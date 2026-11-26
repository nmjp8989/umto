#!/usr/bin/env python3
"""Generate a single reusable original synthetic childlike brand voice.
No reference voice or voice cloning. Use existing Gemini Actions secrets.
"""
import base64
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.request
import urllib.error

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'little panth'/'brand-voice.mp3'
KEYS=('GEMINI_API_KEY2','GEMINI_API_KEY3','GEMINI_API_KEY')
MODELS=('gemini-3.8-flash-lite-tts','gemini-3.8-flash-tts')
TEXT='Little Panth!'
STYLE=('A cheerful, playful young-sounding synthetic character voice for an original '
       'children’s animation brand. Smile as you say the two words naturally, with a little '
       'lift on Panth, pronounced with an Indian Punjabi short a and a lightly aspirated '
       'final t. Speak only "Little Panth!" once, in about 1.2 to 1.5 seconds. '
       'No singing, extra words, laughter, music or sound effects.')
def run():
    if OUT.exists() and OUT.stat().st_size>2048:
        print('Cached brand recording already exists.');return
    keys=[os.environ[k].strip() for k in KEYS if os.environ.get(k,'').strip()]
    if not keys:raise SystemExit('No existing Gemini API credentials configured.')
    data=None
    for model in MODELS:
        payload={'contents':[{'role':'user','parts':[{'text':TEXT,'speech_metadata':{'style':STYLE}}]}],
                 'generationConfig':{'responseModalities':['AUDIO'],'speechConfig':{'voiceConfig':{'voice':'Leda'}}}}
        for key in keys:
            req=urllib.request.Request('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent',
                data=json.dumps(payload).encode(),headers={'Content-Type':'application/json','x-goog-api-key':key},method='POST')
            try:
                with urllib.request.urlopen(req,timeout=120) as r:result=json.load(r)
                part=next(p['inlineData'] for p in result['candidates'][0]['content']['parts'] if p.get('inlineData',{}).get('data'))
                data=base64.b64decode(part['data'],validate=True)
                if data[:4]!=b'RIFF' or data[8:12]!=b'WAVE':raise ValueError('Unexpected audio format')
                break
            except urllib.error.HTTPError as e:
                print('Voice generation returned HTTP',e.code,'using',model,flush=True)
            except (urllib.error.URLError,ValueError,KeyError,IndexError,StopIteration):
                print('No usable audio returned by',model,flush=True)
            data=None
        if data is not None:break
    if not data:raise SystemExit('No brand voice generated; check Gemini availability.')
    with tempfile.TemporaryDirectory() as tmp:
        raw=Path(tmp)/'raw.wav';trim=Path(tmp)/'trim.wav';out=Path(tmp)/'voice.mp3'
        raw.write_bytes(data)
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(raw),'-af',
          'silenceremove=start_periods=1:start_duration=0.03:start_threshold=-48dB,areverse,silenceremove=start_periods=1:start_duration=0.04:start_threshold=-48dB,areverse',
          '-ac','1','-ar','48000',str(trim)],check=True)
        duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(trim)]))
        if not .5<=duration<=4:raise ValueError('Unexpected voice duration')
        speed=max(1,duration/1.65)
        filters=[]
        while speed>2:filters.append('atempo=2');speed/=2
        filters.extend([f'atempo={speed:.4f}','loudnorm=I=-18:TP=-2:LRA=7','afade=t=in:d=0.02'])
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(trim),'-af',','.join(filters),'-ar','48000','-ac','1','-c:a','libmp3lame','-b:a','128k',str(out)],check=True)
        actual=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(out)]))
        if not .4<actual<=1.9 or out.stat().st_size<2048:raise ValueError('Invalid finished brand voice')
        OUT.write_bytes(out.read_bytes())
        print(f'Cached original synthetic brand voice ({actual:.2f} seconds).')
if __name__=='__main__':run()
