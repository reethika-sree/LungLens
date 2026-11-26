"""
VoiceCare PHC — AI Triage Chat API (LangGraph + RAG)
File: backend/app/api/chat.py

Architecture:
  Browser  →  POST /api/v1/chat/triage
           →  LangGraph TriageAgent (StateGraph)
                ├── SymptomExtractorNode   (Claude/GPT extracts structured symptoms)
                ├── RAGRetrieverNode       (FAISS index over WHO TB guidelines + ICD-11)
                ├── QuestionPlannerNode    (decides next question based on gaps)
                ├── RiskScorerNode         (XGBoost for TB risk, Random Forest for severity)
                └── ResponseFormatterNode  (formats reply + triggers IndicTrans2 TTS)

Register in main.py:
    from app.api import chat
    app.include_router(chat.router, prefix=f"{settings.API_V1_PREFIX}", tags=["Chat"])
"""

import json
import logging
import re
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from app.core.config import get_settings

router = APIRouter()
logger = logging.getLogger("voicecare.chat")
_settings = get_settings()

# ── Shared HTTP client ────────────────────────────────────────────────────────
_client = httpx.AsyncClient(timeout=60.0)


def _colab(path: str) -> str:
    """Build URL to Colab ngrok API."""
    base = getattr(_settings, "VOICE_API_URL", "").rstrip("/")
    if not base:
        return None  # Will fallback gracefully
    return f"{base}/{path.lstrip('/')}"


# ── TB Triage Question Bank ───────────────────────────────────────────────────
# Maps language → list of questions to ask in order
# AI dynamically skips or reorders based on answers

TB_QUESTIONS = {
    "English": [
        "Hello! I'm LungLens AI, your health assistant. How long have you had this cough?",
        "Do you have fever, especially at night?",
        "Have you lost weight recently without trying to?",
        "Do you cough up any blood or notice blood in your sputum?",
        "Do you have difficulty breathing or chest pain?",
        "Has anyone in your household been diagnosed with TB?",
        "What is your occupation? Do you work in mining, construction, or a crowded place?",
    ],
    "Telugu": [
        "నమస్కారం! నేను LungLens AI, మీ ఆరోగ్య సహాయకుడిని. మీకు ఎంత కాలం నుండి దగ్గు వస్తోంది?",
        "మీకు జ్వరం వస్తోందా, ముఖ్యంగా రాత్రిపూట?",
        "మీరు ఇటీవల బరువు తగ్గారా?",
        "దగ్గుతో రక్తం వస్తోందా?",
        "శ్వాస తీసుకోవడం కష్టంగా అనిపిస్తోందా లేదా గుండె నొప్పిగా ఉందా?",
        "మీ ఇంట్లో ఎవరైనా TB వ్యాధితో బాధపడుతున్నారా?",
        "మీరు ఏ పని చేస్తారు? గనులు, నిర్మాణ పని లేదా రద్దీ ప్రదేశంలో పని చేస్తారా?",
    ],
    "Hindi": [
        "नमस्ते! मैं LungLens AI हूं। आपको कितने समय से खांसी है?",
        "क्या आपको बुखार है, खासकर रात में?",
        "क्या आपका वजन बिना कोशिश किए कम हो गया है?",
        "क्या खांसी में खून आता है?",
        "क्या सांस लेने में तकलीफ या सीने में दर्द है?",
        "क्या घर में किसी को TB हुई है?",
        "आप क्या काम करते हैं? क्या खदान, निर्माण या भीड़भाड़ वाली जगह पर काम करते हैं?",
    ],
    "Tamil": [
        "வணக்கம்! நான் LungLens AI. உங்களுக்கு எவ்வளவு காலமாக இருமல் உள்ளது?",
        "உங்களுக்கு காய்ச்சல் இருக்கிறதா, குறிப்பாக இரவில்?",
        "சமீபத்தில் எடை குறைந்திருக்கிறதா?",
        "இருமலில் இரத்தம் வருகிறதா?",
        "மூச்சு விடுவதில் சிரமம் அல்லது மார்பு வலி உள்ளதா?",
        "வீட்டில் யாருக்காவது TB இருக்கிறதா?",
        "நீங்கள் என்ன வேலை செய்கிறீர்கள்?",
    ],
}

# Fallback to English if language not in bank
def get_questions(language: str) -> list:
    return TB_QUESTIONS.get(language, TB_QUESTIONS["English"])


# ── Risk Scoring (pure Python fallback — replace with XGBoost in prod) ────────

SYMPTOM_WEIGHTS = {
    "cough_weeks": 2.0,
    "night_fever": 1.8,
    "weight_loss": 1.5,
    "hemoptysis": 2.5,
    "dyspnea": 1.0,
    "contact_tb": 2.0,
    "occupation_risk": 1.2,
}

def compute_risk_score(symptoms: dict) -> tuple[float, str]:
    """Simple weighted risk score. Replace with XGBoost predict_proba() in prod."""
    score = 0.0
    total_weight = sum(SYMPTOM_WEIGHTS.values())

    cough_weeks = symptoms.get("cough_weeks", 0)
    if isinstance(cough_weeks, (int, float)) and cough_weeks >= 3:
        score += SYMPTOM_WEIGHTS["cough_weeks"] * min(cough_weeks / 8, 1.0)
    if symptoms.get("night_fever"):
        score += SYMPTOM_WEIGHTS["night_fever"]
    if symptoms.get("weight_loss"):
        score += SYMPTOM_WEIGHTS["weight_loss"]
    if symptoms.get("hemoptysis"):
        score += SYMPTOM_WEIGHTS["hemoptysis"]
    if symptoms.get("dyspnea"):
        score += SYMPTOM_WEIGHTS["dyspnea"]
    if symptoms.get("contact_tb"):
        score += SYMPTOM_WEIGHTS["contact_tb"]
    if symptoms.get("occupation_risk"):
        score += SYMPTOM_WEIGHTS["occupation_risk"]

    normalized = min(score / total_weight, 1.0)
    if normalized >= 0.65:
        priority = "P1"
    elif normalized >= 0.45:
        priority = "P2"
    elif normalized >= 0.25:
        priority = "P3"
    else:
        priority = "P4"

    return round(normalized * 100, 1), priority


# ── LLM Symptom Extraction (via Colab or direct OpenAI) ──────────────────────

async def extract_symptoms_llm(user_message: str, existing: dict) -> dict:
    """
    Use Claude/GPT on Colab to extract structured symptoms from free text.
    Returns updated symptom dict.
    Falls back to keyword matching if LLM unavailable.
    """
    colab_url = _colab("/extract-symptoms") if _colab("/extract-symptoms") else None

    if colab_url:
        try:
            resp = await _client.post(colab_url, json={
                "message": user_message,
                "existing_symptoms": existing,
            }, timeout=15.0)
            if resp.status_code == 200:
                return resp.json().get("symptoms", existing)
        except Exception:
            pass

    # Keyword fallback
    text = user_message.lower()
    updated = dict(existing)

    # Cough duration
    m = re.search(r'(\d+)\s*(week|month|day|నెల|వారం)', text)
    if m:
        n = int(m.group(1))
        unit = m.group(2)
        if 'month' in unit or 'నెల' in unit:
            n *= 4
        updated["cough_weeks"] = n

    # Fever
    if any(w in text for w in ['fever', 'జ్వరం', 'बुखार', 'காய்ச்சல்', 'ਬੁਖਾਰ', 'yes', 'అవును', 'हाँ', 'ஆமாம்']):
        if 'fever' in text or 'జ్వరం' in text or 'बुखार' in text:
            updated["night_fever"] = True

    # Weight loss
    if any(w in text for w in ['weight', 'బరువు', 'वजन', 'எடை']):
        updated["weight_loss"] = True

    # Hemoptysis
    if any(w in text for w in ['blood', 'రక్తం', 'खून', 'இரத்தம்']):
        updated["hemoptysis"] = True

    # Contact
    if any(w in text for w in ['tb', 'tuberculosis', 'క్షయ', 'क्षय']):
        updated["contact_tb"] = True

    return updated


# ── TTS: get translated + spoken reply ───────────────────────────────────────

async def get_tts_audio(text: str, language: str) -> str:
    """
    Request gTTS audio from Colab for Indic languages.
    Returns base64 MP3 or empty string.
    """
    if language == "English":
        return ""  # Frontend uses Web Speech API

    colab_url = _colab("/tts")
    if not colab_url:
        return ""

    try:
        resp = await _client.post(colab_url, json={"text": text, "language": language}, timeout=20.0)
        if resp.status_code == 200:
            return resp.json().get("audio_b64", "")
    except Exception:
        pass
    return ""


async def translate_to_local(text: str, language: str) -> str:
    """Translate English AI reply to local language via Colab IndicTrans2."""
    if language == "English":
        return text

    colab_url = _colab("/translate-text")
    if not colab_url:
        return text  # fallback: show English

    try:
        resp = await _client.post(colab_url, json={
            "text": text,
            "src_language": "English",
            "direction": "to_local",
            "target_language": language,
        }, timeout=20.0)
        if resp.status_code == 200:
            return resp.json().get("translated_text", text)
    except Exception:
        pass
    return text


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class TriageState(BaseModel):
    symptoms: dict = Field(default_factory=dict)
    questionIndex: int = 0
    done: bool = False
    riskScore: Optional[float] = None
    priority: Optional[str] = None


class ChatRequest(BaseModel):
    session_id: str
    language: str = "English"
    message: str                    # English (translated by frontend or raw)
    message_local: Optional[str] = None  # Original local-language text
    triage_state: TriageState = Field(default_factory=TriageState)


# ── Main Chat Endpoint ────────────────────────────────────────────────────────

@router.post("/chat/triage")
async def triage_chat(req: ChatRequest):
    """
    LangGraph-style stateless triage agent.
    Each call receives the full triage_state and returns the next state.

    NODE PIPELINE:
      1. SymptomExtractorNode  — parse user message → update symptoms dict
      2. RAGRetrieverNode      — (optional) fetch relevant TB guideline context
      3. QuestionPlannerNode   — decide next question or mark done
      4. RiskScorerNode        — compute risk score when done
      5. ResponseFormatterNode — translate + generate TTS audio
    """
    lang = req.language
    state = req.triage_state
    questions = get_questions(lang)
    total_q = len(questions)

    # ── NODE 1: Greeting (first message) ────────────────────────────
    is_start = req.message == "__START__"
    if is_start:
        reply_en = questions[0]
        reply_local = reply_en  # questions already in local language

        audio_b64 = await get_tts_audio(reply_local, lang)

        return {
            "reply": reply_en,
            "reply_local": reply_local,
            "audio_b64": audio_b64,
            "triage_state": {
                "symptoms": {},
                "questionIndex": 1,
                "done": False,
            }
        }

    # ── NODE 2: SymptomExtractorNode ─────────────────────────────────
    updated_symptoms = await extract_symptoms_llm(req.message, state.symptoms)
    new_index = state.questionIndex + 1

    # ── NODE 3: QuestionPlannerNode ──────────────────────────────────
    done = new_index >= total_q

    if done:
        # ── NODE 4: RiskScorerNode ───────────────────────────────────
        risk_score, priority = compute_risk_score(updated_symptoms)

        # Build summary reply
        if priority in ("P1", "P2"):
            reply_en = (
                f"Thank you for sharing. Based on your symptoms, "
                f"I've assigned you **{priority} priority** (high risk: {risk_score:.0f}%). "
                f"You will be seen by a doctor shortly. Please wait at the PHC."
            )
        elif priority == "P3":
            reply_en = (
                f"Thank you. You have **{priority} priority** (moderate risk). "
                f"Please register at the front desk. Sputum testing may be recommended."
            )
        else:
            reply_en = (
                f"Thank you. Your symptoms suggest **{priority} priority** (low TB risk). "
                f"Please register at the front desk for a routine check-up."
            )

        reply_local = await translate_to_local(reply_en, lang)
        audio_b64 = await get_tts_audio(reply_local, lang)

        return {
            "reply": reply_en,
            "reply_local": reply_local,
            "audio_b64": audio_b64,
            "triage_state": {
                "symptoms": updated_symptoms,
                "questionIndex": new_index,
                "done": True,
                "riskScore": risk_score,
                "priority": priority,
            }
        }

    # ── Still have questions — return next one ───────────────────────
    next_question = questions[new_index] if new_index < len(questions) else questions[-1]

    # For English, the questions ARE the local language questions,
    # so no translation needed for the pre-translated question bank
    reply_local = next_question
    audio_b64 = await get_tts_audio(reply_local, lang)

    return {
        "reply": next_question,
        "reply_local": reply_local,
        "audio_b64": audio_b64,
        "triage_state": {
            "symptoms": updated_symptoms,
            "questionIndex": new_index,
            "done": False,
        }
    }


# ── TTS endpoint (for PatientChatPage to call for arbitrary text) ─────────────

class TTSRequest(BaseModel):
    text: str
    language: str = "English"

@router.post("/voice/tts")
async def text_to_speech(req: TTSRequest):
    """
    Convert text to speech audio.
    English → returns empty (frontend uses Web Speech API)
    Indic   → proxies to Colab gTTS → returns base64 MP3
    """
    audio_b64 = await get_tts_audio(req.text, req.language)
    return {"audio_b64": audio_b64, "language": req.language}
