#!/usr/bin/env python3
"""Generate one reusable instrumental Lyria cue for The Thirsty Crow."""

import base64
import json
import os
from pathlib import Path
import subprocess
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from imageio_ffmpeg import get_ffmpeg_exe


OUTPUT = Path(__file__).resolve().parents[1] / "little panth" / "mission-005" / "audio" / "score.mp3"
URL = "https://generativelanguage.googleapis.com/v1beta/interactions"
PROMPT = (
    "A 30-second instrumental background cue for a gentle Punjabi children's animated fable. "
    "A small, curious bansuri motif with very soft plucked strings and light hand percussion, "
    "at about 76 beats per minute. Sunny, warm and airy. Sparse dynamics and plenty of space "
    "for spoken narration. Instrumental only, with a soft ending suitable for looping."
)


def audio_data(value):
    if isinstance(value, dict):
        if value.get("type") == "audio" and value.get("data"):
            return value["data"]
        items = value.values()
    elif isinstance(value, list):
        items = value
    else:
        return None
    for item in items:
        data = audio_data(item)
        if data:
            return data
    return None


def main():
    if OUTPUT.is_file() and OUTPUT.stat().st_size > 4096:
        print("Reusing the cached instrumental score.")
        return
    request_body = json.dumps({"model": "lyria-3-clip-preview", "input": PROMPT}).encode()
    keys = dict.fromkeys(
        os.environ.get(name, "").strip()
        for name in ("GEMINI_API_KEY2", "GEMINI_API_KEY3", "GEMINI_API_KEY")
    )
    for key in filter(None, keys):
        request = Request(URL, data=request_body, method="POST", headers={
            "Content-Type": "application/json", "x-goog-api-key": key, "Api-Revision": "2026-05-20",
        })
        try:
            with urlopen(request, timeout=100) as response:
                data = audio_data(json.load(response))
        except HTTPError as error:
            print(f"Music generation returned HTTP {error.code}.")
            continue
        except (URLError, TimeoutError):
            print("Music generation timed out.")
            continue
        if not data:
            raise SystemExit("Lyria returned an interaction without inline audio.")
        audio = base64.b64decode(data, validate=True)
        subprocess.run([
            get_ffmpeg_exe(), "-v", "error", "-i", "pipe:0", "-f", "null", "-",
        ], input=audio, check=True)
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        temp = OUTPUT.with_suffix(".tmp")
        temp.write_bytes(audio)
        temp.replace(OUTPUT)
        print("Saved the Lyria instrumental score.")
        return
    raise SystemExit("Lyria was unavailable with the configured credentials.")


if __name__ == "__main__":
    main()
