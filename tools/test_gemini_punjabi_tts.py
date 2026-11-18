#!/usr/bin/env python3
"""One-clip Punjabi TTS smoke test using the Gemini API key in GitHub Actions.

Only writes a WAV and MP3. Never prints or stores GEMINI_API_KEY.
This does not modify the existing MiMo mission audio pipeline.
"""
import base64
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.error
import urllib.request

MODEL = "gemini-3.8-flash-tts"
VOICE = "Puck"
SAMPLE = "ਓਏ ਹੋਏ! ਕਣਕ ਦੀ ਫ਼ਸਲ ਪੱਕ ਗਈ ਆ! ਜਲਦੀ ਕਰੋ, ਹੋਰ ਬੋਰੀਆਂ ਲਿਆਓ!"
OUT_DIR = Path("little panth/audio")
WAV_PATH = OUT_DIR / "test-baldev-punjabi.wav"
MP3_PATH = OUT_DIR / "test-baldev-punjabi.mp3"


def main():
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        sys.exit("Missing GEMINI_API_KEY GitHub Actions secret.")

    payload = {
        "contents": [{
            "role": "user",
            "parts": [{
                "text": SAMPLE,
                "speech_metadata": {"style": "Cheerful, expressive, slightly impatient Punjabi village uncle; natural conversational Punjabi pronunciation."}
            }]
        }],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"voice": VOICE}}
        }
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            result = json.load(response)
    except urllib.error.HTTPError as e:
        # Never include request headers or API key in logs.
        details = e.read().decode("utf-8", "replace")[:1000]
        sys.exit(f"Gemini TTS request failed: HTTP {e.code}. {details}")
    parts = result.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    audio_part = next((p.get("inlineData") for p in parts if p.get("inlineData", {}).get("data")), None)
    if not audio_part:
        sys.exit("Gemini returned no audio content; review model eligibility or response.")
    audio = base64.b64decode(audio_part["data"], validate=True)
    # The current Gemini 3.8 unary TTS endpoint returns a complete WAV container.
    if not (len(audio) > 44 and audio[:4] == b"RIFF" and audio[8:12] == b"WAVE"):
        sys.exit("Unexpected audio format: expected complete WAV from Gemini 3.8 TTS.")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    WAV_PATH.write_bytes(audio)
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
        "-i", str(WAV_PATH), "-codec:a", "libmp3lame", "-qscale:a", "3", str(MP3_PATH)
    ], check=True)
    print(f"SUCCESS: {WAV_PATH} ({WAV_PATH.stat().st_size} bytes)")
    print(f"SUCCESS: {MP3_PATH} ({MP3_PATH.stat().st_size} bytes)")
    print(f"Punjabi sample: {SAMPLE}")


if __name__ == "__main__":
    main()
