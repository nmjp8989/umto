"""Join Little Panth sections and offset captions using their position in the final video."""
import json
import shutil
import subprocess
import sys
from pathlib import Path

SECTIONS = ("intro", "harvest", "storage", "requests", "share")


def duration_ms(video):
    seconds = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(video)
    ], text=True)
    milliseconds = round(float(seconds) * 1000)
    if milliseconds <= 0:
        raise ValueError(f"Empty video section: {video}")
    return milliseconds


def timecode(milliseconds):
    seconds, milliseconds = divmod(milliseconds, 1000)
    minutes, seconds = divmod(seconds, 60)
    hours, minutes = divmod(minutes, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"


def assemble(source, output, episode):
    output.mkdir(parents=True, exist_ok=True)
    offset = 0
    captions = []
    segments = []
    for name in SECTIONS:
        directory = source / name
        video = directory / "section.mp4"
        length = duration_ms(video)
        segments.append(video)
        for cue in json.loads((directory / "captions.json").read_text()):
            start, end = max(0, cue["start"]), min(length, cue["end"])
            if start < end:
                captions.append((offset + start, offset + end, cue["text"]))
        offset += length

    if not captions:
        raise ValueError("No captions were recorded")

    video_path = output / f"{episode}.mp4"
    # Re-encode neither picture nor sound when joining matching sections.
    manifest = source / "segments.ffconcat"
    manifest.write_text("ffconcat version 1.0\n" + "".join(
        f"file {video.relative_to(source).as_posix()}\n" for video in segments
    ))
    subprocess.run([
        "ffmpeg", "-v", "warning", "-y", "-f", "concat", "-safe", "1", "-i",
        str(manifest), "-c", "copy", "-movflags", "+faststart", str(video_path)
    ], check=True)
    subtitle_lines = []
    for index, (start, end, text) in enumerate(captions, 1):
        subtitle_lines.append(f"{index}\n{timecode(start)} --> {timecode(end)}\n{text}")
    (output / f"{episode}.en.srt").write_text("\n\n".join(subtitle_lines) + "\n", encoding="utf-8")
    shutil.copyfile(source / "storage" / "thumbnail.png", output / f"{episode}-thumbnail.png")
    print(f"Exported {duration_ms(video_path) / 1000:.1f}s and {len(captions)} caption cues")


if __name__ == "__main__":
    assemble(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3])
