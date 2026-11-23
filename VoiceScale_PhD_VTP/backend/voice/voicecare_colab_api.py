# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  VoiceCare PHC — Colab GPU API                                               ║
# ║  Paste each ## CELL block as a separate cell in a new Colab notebook.        ║
# ║  Runtime → Change runtime type → T4 GPU  before running.                    ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

# ─────────────────────────────────────────────────────────────────────────────
## CELL 1  —  Install dependencies  (run once per session; ~3 min on T4)
# ─────────────────────────────────────────────────────────────────────────────
"""
!pip install -q \
    flask flask-cors pyngrok \
    openai-whisper \
    sentencepiece sacrebleu \
    transformers accelerate \
    torch torchaudio \
    gtts pydub

!apt-get -qq install -y ffmpeg
"""

# ─────────────────────────────────────────────────────────────────────────────
## CELL 2  —  Clone IndicTransToolkit & install  (skips if already present)
# ─────────────────────────────────────────────────────────────────────────────
"""
import os

if not os.path.exists("IndicTransToolkit"):
    !git clone https://github.com/VarunGumma/IndicTransToolkit.git
    %cd IndicTransToolkit
    !pip install -q -e .
    %cd ..
else:
    print("IndicTransToolkit already cloned — skipping.")
"""

# ─────────────────────────────────────────────────────────────────────────────
## CELL 3  —  Load models (cached on disk after first run; ~5 min cold start)
# ─────────────────────────────────────────────────────────────────────────────
"""
import torch
import whisper
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
from IndicTransToolkit import IndicProcessor

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Device: {DEVICE}")

# Whisper large-v3 ────────────────────────────────────────────────────────────
print("Loading Whisper large-v3 ...")
whisper_model = whisper.load_model("large-v3", device=DEVICE)
print("Whisper ready")

# IndicTrans2 ─────────────────────────────────────────────────────────────────
IT2_EN_INDIC = "ai4bharat/indictrans2-en-indic-1B"
IT2_INDIC_EN = "ai4bharat/indictrans2-indic-en-1B"

print("Loading IndicTrans2 indic→en ...")
tok_indic_en   = AutoTokenizer.from_pretrained(IT2_INDIC_EN, trust_remote_code=True)
model_indic_en = AutoModelForSeq2SeqLM.from_pretrained(IT2_INDIC_EN, trust_remote_code=True).to(DEVICE)

print("Loading IndicTrans2 en→indic ...")
tok_en_indic   = AutoTokenizer.from_pretrained(IT2_EN_INDIC, trust_remote_code=True)
model_en_indic = AutoModelForSeq2SeqLM.from_pretrained(IT2_EN_INDIC, trust_remote_code=True).to(DEVICE)

ip = IndicProcessor(inference=True)
print("All models ready")
"""

# ─────────────────────────────────────────────────────────────────────────────
## CELL 4  —  Language config
# ─────────────────────────────────────────────────────────────────────────────
"""
# Maps UI language name  →  (Flores-200 code,  BCP-47 for Whisper / gTTS)
LANG_MAP = {
    "Telugu":    ("tel_Telu", "te"),
    "Tamil":     ("tam_Taml", "ta"),
    "Hindi":     ("hin_Deva", "hi"),
    "Kannada":   ("kan_Knda", "kn"),
    "Malayalam": ("mal_Mlym", "ml"),
    "Bengali":   ("ben_Beng", "bn"),
    "Marathi":   ("mar_Deva", "mr"),
    "Gujarati":  ("guj_Gujr", "gu"),
    "Punjabi":   ("pan_Guru", "pa"),
    "Odia":      ("ory_Orya", "or"),
    # English passes through without IndicTrans2
    "English":   ("eng_Latn", "en"),
}

def get_flores(lang: str) -> str:
    return LANG_MAP.get(lang, ("tel_Telu", "te"))[0]

def get_bcp47(lang: str) -> str:
    return LANG_MAP.get(lang, ("tel_Telu", "te"))[1]
"""

# ─────────────────────────────────────────────────────────────────────────────
## CELL 5  —  Helper functions
# ─────────────────────────────────────────────────────────────────────────────
"""
import io, base64, tempfile, os
from gtts import gTTS


def transcribe(audio_path: str, language: str = "Telugu") -> str:
    lang_code = get_bcp47(language)
    result = whisper_model.transcribe(audio_path, language=lang_code, task="transcribe")
    return result["text"].strip()


def translate_indic_to_en(text: str, src_lang: str = "Telugu") -> str:
    if src_lang == "English":
        return text
    flores = get_flores(src_lang)
    batch  = ip.preprocess_batch([text], src_lang=flores, tgt_lang="eng_Latn")
    inputs = tok_indic_en(batch, return_tensors="pt", padding=True, truncation=True).to(DEVICE)
    with torch.no_grad():
        out = model_indic_en.generate(**inputs, num_beams=5, max_length=512)
    decoded = tok_indic_en.batch_decode(out, skip_special_tokens=True)
    return ip.postprocess_batch(decoded, lang="eng_Latn")[0]


def translate_en_to_indic(text: str, tgt_lang: str = "Telugu") -> str:
    if tgt_lang == "English":
        return text
    flores = get_flores(tgt_lang)
    batch  = ip.preprocess_batch([text], src_lang="eng_Latn", tgt_lang=flores)
    inputs = tok_en_indic(batch, return_tensors="pt", padding=True, truncation=True).to(DEVICE)
    with torch.no_grad():
        out = model_en_indic.generate(**inputs, num_beams=5, max_length=512)
    decoded = tok_en_indic.batch_decode(out, skip_special_tokens=True)
    return ip.postprocess_batch(decoded, lang=flores)[0]


def tts_to_b64(text: str, lang_code: str = "te") -> str:
    tts = gTTS(text=text, lang=lang_code, slow=False)
    buf = io.BytesIO()
    tts.write_to_fp(buf)
    return base64.b64encode(buf.getvalue()).decode("utf-8")
"""

# ─────────────────────────────────────────────────────────────────────────────
## CELL 6  —  Flask application
# ─────────────────────────────────────────────────────────────────────────────
"""
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


@app.get("/health")
def health():
    return jsonify({
        "status": "healthy",
        "service": "VoiceCare-Colab-API",
        "device": DEVICE,
        "supported_languages": list(LANG_MAP.keys()),
    })


# ── POST /voice-process ───────────────────────────────────────────────────────
# multipart/form-data:
#   audio_file  —  WAV / MP3 / WebM blob
#   language    —  UI language string, e.g. "Telugu"
@app.post("/voice-process")
def voice_process():
    try:
        language   = request.form.get("language", "Telugu")
        audio_file = request.files.get("audio_file")

        if not audio_file:
            return jsonify({"success": False, "error": "No audio_file in request"}), 400

        suffix = "." + (audio_file.filename.rsplit(".", 1)[-1]
                        if "." in audio_file.filename else "wav")
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            audio_file.save(tmp.name)
            tmp_path = tmp.name

        # 1. Transcribe
        local_transcript = transcribe(tmp_path, language)

        # 2. Translate local → English
        english_transcript = translate_indic_to_en(local_transcript, language)

        # 3. TTS
        bcp47             = get_bcp47(language)
        local_audio_b64   = tts_to_b64(local_transcript,   lang_code=bcp47)
        english_audio_b64 = tts_to_b64(english_transcript, lang_code="en")

        os.unlink(tmp_path)

        return jsonify({
            "success":            True,
            "language":           language,
            "local_transcript":   local_transcript,
            "english_transcript": english_transcript,
            "local_audio_b64":    local_audio_b64,
            "english_audio_b64":  english_audio_b64,
        })

    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


# ── POST /translate-text ──────────────────────────────────────────────────────
# JSON: { "text": "...", "src_language": "Telugu", "direction": "to_english" | "to_local" }
@app.post("/translate-text")
def translate_text():
    try:
        body      = request.get_json(force=True)
        text      = body.get("text", "")
        lang      = body.get("src_language", "Telugu")
        direction = body.get("direction", "to_english")

        if not text:
            return jsonify({"success": False, "error": "Empty text"}), 400

        result = (translate_indic_to_en(text, lang)
                  if direction == "to_english"
                  else translate_en_to_indic(text, lang))

        return jsonify({"success": True, "result": result, "direction": direction})

    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500
"""

# ─────────────────────────────────────────────────────────────────────────────
## CELL 7  —  Start ngrok tunnel + Flask  ← RUN THIS LAST, keep it running
# ─────────────────────────────────────────────────────────────────────────────
"""
from pyngrok import ngrok, conf

# ┌──────────────────────────────────────────────────────────────────────────┐
# │  1. Get a free authtoken at https://dashboard.ngrok.com                  │
# │  2. Paste it below, replacing PASTE_YOUR_NGROK_TOKEN_HERE                │
# └──────────────────────────────────────────────────────────────────────────┘
NGROK_TOKEN = "PASTE_YOUR_NGROK_TOKEN_HERE"

conf.get_default().auth_token = NGROK_TOKEN
public_url = ngrok.connect(5000).public_url

print("=" * 60)
print("  VoiceCare Colab API is LIVE")
print(f"  URL  : {public_url}")
print(f"  Check: {public_url}/health")
print("=" * 60)
print(f"\n  Add to backend/.env:")
print(f"    VOICE_API_URL={public_url}\n")
print("  Keep this cell running. If Colab disconnects, re-run")
print("  from Cell 3 onwards — models are still cached.\n")

# Blocks the cell — do not interrupt unless you want to stop the server
app.run(port=5000)
"""
