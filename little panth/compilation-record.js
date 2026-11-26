(() => {
'use strict';
const $=id=>document.getElementById(id),screen=$('record-screen'),recordButton=$('record-tab'),renderButton=$('render-mp4');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const brand=window.LPBrand;
const params=new URLSearchParams(location.search),store=window.LPProduction,volume=store.normalize(params.get('name'));const raw=params.get('episodes')||'';
const requested=[...new Set(raw.split(',').map(s=>s.trim()).filter(Boolean))];
const repo='https://github.com/nmjp8989/umto/actions/workflows/little-panth-compilation.yml';
const ids=requested.filter(s=>/^\d{3}$/.test(s));
let entries=[],active=false,objectURL='',stream=null,recorder=null;
const status=(message,error=false)=>{$('record-status').textContent=message;$('record-status').classList.toggle('error',error);};
const totalLabel=sec=>Math.floor(sec/60)+'m '+String(sec%60).padStart(2,'0')+'s';
function setEnabled(enabled){recordButton.disabled=!enabled||!navigator.mediaDevices?.getDisplayMedia||!window.MediaRecorder;renderButton.disabled=!enabled||window.LPRenderDispatch?.busy();$('copy-ids').disabled=!enabled;}
setEnabled(false);
(async()=>{
 try{
  await store.load();
  if(!store.validName(volume)||store.usedName(volume))throw Error('Choose a new valid filename from the contents page.');
  if(ids.some(id=>!store.review(id).approved))throw Error('Every selected episode must be approved before export.');
  $('volume-name').textContent='Video: '+volume+'.mp4';
  if(!ids.length||ids.length!==requested.length)throw Error('Select valid episodes from the contents page first.');
  const res=await fetch('all-missions.html',{cache:'no-cache'});if(!res.ok)throw Error('Could not read the episode catalogue.');
  const doc=new DOMParser().parseFromString(await res.text(),'text/html');
  const catalogue=new Map([...doc.querySelectorAll('tr[data-seconds]')].map(row=>[row.querySelector('.episode-pick')?.value,{id:row.querySelector('.episode-pick')?.value,title:row.querySelector('a')?.textContent,seconds:Number(row.dataset.seconds)}]));
  if(ids.some(id=>!catalogue.has(id)))throw Error('An episode is not in the catalogue.');
  entries=ids.map(id=>catalogue.get(id));const sum=entries.reduce((s,e)=>s+e.seconds,0);
  $('selected-info').textContent=entries.length+' selected episode'+(entries.length===1?'':'s')+' · approximately '+totalLabel(Math.round(sum+brand.seconds(entries.length)))+' including branding';
  $('selected-list').replaceChildren(...entries.map(e=>{const li=document.createElement('li');li.textContent=e.id+' — '+e.title+' ('+totalLabel(e.seconds)+')';return li;}));
  $('episode-ids').value=JSON.stringify(store.request('export',volume,ids));setEnabled(true);
  window.LPRenderDispatch?.init(volume,ids);
  if(recordButton.disabled)status('Tab recording is not supported in this browser. Use the MP4 renderer.');
 }catch(error){$('selected-info').textContent=error.message;setEnabled(false);}
})();
async function copyIds(){const field=$('episode-ids');field.focus();field.select();try{await navigator.clipboard.writeText(field.value);$('workflow-status').textContent='Export request copied.';return true;}catch{$('workflow-status').textContent='Copy the selected export request manually.';return false;}}
$('copy-ids').onclick=copyIds;
renderButton.onclick=()=>{if(window.LPRenderDispatch?.enabled()){window.LPRenderDispatch.start(store.request('export',volume,ids));return;}window.open(repo,'_blank','noopener');copyIds();$('workflow-status').textContent='Open Run workflow and paste the export request into the request field.';};
function frameFor(id,preload=false){const frame=document.createElement('iframe');frame.title='Little Panth episode '+id;frame.allow='autoplay';if(preload)frame.className='preload';frame.src='mission-'+id+'/?compilation=1'+(Number(id)<=3?'&export=1':'');screen.append(frame);return frame;}
function apiFor(frame){const w=frame.contentWindow;if(w?.lpCompilation)return {ready:()=>w.lpCompilation.ready(),start:()=>w.lpCompilation.start(),status:()=>w.lpCompilation.status()};if(w?.lpExport)return {ready:()=>w.lpExport.ready(),start:()=>w.lpExport.start('all'),status:()=>w.lpExport.status()};return null;}
async function waitReady(frame){const deadline=Date.now()+90000;while(active&&Date.now()<deadline){const api=apiFor(frame);if(api){const state=api.status();if(state?.error)throw Error(state.error);if(api.ready())return api;}await delay(150);}throw Error(active?'Episode did not become ready; reload and try again.':'Recording cancelled.');}
function withTimeout(p,ms,message){return Promise.race([Promise.resolve(p),delay(ms).then(()=>{throw Error(message);})]);}
function mimeType(){return ['video/mp4;codecs=avc1.42001f,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t))||'';}
recordButton.onclick=async()=>{
 if(active||!entries.length)return;
 let chunks=[],cancelled=false,ended=null,recordError=null;
 try{
  setEnabled(false);$('download-video').hidden=true;if(objectURL){URL.revokeObjectURL(objectURL);objectURL='';}
  status('Choose this tab in the sharing dialog and turn on tab audio.');
  const brandReady=brand.prepare();brandReady.catch(()=>{});
  // Capture handle confirms the selected tab where Chromium exposes it.
  const handle='little-panth-compilation-'+Math.random().toString(36).slice(2);
  try{navigator.mediaDevices.setCaptureHandleConfig?.({handle,exposeOrigin:true,permittedOrigins:[location.origin]});}catch{}
  stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:30,max:30},width:{ideal:1920},height:{ideal:1080}},audio:true,preferCurrentTab:true,selfBrowserSurface:'include',surfaceSwitching:'exclude',systemAudio:'exclude'});
  const track=stream.getVideoTracks()[0],surface=track?.getSettings().displaySurface,capture=track?.getCaptureHandle?.();
  if(!track||surface&&surface!=='browser'||capture&&capture.handle!==handle)throw Error('Please select the Little Panth tab, not a window, screen or another tab.');
  if(!stream.getAudioTracks().length)throw Error('Tab audio is missing. Try again and enable Share tab audio.');
  active=true;track.addEventListener('ended',()=>{cancelled=true;active=false;});for(const t of stream.getAudioTracks())t.addEventListener('ended',()=>{cancelled=true;active=false;});
  await brandReady;
  screen.hidden=false;let frame=frameFor(entries[0].id,true),api=await waitReady(frame),next=null;
  const recordingStarted=Date.now();
  const type=mimeType(),options={videoBitsPerSecond:5000000,audioBitsPerSecond:160000,...(type?{mimeType:type}:{})};
  recorder=new MediaRecorder(stream,options);
  ended=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=e=>{recordError=e.error||Error('Recording failed');active=false;reject(recordError);};});
  ended.catch(()=>{});
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  recorder.start(1000);
  await brand.play(screen,true,()=>active);frame.className='';
  for(let i=0;i<entries.length;i++){
   if(!active)throw Error('Recording cancelled.');
   if(i+1<entries.length)next=frameFor(entries[i+1].id,true);
   await withTimeout(api.start(),15000,'Punjabi audio could not start. Use the MP4 render instead.');
   const deadline=Date.now()+Math.max(900000,entries[i].seconds*3000+120000);
   let done=false;
   while(active&&Date.now()<deadline){const s=api.status();if(s.error)throw Error(s.error);if(s.finished){done=true;break;}await delay(100);}
   if(!done)throw Error(active?'Episode playback timed out.':'Recording cancelled.');
   if(i+1<entries.length){const nextApi=await waitReady(next);await brand.play(screen,false,()=>active);next.className='';frame.remove();frame=next;api=nextApi;next=null;}
  }
  if(cancelled||recordError)throw Error('Recording cancelled.');
  active=false;recorder.stop();await ended;
  const mime=recorder.mimeType||type||'video/webm',ext=mime.includes('mp4')?'mp4':'webm',blob=new Blob(chunks,{type:mime});
  if(!blob.size)throw Error('No video was recorded.');
  objectURL=URL.createObjectURL(blob);const link=$('download-video');link.href=objectURL;link.download=volume+'.'+ext;link.hidden=false;try{store.addBrowser(volume,ids,ext,(Date.now()-recordingStarted)/1000);status('Your '+ext.toUpperCase()+' video is ready and saved in local export history. Click Download recorded video.');}catch(e){status('Video is ready, but tracker save failed: '+e.message,true);}
 }catch(error){status(error.message||String(error),true);}
 finally{active=false;brand.close();if(recorder?.state==='recording'||recorder?.state==='paused'){recorder.stop();try{await ended;}catch{}}stream?.getTracks().forEach(t=>t.stop());stream=null;recorder=null;screen.replaceChildren();screen.hidden=true;setEnabled(entries.length>0&&!store.usedName(volume));}
};
window.addEventListener('pagehide',()=>{active=false;brand.close();stream?.getTracks().forEach(t=>t.stop());if(objectURL)URL.revokeObjectURL(objectURL);});
})();