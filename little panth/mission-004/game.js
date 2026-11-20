/* Little Panth LP-004: read-along player using existing UMTO pose banks and backgrounds.
   No API keys or external speech requests; optional narration uses a local browser Punjabi voice. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const NS='http://www.w3.org/2000/svg';
const story=window.LP004;
const beats=story.beats;
const chapters=story.chapters;
const stage=$('stage');
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
const camera=new UmtoCamera.DeliveryCamera(stage);
const speakerNames={narrator:'ਕਹਾਣੀਕਾਰ',mehar:'ਮੇਹਰ',baba:'ਬਾਬਾ ਜੀ',baldev:'ਚਾਚਾ ਬਲਦੇਵ',farmer:'ਬਜ਼ੁਰਗ ਕਿਸਾਨ'};
const chapterNames=Object.fromEntries(chapters.map((item,index)=>[item.id,'ਭਾਗ '+(index+1)+' · '+item.pa]));
const frameCount=beats.length;
const beatElements=[];
let bank=null,actors=[],index=0,playing=false,started=false,elapsed=0,frameAt=0,speed=1;
let voiceOn=false,utterance=null,ttsActive=false,englishHints=false,shownBackground='';
let rigFailed=false,rafId=0,transitionSerial=0;

function svg(name,attributes={},parent=null){
  const node=document.createElementNS(NS,name);
  for(const [key,value] of Object.entries(attributes))node.setAttribute(key,String(value));
  if(parent)parent.appendChild(node);
  return node;
}
function point(node,x,y,turn=0,scale=1){node.setAttribute('transform',`translate(${x} ${y}) rotate(${turn}) scale(${scale})`);}
function path(parent,d,fill,stroke='none',width=1){return svg('path',{d,fill,stroke,'stroke-width':width,'stroke-linecap':'round','stroke-linejoin':'round'},parent);}
function safePauseSpeech(){
  if('speechSynthesis' in window)try{speechSynthesis.cancel()}catch{}
  utterance=null;ttsActive=false;
}
function availableVoice(){
  if(!('speechSynthesis' in window))return null;
  return speechSynthesis.getVoices().find(v=>/^pa([-_]|$)/i.test(v.lang))||null;
}
function narrate(beat){
  safePauseSpeech();
  if(!voiceOn||!playing)return;
  const voice=availableVoice();
  if(!voice){voiceOn=false;updateVoice();$('player-hint').textContent='No Punjabi voice is installed in this browser. The animated Gurmukhi read-along still works.';return;}
  const token=transitionSerial;
  utterance=new SpeechSynthesisUtterance(beat.pa);
  utterance.voice=voice;
  utterance.lang=voice.lang||'pa-IN';
  utterance.rate=Math.min(1.5,speed);
  utterance.pitch=1;
  utterance.onend=()=>{
    if(token!==transitionSerial||!playing)return;
    ttsActive=false;
    next(true);
  };
  utterance.onerror=()=>{
    if(token!==transitionSerial)return;
    ttsActive=false;
    $('player-hint').textContent='Voice playback stopped. Continuing with the readable Gurmukhi story.';
  };
  ttsActive=true;
  try{speechSynthesis.speak(utterance)}catch{ttsActive=false}
}
function updateVoice(){
  $('voice').textContent=voiceOn?'🔊 Punjabi voice: on':'🔇 Punjabi voice: off';
  $('voice').setAttribute('aria-pressed',String(voiceOn));
}
function renderStory(){
  const root=$('story-lines');
  let lastChapter='';
  beats.forEach((beat,i)=>{
    if(beat.chapter!==lastChapter){
      lastChapter=beat.chapter;
      const chapter=chapters.find(item=>item.id===beat.chapter);
      const divider=document.createElement('div');
      divider.className='chapter-divider';
      const kicker=document.createElement('span');
      kicker.textContent='CHAPTER '+beat.chapter;
      const title=document.createElement('strong');
      title.lang='pa';title.textContent=chapter.pa;
      divider.append(kicker,title);root.append(divider);
    }
    const block=document.createElement('article');
    block.className='story-beat';
    block.tabIndex=0;
    block.setAttribute('role','button');
    block.setAttribute('aria-label','Go to scene '+(i+1)+', '+speakerNames[beat.speaker]);
    const name=document.createElement('span');name.className='speaker';name.textContent=speakerNames[beat.speaker];
    const text=document.createElement('p');text.className='gurmukhi';text.lang='pa';text.textContent=beat.pa;
    const translation=document.createElement('p');translation.className='english-note';translation.lang='en';translation.textContent=beat.en;
    block.append(name,text,translation);
    block.addEventListener('click',()=>jump(i,true));
    block.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();jump(i,true)}
    });
    beatElements.push(block);root.append(block);
  });
  for(const chapter of chapters){
    const button=document.createElement('button');
    button.type='button';
    button.textContent=chapter.id;
    button.title=chapter.pa+' · '+chapter.en;
    button.setAttribute('aria-label','Go to chapter '+chapter.id+': '+chapter.pa);
    button.addEventListener('click',()=>jump(beats.findIndex(beat=>beat.chapter===chapter.id),true));
    $('chapter-nav').append(button);
  }
}
function scrollCurrent(){
  const scroller=$('story-scroll'),item=beatElements[index];
  if(!item)return;
  const r=item.getBoundingClientRect(),outer=scroller.getBoundingClientRect();
  if(r.top<outer.top+40||r.bottom>outer.bottom-40){
    scroller.scrollTo({top:scroller.scrollTop+r.top-outer.top-45,behavior:'instant'});
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
  if(['wide','establishing','full'].includes(beat.framing))return {x:635,y:385};
  if(beat.framing==='detail')return {x:658,y:568};
  if(beat.framing==='two-shot')return {x:647,y:455};
  const x=beat.speaker==='mehar'?434:beat.speaker==='narrator'?645:840;
  return {x,y:beat.framing==='close-up'?385:442};
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
function updateProgress(){
  const pct=100*Math.min(frameCount,index+elapsed/sceneDuration(beats[index]))/frameCount;
  $('progress-fill').style.width=pct+'%';
  $('progress-track').setAttribute('aria-valuenow',String(Math.round(pct)));
}
function controls(){
  $('back').disabled=!bank||index===0;
  $('forward').disabled=!bank||index===frameCount-1&&!playing;
  $('toggle').disabled=!bank;
  $('restart').disabled=!bank;
  $('toggle').textContent=playing?'Ⅱ Pause':'▶ Play';
  $('scene-count').textContent='SCENE '+String(index+1).padStart(2,'0')+' / '+frameCount;
  $('scene-location').textContent={village:'PUNJAB VILLAGE',gurdwara:'GURDWARA COURTYARD',langar:'LANGAR HALL'}[beats[index].location];
  $('chapter-heading').textContent=chapterNames[beats[index].chapter];
  $('page-folio').textContent='FOLIO '+String(index+1).padStart(2,'0');
  $('chapter-nav').querySelectorAll('button').forEach((btn,i)=>{
    btn.setAttribute('aria-current',chapters[i].id===beats[index].chapter?'step':'false');
  });
}
function showActive(){
  beatElements.forEach((node,i)=>{
    node.setAttribute('aria-current',String(i===index));
  });
  scrollCurrent();
}
function jump(target,autoplay=false){
  if(!bank){$('player-hint').textContent='UMTO character rigs are still loading; the Gurmukhi text is available to read.';return}
  transitionSerial++;
  safePauseSpeech();
  index=Math.min(frameCount-1,Math.max(0,target));
  elapsed=0;
  started=true;$('cover').hidden=true;
  if(autoplay)playing=true
  const beat=beats[index];
  setupScene(beat);
  updateCamera(beat);
  $('scene-speaker').textContent=speakerNames[beat.speaker];
  $('scene-english').textContent=beat.en;
  $('scene-caption').style.display='block';
  $('reflection').hidden=true;
  controls();showActive();updateProgress();
  $('player-hint').textContent='Scene '+(index+1)+' of '+frameCount+' · '+beats[index].pa.trim().split(/\s+/).length+' Gurmukhi words';
  if(playing)narrate(beat);
}
function next(auto=false){
  if(index+1>=frameCount){
    finish();
    return;
  }
  jump(index+1,auto||playing);
}
function finish(){
  playing=false;
  transitionSerial++;safePauseSpeech();
  elapsed=sceneDuration(beats[index]);
  $('reflection').hidden=false;
  $('toggle').textContent='▶ Play again';
  $('forward').disabled=true;
  $('progress-fill').style.width='100%';
  $('progress-track').setAttribute('aria-valuenow','100');
  $('player-hint').textContent='Mission complete · Try the little reflection question on the right.';
  const scroller=$('story-scroll');
  scroller.scrollTo({top:scroller.scrollHeight,behavior:reduced.matches?'instant':'smooth'});
}
function start(){
  if(!bank)return;
  const resumeIndex=index>=frameCount-1&&elapsed>=sceneDuration(beats[index])?0:index;
  jump(resumeIndex,true);
}
function toggle(){
  if(!started){start();return}
  if(index>=frameCount-1&&elapsed>=sceneDuration(beats[index])){jump(0);start();return}
  playing=!playing;controls();
  if(!playing){
    if(ttsActive&&'speechSynthesis'in window)try{speechSynthesis.pause()}catch{}
  }else{
    if(ttsActive&&'speechSynthesis'in window)try{speechSynthesis.resume()}catch{}
    else narrate(beats[index]);
  }
}
function raf(now){
  const delta=frameAt?Math.min(.12,(now-frameAt)/1000):0;frameAt=now;
  if(bank&&playing&&!document.hidden){
    elapsed+=delta*speed;
    if(!ttsActive&&elapsed>=sceneDuration(beats[index]))next(true);
  }
  if(bank){
    animateScene(elapsed);
    camera.update(now,actors.find(a=>a.id===camera.track),!playing);
    updateProgress();
  }
  rafId=requestAnimationFrame(raf);
}
function initializeRig(newBank){
  if(bank)return;
  bank=newBank;
  $('load-status').textContent='Characters ready · press play';
  $('start').disabled=false;
  $('cover').classList.add('ready');
  controls();
  setupScene(beats[0]);
  updateCamera(beats[0]);
  showActive();
  $('player-hint').textContent='Ready: UMTO character poses, five chapters, Gurmukhi story. Press Watch.';
}
const rig=$('umto-rig');
function requestRig(){
  try{rig.contentWindow?.postMessage({type:'anitoons-delivery-request'},location.origin)}catch{}
}
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==rig.contentWindow)return;
  if(event.data?.type==='anitoons-delivery-cast-error'){
    rigFailed=true;$('load-status').textContent='The UMTO character bank could not load.';return;
  }
  if(event.data?.type==='anitoons-delivery-cast'&&event.data.version===2){
    const cast=event.data.bank;
    if(!['mehar','baba','baldev','farmer'].every(id=>cast?.[id]?.left&&cast[id]?.right))return;
    initializeRig(cast);
  }
});
rig.addEventListener('load',requestRig);
requestRig();
renderStory();
controls();updateVoice();
$('start').addEventListener('click',start);
$('toggle').addEventListener('click',toggle);
$('back').addEventListener('click',()=>jump(index-1,playing));
$('forward').addEventListener('click',()=>next(playing));
$('restart').addEventListener('click',()=>{jump(0,false);playing=false;started=false;safePauseSpeech();$('cover').hidden=false;$('scene-caption').style.display='none';controls()});
$('replay').addEventListener('click',()=>{jump(0,true)});
$('speed').addEventListener('change',event=>{speed=Number(event.target.value)||1;});
$('voice').addEventListener('click',()=>{
  if(!voiceOn&&!availableVoice()){
    $('player-hint').textContent='No Punjabi voice found in this browser. Install a Punjabi voice to enable narration; Gurmukhi text and animations still play.';
    return;
  }
  voiceOn=!voiceOn;updateVoice();
  safePauseSpeech();
  if(playing&&voiceOn)narrate(beats[index]);
});
$('translation').addEventListener('click',()=>{
  englishHints=!englishHints;document.body.classList.toggle('show-translation',englishHints);
  $('translation').setAttribute('aria-pressed',String(englishHints));
  $('translation').textContent='English hints: '+(englishHints?'on':'off');
});
document.querySelectorAll('[data-answer]').forEach(btn=>btn.addEventListener('click',()=>{
  const yes=btn.dataset.answer==='right';
  $('answer-feedback').textContent=yes?'Correct! Real seva means helping with love, not looking for praise.':'Try once more: Who needed Mehar’s kindness?';
}));
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&playing){playing=false;controls();if(ttsActive&&'speechSynthesis'in window)try{speechSynthesis.pause()}catch{}}
});
window.addEventListener('beforeunload',()=>{safePauseSpeech();cancelAnimationFrame(rafId)});
requestAnimationFrame(raf);
})();