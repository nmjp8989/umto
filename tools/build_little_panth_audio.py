#!/usr/bin/env python3
"""Generate and cache Little Panth Punjabi voices through Gemini TTS.

GitHub Actions secrets GEMINI_API_KEY2, GEMINI_API_KEY3 and GEMINI_API_KEY are used server-side only.
Outputs reusable MP3 files under the selected Little Panth mission’s audio directory.
Skip unchanged clips based on text, voice, model and speaker style.
The optional Gurbani clip is a synthetic recitation.
"""
from __future__ import annotations
import argparse
import base64
import hashlib
import json
import os
import re
from pathlib import Path
import subprocess
import sys
import time
import urllib.error
import urllib.request
import wave

ROOT=Path(__file__).resolve().parents[1]
MODEL="gemini-3.8-flash-tts"
TTS_MODELS=(MODEL,"gemini-3.8-flash-lite-tts")
VOICES={
 "oak":("Charon","A dignified mature oak tree speaking warm natural Gurmukhi Punjabi, confident at first, thoughtful and gentle later. Read only the written words."),
 "reed":("Leda","A small kind reed speaking clear natural Gurmukhi Punjabi, gently confident and reassuring. Read only the written words."),
 "narrator":("Aoede","Warm, gentle Punjabi storyteller, clear and unhurried child-friendly explanation, natural Punjabi pronunciation."),
 "wind":("Leda","Bright, lively and sure of herself. Speak the exact Punjabi words clearly at a pace a young reader can follow."),
 "sun":("Charon","Warm and quietly confident, with an easy smile in the voice. Speak the exact Punjabi words clearly for young readers."),
 "traveller":("Iapetus","An expressive, friendly Punjabi traveller. Speak naturally and clearly for young readers."),
 "jackal":("Orus","A curious young jackal in a Punjabi story for children. Start a little wary and become warmly amused when the sound is explained. Speak clear, natural Gurmukhi Punjabi at an easy read-along pace. Read only the written words."),
 "fox":("Kore","An expressive young fox speaking conversational Punjabi. Give her bright enthusiasm and honest disappointment without overacting. Read only the written words."),
 "cat":("Leda","A thoughtful, gentle young cat speaking conversational Punjabi in Gurmukhi. Friendly and modest, then alert and reassuring. Clear pronunciation at a comfortable read-along pace. Read only the written words."),
 "goat":("Iapetus","A friendly, curious goat speaking natural Punjabi in Gurmukhi. Clear and warm, with gentle surprise and concern, at a comfortable read-along pace. Read only the written words."),
 "sparrow":("Leda","A small, lively sparrow with a kind, curious voice. Read the Punjabi words clearly, with no imitation of bird sounds."),
 "grasshopper":("Puck","A cheerful young grasshopper speaking clear natural Gurmukhi Punjabi. Playful at first, then gently worried and grateful. Child-friendly conversational pronunciation at a comfortable read-along pace. Read only the written words."),
 "ant":("Leda","A lively little ant speaking natural Punjabi. Clear, warm pronunciation at an easy pace for children. Read only the written words."),
 "stork":("Charon","A thoughtful and friendly stork speaking clear conversational Punjabi with a gentle, expressive delivery. Read only the written words."),
 "dove":("Vindemiatrix","A gentle and reassuring dove speaking clear conversational Punjabi. Read only the written words for young listeners."),
 "goose":("Charon","A gentle and thoughtful goose helping a friend in a Punjabi picture book. Read the exact Gurmukhi line in clear, natural Punjabi at a comfortable read-along pace."),
 "second-goose":("Leda","A bright, kind young goose checking on a friend in a Punjabi picture book. Speak natural Punjabi with warmth and gentle concern. Read the exact Gurmukhi line."),
 "tortoise":("Orus","A gentle, thoughtful tortoise. Speak Gurmukhi Punjabi clearly with steady, friendly delivery for young children. Read only the written words."),
 "hare":("Iapetus","A playful and energetic young hare. Speak natural Gurmukhi Punjabi clearly, with warm, expressive delivery. Read only the written words."),
 "harpreet":("Algieba","A kind Punjabi village tailor speaking to a friend. Use clear, warm conversational Punjabi pronunciation in Gurmukhi, with an easy pace for children."),
 "elephant":("Fenrir","A gentle and enthusiastic elephant in a Punjabi children’s story. Speak in natural, unhurried Punjabi and read the given words exactly."),
 "baldev":("Puck","Lively middle-aged Punjabi village uncle, naturally funny, strong emotion and playful urgency, speaking everyday Punjabi clearly. Avoid artificial exaggerated shouting."),
 "mehar":("Kore","Bright gentle young Punjabi girl's voice with warmth, natural child-friendly surprise, clear conversational Punjabi."),
 "baba":("Charon","Calm, dignified, warm older Punjabi Sikh grandfather voice with careful pronunciation, patient respectful delivery."),
 "pari":("Vindemiatrix","A calm, curious river fairy speaking natural Punjabi. Read the exact words with gentle warmth and a clear pace for children."),
 "dadi":("Pulcherrima","Warm Punjabi grandmother, affectionate and quietly amused. Speak natural conversational Punjabi."),
 "friend":("Iapetus","Playful young Punjabi school friend, quick but clear natural delivery."),
 "girl":("Leda","Punjabi schoolgirl speaking softly and honestly, with restraint. Let the short pauses feel natural."),
 "boy":("Orus","Gentle young Punjabi boy asking his older sister a quiet question. Avoid exaggerated emotion."),
 "teacher":("Vindemiatrix","Calm, reassuring Punjabi teacher. Clear, conversational delivery."),
 "farmer":("Fenrir","Kind, slightly weathered older Punjabi farmer male voice, thankful and natural, clear Punjabi."),
 "lion":("Charon","Warm, deep, expressive male lion character voice for Punjabi children. Gentle and reassuring rather than frightening; every Punjabi word clear. Read only the given line."),
 "mouse":("Leda","Tiny playful, bright and energetic childlike mouse character speaking natural Punjabi with clear articulation and courage. Read only the given line."),
 "crow":("Puck","Curious young crow in a Punjabi children's story. A light, playful speaking voice with clear, natural Gurmukhi Punjabi pronunciation. Read exactly the written line at a comfortable pace for young readers."),
}
def main():
 p=argparse.ArgumentParser()
 p.add_argument("--mission", default="mission-001", metavar="mission-NNN")
 p.add_argument("--model", choices=TTS_MODELS, default=MODEL)
 p.add_argument("--max-new-lines",type=int,default=100,help="Hard limit on billed requests in one run.")
 p.add_argument("--dry-run",action="store_true")
 p.add_argument("--include-sacred-draft",action="store_true",help="Include a synthetic recitation of the Japji Sahib line.")
 args=p.parse_args()
 if not re.fullmatch(r"mission-[0-9]{3}",args.mission):p.error("--mission must be in the form mission-NNN")
 if not (1<=args.max_new_lines<=100):p.error("--max-new-lines must be between 1 and 100")
 mission=ROOT/"little panth"/args.mission
 AUDIO=mission/"audio"
 STATE=AUDIO/"generation-manifest.json"
 doc=json.loads((mission/"dialogue.json").read_text(encoding="utf-8"))
 lines=doc["lines"]
 old=json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {}
 current={}
 pending=[]
 for id,line in lines.items():
  if line.get("sacred") and (args.mission=="mission-002" or not args.include_sacred_draft):continue
  voice,style=VOICES[line["speaker"]]
  if line.get("sacred"):
   style+=" Recite this exact Japji Sahib line slowly in Gurmukhi, with a short pause after ਉਤਰੀ. Say only the quoted line."
  payload_key=json.dumps([args.model,voice,style,line["pa"]],ensure_ascii=False)
  digest=hashlib.sha256(payload_key.encode("utf-8")).hexdigest()
  output=AUDIO/(id+".mp3")
  current[id]={"hash":digest,"voice":voice,"text":line["pa"],"speaker":line["speaker"],"model":args.model}
  previous=old.get(id,{})
  previous_model=previous.get("model",MODEL)
  previous_key=json.dumps([previous_model,voice,style,line["pa"]],ensure_ascii=False)
  previous_hash=hashlib.sha256(previous_key.encode("utf-8")).hexdigest()
  if output.is_file() and output.stat().st_size>2048 and previous_model in TTS_MODELS and previous.get("hash")==previous_hash:continue
  pending.append((id,line,voice,style))
 print(f"Little Panth voice cache: {len(lines)} lines, {len(pending)} pending; model={args.model}.",flush=True)
 print(f"Synthetic Gurbani recitation enabled: {args.include_sacred_draft}.",flush=True)
 if args.dry_run:return 0
 if not pending:return 0
 # Priority order requested for this mission; each key is provided by Actions as a secret.
 # Multiple keys may share one Google project quota. Never print or persist API key values.
 key_names=("GEMINI_API_KEY2","GEMINI_API_KEY3","GEMINI_API_KEY")
 keys=[(name,os.environ[name].strip()) for name in key_names if os.environ.get(name,"").strip()]
 if not keys:raise SystemExit("No Gemini key configured. Add GEMINI_API_KEY2, GEMINI_API_KEY3 or GEMINI_API_KEY in repository Actions secrets.")
 print("Gemini credential priority: "+", ".join(name for name,_ in keys),flush=True)
 active_key=0
 AUDIO.mkdir(parents=True,exist_ok=True)
 # Keep previous valid entries even if a later generation fails.
 state=old.copy()
 completed=0
 for id,line,voice,style in pending[:args.max_new_lines]:
  request_json={
   "contents":[{"role":"user","parts":[{"text":line["pa"],"speech_metadata":{"style":style}}]}],
   "generationConfig":{"responseModalities":["AUDIO"],"speechConfig":{"voiceConfig":{"voice":voice}}},
  }
  url=f"https://generativelanguage.googleapis.com/v1beta/models/{args.model}:generateContent"
  request_bytes=json.dumps(request_json,ensure_ascii=False).encode("utf-8")
  result=None
  # Move to the next user-provided credential only when the active one is unavailable,
  # unauthorised or rate-limited. Do not re-bill cached MP3 clips.
  for index in range(active_key,len(keys)):
   name,key=keys[index]
   rotate=False
   for attempt in range(2):
    req=urllib.request.Request(url,data=request_bytes,
        headers={"Content-Type":"application/json","x-goog-api-key":key},method="POST")
    try:
     with urllib.request.urlopen(req,timeout=120) as response:result=json.load(response)
     active_key=index
     break
    except urllib.error.HTTPError as error:
     status=error.code
     # Avoid logging exception bodies: diagnostic text might contain sensitive details.
     if status in (401,403,429):
      print(f"{id}: {name} returned HTTP {status}; trying the next configured credential.",flush=True)
      rotate=True
      break
     if status in (500,502,503,504) and attempt==0:
      print(f"{id}: temporary HTTP {status} from {name}; one retry.",flush=True)
      time.sleep(3)
      continue
     raise RuntimeError(f"{id}: Gemini TTS returned HTTP {status} using {name}.") from None
    except urllib.error.URLError as error:
     if attempt==0:
      print(f"{id}: transient network error using {name}; one retry.",flush=True)
      time.sleep(3)
      continue
     raise RuntimeError(f"{id}: network error while generating Gemini audio.") from None
   if result is not None:
    break
   if rotate:active_key=index+1
  if result is None:
   raise RuntimeError(f"{id}: no usable Gemini key remains; check quota and permissions on GEMINI_API_KEY2, GEMINI_API_KEY3 and GEMINI_API_KEY.")
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
   import imageio_ffmpeg
   encoder=imageio_ffmpeg.get_ffmpeg_exe()
   subprocess.run([encoder,"-hide_banner","-loglevel","error","-nostdin","-y","-i",str(raw),
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
