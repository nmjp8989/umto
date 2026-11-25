/* Mission 04 uses the UMTO character rig and the recorded narration's reading clock. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const NS='http://www.w3.org/2000/svg';
const beats=window.LP004.beats;
const {makeReading,readingAt}=window.LP004Reading;
const stage=$('stage');
const book=$('book');
const readingLine=$('reading');
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
const camera=new UmtoCamera.DeliveryCamera(stage);
const params=new URLSearchParams(location.search);
const exportMode=params.get('export')==='1';
const compiling=params.get('compilation')==='1';
let compilationStart=0;
let bank=null,actors=[],index=0,playing=false,elapsed=0,frameAt=0;
let shownBackground='',gestureGranted=false,autoplayAttempted=false;
let manifest={},wordTimings={},exportError='';
let serial=0,clipActive=false,finished=false,holdUntil=0,cameraStart=0;
let reading,renderedPhrase=-1,highlightedWord=-1,visibleWords=[];
let sceneDurationMs=0,spillAt=0,props={};
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
function trackFor(beat){
  const timeline=wordTimings[beat.id],voice=manifest[beat.id];
  if(voice?.text===beat.pa&&timeline?.dialogueHash===voice.hash&&timeline.durationMs>0)return timeline;
}
function setReading(beat,durationMs){
  const track=trackFor(beat);
  sceneDurationMs=track?.durationMs||durationMs||Math.max(7000,beat.pa.trim().split(/\s+/u).length*430);
  reading=makeReading(beat.pa,sceneDurationMs,track?.words);
  renderedPhrase=-1;
}
function updateReading(ms){
  const {word,phrase}=readingAt(reading,ms);
  const {first,end}=reading.phrases[phrase];
  if(phrase!==renderedPhrase){
    const content=document.createDocumentFragment();
    visibleWords=[];
    for(let i=first;i<end;i++){
      const span=document.createElement('span');
      span.className='word';
      span.textContent=reading.words[i];
      if(i>first)content.append(' ');
      content.append(span);
      visibleWords.push(span);
    }
    readingLine.replaceChildren(content);
    renderedPhrase=phrase;
    highlightedWord=-1;
  }
  if(highlightedWord!==word){
    visibleWords[highlightedWord-first]?.removeAttribute('aria-current');
    visibleWords[word-first]?.setAttribute('aria-current','true');
    highlightedWord=word;
  }
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
  else if(['farmer','baba','baldev'].includes(beat.speaker))other=beat.speaker;
  else if(beat.chapter==='03'||beat.action==='farmer-arrival')other='farmer';
  else if(beat.chapter==='04')other='baldev';
  else other='baba';
  const x2=other==='farmer'?866:857;
  const cast=[
    {id:'mehar',x:beat.action==='walk'?330:424,y:680,height:348,view:'right',pose:poseFor('mehar',beat)},
    {id:other,x:beat.action==='mop'?654:x2,y:673,height:other==='baldev'?446:other==='farmer'?418:440,view:'left',pose:poseFor(other,beat)}
  ];
  if(beat.action==='mop')cast.push({id:'farmer',x:908,y:676,height:418,view:'left',pose:'concern'});
  return cast;
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
function actorFrame(actor,seconds,talking,walkLength){
  const isWalking=seconds<walkLength&&!reduced.matches;
  const stride=isWalking?seconds*10:undefined;
  const pose=isWalking?'walk'+(Math.floor(stride)%12):actor.pose;
  const blinking=!isWalking&&!reduced.matches&&(seconds+actor.homeX*.01)%4.4<.16;
  const mouth=talking&&!reduced.matches?['talkA','talkEE','talkO'][Math.floor(seconds*7)%3]:null;
  const key=pose+'/'+String(blinking)+'/'+(mouth||'');
  if(key!==actor.key){
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
  rig.contentWindow.UmtoDeliveryArms?.(actor.layers.torso,actor.slot,pose,seconds,{
    stride,walkLength,still:reduced.matches
  });
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
  props=Object.fromEntries([...stage.querySelectorAll('[data-prop]')].map(node=>[node.dataset.prop,node]));
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
    svg('image',{'data-prop':'chicken',href:'../assets/props/chicken.svg',x:38,y:572,width:148,height:108},props);
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
    const puddle=svg('g',{'data-prop':'spill'},fx);
    svg('path',{d:'M552 660Q598 645 630 655T722 655Q754 667 700 677T566 681Q525 670 552 660Z',fill:'#7bb2b3',opacity:mode==='mop'?.35:.68},puddle);
    if(mode==='offer'||mode==='happy'){
      const glass=svg('g',{'data-prop':'glass'},props);
      svg('path',{d:'M620 510L670 510 665 555Q645 567 625 555Z',fill:'#d5eef0','fill-opacity':'.8',stroke:'#7d9893','stroke-width':4},glass);
      svg('path',{d:'M626 539Q647 532 666 540L664 554Q644 562 628 555Z',fill:'#76a8bf','fill-opacity':'.54'},glass);
    }
  }
  if(mode==='broom'){
    const broom=svg('g',{},props);
    path(broom,'M742 326L729 597','none','#87613d',11);
    path(broom,'M705 584Q734 566 760 589L777 642Q739 657 694 639Z','#b99561','#765f3e',3);
    for(let i=0;i<7;i++)path(broom,`M${706+i*10} 602L${695+i*13} 646`,'none','#8b6a47',2);
  }
  if(mode==='mop'){
    const cloth=svg('g',{'data-prop':'cloth'},props);
    path(cloth,'M591 652q29-11 52-5l24 18q-29 12-58 8Z','#efd995','#b58d49',3);
    path(cloth,'M610 650q19 3 34 17','none','#c49b5b',2);
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
  return {x,y:560};
}
function updateCamera(beat){
  const move=beat.action==='walk';
  const reveal=beat.action==='intro'||beat.layout==='cinema'&&['wide','establishing'].includes(beat.framing);
  camera.cue({preset:beat.framing,focus:focusFor(beat),cut:true});
  if(move||reveal){
    camera.cue({preset:beat.framing,focus:focusFor(beat),width:move?1050:1170,
      motion:move?'tracking':'dolly-in',track:move?'mehar':undefined,duration:move?1200:6800,parallax:true});
  }
  cameraStart=camera.started;
}
function animateScene(seconds){
  const beat=beats[index];
  for(const actor of actors){
    let x=actor.homeX,y=actor.y;
    let walkLength=0;
    if(beat.action==='walk'&&actor.id==='mehar'){
      walkLength=sceneDurationMs*.00063;
      x+=Math.min(seconds/walkLength,1)*375;
    }
    if(beat.action==='farmer-arrival'&&actor.id==='farmer'){
      walkLength=6;
      x+=320*Math.max(0,1-seconds/walkLength);
    }
    if(!reduced.matches)y+=Math.sin(seconds*2.3+actor.homeX*.01)*1.7;
    actor.x=x;
    point(actor.node,x,y);
    const talking=(playing||exportMode)&&highlightedWord>=0&&actor.id===beat.speaker;
    actorFrame(actor,seconds,talking,walkLength);
  }
  if(reduced.matches)return;
  if(props.chicken)point(props.chicken,Math.min(seconds*50,245),-Math.abs(Math.sin(seconds*9))*7);
  if(props.cloth)point(props.cloth,Math.sin(seconds*3.3)*34,Math.cos(seconds*3.3)*2);
  if(spillAt&&props.spill&&props.glass){
    const fall=Math.max(0,Math.min(1,(seconds-spillAt)*3));
    props.spill.setAttribute('opacity',String(fall));
    props.glass.setAttribute('transform','translate('+Math.round(fall*18)+' '+Math.round(fall*124)+') rotate('+Math.round(fall*85)+' 645 540)');
  }
}

function renderFrame(seconds,now){
  elapsed=seconds;
  updateReading(elapsed*1000);
  animateScene(elapsed);
  camera.update(now,actors.find(actor=>actor.id===camera.track),false);
}
function stopAudio(){
  audio.onended=null;audio.onerror=null;audio.onloadedmetadata=null;
  audio.pause();audio.removeAttribute('src');audio.load();
  clipActive=false;
}
function selectScene(newIndex){
  index=newIndex;
  const beat=beats[index];
  book.dataset.layout=beat.layout||'spread';
  book.dataset.scene=beat.id;
  setReading(beat);
  spillAt=(reading.timings[reading.words.indexOf('ਫਿਸਲ')]?.[0]||0)/1000;
  setupScene(beat);
  updateCamera(beat);
  renderFrame(0,cameraStart);
}
function showScene(newIndex){
  serial++;
  stopAudio();
  holdUntil=0;
  selectScene(newIndex);
  if(playing)playClip(serial);
}

function finishScene(){
  elapsed=Math.max(elapsed,sceneDurationMs/1000);
  clipActive=false;
  holdUntil=performance.now()+(index===beats.length-1?1800:180);
}

function playClip(token){
  const beat=beats[index];
  if(manifest[beat.id]?.text!==beat.pa||(!gestureGranted&&autoplayAttempted)){if(compiling)exportError='Missing or blocked Punjabi clip: '+beat.id;return;}
  autoplayAttempted=true;
  audio.src='audio/'+beat.id+'.mp3';
  clipActive=true;
  audio.onloadedmetadata=()=>{if(token===serial)setReading(beat,audio.duration*1000)};
  audio.onended=()=>{if(token===serial)finishScene()};
  audio.onerror=()=>{if(token===serial){clipActive=false;if(compiling)exportError='Could not load Punjabi clip: '+beat.id;}};
  audio.play().then(()=>{if(token===serial)gestureGranted=true}).catch(()=>{
    if(token!==serial)return;
    clipActive=false;gestureGranted=false;if(compiling)exportError='Punjabi playback blocked: '+beat.id;
  });
}
function start(){
  if(!bank)return;
  playing=true;finished=false;
  showScene(0);
}
function beginListening(){
  if(!bank||exportMode||playing&&clipActive)return;
  gestureGranted=true;
  start();
}
function tick(now){
  const dt=frameAt?Math.min(.13,(now-frameAt)/1000):0;
  frameAt=now;
  if(playing&&!document.hidden){
    if(clipActive)elapsed=audio.currentTime;
    else if(!holdUntil)elapsed+=dt;
    if(!clipActive&&!holdUntil&&elapsed*1000>=sceneDurationMs)finishScene();
    if(holdUntil&&now>=holdUntil){
      if(index===beats.length-1){
        playing=false;finished=true;
        stopAudio();
      }else showScene(index+1);
    }
    renderFrame(elapsed,now);
  }
  requestAnimationFrame(tick);
}

async function readJson(url){
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok)throw Error('Could not load '+url);
  return response.json();
}
const assetsReady=Promise.all([
  readJson('audio/generation-manifest.json').then(doc=>{manifest=doc}).catch(()=>{}),
  readJson('audio/word-timings.json').then(doc=>{wordTimings=doc}).catch(()=>{}),
  document.fonts.load('700 48px "Little Panth Gurmukhi"','ਪੰਜਾਬ').catch(()=>{})
]);
const rig=$('umto-rig');
function requestRig(){
  try{rig.contentWindow?.postMessage({type:'anitoons-delivery-request'},location.origin)}catch{}
}
window.addEventListener('message',async event=>{
  if(event.source!==rig.contentWindow||event.origin!==location.origin)return;
  if(event.data?.type==='anitoons-delivery-cast-error'){
    exportError='UMTO character pose bank could not load';
    $('loading').textContent='ਤਸਵੀਰ ਤਿਆਰ ਨਹੀਂ ਹੋ ਸਕੀ।';return;
  }
  if(event.data?.type==='anitoons-delivery-cast'&&event.data.version===2){
    const cast=event.data.bank;
    if(!['mehar','baba','baldev','farmer'].every(id=>cast?.[id]?.left&&cast[id]?.right))return;
    await assetsReady;
    if(bank)return;
    bank=cast;
    $('loading').hidden=true;
    if(exportMode||compiling)selectScene(0);
    else start();
  }
});
rig.addEventListener('load',requestRig);
assetsReady.then(requestRig);
$('movie').addEventListener('click',beginListening);
$('movie').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();beginListening()}});
document.addEventListener('visibilitychange',()=>{
  if(!playing||!clipActive)return;
  if(document.hidden)audio.pause();
  else audio.play().catch(()=>{clipActive=false});
});
window.addEventListener('beforeunload',()=>stopAudio());
function renderAt(scene,ms){
  if(index!==scene||ms<elapsed*1000)selectScene(scene);
  renderFrame(ms/1000,cameraStart+ms);
}
if(compiling){
  window.lpCompilation={
    ready:()=>!!bank&&beats.every(b=>!!trackFor(b)),
    start(){if(!this.ready()||compilationStart)throw Error('Mission 004 narration not ready');gestureGranted=true;compilationStart=Date.now();start();return compilationStart;},
    status:()=>({started:compilationStart,finished:finished?Date.now():0,error:exportError,elapsed:beats.slice(0,index).reduce((n,b)=>n+(trackFor(b)?.durationMs||0)+180,0)+elapsed*1000,total:beats.reduce((n,b)=>n+(trackFor(b)?.durationMs||0)+180,0)})
  };
}
if(exportMode){
  window.lp004Export={ready:()=>!!bank,error:()=>exportError,frame:renderAt};
}else{
  if(params.get('test')==='1'){
    window.lp004Test={
      jump:(scene,ms=0)=>{playing=false;showScene(scene);renderAt(scene,ms)},
      status:()=>({scene:index,playing,finished,clipActive,elapsed,highlightedWord,aligned:!!trackFor(beats[index])})
    };
  }
  requestAnimationFrame(tick);
}
})();
