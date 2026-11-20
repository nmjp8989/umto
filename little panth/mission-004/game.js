/* Little Panth LP-004 · control-free animated Gurmukhi reading book.
   The existing UMTO rig supplies facial expressions, mouth poses and walking.
   Dialogue is read from original story.js and recorded Gemini clips from audio/.
   Browser autoplay can be blocked; clicking the illustration enables audio.
   ?export=1 provides a deterministic, audio-backed YouTube export API. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const NS='http://www.w3.org/2000/svg';
const story=window.LP004,beats=story.beats,chapters=story.chapters;
const stage=$('stage');
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
const camera=new UmtoCamera.DeliveryCamera(stage);
const exportMode=new URLSearchParams(location.search).get('export')==='1';
if(exportMode)document.body.classList.add('export');
const speakerNames={narrator:'ਕਹਾਣੀਕਾਰ',mehar:'ਮੇਹਰ',baba:'ਬਾਬਾ ਜੀ',baldev:'ਚਾਚਾ ਬਲਦੇਵ',farmer:'ਬਜ਼ੁਰਗ ਕਿਸਾਨ'};
const beatElements=[];
const chapterNames=Object.fromEntries(chapters.map((chapter,i)=>[chapter.id,'ਭਾਗ '+(i+1)]));
let bank=null,actors=[],index=0,playing=false,elapsed=0,frameAt=0;
let shownBackground='',gestureGranted=exportMode,ttsBlocked=false;
let manifest={},recordedCount=0,finished=0,exportStarted=0,exportError='';
let serial=0,clipActive=false,clipAudio=null,clipFinished=false,holdFinalUntil=0;
let activeCaption=null,exportCaptions=[];
const audio=new Audio();audio.preload='auto';
function svg(name,attributes={},parent=null){
  const node=document.createElementNS(NS,name);
  for(const [key,value] of Object.entries(attributes))node.setAttribute(key,String(value));
  if(parent)parent.appendChild(node);
  return node;
}
function point(node,x,y,turn=0,scale=1){
  node.setAttribute('transform','translate('+x+' '+y+') rotate('+turn+') scale('+scale+')');
}
function path(parent,d,fill,stroke='none',width=1){return svg('path',{d,fill,stroke,'stroke-width':width,'stroke-linecap':'round','stroke-linejoin':'round'},parent);}
function renderStory(){
  let last='';
  for(const [i,beat] of beats.entries()){
    if(beat.chapter!==last){
      last=beat.chapter;
      const divider=document.createElement('div');divider.className='chapter-divider';
      divider.lang='pa';divider.textContent=chapters.find(c=>c.id===beat.chapter).pa;
      $('story-lines').appendChild(divider);
    }
    const block=document.createElement('article');block.className='story-beat';
    block.dataset.scene=beat.id;
    const speaker=document.createElement('span');speaker.className='speaker';speaker.lang='pa';speaker.textContent=speakerNames[beat.speaker];
    const copy=document.createElement('p');copy.className='gurmukhi';copy.lang='pa';copy.textContent=beat.pa;
    block.append(speaker,copy);$('story-lines').appendChild(block);beatElements.push(block);
  }
}
function scrollCurrent(){
  const scroller=$('story-scroll'),block=beatElements[index];
  if(!block)return;
  const r=block.getBoundingClientRect(),bounds=scroller.getBoundingClientRect();
  const desiredTop=bounds.top+33;
  if(r.top<desiredTop||r.bottom>bounds.bottom-35){
    scroller.scrollTop+=r.top-desiredTop;
  }
}
function markReading(){
  for(let i=0;i<beatElements.length;i++){
    const block=beatElements[i];
    block.setAttribute('aria-current',i===index?'true':'false');
    block.dataset.completed=i<index?'true':'false';
  }
  $('scene-heading').textContent=chapterNames[beats[index].chapter];
  $('chapter-label').textContent=chapters.find(c=>c.id===beats[index].chapter).pa;
  $('folio-number').textContent='FOLIO '+String(index+1).padStart(2,'0');
  scrollCurrent();
}
function poseFor(id,beat){
  if(id===beat.speaker){
    const poses={intro:'happy',proud:'proud',point:'point',beckon:'beckon',offer:'offer',concern:'concern',
      alarm:'alarm',reflect:'reflect',happy:'happy',explain:'explain',broom:'explain',mop:'reflect',
      wash:'happy',serve:'offer',complete:'happy',walk:'happy'};
    return poses[beat.action]||'explain';
  }
  if(id==='mehar'&&beat.action==='alarm')return 'alarm';
  if(id==='mehar'&&beat.action==='reflect')return 'reflect';
  if(id==='baba'&&beat.action==='mop')return 'offer';
  if(beat.action==='complete')return 'happy';
  return 'idle';
}
function castFor(beat){
  let other;
  if(beat.location==='village')other='baldev';
  else if(beat.chapter==='03')other=beat.action==='mop'?'baba':'farmer';
  else if(beat.speaker==='farmer')other='farmer';
  else if(beat.speaker==='baldev')other='baldev';
  else if(beat.speaker==='baba')other='baba';
  else if(beat.chapter==='04')other='baldev';
  else other='baba';
  const x2=other==='farmer'?866:857;
  return [
    {id:'mehar',x:beat.action==='walk'?330:424,y:680,height:348,view:'right',pose:poseFor('mehar',beat)},
    {id:other,x:x2,y:673,height:other==='baldev'?446:other==='farmer'?418:440,view:'left',pose:poseFor(other,beat)}
  ];
}
function createActor(item){
  const slot=bank[item.id]?.[item.view];
  if(!slot)return null;
  const node=svg('g',{'data-actor':item.id},$('character-layer'));
  svg('ellipse',{cx:0,cy:-13,rx:item.height*.23,ry:item.height*.057,fill:'url(#shadow)'},node);
  const costume=svg('g',{class:'umto-costume'},node);
  const frame=svg('svg',{x:-item.height*.32,y:-item.height*.96,width:item.height*.64,height:item.height,overflow:'visible'},costume);
  frame.innerHTML=slot.base;
  const layers=Object.fromEntries([...frame.querySelectorAll('[data-scene-layer]')].map(layer=>[layer.dataset.sceneLayer,layer]));
  point(node,item.x,item.y);
  return {...item,node,slot,layers,parts:{},key:''};
}
function actorFrame(actor,seconds,talking,walking){
  const isWalking=walking&&!reduced.matches;
  const pose=isWalking?'walk'+(Math.floor(seconds*10)%12):actor.pose;
  const blinking=!isWalking&&!reduced.matches&&(seconds+actor.homeX*.01)%4.4<.16;
  const mouth=talking&&!reduced.matches?['talkA','talkEE','talkO'][Math.floor(seconds*7)%3]:null;
  const key=pose+'/'+String(blinking)+'/'+(mouth||'');
  if(key===actor.key)return;
  actor.key=key;
  const frame=actor.slot.frames[pose]||actor.slot.frames.idle;
  if(!frame?.parts)return;
  for(const [part,base] of Object.entries(frame.parts)){
    const layer=actor.layers[part];
    if(!layer)continue;
    let graphic=base;
    if(blinking&&part==='eyeGroup')graphic=actor.slot.frames.blink?.parts?.eyeGroup??graphic;
    if(mouth&&['mouthGroup','beardGroup'].includes(part))graphic=actor.slot.frames[mouth]?.parts?.[part]??graphic;
    if(graphic!==actor.parts[part]){layer.innerHTML=graphic;actor.parts[part]=graphic}
  }
  for(const part of actor.slot.headLayers||[])actor.layers[part]?.setAttribute('transform',frame.head||'');
}
function setupScene(beat){
  if(shownBackground!==beat.location){
    shownBackground=beat.location;
    $('backdrop-layer').querySelectorAll('[data-background]').forEach(node=>{
      node.setAttribute('opacity',node.dataset.background===beat.location?'1':'0');
    });
  }
  $('character-layer').replaceChildren();
  actors=castFor(beat).map(createActor).filter(Boolean).map(a=>({...a,homeX:a.x}));
  decorate(beat);
  if(bank)animateScene(0);
}
function decorate(beat){
  const props=$('prop-layer'),fx=$('fx-layer');
  props.replaceChildren();fx.replaceChildren();
  const mode=beat.action;
  if(['proud','point'].includes(mode)&&beat.chapter==='01'){
    const medal=svg('g',{},props);point(medal,560,230,11,1);
    path(medal,'M0 0 15 22 8 65-13 51-34 63-25 17Z','#cda25b','#967239',3);
    svg('circle',{cx:-9,cy:28,r:13,fill:'#ffecb5'},medal);
  }
  if(['arrival','intro','walk'].includes(mode)&&beat.location==='village'){
    svg('image',{href:'../assets/props/chicken.svg',x:38,y:572,width:148,height:108},props);
    svg('image',{href:'../assets/props/basket.svg',x:1030,y:556,width:126,height:108},props);
  }
  if(['wash','serve','broom','explain','proud','point','happy','beckon'].includes(mode)&&beat.location==='langar'){
    const tray=svg('g',{},props);
    for(let i=0;i<4;i++){
      const x=590+i*72;
      svg('ellipse',{cx:x,cy:641,rx:30,ry:11,fill:'#8a8b76',stroke:'#504d44','stroke-width':2},tray);
      svg('ellipse',{cx:x,cy:637,rx:27,ry:9,fill:'#dce0ce',stroke:'#8b9184','stroke-width':1.5},tray);
    }
  }
  if(['offer','concern','alarm','mop','reflect','happy'].includes(mode)&&beat.chapter==='03'){
    const puddle=svg('g',{},fx);
    svg('path',{d:'M552 660Q598 645 630 655T722 655Q754 667 700 677T566 681Q525 670 552 660Z',fill:'#7bb2b3',opacity:mode==='mop'?.35:.68},puddle);
    if(mode==='offer'||mode==='happy'){
      const glass=svg('g',{},props);
      svg('path',{d:'M620 510L670 510 665 555Q645 567 625 555Z',fill:'#d5eef0','fill-opacity':'.8',stroke:'#7d9893','stroke-width':4},glass);
      svg('path',{d:'M626 539Q647 532 666 540L664 554Q644 562 628 555Z',fill:'#76a8bf','fill-opacity':'.54'},glass);
    }
  }
  if(mode==='broom'||mode==='mop'){
    const broom=svg('g',{},props);
    path(broom,'M742 326L729 597','none','#87613d',11);
    path(broom,'M705 584Q734 566 760 589L777 642Q739 657 694 639Z','#b99561','#765f3e',3);
    for(let i=0;i<7;i++)path(broom,`M${706+i*10} 602L${695+i*13} 646`,'none','#8b6a47',2);
  }
  if(mode==='serve'||mode==='offer'&&beat.location==='langar'){
    const jug=svg('g',{},props);
    svg('path',{d:'M679 460h91v124q-43 29-91 0Z',fill:'#c4cdc6',stroke:'#5f6b63','stroke-width':5},jug);
    path(jug,'M764 470Q824 471 817 520Q811 552 771 547','none','#66766e',11);
    svg('ellipse',{cx:723,cy:462,rx:48,ry:11,fill:'#e5e8de',stroke:'#7a8b80','stroke-width':4},jug);
  }
  if(mode==='complete'){
    for(let i=0;i<11;i++)svg('circle',{cx:80+i*116,cy:110+(i%4)*74,r:3+i%3,fill:i%2?'#f4d289':'#fff1c1',opacity:.85},fx);
  }
}
function focusFor(beat){
  // Actor faces are near y=510–560 in the 1280x720 UMTO artwork.
  // Crop lower for dialogue so the face is central, never buried below the frame.
  if(['wide','establishing','full'].includes(beat.framing))return {x:635,y:385};
  if(beat.framing==='detail')return {x:658,y:605};
  if(beat.framing==='two-shot')return {x:647,y:570};
  const x=beat.speaker==='mehar'?434:beat.speaker==='narrator'?645:840;
  return {x,y:600};
}
function updateCamera(beat){
  const move=beat.action==='walk';
  camera.cue({preset:beat.framing,focus:focusFor(beat),cut:!['intro','complete','walk'].includes(beat.action),
    motion:move?'tracking':beat.action==='intro'?'dolly-in':'static',track:move?'mehar':undefined,
    duration:move?1200:2400,parallax:move||beat.action==='intro'});
}
function animateScene(seconds){
  const beat=beats[index];
  const duration=sceneDuration(beat);
  for(const actor of actors){
    let x=actor.homeX,y=actor.y;
    const walking=beat.action==='walk'&&actor.id==='mehar'&&seconds<duration*.63;
    if(walking)x+=Math.min(seconds/(duration*.63),1)*485;
    if(!reduced.matches)y+=Math.sin(seconds*2.3+actor.homeX*.01)*1.7;
    actor.x=x;
    point(actor.node,x,y);
    const talking=playing&&actor.id===beat.speaker;
    actorFrame(actor,seconds,talking,walking);
  }
  if(beat.action==='mop'&&!reduced.matches){
    $('prop-layer').setAttribute('transform',`translate(${Math.sin(seconds*2.5)*4} 0)`);
  }else $('prop-layer').removeAttribute('transform');
}
function sceneDuration(beat){return Math.max(7,beat.pa.trim().split(/\s+/).length*.43);}

function recorded(id){
  const item=manifest[id],beat=beats.find(b=>b.id===id);
  return !!(item&&beat&&item.text===beat.pa);
}
function closeCaption(){
  if(!activeCaption)return;
  activeCaption.end=Date.now()-exportStarted;
  exportCaptions.push(activeCaption);
  activeCaption=null;
}
function stopAudio(){
  audio.onended=null;audio.onerror=null;
  audio.pause();audio.removeAttribute('src');audio.load();
  clipActive=false;
}
function showScene(newIndex){
  serial++;
  stopAudio();
  if(exportStarted)closeCaption();
  index=newIndex;elapsed=0;holdFinalUntil=0;
  setupScene(beats[index]);updateCamera(beats[index]);markReading();
  if(exportStarted){
    activeCaption={start:Date.now()-exportStarted,text:beats[index].pa};
  }
  if(playing)playClip(serial);
}
function complete(){
  if(finished)return;
  playing=false;stopAudio();
  if(exportStarted)closeCaption();
  finished=Date.now();
  $('chapter-label').textContent='ਸੇਵਾ · ਨਿਮਰਤਾ · ਪਿਆਰ';
}
function nextScene(){
  if(index===beats.length-1){
    // Hold the final page briefly as a calm reading-book ending.
    holdFinalUntil=performance.now()+1800;
    clipFinished=true;clipActive=false;
  }else showScene(index+1);
}
function playClip(token){
  if(!playing)return;
  const beat=beats[index];
  clipFinished=false;
  if(!recorded(beat.id)||(!gestureGranted&&!exportMode)){
    clipActive=false;
    if(exportMode)exportError='Missing recorded Gemini Punjabi dialogue for '+beat.id;
    return;
  }
  audio.src='audio/'+beat.id+'.mp3';
  audio.playbackRate=1;
  clipActive=true;
  audio.onended=()=>{
    if(token!==serial)return;
    clipFinished=true;clipActive=false;
    nextScene();
  };
  audio.onerror=()=>{
    if(token!==serial)return;
    clipActive=false;
    if(exportMode)exportError='Could not play audio/'+beat.id+'.mp3';
  };
  audio.play().then(()=>{if(token===serial)gestureGranted=true}).catch(()=>{
    if(token!==serial)return;
    clipActive=false;gestureGranted=false;
    if(exportMode)exportError='Autoplay audio blocked by headless Chrome for '+beat.id;
  });
}
function start(){
  if(!bank)return;
  playing=true;finished=0;
  $('loading').hidden=true;
  showScene(0);
}
function beginListening(){
  if(!bank)return;
  gestureGranted=true;
  // A single natural tap on the illustration unlocks browser audio; no UI controls.
  // Start from the first sentence so sound and its Gurmukhi highlight stay synchronized.
  start();
}
function tick(now){
  const dt=frameAt?Math.min(.13,(now-frameAt)/1000):0;frameAt=now;
  if(bank&&playing&&!document.hidden){
    if(clipActive&&audio.readyState>=2)elapsed=audio.currentTime;
    else elapsed+=dt;
    if(holdFinalUntil&&now>=holdFinalUntil)complete();
    else if(!clipActive&&!holdFinalUntil&&elapsed>=sceneDuration(beats[index]))nextScene();
  }
  if(bank){
    animateScene(elapsed);
    camera.update(now,actors.find(a=>a.id===camera.track),!playing);
  }
  requestAnimationFrame(tick);
}
function initializeRig(newBank){
  if(bank)return;
  bank=newBank;$('loading').hidden=true;
  start();
}
const rig=$('umto-rig');
function requestRig(){
  try{rig.contentWindow?.postMessage({type:'anitoons-delivery-request'},location.origin)}catch{}
}
window.addEventListener('message',event=>{
  if(event.source!==rig.contentWindow||event.origin!==location.origin)return;
  if(event.data?.type==='anitoons-delivery-cast-error'){
    exportError='UMTO character pose bank could not load';
    $('loading').textContent='The animation could not load';return;
  }
  if(event.data?.type==='anitoons-delivery-cast'&&event.data.version===2){
    const cast=event.data.bank;
    if(!['mehar','baba','baldev','farmer'].every(id=>cast?.[id]?.left&&cast[id]?.right))return;
    initializeRig(cast);
  }
});
rig.addEventListener('load',requestRig);
const manifestReady=fetch('audio/generation-manifest.json',{cache:'no-store'})
  .then(r=>r.ok?r.json():{}).then(doc=>{
    manifest=doc;
    recordedCount=beats.filter(b=>recorded(b.id)).length;
  }).catch(()=>{manifest={};recordedCount=0});
renderStory();
$('movie').addEventListener('click',beginListening);
$('movie').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();beginListening()}});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&!exportMode){
    stopAudio();playing=false;
  }else if(!document.hidden&&!exportMode&&bank&&!playing&&!finished){
    playing=true;showScene(index);
  }
});
window.addEventListener('beforeunload',()=>stopAudio());
window.lp004Export={
  ready:()=>!!bank&&recordedCount===beats.length&&!exportError,
  diagnostic:()=>({bankReady:!!bank,clipsAvailable:recordedCount,clipsNeeded:beats.length,error:exportError}),
  start:()=>{
    if(!bank||recordedCount!==beats.length)throw Error('Gemini audio not fully generated for Mission 04');
    if(exportStarted)throw Error('Export already started');
    gestureGranted=true;exportStarted=Date.now();exportCaptions=[];activeCaption=null;
    start();return exportStarted;
  },
  status:()=>({started:exportStarted,finished,error:exportError,index,phase:beats[index].chapter,captions:finished?exportCaptions:[]})
};
if(new URLSearchParams(location.search).get('test')==='1'){
  window.lp004Test={
    jump:(scene)=>{playing=false;showScene(scene)},
    status:()=>({scene:index,playing,recordedCount,active:beatElements[index]?.textContent||''})
  };
}
Promise.resolve(manifestReady).then(()=>requestRig());
requestAnimationFrame(tick);
})();
