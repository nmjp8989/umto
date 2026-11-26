// Private, owner-only studio. Never store a GitHub credential in browser code.
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
function ghHeaders(env){return {'Accept':'application/vnd.github+json','Authorization':'Bearer '+env.GITHUB_TOKEN,'X-GitHub-Api-Version':'2026-03-10','User-Agent':'little-panth-private-render'};}
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
  const response=await fetch(API+'/actions/workflows/'+WORKFLOW+'/dispatches',{method:'POST',headers,redirect:'error',body:JSON.stringify({ref:'main',inputs:{request:JSON.stringify(value)}})});
  if(!response.ok){if(response.status===401||response.status===403)return error('GitHub authorization failed. Check the render token permissions.',403);return error('GitHub did not accept the render (HTTP '+response.status+'). Check Actions.',response.status>=500?502:400);}
  const result=await response.json().catch(()=>({}));
  const id=String(result.workflow_run_id||'');
  return json({accepted:true,runId:/^\d+$/.test(id)?id:null},202);
 }catch{return error('Could not verify whether GitHub received the request. Check Actions before retrying.',502);}
}
async function runStatus(id,env){
 if(!env.GITHUB_TOKEN)return error('Render studio not configured.',503);
 try{
  const response=await fetch(API+'/actions/runs/'+id,{headers:ghHeaders(env),redirect:'error'});
  if(!response.ok)return error('Render status unavailable.',response.status===404?404:502);
  const run=await response.json();
  if(!String(run.path||'').includes('/'+WORKFLOW))return error('Not a Little Panth render.',404);
  return json({status:run.status,conclusion:run.conclusion||null});
 }catch{return error('Render status unavailable.',502);}
}
async function staticPage(request,url){
 // Fixed upstream, never accept an arbitrary proxy destination.
 if(!url.pathname.startsWith('/umto/'))return new Response('Not found',{status:404,headers:NO_CACHE});
 let upstream=new URL(PAGES);upstream.pathname=url.pathname;upstream.search=url.search;
 const isTracker=url.pathname===ROOT+'production-db.json';
 if(isTracker)upstream=new URL('https://raw.githubusercontent.com/nmjp8989/umto/main/little%20panth/production-db.json?fresh='+Date.now());
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
 return out;
}
export default {
 async fetch(request,env,ctx){
  if(!await isOwner(env,ctx))return new Response('Owner-only Little Panth studio. Access and owner configuration are required.',{status:403,headers:NO_CACHE});
  const url=new URL(request.url);
  if(url.pathname==='/api/lp-render/dispatch')return dispatch(request,env,url);
  const match=url.pathname.match(/^\/api\/lp-render\/runs\/(\d+)$/);
  if(match&&request.method==='GET')return runStatus(match[1],env);
  if(!['GET','HEAD'].includes(request.method))return error('Method not allowed.',405);
  if(url.pathname==='/')return new Response(null,{status:302,headers:{...NO_CACHE,Location:ROOT}});
  return staticPage(request,url);
 }
};
