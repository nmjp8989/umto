(() => {
'use strict';
const key='little-panth-production-v1',cacheKey=key+'-shared',empty=()=>({schemaVersion:1,updatedAt:'',reviews:{},exports:[]});
function read(k,fallback){try{const v=JSON.parse(localStorage.getItem(k)||'null');return v&&typeof v==='object'?v:fallback;}catch{return fallback;}}
function write(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch{return false;}}
let draft=read(key,{reviews:{},exports:[]}),shared=read(cacheKey,empty()),online=false;
if(!draft.reviews||!Array.isArray(draft.exports))draft={reviews:{},exports:[]};
if(!shared.reviews||!Array.isArray(shared.exports))shared=empty();
const workflow='https://github.com/nmjp8989/umto/actions/workflows/little-panth-compilation.yml';
const validId=id=>/^\d{3}$/.test(id),validName=name=>/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(name);
const normalize=name=>String(name||'').trim().replace(/\.(mp4|webm)$/i,'');
const stamp=()=>new Date().toISOString();
function persist(){return write(key,draft);}
function reloadDraft(){
 const saved=read(key,null);
 if(!saved?.reviews||!Array.isArray(saved.exports))return;
 // A restored contents page may predate a recording completed on another page.
 // Merge instead of replacing so a failed storage write cannot discard newer
 // owner decisions or recordings still held in this page's memory.
 for(const [id,value] of Object.entries(saved.reviews))if(!draft.reviews[id]||String(value.changedAt)>=String(draft.reviews[id].changedAt))draft.reviews[id]=value;
 const ids=new Set(draft.exports.map(e=>e.id));
 for(const entry of saved.exports)if(!ids.has(entry.id)){draft.exports.push(entry);ids.add(entry.id);}
}
function review(id){const local=draft.reviews[id],remote=shared.reviews[id];const v=local&&(!remote||local.changedAt>=remote.changedAt)?local:remote;return v||{checked:false,approved:false,changedAt:''};}
function setReview(id,checked,approved){if(!validId(id))throw Error('Invalid episode');draft.reviews[id]={checked:!!checked,approved:!!checked&&!!approved,changedAt:stamp()};return persist();}
function exportsList(){const records=new Map(shared.exports.map(e=>[e.id,e]));for(const e of draft.exports)if(!records.has(e.id))records.set(e.id,e);return [...records.values()].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));}
function exportedIn(id){return exportsList().filter(e=>e.episodes?.includes(id));}
function usedName(name){return exportsList().some(e=>e.name.toLowerCase()===normalize(name).toLowerCase());}
function reconcile(){let dirty=false;for(const [id,v] of Object.entries(draft.reviews)){const remote=shared.reviews[id];if(remote&&remote.changedAt>=v.changedAt){delete draft.reviews[id];dirty=true;}}const ids=new Set(shared.exports.map(e=>e.id));const remaining=draft.exports.filter(e=>!ids.has(e.id));if(remaining.length!==draft.exports.length){draft.exports=remaining;dirty=true;}if(dirty)persist();}
async function load(){
 reloadDraft();
 const urls=['production-db.json'];
 if(location.hostname==='nmjp8989.github.io')urls.unshift('https://raw.githubusercontent.com/nmjp8989/umto/main/little%20panth/production-db.json?fresh='+Date.now());
 online=false;
 await Promise.all(urls.map(async url=>{try{const res=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(7000)});if(!res.ok)throw Error('Tracker unavailable');const db=await res.json();if(db.schemaVersion!==1||!db.reviews||!Array.isArray(db.exports))throw Error('Invalid tracker');online=true;if(String(db.updatedAt||'')>=String(shared.updatedAt||''))shared=db;}catch{}}));
 reconcile();write(cacheKey,shared);return online;
}
function pending(){return Object.keys(draft.reviews).length+draft.exports.length;}
function request(mode,name='',episodes=[]){if(mode==='export'){if(!validName(name)||usedName(name))throw Error('Choose a new valid filename.');if(!episodes.length||episodes.some(id=>!validId(id)||!review(id).approved))throw Error('Only approved episodes may be exported.');}return {version:1,mode,name,episodes,reviews:structuredClone(draft.reviews),browserExports:structuredClone(draft.exports)};}
function addBrowser(name,episodes,extension,seconds){if(!validName(name)||usedName(name)||!episodes.length||episodes.some(id=>!review(id).approved))throw Error('Recording could not be entered in tracker; use a new name and approved stories.');const entry={id:'browser-'+crypto.randomUUID(),name,episodes:[...episodes],filename:name+'.'+extension,format:extension,kind:'browser',createdAt:stamp(),seconds:Math.max(1,Math.round(seconds))};draft.exports.push(entry);if(!persist())throw Error('Browser storage is full; video is available but history could not be saved.');return entry;}
window.LPProduction={load,review,setReview,exports:exportsList,exportedIn,usedName,normalize,validName,request,addBrowser,pending,workflow,online:()=>online};
})();
