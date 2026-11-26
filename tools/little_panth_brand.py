#!/usr/bin/env python3
"""Generate original Little Panth brand bumpers in the episode MP4 format."""
import math
import pathlib
import random
import struct
import subprocess
import wave

INTRO_FRAMES = 72
TRANSITION_FRAMES = 36
FPS = 30
RATE = 48000


def soundtrack(path, frames, intro):
    duration = frames / FPS
    rng = random.Random(2157)
    notes = [(0.19, 659.25), (0.34, 880.0), (0.50, 1046.50)] if intro else [(0.17, 783.99), (0.32, 1046.50)]
    buf = bytearray()
    smooth = 0.0
    for i in range(round(duration * RATE)):
        t = i / RATE
        smooth = 0.94 * smooth + 0.06 * rng.uniform(-1, 1)
        u = t / 0.42
        value = 0.10 * smooth * math.sin(math.pi * u)**2 if u < 1 else 0.0
        for start, hz in notes:
            dt = t - start
            if 0 <= dt < 0.72:
                envelope = min(1, dt / 0.008) * math.exp(-6.0 * dt) * min(1, (0.72-dt)/0.08)
                value += 0.12 * envelope * (math.sin(2*math.pi*hz*dt) + 0.22*math.sin(2*math.pi*hz*2.01*dt))
        value *= min(1, max(0, (duration-t)/0.06))
        sample = round(32767 * max(-0.95, min(0.95, value)))
        buf.extend(struct.pack('<hh', sample, sample))
    with wave.open(str(path), 'wb') as audio:
        audio.setparams((2, 2, RATE, 0, 'NONE', 'not compressed'))
        audio.writeframes(buf)


def make_bumpers(directory, logo):
    directory = pathlib.Path(directory).resolve()
    directory.mkdir(parents=True, exist_ok=True)
    logo = pathlib.Path(logo).resolve()
    tools = pathlib.Path(__file__).resolve().parent
    motion = tools.parent/'little panth'/'brand-motion.js'
    clips = []
    for name, frames in [('intro', INTRO_FRAMES), ('transition', TRANSITION_FRAMES)]:
        audio = directory/(name+'.wav')
        soundtrack(audio, frames, name == 'intro')
        target = directory/(name+'.mp4')
        sequence = directory/(name+'-frames')
        subprocess.run(['node',str(tools/'little-panth-brand-frames.cjs'),str(logo),str(sequence),str(frames),name,str(motion)],check=True)
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-filter_threads','2','-threads','2','-framerate',str(FPS),'-c:v','librsvg','-i',str(sequence/'frame-%03d.svg'),'-i',str(audio),'-map','0:v:0','-map','1:a:0','-frames:v',str(frames),'-t',str(frames/FPS),'-c:v','libx264','-preset','veryfast','-crf','18','-threads','2','-pix_fmt','yuv420p','-video_track_timescale','15360','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-movflags','+faststart',str(target)],check=True)
        clips.append(target)
    return clips


if __name__ == '__main__':
    import sys
    make_bumpers(sys.argv[1],sys.argv[2])
