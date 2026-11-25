#!/usr/bin/env python3
"""Concatenate complete rendered Little Panth episodes into one MP4."""
import json, pathlib, re, shutil, subprocess, sys
from html import unescape
root=pathlib.Path(sys.argv[1])
release=pathlib.Path(sys.argv[2]); release.mkdir(parents=True,exist_ok=True)
ids=sys.argv[3].split(",")
if not ids or any(not re.fullmatch(r"\d{3}",i) for i in ids) or len(set(ids))!=len(ids):
    raise SystemExit("Invalid episode selection")
def ffprobe(file):
    return json.loads(subprocess.check_output(["ffprobe","-v","error","-show_streams","-show_format","-of","json",str(file)]))
catalogue=pathlib.Path("little panth/all-missions.html").read_text()
def title(i):
    m=re.search(r'href="mission-'+i+r'/">([^<]+)</a>',catalogue)
    return unescape(m.group(1)) if m else "Mission "+i
def esc(s):
    return s.replace("\\","\\\\").replace("=","\\=").replace(";","\\;").replace("#","\\#").replace("\n"," ")
def stamp(ms):
    t=ms//1000
    return f"{t//3600:02}:{t//60%60:02}:{t%60:02}" if t>=3600 else f"{t//60:02}:{t%60:02}"
concat=[]; chapters=[]; meta=[";FFMETADATA1","title=Little Panth compilation"]; cursor=0
for i in ids:
    file=root/f"episode-{i}"/f"mission-{i}"/"episode.mp4"
    if not file.is_file():raise SystemExit("Missing rendered episode "+i)
    doc=ffprobe(file);streams=doc["streams"]
    v=next((s for s in streams if s["codec_type"]=="video"),{}); a=next((s for s in streams if s["codec_type"]=="audio"),{})
    if (v.get("codec_name"),v.get("width"),v.get("height"),v.get("pix_fmt"),v.get("r_frame_rate"))!=("h264",1920,1080,"yuv420p","30/1") or a.get("codec_name")!="aac" or a.get("sample_rate")!="48000" or a.get("channels")!=2:
        raise SystemExit("Unexpected video/audio format for "+i)
    ms=round(float(doc["format"]["duration"])*1000)
    if ms<=0:raise SystemExit("Invalid runtime for "+i)
    concat.append("file '"+str(file.resolve()).replace("'","'\\''")+"'")
    name=title(i)
    chapters.append(stamp(cursor)+" "+name)
    meta.extend(["[CHAPTER]","TIMEBASE=1/1000",f"START={cursor}",f"END={cursor+ms}","title="+esc(name)])
    cursor+=ms
    if len(chapters)==1 and (file.parent/"thumbnail.png").exists():shutil.copyfile(file.parent/"thumbnail.png",release/"thumbnail.png")
(release/"chapters.txt").write_text("\n".join(chapters)+"\n",encoding="utf-8")
(root/"concat.txt").write_text("\n".join(concat)+"\n")
(root/"chapters.ffmeta").write_text("\n".join(meta)+"\n")
out=release/"little-panth-compilation.mp4"
subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","concat","-safe","0","-i",str(root/"concat.txt"),"-f","ffmetadata","-i",str(root/"chapters.ffmeta"),"-map","0:v:0","-map","0:a:0","-map_metadata","1","-map_chapters","1","-c","copy","-movflags","+faststart",str(out)],check=True)
actual=ffprobe(out);duration=float(actual["format"]["duration"])
if abs(duration-cursor/1000)>max(1.5,len(ids)*.1):raise SystemExit("Compilation duration differs from the sum of episodes")
print("Rendered",len(ids),"episodes;",round(duration,1),"seconds")
