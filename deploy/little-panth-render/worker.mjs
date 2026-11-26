// Private, owner-only studio. Never store a GitHub credential in browser code.
import {openVideo} from './zip-video.mjs';
const API='https://api.github.com/repos/nmjp8989/umto';
const WORKFLOW='little-panth-compilation.yml';
const PAGES='https://nmjp8989.github.io';
const ROOT='/umto/little%20panth/';
const NO_CACHE={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{...NO_CACHE,'Content-Type':'application/json; charset=utf-8'}});
const error=(message,status)=>json({error:message},status);
function validRequest(v){
 return v&&v.version===1&&v.mode==='export'&&typeof v.name==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(v.name)&&
 Array.isArray(v.episodes)&&v.episodes.length>0&&v.episodes.length<=60&&new Set(v.episodes).size===v.episodes.length&&v.episodes.every(x=>typeof x==='string'&&/^\d{3}$/.test(x))&&
 v.reviews&&typeof v.reviews==='object'&&!Array.isArray(v.reviews)&&Object.keys(v.reviews).length<=60&&Array.isArray(v.browserExports)&&v.browserExports.length<=200;
}
// Cloudflare Workers supports manual/follow, not redirect:error. Never follow
// a GitHub redirect with the owner's Authorization header or repeat a POST.
function ghHeaders(env){return {'Accept':'application/vnd.github+json','Authorization':'Bearer '+env.GITHUB_TOKEN.trim(),'X-GitHub-Api-Version':'2026-03-10','User-Agent':'little-panth-private-render'};}
async function isOwner(env,ctx){
 // Cloudflare provides this context only after Access authenticates this invocation.
 // Fail closed for unauthenticated callers and missing/mismatched configuration.
 if(!ctx.access||!env.OWNER_EMAIL||!env.ACCESS_AUD||ctx.access.aud!==env.ACCESS_AUD)return false;
 try{const identity=await ctx.access.getIdentity();return typeof identity?.email==='string'&&identity.email.toLowerCase()===env.OWNER_EMAIL.trim().toLowerCase();}catch{return false;}
}
async function dispatch(request,env,url){
 if(request.method!=='POST')return error('POST required.',405);
 if(request.headers.get('Origin')!==url.origin||request.headers.get('Sec-Fetch-Site')!=='same-origin')return error('Only the private studio can start a render.',403);
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))return error('JSON required.',415);
 if(Number(request.headers.get('Content-Length')||0)>60000)return error('Request too large.',413);
 let value,text;
 try{text=await request.text();if(new TextEncoder().encode(text).length>60000)return error('Request too large.',413);value=JSON.parse(text);}catch{return error('Invalid JSON.',400);}
 if(!validRequest(value))return error('Invalid approved-episode export request.',400);
 if(!env.GITHUB_TOKEN)return error('The render studio is not configured. Add its GitHub token as a Cloudflare secret.',503);
 const headers={...ghHeaders(env),'Content-Type':'application/json'};
 try{
  const response=await fetch(API+'/actions/workflows/'+WORKFLOW+'/dispatches',{method:'POST',headers,redirect:'manual',body:JSON.stringify({ref:'main',inputs:{request:JSON.stringify(value)}})});
  if(response.status>=300&&response.status<400)return error('GitHub returned an unexpected redirect. No redirect was followed; check the workflow.',502);
  if(!response.ok){if(response.status===401||response.status===403)return error('GitHub authorization failed. Check the render token permissions.',403);return error('GitHub did not accept the render (HTTP '+response.status+'). Check Actions.',response.status>=500?502:400);}
  const result=await response.json().catch(()=>({}));
  const id=String(result.workflow_run_id||'');
  return json({accepted:true,runId:/^\d+$/.test(id)?id:null},202);
 }catch(e){console.warn('Little Panth dispatch transport failure:',e?.name||'Error');return error('Could not verify whether GitHub received the request. Check Actions before retrying.',502);}
}
const validVolume=name=>typeof name==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(name);
function downloadPath(runId,artifactId,name,ext='mp4'){return '/api/lp-render/download/'+runId+'/'+artifactId+'/'+encodeURIComponent(name)+'.'+ext;}
async function getRun(id,env){
 const r=await fetch(API+'/actions/runs/'+id,{headers:ghHeaders(env),redirect:'manual'});
 if(!r.ok)return null;
 const j=await r.json();
 return String(j.path||'').split('@')[0].endsWith('/'+WORKFLOW)&&String(j.id)===id?j:null;
}
async function getArtifact(runId,name,env){
 const r=await fetch(API+'/actions/runs/'+runId+'/artifacts?name='+encodeURIComponent(name),{headers:ghHeaders(env),redirect:'manual'});
 if(!r.ok)throw Error('Artifact metadata unavailable');
 const j=await r.json();
 return (j.artifacts||[]).find(a=>a.name===name&&/^\d+$/.test(String(a.id))&&(!a.workflow_run||String(a.workflow_run.id)===runId))||null;
}
async function downloadVideo(runId,artifactId,name,ext,env){
 if(!env.GITHUB_TOKEN)return error('Render studio not configured.',503);
 try{
  const run=await getRun(runId,env);
  if(!run||run.status!=='completed'||run.conclusion!=='success'||run.event!=='workflow_dispatch')return error('Completed export not found.',404);
  const artifact=await getArtifact(runId,name,env);
  if(!artifact||String(artifact.id)!==artifactId)return error('Export artifact not found.',404);
  if(artifact.expired)return error('This export has expired. GitHub retains completed video artifacts for 30 days.',410);
  const zip=await fetch(API+'/actions/artifacts/'+artifactId+'/zip',{headers:ghHeaders(env),redirect:'manual'});
  if(zip.status===410)return error('This export has expired.',410);
  const location=zip.headers.get('Location');
  if(zip.status!==302||!location)return error('GitHub download unavailable.',502);
  // The redirect is a short-lived signed storage URL supplied by GitHub. Never
  // forward GitHub authorization or the user's Access cookie to storage.
  const signed=new URL(location);
  if(signed.protocol!=='https:'||signed.username||signed.password)return error('Unexpected artifact storage location.',502);
  if(ext==='zip')return new Response(null,{status:302,headers:{...NO_CACHE,Location:signed.href,'Referrer-Policy':'no-referrer'}});
  try{
   const fetcher=range=>fetch(signed.href,{headers:{Range:range,'Accept-Encoding':'identity'},redirect:'manual'});
   const video=await openVideo(fetcher,name+'.mp4');
   return new Response(video.body,{headers:{...NO_CACHE,'Content-Type':'video/mp4','Content-Disposition':'attachment; filename="'+name+'.mp4"','Content-Length':String(video.size),'Referrer-Policy':'no-referrer'}});
  }catch(e){
   console.warn('Little Panth direct MP4 unavailable:',e?.name||'Error');
   // A storage backend without byte ranges, or an unsupported ZIP variant, can
   // still provide the complete archive. Explicitly label the fallback.
   const href=downloadPath(runId,artifactId,name,'zip');
   return new Response('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Download video ZIP</title></head><body style="font:16px system-ui;padding:24px"><h1>Direct MP4 download unavailable</h1><p>Your completed video is still available in its original ZIP archive.</p><p><a href="'+href+'">Download '+name+'.zip (contains '+name+'.mp4)</a></p></body></html>',{status:502,headers:{...NO_CACHE,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"}});
  }
 }catch(e){console.warn('Little Panth download failed:',e?.name||'Error');return error('Download unavailable. Please use the GitHub run link.',502);}
}
async function runStatus(id,env,name){
 if(!env.GITHUB_TOKEN)return error('Render studio not configured.',503);
 try{
  const response=await fetch(API+'/actions/runs/'+id,{headers:ghHeaders(env),redirect:'manual'});
  if(!response.ok)return error('Render status unavailable.',response.status===404?404:502);
  const run=await response.json();
  if(!String(run.path||'').includes('/'+WORKFLOW))return error('Not a Little Panth render.',404);
  const result={status:run.status,conclusion:run.conclusion||null};
  if(run.status==='completed'&&run.conclusion==='success'&&run.event==='workflow_dispatch'&&validVolume(name)){
   const a=await getArtifact(id,name,env);
   if(a&&!a.expired){result.downloadUrl=downloadPath(id,String(a.id),name);result.zipUrl=downloadPath(id,String(a.id),name,'zip');}
   if(a?.expired)result.expired=true;
  }
  return json(result);
 }catch{return error('Render status unavailable.',502);}
}
async function staticPage(request,url){
 // Fixed upstream, never accept an arbitrary proxy destination.
 if(!url.pathname.startsWith('/umto/'))return new Response('Not found',{status:404,headers:NO_CACHE});
 let upstream=new URL(PAGES);upstream.pathname=url.pathname;upstream.search=url.search;
 const isTracker=url.pathname===ROOT+'production-db.json';
 if(isTracker)upstream=new URL('https://raw.githubusercontent.com/nmjp8989/umto/main/little%20panth/production-db.json?fresh='+Date.now());
 if(url.pathname===ROOT+'brand-voice.mp3')upstream=new URL('https://raw.githubusercontent.com/nmjp8989/umto/main/little%20panth/brand-voice.mp3');
 const headers={};
 if(request.headers.has('Range'))headers.Range=request.headers.get('Range');
 let response;
 try{response=await fetch(upstream.toString(),{method:request.method,headers,redirect:'manual',cf:{cacheTtl:0,cacheEverything:false}});}catch{return new Response('Site unavailable',{status:502,headers:NO_CACHE});}
 if(response.status>=300&&response.status<400&&response.headers.has('Location')){
  const target=new URL(response.headers.get('Location'),upstream);
  if(target.origin!==PAGES||!target.pathname.startsWith('/umto/'))return new Response('Unexpected upstream redirect',{status:502,headers:NO_CACHE});
  return new Response(null,{status:response.status,headers:{...NO_CACHE,Location:target.pathname+target.search}});
 }
 const h=new Headers(NO_CACHE);
 for(const key of ['Content-Type','Content-Range','Accept-Ranges','Last-Modified'])if(response.headers.has(key))h.set(key,response.headers.get(key));
 const out=new Response(response.body,{status:response.status,headers:h});
 if(request.method==='GET'&&response.ok&&url.pathname===ROOT+'compilation.html'&&(h.get('Content-Type')||'').includes('text/html')){
  return new HTMLRewriter().on('head',{element(e){e.append('<meta name="lp-private-studio" content="1">',{html:true});}}).transform(out);
 }
 // Production catalogue is for approved stories and video exports, not games.
 if(request.method==='GET'&&response.ok&&[ROOT,ROOT+'index.html',ROOT+'all-missions.html'].includes(url.pathname)&&(h.get('Content-Type')||'').includes('text/html')){
  return new HTMLRewriter().on('aside[aria-label="Games"]',{element(e){e.remove();}}).on('head',{element(e){e.append('<meta name="lp-private-studio" content="1">',{html:true});}}).transform(out);
 }
 return out;
}
export default {
 async fetch(request,env,ctx){
  if(!await isOwner(env,ctx))return new Response('Owner-only Little Panth studio. Access and owner configuration are required.',{status:403,headers:NO_CACHE});
  const url=new URL(request.url);
  if(url.pathname==='/api/lp-render/dispatch')return dispatch(request,env,url);
  const match=url.pathname.match(/^\/api\/lp-render\/runs\/(\d+)$/);
  if(match&&request.method==='GET')return runStatus(match[1],env,url.searchParams.get('name'));
  const download=url.pathname.match(/^\/api\/lp-render\/download\/(\d+)\/(\d+)\/([A-Za-z0-9][A-Za-z0-9_-]{0,79})\.(mp4|zip)$/);
  if(download&&request.method==='GET')return downloadVideo(download[1],download[2],download[3],download[4],env);
  if(!['GET','HEAD'].includes(request.method))return error('Method not allowed.',405);
  if(url.pathname==='/')return new Response(null,{status:302,headers:{...NO_CACHE,Location:ROOT}});
  return staticPage(request,url);
 }
};
