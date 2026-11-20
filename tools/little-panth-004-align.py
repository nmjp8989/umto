#!/usr/bin/env python3
"""Align Mission 04's written Gurmukhi to the recorded Punjabi dialogue."""

import argparse
from difflib import SequenceMatcher
import hashlib
import json
from pathlib import Path
import subprocess
import unicodedata

import numpy as np


MISSION = Path(__file__).resolve().parents[1] / "little panth" / "mission-004"
SAMPLE_RATE = 16000


def gurmukhi(text):
    return "".join(c for c in unicodedata.normalize("NFC", text) if "\u0a00" <= c <= "\u0a7f")


def word_timings(text, tokens, timestamps, speech_start, speech_end):
    words = [gurmukhi(word) for word in text.split()]
    expected = "".join(words)
    spoken, spoken_times = [], []
    for token, timestamp in zip(tokens, timestamps, strict=True):
        clean = gurmukhi(token)
        spoken.append(clean)
        spoken_times.extend([timestamp * 1000] * len(clean))

    matcher = SequenceMatcher(None, expected, "".join(spoken), autojunk=False)
    matched = {}
    for expected_start, spoken_start, length in matcher.get_matching_blocks():
        for offset in range(length):
            matched[expected_start + offset] = spoken_times[spoken_start + offset]

    starts, tails, offset = [], [], 0
    for word in words:
        hits = [(i, matched[offset + i]) for i in range(len(word)) if offset + i in matched]
        if hits and len(hits) * 2 >= len(word):
            first, onset = hits[0]
            starts.append(onset - min(160, 45 + first * 25))
            tails.append(hits[-1][1] + 120)
        else:
            starts.append(None)
            tails.append(None)
        offset += len(word)

    # Keep the measured anchors. Interpolate only words that the recognizer missed.
    starts[0] = starts[0] if starts[0] is not None else speech_start
    anchors = [(i, onset) for i, onset in enumerate(starts) if onset is not None]
    anchors.append((len(words), speech_end))
    for (i, left), (j, right) in zip(anchors, anchors[1:]):
        cumulative = np.cumsum([0, *(max(1, len(word)) ** 0.6 for word in words[i:j])])
        for k, weight in enumerate(cumulative[:-1]):
            starts[i + k] = round(left + (right - left) * weight / cumulative[-1])

    # Adjacent subword tokens can land in one acoustic frame. Keep each whole word visible.
    for i, start in enumerate(starts):
        earliest = speech_start if i == 0 else starts[i - 1] + 45
        latest = speech_end - 45 * (len(words) - i)
        starts[i] = max(earliest, min(start, latest))
    ends = starts[1:] + [speech_end]
    windows = []
    for start, limit, tail in zip(starts, ends, tails, strict=True):
        end = limit if tail is None or limit - tail <= 220 else max(start + 45, round(tail))
        windows.append([start, end])
    return windows, len(matched) / len(expected)


def speech_bounds(samples):
    # Detect the quiet lead-in and tail without discarding short, soft syllables.
    size = SAMPLE_RATE // 100
    windows = samples[:len(samples) // size * size].reshape(-1, size)
    rms = np.sqrt(np.mean(windows ** 2, axis=1))
    voiced = np.flatnonzero(rms >= max(0.001, np.max(rms) * 0.025))
    if not len(voiced):
        raise ValueError("The recorded line is silent")
    return max(0, int(voiced[0]) * 10 - 50), min(round(len(samples) / 16), int(voiced[-1]) * 10 + 140)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model", type=Path)
    parser.add_argument("tokens", type=Path)
    args = parser.parse_args()
    import imageio_ffmpeg
    import sherpa_onnx

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    audio = MISSION / "audio"
    dialogue = json.loads((MISSION / "dialogue.json").read_text(encoding="utf-8"))["lines"]
    manifest = json.loads((audio / "generation-manifest.json").read_text(encoding="utf-8"))
    output = audio / "word-timings.json"
    previous = json.loads(output.read_text(encoding="utf-8")) if output.exists() else {}
    tracks = {}
    recognizer = sherpa_onnx.OfflineRecognizer.from_nemo_ctc(
        model=str(args.model), tokens=str(args.tokens), num_threads=4,
    )
    for scene, line in dialogue.items():
        text = line["pa"]
        if manifest.get(scene, {}).get("text") != text:
            raise ValueError(f"{scene}: recording does not match the dialogue")
        mp3 = audio / f"{scene}.mp3"
        digest = hashlib.sha256(mp3.read_bytes()).hexdigest()
        cached = previous.get(scene, {})
        if cached.get("audioSha256") == digest and cached.get("dialogueHash") == manifest[scene]["hash"]:
            tracks[scene] = cached
            continue

        pcm = subprocess.check_output([
            ffmpeg, "-v", "error", "-i", str(mp3), "-f", "f32le", "-ac", "1", "-ar", str(SAMPLE_RATE), "pipe:1",
        ])
        samples = np.frombuffer(pcm, dtype="<f4")
        speech_start, speech_end = speech_bounds(samples)
        stream = recognizer.create_stream()
        stream.accept_waveform(SAMPLE_RATE, samples)
        recognizer.decode_stream(stream)
        result = stream.result
        windows, coverage = word_timings(text, result.tokens, result.timestamps, speech_start, speech_end)
        print(f"{scene}: {len(windows)} words, {coverage:.0%} acoustic transcript match", flush=True)
        if coverage < 0.70:
            raise ValueError(f"{scene}: low transcript match. Recognized {result.text!r}")
        tracks[scene] = {
            "audioSha256": digest,
            "dialogueHash": manifest[scene]["hash"],
            "durationMs": round(len(samples) / 16),
            "words": windows,
        }

    output.write_text(json.dumps(tracks, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
