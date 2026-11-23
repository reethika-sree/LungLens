# test_voicecare_api.py
# Run this locally: python test_voicecare_api.py

import requests
import base64
import json
import os

# ── Paste your ngrok URL here ──────────────────────────────────────────────────
BASE_URL = "https://nonactinically-carneous-lesley.ngrok-free.dev/"  # e.g. https://abc123.ngrok-free.app
# ──────────────────────────────────────────────────────────────────────────────


def print_result(title, data):
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60)
    for k, v in data.items():
        if "audio_b64" in k:
            print(f"  {k}: <audio data, {len(v)} chars>")
        else:
            print(f"  {k}: {v}")
    print()


# ── Test 1: Health Check ───────────────────────────────────────────────────────
def test_health():
    print("\n🔍 Test 1: Health Check")
    resp = requests.get(f"{BASE_URL}/health")
    print_result("Health Response", resp.json())
    assert resp.status_code == 200, "❌ Health check failed!"
    print("✅ Health check passed!")


# ── Test 2: Text Translation (Indic → English) ────────────────────────────────
def test_translate_to_english():
    print("\n🔍 Test 2: Telugu → English Text Translation")
    payload = {
        "text": "నమస్కారం, మీరు ఎలా ఉన్నారు?",  # "Hello, how are you?" in Telugu
        "src_language": "Telugu",
        "direction": "to_english"
    }
    resp = requests.post(f"{BASE_URL}/translate-text", json=payload)
    data = resp.json()
    print_result("Translation Response", data)
    assert resp.status_code == 200, "❌ Translation failed!"
    assert data.get("success"), f"❌ API error: {data.get('result')}"
    print("✅ Telugu → English passed!")


# ── Test 3: Text Translation (English → Indic) ────────────────────────────────
def test_translate_to_telugu():
    print("\n🔍 Test 3: English → Telugu Text Translation")
    payload = {
        "text": "Hello, how are you?",
        "src_language": "Telugu",
        "direction": "to_local"
    }
    resp = requests.post(f"{BASE_URL}/translate-text", json=payload)
    data = resp.json()
    print_result("Translation Response", data)
    assert resp.status_code == 200, "❌ Translation failed!"
    assert data.get("success"), f"❌ API error: {data.get('result')}"
    print("✅ English → Telugu passed!")


# ── Test 4: Voice Process with a real WAV file ────────────────────────────────
def test_voice_process_with_file(wav_path: str, language: str = "Telugu"):
    print(f"\n🔍 Test 4: Voice Process — {wav_path}")

    if not os.path.exists(wav_path):
        print(f"⚠️  File not found: {wav_path} — skipping voice test")
        return

    with open(wav_path, "rb") as f:
        files   = {"audio_file": (os.path.basename(wav_path), f, "audio/wav")}
        data    = {"language": language}
        resp    = requests.post(f"{BASE_URL}/voice-process", files=files, data=data)

    result = resp.json()
    print_result("Voice Process Response", result)

    if result.get("success"):
        # Save returned audio files locally
        if result.get("english_audio_b64"):
            with open("output_english.mp3", "wb") as f:
                f.write(base64.b64decode(result["english_audio_b64"]))
            print("💾 Saved: output_english.mp3")

        if result.get("local_audio_b64"):
            with open("output_local.mp3", "wb") as f:
                f.write(base64.b64decode(result["local_audio_b64"]))
            print("💾 Saved: output_local.mp3")

        print("✅ Voice process passed!")
    else:
        print(f"❌ Voice process failed: {result.get('error')}")


# ── Test 5: Generate a dummy WAV and test voice process ───────────────────────
def test_voice_process_dummy():
    print("\n🔍 Test 5: Voice Process — Dummy silent WAV (smoke test)")
    import wave, struct, math

    dummy_path = "dummy_test.wav"
    sample_rate = 16000
    duration    = 2  # seconds
    frequency   = 440  # Hz (A note)

    with wave.open(dummy_path, "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        samples = [
            struct.pack("<h", int(32767 * math.sin(2 * math.pi * frequency * t / sample_rate)))
            for t in range(sample_rate * duration)
        ]
        wf.writeframes(b"".join(samples))

    print(f"  Created dummy WAV: {dummy_path}")
    test_voice_process_with_file(dummy_path, language="Telugu")
    os.remove(dummy_path)


# ── Run all tests ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n🚀 VoiceCare API Test Suite")
    print(f"   Target: {BASE_URL}\n")

    try:
        test_health()
        test_translate_to_english()
        test_translate_to_telugu()
        test_voice_process_dummy()

        # Optional: test with a real WAV file
        # test_voice_process_with_file("my_telugu_audio.wav", language="Telugu")

        print("\n" + "="*60)
        print("  ✅ All tests completed!")
        print("="*60 + "\n")

    except Exception as e:
        print(f"\n❌ Test failed with exception: {e}")