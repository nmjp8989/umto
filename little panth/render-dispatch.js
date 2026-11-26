(() => {
'use strict';
const $=id=>document.getElementById(id);
const privateStudio=Boolean(document.querySelector('meta[name="lp-private-studio"]'));
const root='/api/lp-render';
const workflow='https://github.com/nmjp8989/umto/actions/workflows/little-panth-compilation.yml';
let name='',ids=[],key='',locked=false,runId='',timer=null;
function say(message){$('workflow-status').textContent=message;}
function link(id){const a=$('render-run-link');a.href=id?'https://github.com/nmjp8989/umto/actions/runs/'+id:workflow;a.hidden=false;}
function downloads(mp4,zip){
 const m=$('render-mp4-download'),z=$('render-zip-download');
 m.href=mp4;m.download=name+'.mp4';m.textContent='Download '+name+'.mp4';m.hidden=false;
 z.href=zip;z.textContent='Download ZIP (video + chapters)';z.hidden=false;
 $('render-run-link').textContent='View GitHub render details';
}
function completedRecord(e){
 if(!e||!/^\d+$/.test(String(e.runId))||!/^\d+$/.test(String(e.artifactId)))return false;
 runId=String(e.runId);lock();link(runId);
 const base=root+'/download/'+runId+'/'+e.artifactId+'/'+encodeURIComponent(e.name);
 downloads(base+'.mp4',base+'.zip');say('Your video '+e.filename+' is ready to download.');
 return true;
}
function save(id){try{sessionStorage.setItem(key,JSON.stringify({id}));}catch{}}
function read(){try{return JSON.parse(sessionStorage.getItem(key)||'null');}catch{return null;}}
function lock(){locked=true;$('render-mp4').disabled=true;}
function stop(){clearTimeout(timer);timer=null;}
async function watch(){
 stop();
 try{
  const r=await fetch(root+'/runs/'+runId+'?name='+encodeURIComponent(name),{cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error('status unavailable');
  const j=await r.json();
  if(j.status==='completed'){
   if(j.conclusion==='success'){
    if(j.downloadUrl&&j.zipUrl){downloads(j.downloadUrl,j.zipUrl);say('Your video '+name+'.mp4 is ready to download.');}
    else if(j.expired)say('This render has expired. Generate a new video with a new filename.');
    else{say('Render complete. Waiting for the finished artifact…');timer=setTimeout(watch,5000);}
   }
   else{say('Render finished: '+String(j.conclusion||'unknown')+'. Open the run for details or retry failed jobs.');}
   return;
  }
  say(j.status==='queued'?'Video render queued on GitHub.':'Rendering '+name+'.mp4 on GitHub. You may close this tab; the render continues.');
 }catch{say('Render submitted. Live status is temporarily unavailable; open the GitHub run.');}
 timer=setTimeout(watch,15000);
}
function init(volume,episodes,existing=null){
 if(!privateStudio)return;
 name=volume;ids=episodes;key='lp-render:'+name.toLowerCase()+':'+ids.join(',');
 $('render-description').textContent='Generate a full-quality video directly from this private studio. GitHub authentication is handled on the server.';
 $('render-mp4').textContent='Generate MP4';
 $('manual-request').hidden=true;
 if(completedRecord(existing))return;
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
  if(!/^\d+$/.test(String(j.runId||''))){link('');say('Render accepted. Checking completed export history…');const check=async()=>{try{await window.LPProduction.load();const entry=window.LPProduction.exports().find(e=>e.kind==='github'&&e.name.toLowerCase()===name.toLowerCase()&&e.episodes.join(',')===ids.join(','));if(completedRecord(entry))return;}catch{}timer=setTimeout(check,15000);};timer=setTimeout(check,5000);return;}
  runId=String(j.runId);save(runId);link(runId);watch();
 }catch{link('');say('The request may have reached GitHub. Check the workflow before retrying to avoid duplicate renders.');}
}
window.addEventListener('pagehide',stop);
window.LPRenderDispatch={init,start,enabled:()=>privateStudio,busy:()=>locked};
})();
