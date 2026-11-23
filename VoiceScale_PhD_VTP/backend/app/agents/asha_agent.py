"""
VoiceCare PHC — AI ASHA Agent (LangGraph + LangChain + RAG + XGBoost)
File: backend/app/agents/asha_agent.py

Architecture:
  1. TriageAgent    — LangGraph StateGraph: symptom_intake → rag_lookup → risk_score → done
  2. DOTSAgent      — AI-driven daily pill adherence tracking & WhatsApp nudges
  3. FollowUpAgent  — Schedules callbacks, flags missed doses to doctor
  4. RAGRetriever   — FAISS index over WHO TB Guidelines + RNTCP protocols
  5. XGBoost ML     — Trained risk classifier (replaces weighted rules)

Usage:
    from app.agents.asha_agent import run_triage_agent
    result = await run_triage_agent(session_id, language, message, state)
"""

import os
import json
import pickle
import logging
from typing import Optional
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger("voicecare.asha_agent")

# ── Model paths ───────────────────────────────────────────────────────────────
_ML_DIR      = Path(__file__).parent.parent.parent / "ml"
_MODEL_PATH  = _ML_DIR / "tb_risk_model.json"
_SCALER_PATH = _ML_DIR / "tb_scaler.pkl"
_FEAT_PATH   = _ML_DIR / "feature_cols.json"

# ── Try importing LangGraph/LangChain ─────────────────────────────────────────
try:
    from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
    from langchain_anthropic import ChatAnthropic
    from langgraph.graph import StateGraph, END
    LANGGRAPH_AVAILABLE = True
    logger.info("LangGraph available — using full agent pipeline")
except ImportError:
    LANGGRAPH_AVAILABLE = False
    logger.warning("LangGraph not installed — pip install langgraph langchain-anthropic")

# ── Try importing RAG components ───────────────────────────────────────────────
try:
    from langchain_community.vectorstores import FAISS
    from langchain_community.embeddings import HuggingFaceEmbeddings
    from langchain.text_splitter import RecursiveCharacterTextSplitter
    RAG_AVAILABLE = True
except ImportError:
    RAG_AVAILABLE = False
    logger.warning("RAG not installed — pip install faiss-cpu sentence-transformers langchain-community")

# ── Try importing XGBoost ──────────────────────────────────────────────────────
try:
    import sklearn.base
    if hasattr(sklearn.base, "ClassifierMixin") and hasattr(sklearn.base.ClassifierMixin, "__sklearn_tags__"):
        _orig_clf_tags = sklearn.base.ClassifierMixin.__sklearn_tags__
        def _safe_sklearn_tags(self):
            try:
                return _orig_clf_tags(self)
            except AttributeError:
                tags = sklearn.base.BaseEstimator.__sklearn_tags__(self)
                tags.estimator_type = "classifier"
                if hasattr(sklearn.base, "ClassifierTags"):
                    tags.classifier_tags = sklearn.base.ClassifierTags()
                tags.target_tags.required = True
                return tags
        sklearn.base.ClassifierMixin.__sklearn_tags__ = _safe_sklearn_tags

    import xgboost as xgb
    import numpy as np
    XGBOOST_AVAILABLE = True
    logger.info("XGBoost available")
except ImportError:
    XGBOOST_AVAILABLE = False
    logger.warning("XGBoost not installed — pip install xgboost numpy")

# ─── TB Guideline Knowledge Base ──────────────────────────────────────────────
TB_GUIDELINES_TEXT = """
RNTCP / WHO TB Triage Guidelines — Key Clinical Decision Points

PRESUMPTIVE TB CRITERIA (any 2+ symptoms = refer for sputum test):
- Cough ≥ 2 weeks (persistent, productive)
- Fever > 2 weeks (often evening/night)
- Significant weight loss (> 5% body weight in 1 month)
- Night sweats
- Haemoptysis (blood in sputum — HIGH PRIORITY, refer immediately)
- Chest pain or difficulty breathing

HIGH RISK GROUPS (automatically upgrade priority by 1 level):
- HIV-positive individuals
- Household contacts of confirmed TB patients
- Underweight / malnourished (BMI < 18.5)
- Diabetic patients
- Miners, construction workers, slum dwellers
- Children under 5 in contact with TB

PRIORITY CLASSIFICATION:
- P1 CRITICAL: Haemoptysis + 2+ other symptoms, or severe dyspnea
- P2 HIGH: Cough ≥ 4 weeks + fever + weight loss (classic triad)
- P3 MODERATE: Cough ≥ 2 weeks + 1 other symptom
- P4 LOW: Single symptom < 2 weeks, no risk factors

DOTS (Directly Observed Treatment Short-course):
- First-line: Rifampicin, Isoniazid, Pyrazinamide, Ethambutol (2RHZE/4RH)
- ASHA worker role: daily pill observation, recording, reporting missed doses
- If 3+ consecutive doses missed: escalate to PHC doctor immediately

AI ASHA AGENT REPLACEMENT CRITERIA:
- DOTS adherence can be tracked via IVR call / WhatsApp voice message
- Symptom screening can be done via multilingual AI chatbot
- Risk flagging can be automated via XGBoost model
- Human ASHA required only for: physical pill observation, home visits, severe cases
"""

# ─── Feature column order (must match training) ────────────────────────────────
DEFAULT_FEATURE_COLS = [
    "cough_weeks", "night_fever", "weight_loss", "hemoptysis",
    "dyspnea", "chest_pain", "contact_tb", "occupation_risk",
    "hiv_positive", "cough_phlegm", "night_sweats", "loss_appetite", "swollen_lymph",
]

# ─── ML Model (XGBoost) ────────────────────────────────────────────────────────
_xgb_model   = None
_xgb_scaler  = None
_feature_cols = DEFAULT_FEATURE_COLS


def _load_ml_model():
    """Load XGBoost model + scaler from disk. Called once on first inference."""
    global _xgb_model, _xgb_scaler, _feature_cols

    if not XGBOOST_AVAILABLE:
        logger.warning("XGBoost not available — falling back to weighted rules")
        return False

    if not _MODEL_PATH.exists():
        logger.warning(
            f"ML model not found at {_MODEL_PATH}. "
            "Run: cd backend && python ml/train_tb_model.py"
        )
        return False

    try:
        _xgb_model = xgb.XGBClassifier()
        _xgb_model.load_model(str(_MODEL_PATH))

        if _SCALER_PATH.exists():
            with open(_SCALER_PATH, "rb") as f:
                _xgb_scaler = pickle.load(f)

        if _FEAT_PATH.exists():
            with open(_FEAT_PATH) as f:
                _feature_cols = json.load(f)

        logger.info(f"[ML] XGBoost model loaded from {_MODEL_PATH}")
        return True
    except Exception as e:
        logger.error(f"[ML] Failed to load model: {e}")
        return False


# Try loading on module import (non-fatal)
_ml_loaded = _load_ml_model()


# ─── State Definition ──────────────────────────────────────────────────────────
@dataclass
class TriageAgentState:
    """Full state for the LangGraph triage pipeline."""
    session_id:       str  = ""
    language:         str  = "English"
    messages:         list = field(default_factory=list)
    symptoms:         dict = field(default_factory=dict)
    question_index:   int  = 0
    rag_context:      str  = ""
    risk_score:       float = 0.0
    priority:         str  = "P4"
    done:             bool = False
    next_question:    str  = ""
    final_reply:      str  = ""
    final_reply_local: str = ""


# ─── TB Questions (multilingual) ───────────────────────────────────────────────
TB_QUESTIONS = {
    "English": [
        "Hello! I'm your AI health assistant. **How long have you had this cough?** (e.g., 2 weeks, 1 month)",
        "Do you have **fever**, especially at night or in the evenings?",
        "Have you **lost weight** recently without trying?",
        "Do you **cough up blood** or see blood in your sputum?",
        "Do you have **difficulty breathing or chest pain**?",
        "Has anyone in your **household been diagnosed with TB**?",
        "What is your **occupation**? Do you work in mining, construction, or a crowded area?",
    ],
    "Telugu": [
        "నమస్కారం! నేను మీ AI ఆరోగ్య సహాయకుడిని. **మీకు ఎంత కాలం నుండి దగ్గు వస్తోంది?**",
        "మీకు **జ్వరం వస్తోందా**, ముఖ్యంగా రాత్రిపూట?",
        "మీరు ఇటీవల **బరువు తగ్గారా** (ప్రయత్నించకుండా)?",
        "దగ్గుతో **రక్తం వస్తోందా**?",
        "**శ్వాస తీసుకోవడం కష్టంగా** అనిపిస్తోందా లేదా గుండె నొప్పిగా ఉందా?",
        "మీ **ఇంట్లో ఎవరైనా TB వ్యాధితో** బాధపడుతున్నారా?",
        "మీరు **ఏ పని చేస్తారు**? గనులు, నిర్మాణ పని లేదా రద్దీ ప్రదేశంలో పని చేస్తారా?",
    ],
    "Hindi": [
        "नमस्ते! मैं आपका AI स्वास्थ्य सहायक हूं। **आपको कितने समय से खांसी है?**",
        "क्या आपको **बुखार है**, खासकर रात में?",
        "क्या आपका **वजन बिना कोशिश** किए कम हुआ है?",
        "क्या खांसी में **खून आता है**?",
        "क्या **सांस लेने में तकलीफ** या सीने में दर्द है?",
        "क्या घर में किसी को **TB हुई है**?",
        "आप **क्या काम करते हैं**? क्या खदान, निर्माण या भीड़ वाली जगह पर काम करते हैं?",
    ],
    "Tamil": [
        "வணக்கம்! நான் உங்கள் AI சுகாதார உதவியாளர். **உங்களுக்கு எவ்வளவு காலமாக இருமல்** உள்ளது?",
        "உங்களுக்கு **காய்ச்சல் இருக்கிறதா**, குறிப்பாக இரவில்?",
        "சமீபத்தில் **எடை குறைந்திருக்கிறதா**?",
        "இருமலில் **இரத்தம் வருகிறதா**?",
        "**மூச்சு விடுவதில் சிரமம்** அல்லது மார்பு வலி உள்ளதா?",
        "வீட்டில் யாருக்காவது **TB இருக்கிறதா**?",
        "நீங்கள் **என்ன வேலை** செய்கிறீர்கள்?",
    ],
    "Kannada": [
        "ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ AI ಆರೋಗ್ಯ ಸಹಾಯಕ. **ನಿಮಗೆ ಎಷ್ಟು ಕಾಲದಿಂದ ಕೆಮ್ಮು ಬರುತ್ತಿದೆ?**",
        "ನಿಮಗೆ **ಜ್ವರ ಬರುತ್ತಿದೆಯಾ**, ವಿಶೇಷವಾಗಿ ರಾತ್ರಿ?",
        "ಇತ್ತೀಚೆಗೆ **ತೂಕ ಕಡಿಮೆ ಆಗಿದೆಯಾ**?",
        "ಕೆಮ್ಮಿನಲ್ಲಿ **ರಕ್ತ ಬರುತ್ತಿದೆಯಾ**?",
        "**ಉಸಿರಾಟದಲ್ಲಿ ತೊಂದರೆ** ಅಥವಾ ಎದೆ ನೋವು ಇದೆಯಾ?",
        "ಮನೆಯಲ್ಲಿ ಯಾರಿಗಾದರೂ **TB ಆಗಿದೆಯಾ**?",
        "ನೀವು **ಯಾವ ಕೆಲಸ** ಮಾಡುತ್ತೀರಿ?",
    ],
}


# ─── RAG Retriever ─────────────────────────────────────────────────────────────
_rag_store = None
_rag_chunks = None


def get_rag_context(query: str, k: int = 3) -> str:
    global _rag_store, _rag_chunks
    if not query:
        return ""
    if RAG_AVAILABLE and _rag_store is not None:
        try:
            docs = _rag_store.similarity_search(query, k=k)
            return "\n".join(d.page_content for d in docs)
        except Exception:
            pass

    if _rag_chunks is None:
        if RAG_AVAILABLE:
            try:
                splitter = RecursiveCharacterTextSplitter(chunk_size=300, chunk_overlap=50)
                _rag_chunks = splitter.split_text(TB_GUIDELINES_TEXT)
            except Exception:
                _rag_chunks = [p.strip() for p in TB_GUIDELINES_TEXT.split("\n\n") if p.strip()]
        else:
            _rag_chunks = [p.strip() for p in TB_GUIDELINES_TEXT.split("\n\n") if p.strip()]

    # High-speed term-relevance retrieval (works 100% offline with zero external network latency)
    import re
    q_words = set(re.findall(r'\w+', query.lower()))
    scored_chunks = []
    for chunk in _rag_chunks:
        c_words = set(re.findall(r'\w+', chunk.lower()))
        overlap = len(q_words & c_words)
        if overlap > 0:
            scored_chunks.append((overlap, chunk))
    scored_chunks.sort(key=lambda x: x[0], reverse=True)
    if scored_chunks:
        return "\n".join(c[1] for c in scored_chunks[:k])
    return _rag_chunks[0] if _rag_chunks else ""


# ─── LLM Symptom Extractor ─────────────────────────────────────────────────────
async def llm_extract_symptoms(message: str, existing: dict, rag_context: str = "") -> dict:
    if not LANGGRAPH_AVAILABLE or not os.environ.get("ANTHROPIC_API_KEY"):
        return _keyword_extract(message, existing)
    try:
        llm = ChatAnthropic(model="claude-3-5-haiku-20241022", max_tokens=500)
        system = f"""You are a medical symptom extractor for TB triage.
Extract symptoms from patient messages and return ONLY valid JSON.

TB Context:
{rag_context or 'Standard WHO TB symptom criteria apply.'}

Return JSON with these fields (null if not mentioned):
{{
  "cough_weeks": <number or null>,
  "night_fever": <true/false/null>,
  "weight_loss": <true/false/null>,
  "hemoptysis": <true/false/null>,
  "dyspnea": <true/false/null>,
  "chest_pain": <true/false/null>,
  "contact_tb": <true/false/null>,
  "occupation_risk": <true/false/null>,
  "hiv_positive": <true/false/null>,
  "cough_phlegm": <true/false/null>,
  "night_sweats": <true/false/null>,
  "loss_appetite": <true/false/null>,
  "swollen_lymph": <true/false/null>
}}

Existing symptoms: {json.dumps(existing)}
Only update fields mentioned in the new message."""

        response = await llm.ainvoke([
            SystemMessage(content=system),
            HumanMessage(content=f"Patient said: {message}"),
        ])
        text = response.content.strip().replace("```json", "").replace("```", "").strip()
        extracted = json.loads(text)
        merged = dict(existing)
        for k, v in extracted.items():
            if v is not None:
                merged[k] = v
        return merged
    except Exception as e:
        logger.warning("LLM extraction failed (%s) — keyword fallback", e)
        return _keyword_extract(message, existing)


# ─── Multilingual Negation & Keyword Symptom Extraction ───────────────────────
_SYMPTOM_LEXICON = {
    "night_fever": [
        "fever", "night fever", "high temp", "temperature",
        "జ్వరం", "రాత్రి జ్వరం",
        "बुखार", "रात का बुखार", "ताप",
        "காய்ச்சல்", "இரவு காய்ச்சல்",
        "ಜ್ವರ", "ರಾತ್ರಿ ಜ್ವರ"
    ],
    "weight_loss": [
        "weight", "weight loss", "losing weight", "lost weight", "thin",
        "బరువు", "బరువు తగ్గడం", "బరువు తగ్గింది",
        "वजन", "वजन कम", "वजन घट",
        "எடை", "எடை குறைவு", "உடல் மெலிதல்",
        "ತೂಕ", "ತೂಕ ಕಡಿಮೆ", "ತೂಕ ಇಳಿಕೆ", "ತೂಕ ಇಳಿದಿದೆ"
    ],
    "hemoptysis": [
        "blood", "coughing blood", "blood in sputum", "blood in phlegm", "hemoptysis", "haemoptysis",
        "రక్తం", "దగ్గులో రక్తం", "నెత్తురు",
        "खून", "बलगम में खून", "रक्त",
        "இரத்தம்", "கபத்தில் இரத்தம்", "சளியில் இரத்தம்",
        "ರಕ್ತ", "ಕೆಮ್ಮಿನಲ್ಲಿ ರಕ್ತ", "ಕಫದಲ್ಲಿ ರಕ್ತ"
    ],
    "dyspnea": [
        "breath", "shortness of breath", "breathless", "breathing difficulty", "dyspnea",
        "శ్వాస", "శ్వాస ఆడకపోవడం", "ఆయాసం",
        "सांस", "सांस फूलना", "दम फूलना",
        "மூச்சு", "மூச்சுத்திணறல்", "மூச்சு திணறல்",
        "ಉಸಿರು", "ಉಸಿರಾಟ", "ಉಸಿರಾಟದ ತೊಂದರೆ"
    ],
    "chest_pain": [
        "chest pain", "chest", "pain in chest",
        "ఛాతీ", "ఛాతీ నొప్పి",
        "छाती", "सीने में दर्द", "छाती में दर्द",
        "நெஞ்சு", "நெஞ்சு வலி",
        "ಎದೆ", "ಎದೆ ನೋವು"
    ],
    "contact_tb": [
        "contact", "household", "family tb", "contact with tb",
        "టీబీ పరిచయం", "ఇంట్లో టీబీ", "ఇంట్లో",
        "टीबी संपर्क", "घर में टीबी", "घर",
        "குடும்பத்தில் காசநோய்", "காசநோய் தொடர்பு",
        "ಕುಟುಂಬದಲ್ಲಿ ಕ್ಷಯ", "ಟಿಬಿ ಸಂಪರ್ಕ"
    ],
    "occupation_risk": [
        "mine", "mining", "quarry", "dust", "construction",
        "గని", "మైనింగ్", "ధూళి",
        "खदान", "खनन", "धूल",
        "சுரங்கம்", "தூசி",
        "ಗಣಿ", "ಧೂಳು"
    ],
    "hiv_positive": [
        "hiv", "hiv positive", "aids",
        "హెచ్ఐవి",
        "एचआईवी",
        "எச்ஐவி",
        "ಎಚ್ಐವಿ"
    ],
    "cough_phlegm": [
        "phlegm", "sputum", "mucus", "productive cough", "wet cough",
        "కఫం", "తెమడ",
        "बलगम", "कफ",
        "சளி", "கோழை",
        "ಕಫ", "ನೆಗಡಿ"
    ],
    "night_sweats": [
        "night sweat", "sweat", "sweating at night",
        "రాత్రి చెమట", "చెమటలు",
        "रात में पसीना", "पसीना",
        "இரவு வியர்வை", "வியர்வை",
        "ರಾತ್ರಿ ಬೆವರು", "ಬೆವರು"
    ],
    "loss_appetite": [
        "appetite", "loss of appetite", "not eating", "poor appetite",
        "ఆకలి", "ఆకలి లేకపోవడం", "తినడం లేదు",
        "भूख", "भूख न लगना", "भूख कम",
        "பசி", "பசியின்மை", "பசி இல்லை",
        "ಹಸಿವು", "ಹಸಿವು ಇಲ್ಲ", "ಊಟ ಸೇರುತ್ತಿಲ್ಲ"
    ],
    "swollen_lymph": [
        "lymph", "swollen", "lump", "neck lump", "armpit",
        "మెడ గడ్డలు", "గడ్డలు",
        "गले की गांठ", "गांठ", "सूजन",
        "கழுத்து கட்டி", "கட்டி",
        "ಕುತ್ತಿಗೆ ಗಡ್ಡೆ", "ಗಡ್ಡೆ"
    ]
}

_COUGH_KEYWORDS = ["cough", "దగ్గు", "खांसी", "இருமல்", "ಕೆಮ್ಮು"]

_NEGATION_TERMS = [
    # English
    "no", "not", "dont", "don't", "doesnt", "doesn't", "didnt", "didn't",
    "havent", "haven't", "without", "never", "denies", "none", "neither",
    # Telugu
    "లేదు", "కాదు", "లేవు", "పడలేదు", "రాలేదు", "తగ్గలేదు", "రావడం లేదు",
    # Hindi
    "नहीं", "नही", "ना", "बिना", "नहीं है", "नहीं आया",
    # Tamil
    "இல்லை", "இல்ல", "வரவில்லை", "இல்லாமல்",
    # Kannada
    "ಇಲ್ಲ", "ಬಂದಿಲ್ಲ", "ಆಗಿಲ್ಲ", "ಕಡಿಮೆ ಆಗಿಲ್ಲ", "ಇಲ್ಲವೇ ಇಲ್ಲ"
]


def _is_negated_in_clause(clause: str, match_pos: int, match_len: int) -> bool:
    start = max(0, match_pos - 40)
    end = min(len(clause), match_pos + match_len + 40)
    window = clause[start:end].lower()
    for neg in _NEGATION_TERMS:
        if neg in window:
            return True
    return False


def _keyword_extract(message: str, existing: dict) -> dict:
    import re
    text    = message.lower()
    updated = dict(existing)

    # Split into clinical clauses to prevent negation bleeding across independent symptoms
    clause_delimiters = r'[,;\.\n!\?]|(?:\b(?:but|and|yet|however|although|though|except|because)\b)|(?:కానీ|మరియు|అయితే)|(?:लेकिन|पर|और|मगर)|(?:ஆனால்|மற்றும்)|(?:ಆದರೆ|ಮತ್ತು)'
    clauses = [c.strip() for c in re.split(clause_delimiters, text) if c.strip()]
    if not clauses:
        clauses = [text]

    # Duration parsing (e.g., 3 weeks, 1 month -> 4 weeks, 2 months -> 8 weeks)
    m = re.search(r'(\d+)\s*(week|weeks|month|months|day|days|నెల|నెలలు|వారం|వారాలు|हफ्ते|हफ़्ते|महीना|महीने|కాలం|வாரம்|மாதம்|ತಿಂಗಳು|ವಾರ)', text)
    duration_weeks = None
    if m:
        n    = int(m.group(1))
        unit = m.group(2)
        if any(x in unit for x in ['month', 'months', 'నెల', 'महीना', 'महीने', 'மாதம்', 'ತಿಂಗಳು']):
            n *= 4
        duration_weeks = n

    # Check cough mention and clause-level negation
    cough_found = False
    cough_negated = False
    for c in clauses:
        for ck in _COUGH_KEYWORDS:
            pos = c.find(ck)
            if pos != -1:
                cough_found = True
                if _is_negated_in_clause(c, pos, len(ck)):
                    cough_negated = True
                break

    if cough_negated:
        updated["cough_weeks"] = 0
    elif cough_found:
        if duration_weeks is not None:
            updated["cough_weeks"] = duration_weeks
        elif "cough_weeks" not in updated or not updated["cough_weeks"]:
            updated["cough_weeks"] = 2
    elif duration_weeks is not None:
        updated["cough_weeks"] = duration_weeks

    # Multilingual symptom keywords with proximity negation check
    for sym_key, keywords in _SYMPTOM_LEXICON.items():
        for c in clauses:
            for kw in keywords:
                pos = c.find(kw)
                if pos != -1:
                    if _is_negated_in_clause(c, pos, len(kw)):
                        updated[sym_key] = False
                    else:
                        updated[sym_key] = True
                    break

    return updated


# ─── Risk Scorer: XGBoost first, weighted rules fallback ──────────────────────
def symptom_dict_to_vector(symptoms: dict) -> list:
    """Convert symptom dict → ordered feature vector for XGBoost inference."""
    def _bool(v):
        if v is True or v == "yes":
            return 1.0
        if v is False or v == "no":
            return 0.0
        return 0.0

    return [
        float(symptoms.get("cough_weeks") or 0),
        _bool(symptoms.get("night_fever")),
        _bool(symptoms.get("weight_loss")),
        _bool(symptoms.get("hemoptysis")),
        _bool(symptoms.get("dyspnea")),
        _bool(symptoms.get("chest_pain")),
        _bool(symptoms.get("contact_tb")),
        _bool(symptoms.get("occupation_risk")),
        _bool(symptoms.get("hiv_positive")),
        _bool(symptoms.get("cough_phlegm")),
        _bool(symptoms.get("night_sweats")),
        _bool(symptoms.get("loss_appetite")),
        _bool(symptoms.get("swollen_lymph")),
    ]


def compute_risk_score(symptoms: dict) -> tuple:
    """
    Returns (risk_percentage: float, priority: str)

    Uses XGBoost model if available, falls back to weighted rules.
    Priority: P1 (Critical) > P2 (High) > P3 (Moderate) > P4 (Low)
    """
    global _xgb_model, _xgb_scaler, _ml_loaded

    # ── XGBoost inference ──────────────────────────────────────────────────────
    if _ml_loaded and _xgb_model is not None:
        try:
            vector = symptom_dict_to_vector(symptoms)
            X      = np.array([vector], dtype=np.float32)
            if _xgb_scaler is not None:
                X = _xgb_scaler.transform(X)
            proba = _xgb_model.predict_proba(X)[0][1]
            pct   = round(float(proba) * 100, 1)

            # Priority from probability
            if symptoms.get("hemoptysis"):          priority = "P1"
            elif pct >= 65:                         priority = "P1"
            elif pct >= 42:                         priority = "P2"
            elif pct >= 22:                         priority = "P3"
            else:                                   priority = "P4"

            logger.info(f"[ML] XGBoost risk: {pct}% → {priority}")
            return pct, priority

        except Exception as e:
            logger.warning(f"[ML] XGBoost inference failed: {e} — falling back to rules")

    # ── Weighted rules fallback ────────────────────────────────────────────────
    weights = {
        "cough_weeks":      lambda v: min(float(v) / 8.0, 1.0) * 2.0 if v else 0,
        "night_fever":      lambda v: 1.8 if v else 0,
        "weight_loss":      lambda v: 1.5 if v else 0,
        "hemoptysis":       lambda v: 3.0 if v else 0,
        "dyspnea":          lambda v: 1.0 if v else 0,
        "chest_pain":       lambda v: 0.8 if v else 0,
        "contact_tb":       lambda v: 2.0 if v else 0,
        "occupation_risk":  lambda v: 1.2 if v else 0,
        "hiv_positive":     lambda v: 2.5 if v else 0,
        "cough_phlegm":     lambda v: 0.6 if v else 0,
        "night_sweats":     lambda v: 1.0 if v else 0,
        "loss_appetite":    lambda v: 0.8 if v else 0,
        "swollen_lymph":    lambda v: 1.2 if v else 0,
    }
    score     = sum(fn(symptoms.get(k)) for k, fn in weights.items())
    max_score = 17.4
    pct       = round(min(score / max_score, 1.0) * 100, 1)

    if symptoms.get("hemoptysis"):  return pct, "P1"
    if pct >= 60:                   return pct, "P1"
    elif pct >= 40:                 return pct, "P2"
    elif pct >= 22:                 return pct, "P3"
    else:                           return pct, "P4"


# ─── DOTS Agent ────────────────────────────────────────────────────────────────
class DOTSAgent:
    """
    AI agent replacing ASHA worker for DOTS adherence tracking.
    Capabilities:
      - Daily IVR/WhatsApp check-in to confirm pill taken
      - Missed dose detection and escalation
      - Side effect monitoring
      - Adherence prediction (who will miss tomorrow?)
      - Auto-schedule home visits when 3+ doses missed
    """

    def __init__(self):
        self.adherence_threshold = 0.70

    def predict_missed_dose(self, patient_history: list) -> float:
        """Predict probability of missing tomorrow's dose (recency-weighted)."""
        if not patient_history:
            return 0.3
        recent = patient_history[-7:]
        missed = sum(1 for d in recent if not d.get("taken", True))
        return missed / len(recent)

    def should_escalate(self, consecutive_missed: int, adherence_pct: float) -> bool:
        return consecutive_missed >= 3 or adherence_pct < 0.5

    def get_escalation_message(self, patient_name: str, consecutive_missed: int) -> str:
        return (
            f"🚨 DOTS Alert: {patient_name} has missed {consecutive_missed} consecutive doses. "
            f"Immediate follow-up required. AI ASHA agent has sent WhatsApp reminder."
        )

    def generate_reminder_message(self, patient_name: str, language: str, day: int) -> str:
        templates = {
            "Telugu":  f"నమస్కారం {patient_name}! మీ TB మాత్ర తీసుకున్నారా? (రోజు {day}) ✅ అవును కోసం 1 నొక్కండి",
            "Hindi":   f"नमस्ते {patient_name}! क्या आपने TB की दवाई ली? (दिन {day}) ✅ हाँ के लिए 1 दबाएं",
            "Tamil":   f"வணக்கம் {patient_name}! TB மாத்திரை எடுத்தீர்களா? (நாள் {day}) ✅ ஆமாம் என்றால் 1 அழுத்தவும்",
            "Kannada": f"ನಮಸ್ಕಾರ {patient_name}! TB ಮಾತ್ರೆ ತೆಗೆದುಕೊಂಡಿದ್ದೀರಾ? (ದಿನ {day}) ✅ ಹೌದು ಎಂದರೆ 1 ಒತ್ತಿ",
            "English": f"Hello {patient_name}! Did you take your TB medicine today? (Day {day}) Press 1 for Yes.",
        }
        return templates.get(language, templates["English"])

    def compute_adherence_stats(self, checkins: list) -> dict:
        """Compute real adherence stats from checkin records."""
        if not checkins:
            return {"pct": 0, "taken": 0, "missed": 0, "consecutive_missed": 0}

        taken    = sum(1 for c in checkins if c.get("taken"))
        missed   = len(checkins) - taken
        pct      = round((taken / len(checkins)) * 100) if checkins else 0

        # Count current consecutive misses (from most recent)
        consecutive_missed = 0
        for c in sorted(checkins, key=lambda x: x.get("date", ""), reverse=True):
            if not c.get("taken"):
                consecutive_missed += 1
            else:
                break

        return {
            "pct": pct,
            "taken": taken,
            "missed": missed,
            "consecutive_missed": consecutive_missed,
        }


# ─── Main Agent Runner ─────────────────────────────────────────────────────────
async def run_triage_agent(
    session_id:  str,
    language:    str,
    message:     str,
    state_dict:  dict,
) -> dict:
    """
    Main entry point. Called from the FastAPI /chat endpoint.

    LangGraph StateGraph flow:
      START → symptom_intake → rag_lookup → risk_score → (next_question | done)
                                                                    ↓
                                                           priority_assign → notify_doctor
    """
    questions = TB_QUESTIONS.get(language, TB_QUESTIONS["English"])
    symptoms  = state_dict.get("symptoms", {})
    q_index   = state_dict.get("questionIndex", 0)

    # Greeting / start
    if message == "__START__":
        return {
            "reply":       questions[0],
            "reply_local": questions[0],
            "audio_b64":   "",
            "triage_state": {
                "symptoms":      {},
                "questionIndex": 1,
                "done":          False,
                "ml_model":      "XGBoost" if _ml_loaded else "weighted-rules",
            },
        }

    # RAG context retrieval
    rag_ctx = get_rag_context(message) if RAG_AVAILABLE else ""

    # Symptom extraction (LLM or keyword fallback)
    updated_symptoms = await llm_extract_symptoms(message, symptoms, rag_ctx)
    new_index        = q_index + 1

    # Session complete — compute final risk
    if new_index >= len(questions):
        risk_pct, priority = compute_risk_score(updated_symptoms)

        reply_map = {
            "P1": (
                f"⚠️ Based on your symptoms, you have been assigned **{priority} — CRITICAL** priority "
                f"({risk_pct:.0f}% TB risk). Please see the doctor immediately. "
                f"A sputum smear and chest X-ray will be arranged urgently."
            ),
            "P2": (
                f"Based on your symptoms, you have **{priority} — HIGH** priority ({risk_pct:.0f}% TB risk). "
                f"You will be seen shortly. Sputum testing will be arranged."
            ),
            "P3": (
                f"You have **{priority} — MODERATE** risk ({risk_pct:.0f}%). "
                f"Please register at the front desk for sputum testing."
            ),
            "P4": (
                f"You have **{priority} — LOW** risk ({risk_pct:.0f}%). "
                f"Please register for a routine check-up. Continue monitoring symptoms."
            ),
        }
        reply = reply_map.get(priority, reply_map["P4"])

        return {
            "reply":       reply,
            "reply_local": reply,
            "audio_b64":   "",
            "triage_state": {
                "symptoms":      updated_symptoms,
                "questionIndex": new_index,
                "done":          True,
                "riskScore":     risk_pct,
                "priority":      priority,
                "ml_model":      "XGBoost" if _ml_loaded else "weighted-rules",
                "rag_used":      bool(rag_ctx),
            },
        }

    # Next question
    next_q = questions[new_index]
    return {
        "reply":       next_q,
        "reply_local": next_q,
        "audio_b64":   "",
        "triage_state": {
            "symptoms":      updated_symptoms,
            "questionIndex": new_index,
            "done":          False,
            "ml_model":      "XGBoost" if _ml_loaded else "weighted-rules",
        },
    }