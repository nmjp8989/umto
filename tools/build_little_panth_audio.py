#!/usr/bin/env python3
"""Generate and cache Little Panth Punjabi voices through Gemini TTS.

GitHub Actions secret GEMINI_API_KEY is used server-side only.
Outputs reusable MP3 files under little panth/mission-001/audio/.
Skip unchanged clips based on text, voice, model and speaker style.
The sacred Gurbani line is intentionally reserved for a verified human-checked recitation.
"""
from __future__ import annotations
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.error
import urllib.request
import wave

ROOT=Path(__file__).resolve().parents[1]
MISSION=ROOT/"little panth"/"mission-001"
DIALOGUE=MISSION/"dialogue.json"
AUDIO=MISSION/"audio"
STATE=AUDIO/"generation-manifest.json"
MODEL="gemini-3.8-flash-tts"
VOICES={
 "baldev":("Puck","Lively middle-aged Punjabi village uncle, naturally funny, strong emotion and playful urgency, speaking everyday Punjabi clearly. Avoid artificial exaggerated shouting."),
 "mehar":("Kore","Bright gentle young Punjabi girl's voice with warmth, natural child-friendly surprise, clear conversational Punjabi."),
 "baba":("Charon","Calm, dignified, warm older Punjabi Sikh grandfather voice with careful pronunciation, patient respectful delivery."),
 "farmer":("Fenrir","Kind, slightly weathered older Punjabi farmer male voice, thankful and natural, clear Punjabi."),
}
def main():
 p=argparse.ArgumentParser()
 p.add_argument("--max-new-lines",type=int,default=100,help="Hard limit on billed requests in one run.")
 p.add_argument("--dry-run",action="store_true")
 p.add_argument("--include-sacred-draft",action="store_true",help="Opt-in only: AI recitation draft requires human pronunciation review; never enabled by automation.")
 args=p.parse_args()
 if not (1<=args.max_new_lines<=100):p.error("--max-new-lines must be between 1 and 100")
 doc=json.loads(DIALOGUE.read_text(encoding="utf-8"))
 lines=doc["lines"]
 old=json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {}
 current={}
 pending=[]
 for id,line in lines.items():
  if line.get("sacred") and not args.include_sacred_draft:continue
  voice,style=VOICES[line["speaker"]]
  payload_key=json.dumps([MODEL,voice,style,line["pa"]],ensure_ascii=False)
  digest=hashlib.sha256(payload_key.encode("utf-8")).hexdigest()
  output=AUDIO/(id+".mp3")
  current[id]={"hash":digest,"voice":voice,"text":line["pa"],"speaker":line["speaker"]}
  if output.is_file() and output.stat().st_size>2048 and old.get(id,{}).get("hash")==digest:continue
  pending.append((id,line,voice,style))
 print(f"Little Panth voice cache: {len(lines)} lines, {len(pending)} pending; model={MODEL}.",flush=True)
 print("Gurbani audio: not generated automatically; use a reviewed recording.",flush=True)
 if args.dry_run:return 0
 key=os.environ.get("GEMINI_API_KEY","").strip()
 if not key:raise SystemExit("Missing GEMINI_API_KEY secret (Settings > Secrets and variables > Actions)")
 AUDIO.mkdir(parents=True,exist_ok=True)
 # Keep previous valid entries even if a later generation fails.
 state=old.copy()
 completed=0
 for id,line,voice,style in pending[:args.max_new_lines]:
  request_json={
   "contents":[{"role":"user","parts":[{"text":line["pa"],"speech_metadata":{"style":style}}]}],
   "generationConfig":{"responseModalities":["AUDIO"],"speechConfig":{"voiceConfig":{"voice":voice}}},
  }
  url=f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
  req=urllib.request.Request(url,data=json.dumps(request_json,ensure_ascii=False).encode("utf-8"),
      headers={"Content-Type":"application/json","x-goog-api-key":key},method="POST")
  result=None
  for attempt in range(3):
   try:
    with urllib.request.urlopen(req,timeout=120) as r: result=json.load(r)
    break
   except urllib.error.HTTPError as error:
    safe=error.read().decode("utf-8","replace")[:360]
    if error.code in (429,500,502,503,504) and attempt<2:
     print(f"Transient HTTP {error.code} for {id}, retrying.",flush=True);time.sleep(3*(attempt+1));continue
    raise RuntimeError(f"{id}: Gemini TTS failed HTTP {error.code}: {safe}") from None
  parts=result.get("candidates",[{}])[0].get("content",{}).get("parts",[])
  inline=next((a.get("inlineData") for a in parts if a.get("inlineData",{}).get("data")),None)
  if not inline:raise RuntimeError(f"{id}: Gemini returned no audio for this line.")
  pcm=base64.b64decode(inline["data"],validate=True)
  if pcm[:4]!=b"RIFF" or pcm[8:12]!=b"WAVE":
   raise RuntimeError(f"{id}: Unexpected audio format, expected WAV; MIME={inline.get('mimeType')}")
  raw=AUDIO/(id+".temp.wav")
  out=AUDIO/(id+".mp3")
  raw.write_bytes(pcm)
  try:
   subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-nostdin","-y","-i",str(raw),
    "-codec:a","libmp3lame","-qscale:a","4",str(out)],check=True)
  finally:
   raw.unlink(missing_ok=True)
  if out.stat().st_size<2048:raise RuntimeError(f"{id}: generated MP3 is too short.")
  state[id]=current[id]
  STATE.write_text(json.dumps(state,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
  completed+=1
  print(f"[{completed}/{min(len(pending),args.max_new_lines)}] generated {id}: {out.stat().st_size} bytes ({voice})",flush=True)
 print(f"Completed {completed} new lines; {len(pending)-completed} pending; unchanged cached clips cost zero.")
 return 0
if __name__=="__main__":
 try:raise SystemExit(main())
 except Exception as e:raise SystemExit(f"Voice generation stopped: {e}")
