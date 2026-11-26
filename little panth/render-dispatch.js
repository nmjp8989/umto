(() => {
'use strict';
const $=id=>document.getElementById(id);
const privateStudio=Boolean(document.querySelector('meta[name="lp-private-studio"]'));
const root='/api/lp-render';
const workflow='https://github.com/nmjp8989/umto/actions/workflows/little-panth-compilation.yml';
let name='',ids=[],key='',locked=false,runId='',timer=null;
function say(message){$('workflow-status').textContent=message;}
function link(id){const a=$('render-run-link');a.href=id?'https://github.com/nmjp8989/umto/actions/runs/'+id:workflow;a.hidden=false;}
function save(id){try{sessionStorage.setItem(key,JSON.stringify({id}));}catch{}}
function read(){try{return JSON.parse(sessionStorage.getItem(key)||'null');}catch{return null;}}
function lock(){locked=true;$('render-mp4').disabled=true;}
function stop(){clearTimeout(timer);timer=null;}
async function watch(){
 stop();
 try{
  const r=await fetch(root+'/runs/'+runId,{cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error('status unavailable');
  const j=await r.json();
  if(j.status==='completed'){
   if(j.conclusion==='success'){say('Your video '+name+'.mp4 is ready. Open the completed render to download its artifact.');$('render-run-link').textContent='Download video artifact';}
   else{say('Render finished: '+String(j.conclusion||'unknown')+'. Open the run for details or retry failed jobs.');}
   return;
  }
  say(j.status==='queued'?'Video render queued on GitHub.':'Rendering '+name+'.mp4 on GitHub. You may close this tab; the render continues.');
 }catch{say('Render submitted. Live status is temporarily unavailable; open the GitHub run.');}
 timer=setTimeout(watch,15000);
}
function init(volume,episodes){
 if(!privateStudio)return;
 name=volume;ids=episodes;key='lp-render:'+name.toLowerCase()+':'+ids.join(',');
 $('render-description').textContent='Generate a full-quality video directly from this private studio. GitHub authentication is handled on the server.';
 $('render-mp4').textContent='Generate MP4';
 $('manual-request').hidden=true;
 const saved=read();
 if(/^\d+$/.test(String(saved?.id||''))){runId=String(saved.id);lock();link(runId);watch();}
}
async function start(request){
 if(!privateStudio||locked||!key)return;
 lock();say('Starting the GitHub video render…');
 try{
  const r=await fetch(root+'/dispatch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(25000)});
  const j=await r.json().catch(()=>({}));
  if(!r.ok){
   if(r.status>=500){link('');say(j.error||'Could not verify whether the render started. Check GitHub before retrying.');return;}
   locked=false;$('render-mp4').disabled=false;say(j.error||'GitHub rejected this request.');return;
  }
  if(!/^\d+$/.test(String(j.runId||''))){link('');say('Render accepted. Open GitHub Actions to find the new run.');return;}
  runId=String(j.runId);save(runId);link(runId);watch();
 }catch{link('');say('The request may have reached GitHub. Check the workflow before retrying to avoid duplicate renders.');}
}
window.addEventListener('pagehide',stop);
window.LPRenderDispatch={init,start,enabled:()=>privateStudio,busy:()=>locked};
})();
