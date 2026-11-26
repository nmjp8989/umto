#!/usr/bin/env python3
"""Generate original Little Panth brand bumpers in the episode MP4 format."""
import math
import pathlib
import random
import struct
import subprocess
import wave
import re

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
    svg = pathlib.Path(logo).read_text(encoding='utf-8')
    nested = svg[svg.index('<svg'):svg.rindex('</svg>')+6]
    nested = nested.replace('<svg ', '<svg x="300" y="370" ', 1)
    nested = re.sub(r'\bwidth="[^"]+"', 'width="1320"', nested, count=1)
    nested = re.sub(r'\bheight="[^"]+"', 'height="340"', nested, count=1)
    scene = directory/'brand-scene.svg'
    scene.write_text('<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><rect width="1920" height="1080" fill="white"/>'+nested+'</svg>', encoding='utf-8')
    clips = []
    for name, frames in [('intro', INTRO_FRAMES), ('transition', TRANSITION_FRAMES)]:
        intro = name == 'intro'
        audio = directory/(name+'.wav')
        soundtrack(audio, frames, intro)
        target = directory/(name+'.mp4')
        rise = 23 if intro else 13
        fade_in = 6 if intro else 4
        fade_out = 7 if intro else 5
        zoom = f"1+0.22*(1-pow(1-min(on/{rise},1),3))+0.025*sin(PI*min(on/{rise},1))"
        filters = ("scale=3840:2160:flags=lanczos,"
                   f"zoompan=z='{zoom}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d={frames}:s=1920x1080:fps=30,"
                   f"fade=t=in:s=0:n={fade_in}:color=white,fade=t=out:s={frames-fade_out-1}:n={fade_out}:color=white,format=yuv420p")
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-filter_threads','2','-i',str(scene),'-i',str(audio),'-vf',filters,'-map','0:v:0','-map','1:a:0','-frames:v',str(frames),'-t',str(frames/FPS),'-c:v','libx264','-preset','veryfast','-crf','18','-threads','2','-video_track_timescale','15360','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-movflags','+faststart',str(target)],check=True)
        clips.append(target)
    return clips


if __name__ == '__main__':
    import sys
    make_bumpers(sys.argv[1],sys.argv[2])
