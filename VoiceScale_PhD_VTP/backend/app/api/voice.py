"""
VoiceCare PHC — Voice API router
File: backend/app/api/voice.py

Register in backend/app/main.py:
    from app.api import voice
    app.include_router(voice.router, prefix=f"{settings.API_V1_PREFIX}", tags=["Voice"])

Required in backend/.env:
    VOICE_API_URL=https://your-ngrok-url.ngrok-free.app
"""

import httpx
import logging
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.core.config import get_settings

router    = APIRouter()
_settings = get_settings()
logger    = logging.getLogger("voicecare.voice")

# Shared async HTTP client — long timeout because GPU inference can be slow
_client = httpx.AsyncClient(timeout=120.0)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _colab(path: str) -> str:
    """Build absolute URL to the Colab API endpoint."""
    base = getattr(_settings, "VOICE_API_URL", "").rstrip("/")
    if not base:
        raise HTTPException(
            status_code=503,
            detail=(
                "VOICE_API_URL is not set. "
                "Add VOICE_API_URL=<ngrok-url> to backend/.env and restart FastAPI."
            ),
        )
    return f"{base}/{path.lstrip('/')}"


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class TranslateRequest(BaseModel):
    text: str
    src_language: str = "Telugu"
    direction: str = "to_english"   # "to_english" | "to_local"


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/voice/health")
async def voice_health():
    """Proxy health-check to the Colab API so the frontend can verify connectivity."""
    try:
        resp = await _client.get(_colab("/health"))
        return resp.json()
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail=f"Colab API unreachable: {exc}")


@router.post("/voice/process")
async def voice_process(
    audio_file: UploadFile = File(..., description="WAV / MP3 / WebM audio blob"),
    language:   str        = Form("Telugu", description="UI language name, e.g. 'Telugu'"),
):
    """
    Receive browser audio, forward to the Colab GPU API, and return:
      - local_transcript   — transcribed text in the patient's language
      - english_transcript — English translation via IndicTrans2
      - local_audio_b64    — gTTS MP3 of local transcript (base64)
      - english_audio_b64  — gTTS MP3 of English transcript (base64)
    """
    audio_bytes = await audio_file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file received.")

    logger.info(
        "voice_process: received audio — filename=%s, content_type=%s, size=%d bytes, language=%s",
        audio_file.filename, audio_file.content_type, len(audio_bytes), language,
    )

    colab_url = _colab("/voice-process")
    logger.info("voice_process: forwarding to Colab → %s", colab_url)

    try:
        resp = await _client.post(
            colab_url,
            files={
                "audio_file": (
                    audio_file.filename or "audio.webm",
                    audio_bytes,
                    audio_file.content_type or "audio/webm",
                )
            },
            data={"language": language},
        )
    except httpx.RequestError as exc:
        logger.error("voice_process: Colab unreachable — %s", exc)
        raise HTTPException(status_code=503, detail=f"Colab API unreachable: {exc}")

    logger.info("voice_process: Colab responded HTTP %d", resp.status_code)
    logger.debug("voice_process: raw Colab response body (first 1000 chars): %s", resp.text[:1000])

    if resp.status_code != 200:
        logger.error("voice_process: Colab error %d — %s", resp.status_code, resp.text[:500])
        raise HTTPException(
            status_code=502,
            detail=f"Colab API error {resp.status_code}: {resp.text}",
        )

    data = resp.json()

    # Normalize: ensure the frontend always gets { success: true, ... }
    # regardless of whether the Colab API includes a "success" field.
    if isinstance(data, dict) and "success" not in data:
        data["success"] = True

    # Ensure required transcript fields are always present (even if empty strings)
    data.setdefault("local_transcript",   "")
    data.setdefault("english_transcript", "")
    data.setdefault("local_audio_b64",    "")
    data.setdefault("english_audio_b64",  "")
    data.setdefault("language",           language)

    logger.info(
        "voice_process: returning — local_transcript=%r, english_transcript=%r, "
        "local_audio_b64_len=%d, english_audio_b64_len=%d",
        data["local_transcript"][:120],
        data["english_transcript"][:120],
        len(data["local_audio_b64"]),
        len(data["english_audio_b64"]),
    )

    return data


@router.post("/voice/translate")
async def voice_translate(body: TranslateRequest):
    """
    Translate text between a local Indic language and English via IndicTrans2.
    direction: "to_english"  — Indic to English
    direction: "to_local"    — English to Indic
    """
    try:
        resp = await _client.post(
            _colab("/translate-text"),
            json={
                "text":         body.text,
                "src_language": body.src_language,
                "direction":    body.direction,
            },
        )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail=f"Colab API unreachable: {exc}")

    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Colab API error {resp.status_code}: {resp.text}",
        )

    return resp.json()