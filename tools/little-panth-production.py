#!/usr/bin/env python3
"""Validate owner review decisions and maintain the shared Little Panth export ledger."""
import datetime as dt
import json, os, pathlib, re, sys
DB=pathlib.Path("little panth/production-db.json")
CAT=pathlib.Path("little panth/all-missions.html")
NAME=re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{0,79}")
DATE=re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z")
def now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00","Z")
def fail(msg):
    raise ValueError(msg)
def catalogue():
    return set(re.findall(r'href="mission-(\d{3})/">',CAT.read_text(encoding="utf-8")))
def valid_ids(ids,known,empty=False):
    if not isinstance(ids,list) or (not empty and not ids) or len(ids)>60 or any(not isinstance(i,str) or i not in known for i in ids) or len(set(ids))!=len(ids):
        fail("Invalid episode selection")
    return ids
def valid_name(name):
    if not isinstance(name,str) or not NAME.fullmatch(name):
        fail("Invalid filename: use 1–80 letters, numbers, hyphens or underscores")
    return name
def valid_date(value):
    if not isinstance(value,str) or not DATE.fullmatch(value):
        fail("Invalid review or recording date")
    dt.datetime.fromisoformat(value.replace("Z","+00:00"))
    return value
def load_db():
    return json.loads(DB.read_text(encoding="utf-8"))
def save_db(db):
    db["updatedAt"]=now()
    DB.write_text(json.dumps(db,ensure_ascii=False,indent=2,sort_keys=True)+"\n",encoding="utf-8")
def duplicate(db,name,exclude=None):
    return any(x["name"].casefold()==name.casefold() and x["id"]!=exclude for x in db["exports"])
def validate(req,db,known):
    if not isinstance(req,dict) or req.get("version")!=1 or req.get("mode") not in ("save","export"):
        fail("Expected a production request copied from the Little Panth tracker")
    mode=req["mode"]
    name=valid_name(req.get("name")) if mode=="export" else ""
    ids=valid_ids(req.get("episodes",[]),known,empty=mode=="save")
    if mode=="save" and ids:fail("Save request must not render episodes")
    reviews=req.get("reviews",{})
    if not isinstance(reviews,dict) or len(reviews)>len(known):fail("Invalid review changes")
    for i,v in reviews.items():
        if i not in known or not isinstance(v,dict) or type(v.get("checked")) is not bool or type(v.get("approved")) is not bool or v["approved"] and not v["checked"]:fail("Approval requires a checked episode: "+str(i))
        stamp=valid_date(v.get("changedAt"))
        old=db["reviews"].get(i)
        clean={"checked":v["checked"],"approved":v["approved"],"changedAt":stamp}
        if old and old["changedAt"]==stamp and old!=clean:fail("Review conflict: refresh tracker before saving "+i)
        if not old or old["changedAt"]<stamp:db["reviews"][i]=clean
    browser=req.get("browserExports",[])
    if not isinstance(browser,list) or len(browser)>200:fail("Invalid browser recording list")
    for e in browser:
        if not isinstance(e,dict) or not re.fullmatch(r"browser-[0-9a-f-]{36}",str(e.get("id",""))) or e.get("kind")!="browser":fail("Invalid local recording")
        en=valid_name(e.get("name"))
        if e.get("format") not in ("mp4","webm") or e.get("filename")!=en+"."+e["format"]:fail("Invalid local recording format")
        es=valid_ids(e.get("episodes"),known)
        if type(e.get("seconds")) is not int or not 1<=e["seconds"]<=86400:fail("Invalid recording duration")
        clean={k:e[k] for k in ("id","name","filename","format","kind","seconds")}
        clean.update(episodes=es,createdAt=valid_date(e.get("createdAt")))
        existing=next((x for x in db["exports"] if x["id"]==e["id"]),None)
        if existing:
            if existing!=clean:fail("Recording ID conflict")
            continue
        if duplicate(db,en):fail("Filename already used: "+en)
        db["exports"].append(clean)
    if mode=="export":
        if duplicate(db,name):fail("Filename already used: "+name)
        unapproved=[i for i in ids if not db["reviews"].get(i,{}).get("approved")]
        if unapproved:fail("Episodes must be approved first: "+", ".join(unapproved))
    return mode,name,ids
def output(values):
    with open(os.environ["GITHUB_OUTPUT"],"a",encoding="utf-8") as f:
        for k,v in values.items():print(k+"="+str(v),file=f)
def main():
    cmd=sys.argv[1];known=catalogue();db=load_db()
    if cmd=="plan":
        if os.environ.get("EVENT")=="push":
            mode,name,ids="test","test-compilation",valid_ids(["005","034"],known)
        else:
            mode,name,ids=validate(json.loads(os.environ["REQUEST"]),db,known)
        output({"mode":mode,"name":name,"episodes":",".join(ids),"matrix":json.dumps({"episode":ids or ["005"]},separators=(",",":"))})
    elif cmd=="apply":
        before=json.dumps(db,sort_keys=True)
        validate(json.loads(os.environ["REQUEST"]),db,known)
        if json.dumps(db,sort_keys=True)!=before:save_db(db)
    elif cmd=="record":
        name=valid_name(os.environ["VOLUME_NAME"]);ids=valid_ids(os.environ["EPISODES"].split(","),known)
        run=os.environ["GITHUB_RUN_ID"];attempt=os.environ["GITHUB_RUN_ATTEMPT"];artifact=os.environ["ARTIFACT_ID"]
        if not all(x.isdigit() for x in (run,attempt,artifact)):fail("Invalid render identifier")
        rid="github-"+run
        seconds=round(float(os.environ["VIDEO_SECONDS"]))
        if not 1<=seconds<=86400:fail("Invalid MP4 duration")
        existing=next((x for x in db["exports"] if x["id"]==rid),None)
        if existing and existing["name"]==name and existing["episodes"]==ids:return
        if existing or duplicate(db,name):fail("Filename or render ID already exists")
        db["exports"].append({"id":rid,"name":name,"filename":name+".mp4","format":"mp4","kind":"github","episodes":ids,"seconds":seconds,"createdAt":now(),"runId":run,"artifactId":artifact,"sourceCommit":os.environ["SOURCE_COMMIT"]})
        save_db(db)
    else:fail("Unknown operation")
if __name__=="__main__":
    try:main()
    except (ValueError,KeyError,TypeError) as e:raise SystemExit(str(e))
