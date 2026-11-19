/* Little Panth LP-001 — browser-only playable adventure.
   Static SVG art and cached Punjabi MP3s. No credentials or remote API at play time. */
(() => {
'use strict';
const $=id=>document.getElementById(id), NS='http://www.w3.org/2000/svg', BASE='../';
const imageOf=path=>new URL(BASE+path,location.href).href;
const backgrounds={village:'anchor set/village courtyard.svg',field:'anchor set/wheat field.svg',storage:'anchor set/village storage courtyard.svg',gurdwara:'anchor set/gurudwara courtyard.svg'};
const asset={patch:'assets/wheat/wheat-patch.svg',bundle:'assets/wheat/wheat-bundle.svg',sack:'assets/wheat/wheat-sack.svg',chicken:'assets/props/chicken.svg',basket:'assets/props/basket.svg',sickle:'assets/tools/sickle.svg'};
const n=(name,attrs={})=>{const el=document.createElementNS(NS,name);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,String(v));return el};
const stage=$('stage'),props=$('worldProps'),cast=$('characters'),front=$('foreground'),fx=$('fx');
const captionModes=['English','Full','Off'];
let captionMode=0, captionRequired=false;
try { captionMode=Math.max(0,captionModes.indexOf(localStorage.getItem('little-panth-captions'))); } catch {}
function updateCaptions(){
 const mode=captionModes[captionMode];
 $('spoken').hidden=mode!=='Full'&&!(mode==='Off'&&captionRequired);
 $('roman').hidden=mode!=='Full';
 $('english').hidden=mode==='Off'&&!captionRequired;
 $('captionToggle').textContent='CC · '+mode;
}
$('captionToggle').onclick=()=>{
 captionMode=(captionMode+1)%captionModes.length;
 try { localStorage.setItem('little-panth-captions',captionModes[captionMode]); } catch {}
 updateCaptions();
};
const STORAGE_KEY='little-panth-lp001-v1';
let story,cartSource,chickenSource,rig={},actors=[],currentVoice=null,voiceResolver=null,voiceEnabled=true,musicEnabled=true,
    epoch=0,activeSpeaker='',activeListener='',stageBusy=false,loaded=0,harvested=0,selectedSack=null,shareCounts={home:0,seeds:0,sharing:0},quizIndex=0,
    eighthAttempts=0,locationId='village',act=1,runStarted=false,firstLoad=true;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const getXY=e=>{const pt=stage.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;return pt.matrixTransform(stage.getScreenCTM().inverse())};
function setLabel(objective,counter='',instruction=''){
 $('objective').textContent=objective;$('counter').textContent=counter;$('instruction').textContent=instruction||objective;
}
function banner(text,ms=1500){const b=$('activity');b.textContent=text;b.hidden=false;clearTimeout(b._t);b._t=setTimeout(()=>b.hidden=true,ms)}
function background(id){locationId=id;delete stage.dataset.light;$('background').setAttribute('href',imageOf(backgrounds[id]));$('location').textContent={village:'Village courtyard',field:'Golden wheat field',storage:'Baldev\u2019s storage yard',gurdwara:'Gurudwara Sahib'}[id];}
function clearStage(){sharingIntro=false;hideWatchHand(true);crashPending=false;reactionFocus='';walkingFocus='';hideNarrator();resetCamera();activeListener='';actors=[];clearTimeout($('activity')._t);$('activity').hidden=true;props.replaceChildren();front.replaceChildren();fx.replaceChildren();$('verse').hidden=true;$('speech').hidden=true;$('sceneAction').hidden=true;$('quiz').hidden=true;$('finish').hidden=true;cast.replaceChildren();activeSpeaker='';selectedSack=null;stageBusy=false}
function scene(id,number,title){epoch++;clearStage();act=number;$('actBadge').textContent='ACT '+number+' / 5';$('chapter').textContent=title;background(id);save();}
function save(){if(!runStarted)return;try{localStorage.setItem(STORAGE_KEY,JSON.stringify({phase:window.lpPhase||'intro',loaded,harvested,shareCounts,quizIndex,ts:Date.now()}))}catch{}}
function setPhase(id){window.lpPhase=id;save()}
function button(text,fn){const el=$('sceneAction');el.textContent=text;el.hidden=false;el.onclick=()=>{el.hidden=true;sound.ping();fn()}}
function clipStop(){if(currentVoice){currentVoice.onended=null;currentVoice.onerror=null;currentVoice.pause();currentVoice=null;}if('speechSynthesis'in window)try{speechSynthesis.cancel()}catch{};if(voiceResolver){const f=voiceResolver;voiceResolver=null;f()}}
async function oneLine(id,token,autoRead) {
 if(token!==epoch)return;
 hideWatchHand(true);
 const line=story.lines[id];if(!line)return;
 if(id==='lp009'&&window.lpPhase==='harvest'&&!$('cartHost')){
  activeSpeaker='';activeListener='';$('speech').hidden=true;resetCamera();updateTalking();
  await rollFieldCartIn(token);if(token!==epoch)return;
 }
 activeSpeaker=line.speaker;
 activeListener=line.to||'';
 if(line.speaker==='narrator'&&!actors.some(actor=>actor.id==='narrator'))showNarrator();else hideNarrator();
 dialoguePose=storyPoses[id]||'explain';
 dialogueStart=performance.now();
 directAttention();
 captionRequired=!voiceEnabled||Boolean(line.sacred);
 updateCaptions();
 updateTalking();
 $('speech').hidden=false;
 $('speaker').textContent=story.speakerDisplay[line.speaker]||line.speaker;
 $('spoken').textContent=line.pa;
 $('roman').textContent=line.roman;
 $('english').textContent=line.en;
 $('soundHint').textContent='';
 const lastFocus=document.activeElement;
 await new Promise(resolve=>{
   let settled=false;let utterance=null;let readTimer;
   let cueTimer;const fireCue=()=>{if(id==='lp017'&&token===epoch)triggerCartBreak()};
   const done=()=>{if(settled)return;settled=true;clearTimeout(readTimer);clearTimeout(cueTimer);fireCue();voiceResolver=null;if(currentVoice){currentVoice.onended=null;currentVoice.onerror=null;currentVoice.pause();currentVoice=null}if(utterance&&'speechSynthesis'in window)try{speechSynthesis.cancel()}catch{};resolve()};
   voiceResolver=done;$('nextLine').onclick=done;
   function startReadingTimer(){
     if(autoRead||watchMode){clearTimeout(readTimer);readTimer=setTimeout(done,Math.max(line.sacred?6500:3800,line.en.split(/\s+/).length*325));}
   }
   if(!voiceEnabled){if(id==='lp017')cueTimer=setTimeout(fireCue,3300);startReadingTimer();return}
   let failed=false;
   const audio=new Audio('audio/'+id+'.mp3');currentVoice=audio;audio.volume=.94;
   if(id==='lp017')audio.addEventListener('timeupdate',()=>{if(Number.isFinite(audio.duration)&&audio.currentTime>=audio.duration*.82)fireCue()});
   if(autoRead||watchMode)audio.addEventListener('pause',()=>{if(!voiceEnabled&&!settled)startReadingTimer()});
   audio.onended=()=>setTimeout(done,watchMode?Math.max(350,4600-(performance.now()-dialogueStart)):250);
   audio.onerror=()=>{
     if(settled||failed)return;
     failed=true;
     currentVoice=null;
     // On a first deploy or offline run, keep text interactive instead of failing.
     if('speechSynthesis'in window && speechSynthesis.getVoices().some(v=>/^pa(-|_)/i.test(v.lang))) {
       utterance=new SpeechSynthesisUtterance(line.pa);
       utterance.lang='pa-IN';utterance.rate=.94;
       utterance.onend=()=>setTimeout(done,200);utterance.onerror=showUnavailable;
       speechSynthesis.speak(utterance);
     }else showUnavailable();
   };
   function showUnavailable(){
     if(id==='lp017')cueTimer=setTimeout(fireCue,3300);
     captionRequired=true;
     updateCaptions();
     $('soundHint').textContent='Narration unavailable for this line';
     startReadingTimer();
   }
   audio.play().catch(()=>{audio.onerror?.()});
 });
 if(token!==epoch)return;
 if(lastFocus&&typeof lastFocus.focus==='function'&&lastFocus!==$('nextLine'))try{lastFocus.focus({preventScroll:true})}catch{}
}
async function speak(beat){const token=epoch;const ids=story.beats[beat]||[];stageBusy=true;for(const id of ids){if(token!==epoch)break;await oneLine(id,token,beat==='gurbani'||beat==='lessonExplain'||story.lines[id]?.speaker==='narrator');}if(token===epoch){$('speech').hidden=true;hideNarrator();activeSpeaker='';activeListener='';updateTalking();if(!reducedMotion.matches&&camera.w<1279)await wait(600);if(token!==epoch)return false;resetCamera();stageBusy=false;}return token===epoch}
const sounds={
  ctx:null,gain:null,timer:null,tick:0,mood:'village',
  start(){try{if(!this.ctx){this.ctx=new (window.AudioContext||window.webkitAudioContext)();this.gain=this.ctx.createGain();this.gain.gain.value=.2;this.gain.connect(this.ctx.destination);}this.ctx.resume();if(!this.timer)this.timer=setInterval(()=>this.musicTick(),300)}catch{}},
  tone(hz,d=.2,vol=.09,type='sine',delay=0){if(!this.ctx)return;const t=this.ctx.currentTime+delay,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(hz,t);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(vol,.00015),t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(this.gain);o.start(t);o.stop(t+d+.025)},
  musicTick(){if(!musicEnabled||!runStarted)return;this.tick++;const m=this.mood;if(m==='quiet')return;if(m==='opening'){const tune=[392,440,494,587,494,440,392,330,392,494,587,659,587,494,440,392];const j=this.tick%tune.length;this.tone(tune[j],.28,.10,'triangle');if(j%4===0)this.tone(196,.65,.045,'sine');if(j%2===1)this.tone(132,.09,.045,'triangle');return}const notes=m==='storage'?[196,220,247,294,330]:m==='field'?[220,247,294,330,392]:[196,247,294,330,392];const i=this.tick;const rate=m==='reflection'?5:2;if(i%rate===0)this.tone(notes[Math.floor(i/rate)%notes.length],.43,m==='reflection'?.035:.061,'sine');if(i%8===0)this.tone(notes[0]/2,.94,.04,'triangle');if(m==='storage'&&i%4===3)this.tone(125,.08,.022,'triangle')},
  setMood(m){this.mood=m},
  ping(){this.tone(640,.16,.11);this.tone(880,.24,.055,'sine',.09)},
  cut(){this.tone(740,.08,.065,'sawtooth');this.tone(1080,.10,.03,'triangle',.03)},
  load(){this.tone(135,.24,.14,'triangle');this.tone(205,.12,.045,'sine',.1)},
  wobble(){for(let j=0;j<4;j++)this.tone(145+j*13,.16,.08,'sawtooth',j*.095)},
  crash(){this.tone(88,.75,.2,'sawtooth');this.tone(66,.75,.18,'triangle',.2);this.tone(290,.17,.1,'square',.05)},
  cheer(){[392,494,587,784].forEach((f,i)=>this.tone(f,.25,.1,'sine',i*.12))}
};
const sound=sounds; // melody and all effects synthesized locally, no audio dependencies
function img(path,x,y,w,h,clazz='',label=''){const el=n('image',{x,y,width:w,height:h,href:imageOf(path),'class':clazz,preserveAspectRatio:'xMidYMid meet'});if(label){el.setAttribute('role','button');el.setAttribute('tabindex','0');el.setAttribute('aria-label',label)}return el}
function labelText(text,x,y,size=26,fill='#fff'){const el=n('text',{x,y,'text-anchor':'middle','font-family':'Nunito,system-ui,sans-serif','font-size':size,'font-weight':'900',fill,stroke:'#23454d','stroke-width':.5});el.textContent=text;return el}
function arrangeCast(type){
 cast.replaceChildren();
 const layouts={
 storytellerIntro:[['narrator',640,665,360]],
 intro:[['baldev',265,660,430],['mehar',1050,675,320,'left']],
 harvest:[['baldev',160,657,320],['mehar',1100,666,290,'left']],
 load:[['baldev',180,656,310],['mehar',1115,666,280,'left']],
 storage:[['baldev',145,647,340],['mehar',1125,660,290,'left']],
 requests:[['baldev',235,660,360],['mehar',510,660,275],['farmer',910,656,365,'left'],['baba',1130,660,350,'left']],
 lesson:[['baldev',230,665,350],['mehar',450,665,250],['baba',1020,665,415,'left']],
 share:[['baldev',245,660,390],['mehar',1100,655,285,'left']],
 sharingGame:[['baldev',96,665,310],['mehar',1180,665,265,'left']],
 shareDone:[['baldev',290,660,365],['mehar',665,655,280],['farmer',1040,655,345,'left']],
 finale:[['baldev',270,670,365],['mehar',1050,670,320,'left']],
 };
 actors=(layouts[type]||layouts.intro).map(([id,x,y,height,view='right'])=>({id,x,y,height,view,homeView:view,frame:'',action:'idle',node:null}));
 renderCast();
 if(type==='requests'&&!reducedMotion.matches){
   for(const actor of actors.filter(a=>a.view==='left')){
     actor.walkStart=performance.now();
     actor.art.animate([{translate:'100px 0'},{translate:'0 0'}],{duration:760,easing:'linear'});
     actor.node.firstElementChild.animate([{translate:'100px 0'},{translate:'0 0'}],{duration:760,easing:'linear'});
   }
 }
}
function wearsGurudwaraScarf(actor){
 return locationId==='gurdwara'&&(actor.id==='mehar'||actor.id==='narrator');
}
function fallback(actor){
 const scarf=wearsGurudwaraScarf(actor);
 if(actor.id==='narrator')return `<svg x="${-actor.height*50/174}" y="${-actor.height}" width="${actor.height*100/174}" height="${actor.height}" viewBox="0 0 100 174"><g stroke="#593c42" stroke-width="2" stroke-linejoin="round"><ellipse cx="50" cy="168" rx="29" ry="4" fill="#302b3b" opacity=".2"/><path d="M29 112L24 153 42 159 50 132 57 159 77 153 70 112Z" fill="#e8c89d"/><path d="M24 151Q16 164 38 164H43L42 153M76 151Q84 164 63 164H57L58 153" fill="#754d46"/><path d="M32 59Q50 51 68 59L80 126Q50 140 20 126Z" fill="#865b86"/><path d="M33 62Q26 84 17 92L8 84Q4 77 10 73L18 77 23 65Z" fill="#bb8969"/><path d="M68 62Q77 82 84 97L77 104Q69 105 67 97L59 75Z" fill="#bb8969"/><path d="M30 61Q42 77 70 64L69 77Q43 92 26 76Z" fill="#e6bf8e"/><circle cx="50" cy="34" r="27" fill="#c89975"/>${scarf?'<g fill="#edc438"><path d="M26 36C18 32 19 14 29 8C42-1 64 0 74 12Q80 19 78 28Q52 20 26 36Z"/><path d="M25 31Q18 32 17 39L9 47Q19 47 23 43L21 55Q29 48 30 39Z"/><path d="M24 33Q22 16 38 10M25 35Q35 25 50 23" fill="none" stroke="#ffe987"/></g>':'<path d="M24 38Q15 5 50 5Q80 6 77 37L66 17Q50 29 30 23Z" fill="#a5a1a5"/><circle cx="75" cy="12" r="10" fill="#a5a1a5"/>'}<g fill="none"><rect x="29" y="32" width="18" height="12" rx="5"/><rect x="53" y="32" width="18" height="12" rx="5"/><path d="M47 36H53"/></g><circle cx="39" cy="38" r="2" fill="#38272a"/><circle cx="61" cy="38" r="2" fill="#38272a"/><path d="M43 50Q50 56 57 50" fill="none"/></g></svg>`;
 const size=actor.id==='mehar'?0.76:1;
 const c={baldev:['#bc7641','#df873d','#f1c165'],mehar:['#c17f49','#e9b450','#fd6f69'],baba:['#c19565','#d3c4a3','#7bb2ad'],farmer:['#b88256','#ad7c51','#9cb87d']}[actor.id];
 const turban=scarf?'<g'+(actor.view==='left'?' transform="scale(-1 1)"':'')+' fill="#edc438" stroke="#825d29" stroke-width="4" stroke-linejoin="round"><path d="M-48-117Q-62-117-62-105L-77-90Q-62-88-54-95L-59-73Q-42-84-42-103Z"/><path d="M-52-111C-62-126-43-160-6-162C20-164 46-148 49-128Q9-134-33-114L-46-104Z"/><path d="M-47-113Q-43-141-21-149M-43-111Q-27-125-7-128" fill="none" stroke="#ffe987" stroke-width="2.5"/></g>':actor.id==='mehar'?'<path d="M-49-98Q-58-159 0-158Q51-158 49-103L25-131Q-10-126-38-101Z" fill="#30252c"/><path d="M-43-92Q-56-70-45-39L-37-23" stroke="#30252c" stroke-width="16" stroke-linecap="round"/><path d="M44-92Q58-70 46-39L39-23" stroke="#30252c" stroke-width="16" stroke-linecap="round"/>':'<path d="M-51-129q0-43 51-52q51 11 51 52v25h-102Z" fill="'+c[1]+'" stroke="#4c3125" stroke-width="4"/><path d="M-48-139q46 11 96-6M-45-122q40 10 89-9" fill="none" stroke="#faf2d3" stroke-width="4"/>';
 return `<svg x="${-actor.height*.28}" y="${-actor.height}" width="${actor.height*.56}" height="${actor.height}" viewBox="-115 -200 230 390" overflow="visible"><g class="fallback-body"><path d="M-40 58L-44 151H-9L-4 69 9 151H45L41 56Z" fill="#524b53" stroke="#302b29" stroke-width="6"/><path d="M-56-19Q0-32 56-19L74 100H-69Z" fill="${c[2]}" stroke="#402f29" stroke-width="6"/><path d="M-52-9l-27 81 20 8 28-56M53-9l27 81-20 8-28-56" fill="${c[0]}" stroke="#493126" stroke-width="6"/><circle cy="-102" r="48" fill="${c[0]}" stroke="#493126" stroke-width="5"/>${turban}<circle cx="${actor.view==='left'?-23:-11}" cy="-106" r="4" fill="#282321"/><circle cx="${actor.view==='left'?12:24}" cy="-106" r="4" fill="#282321"/><path d="M-12-84Q3-72 16-86" stroke="#733725" fill="none" stroke-width="3"/>${actor.id!=='mehar'?`<path d="${actor.id==='baba'?'M-35-83Q0-58 35-83Q40-36 0 1Q-40-36-35-83Z':actor.id==='farmer'?'M-35-83Q0-58 35-83Q32-36 0-24Q-32-36-35-83Z':'M-35-83Q0-58 35-83Q39-38 0-30Q-39-38-35-83Z'}" fill="${actor.id==='baba'?'#e0e1e1':actor.id==='farmer'?'#a8a8a2':'#34312d'}"/>`:''}</g></svg>`;
}
const narratorActor={id:'narrator',x:60,y:176,height:174,view:'right',frame:'',action:'idle',art:$('narratorArt')};
function showNarrator(){const el=$('narratorFigure');if(!el.classList.contains('visible')){el.classList.remove('glow-out');el.classList.add('visible','glow-in')}renderActor(narratorActor)}
function hideNarrator(){const el=$('narratorFigure');if(el.classList.contains('visible')){el.classList.remove('visible','glow-in');el.classList.add('glow-out')}}
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const storyPoses={
 lpStoryWelcome:'beckon',lpStoryQuestion:'wonder',
 lp001:'concern',lp017:'proud',lp033:'happy',lp034:'happy',lp035:'happy',lp036:'happy',lp038:'happy',
 lp042:'point',lp005:'explain',lp010:'wonder',lp011:'point',lp012:'beckon',lp015:'point',lp028:'explain',
 lp002:'wonder',lp003:'point',lp004:'point',lp006:'celebrate',
 lp007:'wonder',lp008:'celebrate',lp009:'point',lp013:'point',lp014:'alarm',
 lp016:'alarm',lp018:'alarm',lp019:'reflect',lp020:'reflect',
 lp021:'offer',lp022:'offer',lp023:'reflect',lp024:'wonder',lp025:'beckon',
 lp026:'offer',lp027:'reflect',lp029:'point',lp030:'offer',lp031:'reflect',
 lp032:'point',
 lp037:'wonder'
};
let dialoguePose='idle', dialogueStart=0;
function directAttention(){
 const speaker=actors.find(a=>a.id===activeSpeaker);
 const listener=actors.find(a=>a.id===activeListener)||actors.filter(a=>a!==speaker).sort((a,b)=>Math.abs(a.x-(speaker?.x||640))-Math.abs(b.x-(speaker?.x||640)))[0];
 for(const actor of actors){
  const target=actor===speaker?listener:speaker;
  if(!target||target===actor)continue;
  const view=target.x<actor.x?'left':'right';
  if(actor.view!==view){actor.view=view;actor.frame='';actor.art._sprite=null;actor.art.replaceChildren();}
  actor.node.dataset.facing=actor.view;
 }
}
let reactionFocus='',walkingFocus='';const camera={x:0,y:0,w:1280,h:720};
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function resetCamera(){Object.assign(camera,{x:0,y:0,w:1280,h:720});stage.setAttribute('viewBox','0 0 1280 720')}
function animateCamera(now){
 if(reducedMotion.matches||!stageBusy){if(camera.w!==1280)resetCamera();return}
 if(!activeSpeaker&&!reactionFocus&&!walkingFocus){for(const [k,v] of Object.entries({x:0,y:0,w:1280,h:720}))camera[k]+=(v-camera[k])*.105;stage.setAttribute('viewBox',[camera.x,camera.y,camera.w,camera.h].map(v=>v.toFixed(2)).join(' '));return}
 const actor=actors.find(a=>a.id===(reactionFocus||walkingFocus||activeSpeaker));
 const elapsed=Math.max(0,now-dialogueStart);
 const zoom=actor?.id==='narrator'||(window.lpPhase==='share'&&activeSpeaker==='baldev')?1:walkingFocus?1.14:reactionFocus?1.32:actor?1.27+.12*Math.min(1,elapsed/4000):1.06;
 const w=1280/zoom,h=720/zoom;
 const x=clamp((actor?.x??640)-w/2,0,1280-w);
 const focusY=actor?actor.y-actor.height*.64:360;
 const y=clamp(focusY-h*.40,0,720-h);
 for(const [k,v] of Object.entries({x,y,w,h}))camera[k]+=(v-camera[k])*.045;
 stage.setAttribute('viewBox',[camera.x,camera.y,camera.w,camera.h].map(v=>v.toFixed(2)).join(' '));
}

function renderCast(){
 for(const actor of actors){
   const node=n('g',{class:'actor',id:'actor-'+actor.id,transform:`translate(${actor.x} ${actor.y})`});
   node.append(n('ellipse',{class:'actor-shadow',cy:-4,rx:actor.height*.14,ry:actor.height*.028}));
   actor.art=n('g',{class:'actor-art'});
   node.append(actor.art);
   actor.node=node;
   cast.appendChild(node);
   renderActor(actor);
 }
}
function listenEmotion(actor){
 if(!activeSpeaker||actor.id==='narrator')return 'idle';
 if(['alarm','concern','reflect'].includes(dialoguePose))return dialoguePose==='alarm'?'alarm':'concern';
 if(['happy','celebrate'].includes(dialoguePose))return 'happy';
 return 'idle';
}
function renderActor(actor,now=performance.now()){
 const art=actor.art;
 const covered=wearsGurudwaraScarf(actor);
 if(art._headCovered!==covered){
   art._headCovered=covered;art._sprite=null;art.replaceChildren();actor.frame='';
 }
 const slot=rig[actor.id]?.[actor.view];
 const speaking=activeSpeaker===actor.id;
 const elapsed=now-dialogueStart;
 const clipPlaying=currentVoice&&!currentVoice.paused;
 const speakingTime=clipPlaying?currentVoice.currentTime*1000:elapsed;
 const mouth=!reducedMotion.matches&&speaking&&clipPlaying?['talkA','talkEE','idle','talkO','talkEE'][Math.floor(speakingTime/118)%5]:'idle';
 const blink=!reducedMotion.matches&&(now+actor.x*3)%4300<135;
 const reaction=speaking?dialoguePose:actor.action!=='idle'?actor.action:listenEmotion(actor);
 const listener=Boolean(activeSpeaker&&activeSpeaker!=='narrator'&&!speaking);
  const gesture=reducedMotion.matches?reaction:speaking?(elapsed%3000<1900?reaction:(['alarm','reflect','concern','happy','proud','angry'].includes(reaction)?reaction:reaction==='explain'?'offer':'explain')):listener&&actor.action==='idle'&&(elapsed+actor.x)%3500<650?'nod':reaction;
 const walkTime=now-(actor.walkStart??-Infinity);
 const walk=!reducedMotion.matches&&walkTime>=0&&(actor.walking||walkTime<760);
 const pose=walk?'walk'+Math.floor((walkTime%760)/760*12):gesture;
 art.classList.toggle('alarm',reaction==='alarm');
 art.classList.toggle('celebrate',reaction==='celebrate');
 const frame=slot?.frames[pose]??slot?.frames.idle;
 if(!slot||(covered&&!slot.headScarf)){
   if(!art.firstChild)art.innerHTML=fallback(actor);
    art.firstElementChild?.setAttribute('data-fallback-facing',actor.view);
   return;
 }
 if(!art._sprite){
   art.innerHTML=`<svg x="${-actor.height*.30}" y="${-actor.height}" width="${actor.height*.60}" height="${actor.height}" overflow="visible">${slot.base}</svg>`;
   art._sprite=art.firstElementChild;
   art._layers=Object.fromEntries([...art.querySelectorAll('[data-scene-layer]')].map(e=>[e.dataset.sceneLayer,e]));
   art._parts={};
   if(covered&&slot.headScarf){
     for(const name of ['hairBack','frontHair'])art._layers[name]?.replaceChildren();
     art._layers.headwearFront.innerHTML=slot.headScarf;
   }
 }
 const face=slot.frames[mouth];
 const key=[actor.view,pose,mouth,blink].join(':');
 if(key===actor.frame)return;
 actor.frame=key;
 for(const [part,original] of Object.entries(frame.parts)){
   let markup=original;
   if(blink&&part==='eyeGroup')markup=slot.frames.blink.parts[part];
   if(mouth!=='idle'&&['mouthGroup','beardGroup'].includes(part)&&reaction!=='alarm')markup=face.parts[part];
   if(art._layers[part]&&art._parts[part]!==markup){
     art._layers[part].innerHTML=markup;
     art._parts[part]=markup;
   }
 }
 for(const name of slot.headLayers)art._layers[name]?.setAttribute('transform',frame.head||'');
}
function updateTalking(){for(const actor of actors)renderActor(actor)}
let last=0;
function animate(now){
 animateCamera(now);
 if(now-last>55){last=now;for(const actor of actors)renderActor(actor,now);if($('narratorFigure').classList.contains('visible'))renderActor(narratorActor,now);stage.dataset.busy=String(stageBusy);}
 requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
window.addEventListener('message',e=>{if(e.source!==$('rigBridge').contentWindow||e.origin!==location.origin)return;
 if(e.data?.type==='anitoons-delivery-cast'&&e.data.version===2){rig=e.data.bank||{};for(const actor of [...actors,narratorActor]){actor.art._sprite=null;actor.frame='';renderActor(actor)}}
});
const requestRig=()=>{try{$('rigBridge').contentWindow.postMessage({type:'anitoons-delivery-request'},location.origin)}catch{}};
$('rigBridge').addEventListener('load',requestRig);setTimeout(requestRig,2500);
function cart(x=465,y=330,scale=.63){
 const host=n('g',{id:'cartHost',transform:`translate(${x} ${y}) scale(${scale})`});
 if(cartSource){const doc=new DOMParser().parseFromString(cartSource,'image/svg+xml');if(!doc.querySelector('parsererror')){const root=document.importNode(doc.documentElement,true);root.setAttribute('width','920');root.setAttribute('height','440');host.append(root);}}
 if(!host.firstElementChild)host.append(img('assets/cart/bullock-cart.svg',0,0,920,440));
 props.appendChild(host);updateCart();return host;
}
// Enter from the right, oxen leading the cart towards the field loading position.
async function rollFieldCartIn(token,x=365,y=278,scale=.80,durationMs=3650){
 const startX=1305,distance=startX-x,host=cart(startX,y,scale);
 host.dataset.arrival='rolling';host.querySelectorAll('#cart-shadow use').forEach(e=>e.remove());
 const wheels=[['#left-wheel-spin',72],['#right-wheel-spin',90]].map(([sel,radius])=>({el:host.querySelector(sel),radius}));
 // Split the existing leg artwork into individual limbs without changing their drawing.
 const legs=[];
 for(const [sel,pivots] of [
  ['#ox-far-legs-back',[[224,284]]],['#ox-far-legs-front',[[112,282],[138,286]]],
  ['#ox-near-legs-back',[[312,296],[342,284]]],['#ox-near-legs-front',[[190,296],[218,288]]]
 ]){
  const layer=host.querySelector(sel);if(!layer)continue;
  let limb=null,k=-1;
  for(const child of [...layer.children]){
   if(child.localName==='path'&&(!limb||k+1<pivots.length&&limb.children.length>=2)){limb=n('g');layer.append(limb);k++;legs.push({el:limb,pivot:pivots[k],offset:(k+(sel.includes('far')?1:0)+(sel.includes('back')?1:0))*Math.PI})}
   limb?.append(child);
  }
 }
 const heads=['#ox-near-head','#ox-far-head'].map(sel=>host.querySelector(sel)).filter(Boolean).map(el=>({el,base:el.getAttribute('transform')||''}));
 const duration=reducedMotion.matches?0:durationMs,start=performance.now();let dustAt=-500;
 await new Promise(resolve=>{function step(now){
  if(token!==epoch){resolve();return}
  const q=duration?Math.min(1,(now-start)/duration):1;
  const travel=q<.82?q/.91: (1-(1-q)*(1-q)/(.18*.91*2)); // steady approach; gentle stop
  const progress=q===1?1:Math.max(0,Math.min(1,travel)),moved=distance*progress,px=startX-moved;
  host.setAttribute('transform','translate('+px+' '+y+') scale('+scale+')');
  for(const {el,radius} of wheels)el?.setAttribute('transform','rotate('+(-moved/(scale*radius)*180/Math.PI)+')');
  const phase=moved/20,weight=Math.min(1,(1-q)*9);
  for(const {el,pivot,offset} of legs){const angle=Math.sin(phase+offset)*12*weight;el.setAttribute('transform','rotate('+angle+' '+pivot[0]+' '+pivot[1]+')')}
  for(const {el,base} of heads)el.setAttribute('transform',base+' rotate('+(Math.sin(phase)*2.5*weight)+')');
  if(duration&&q<.97&&now-start-dustAt>280){dustAt=now-start;const dx=px+scale*675;if(dx>30&&dx<1240)dust(dx,y+scale*421)}
  if(q<1)requestAnimationFrame(step);else resolve();
 }requestAnimationFrame(step)});
 if(token!==epoch)return;
 host.setAttribute('transform','translate('+x+' '+y+') scale('+scale+')');
 for(const {el} of legs)el.removeAttribute('transform');
 for(const {el,base} of heads)el.setAttribute('transform',base);
 host.dataset.arrival='arrived';if(musicEnabled)sound.tone(720,.16,.04,'triangle');
}
function updateCart(){
 const host=$('cartHost');if(!host)return;
 for(let i=1;i<=8;i++){const g=host.querySelector('#sack-pos-'+i);if(g)g.setAttribute('opacity',i<=loaded?'1':'0')}
 host.querySelector('#ox-nervous-fx')?.setAttribute('opacity',loaded>=7?'1':'0');
}
function decoratePile(count=5,x=350,y=555){for(let j=0;j<count;j++)props.appendChild(img(asset.sack,x+j*96,y-14-((j%2)*12),98,119))}
function looseSacks(count,onCollect){
 let container=$('looseSacks');if(!container){container=n('g',{id:'looseSacks'});front.append(container)}
 container.replaceChildren();
 for(let j=0;j<count;j++){
   const x=247+j*110,y=530,w=108,h=140;
   const im=img(asset.sack,x,y,w,h,'sack-draggable tap-target','Load a wheat sack');
   im.style.pointerEvents='all';im.dataset.index=j;
   im.addEventListener('pointerdown',e=>{if(stageBusy)return;im.setPointerCapture(e.pointerId);im._drag={sx:e.clientX,sy:e.clientY};e.preventDefault()});
   im.addEventListener('pointermove',e=>{if(!im._drag)return;const p=getXY(e);im._moved={x:p.x-w/2,y:p.y-h/2};im.setAttribute('transform','translate('+(im._moved.x-x)+' '+(im._moved.y-y)+')')});
   const collect=()=>{if(stageBusy)return;const from=im._moved||{x,y};im._moved=null;im._drag=null;im.removeAttribute('transform');onCollect(im,{...from,w,h})};
   im.addEventListener('pointerup',e=>{if(!im._drag)return;collect();e.preventDefault()});
   im.addEventListener('pointercancel',()=>{im._drag=null;im._moved=null;im.removeAttribute('transform')});
   im.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();collect()}});
   container.appendChild(im)
 }
}
function cartSlot(index){
 const slot=$('cartHost')?.querySelector('#sack-pos-'+index);
 if(!slot)return {x:820,y:380,w:65,h:86};
 const box=slot.getBBox(),m=stage.getScreenCTM().inverse().multiply(slot.getScreenCTM());
 const pt=stage.createSVGPoint();pt.x=box.x;pt.y=box.y;const p=pt.matrixTransform(m);pt.x=box.x+box.width;pt.y=box.y+box.height;const q=pt.matrixTransform(m);
 return {x:Math.min(p.x,q.x),y:Math.min(p.y,q.y),w:Math.max(35,Math.abs(q.x-p.x)),h:Math.max(48,Math.abs(q.y-p.y))};
}
function sackFlight(from,to,ms=720,arc=130,keep=false){
 const token=epoch,item=img(asset.sack,from.x,from.y,from.w,from.h,'sack-flight');fx.append(item);
 const start=performance.now();return new Promise(resolve=>{function step(now){
  if(token!==epoch){item.remove();resolve(null);return}
  const q=reducedMotion.matches?1:Math.min(1,(now-start)/ms),e=q*q*(3-2*q);
  const p={x:from.x+(to.x-from.x)*e,y:from.y+(to.y-from.y)*e-Math.sin(Math.PI*q)*arc,w:from.w+(to.w-from.w)*e,h:from.h+(to.h-from.h)*e};
  for(const [k,v] of Object.entries({x:p.x,y:p.y,width:p.w,height:p.h}))item.setAttribute(k,v);
  if(q<1)requestAnimationFrame(step);else{if(!keep)item.remove();resolve(item)}
 }requestAnimationFrame(step)});
}
function dust(x,y){
 const puff=n('g',{class:'dust-puff'});for(let j=0;j<5;j++)puff.append(n('ellipse',{cx:x+(j-2)*15,cy:y-5-(j%2)*9,rx:15,ry:7,fill:'#d4ad79',opacity:.8}));fx.append(puff);puff.animate([{opacity:1},{opacity:0}],{duration:500});setTimeout(()=>puff.remove(),500);
}
function runningChicken(group){
 const chicken=n('g',{id:'introChicken','pointer-events':'none'});group.append(chicken);
 let legs=[],wing=null,head=null;
 if(chickenSource){
  const parsed=new DOMParser().parseFromString(chickenSource,'image/svg+xml');
  if(!parsed.querySelector('parsererror')){
   const root=document.importNode(parsed.documentElement,true);root.setAttribute('x','-90');root.setAttribute('y','-128');root.setAttribute('width','180');root.setAttribute('height','134');chicken.append(root);
   // Animate each outlined leg together with its matching colored path.
   const layer=root.querySelector('#chicken-legs');
   if(layer){const paths=[...layer.children];for(let j=0;j<2;j++){const limb=n('g');layer.append(limb);for(const path of paths.slice(j*2,j*2+2))limb.append(path);legs.push(limb)}}
   wing=root.querySelector('#chicken-wing');head=root.querySelector('#chicken-head');
  }
 }
 if(!chicken.firstElementChild)chicken.append(img(asset.chicken,-90,-128,180,134));
 return {chicken,legs,wing,head};
}
async function openingFlyover(){
 if(reducedMotion.matches)return;
 stageBusy=true;const token=epoch;const group=n('g',{id:'openingBirds'});fx.append(group);
 const title=labelText('The Cart That Was Never Full',640,145,40,'#fff2ce');title.setAttribute('class','intro-title');group.append(title);
 title.animate([{opacity:0},{opacity:1,offset:.22},{opacity:1,offset:.72},{opacity:0}],{duration:5100,fill:'both'});
 for(let j=0;j<4;j++){
  const bird=n('g',{stroke:'#34424b','stroke-width':3,'stroke-linecap':'round',fill:'none'});const wing=n('path',{d:'M-13 0Q-7 -11 0 0Q7 -11 13 0'});bird.append(wing);group.append(bird);
  bird.animate([{transform:'translate('+(-60-j*65)+'px,'+(60+j*22)+'px)'},{transform:'translate('+(1420-j*65)+'px,'+(106+j*22)+'px)'}],{duration:4700,fill:'both',easing:'linear'});
  wing.animate([{transform:'scaleY(1)'},{transform:'scaleY(-.4)'},{transform:'scaleY(1)'}],{duration:480,iterations:10});
 }
 const {chicken,legs,wing,head}=runningChicken(group);const start=performance.now();
 await new Promise(resolve=>{function frame(now){
  if(token!==epoch){resolve();return}
  const q=Math.min(1,(now-start)/5500),p=Math.max(0,Math.min(1,(q-.13)/.75)),step=p*Math.PI*24;
  const x=1370-1490*p,y=654;
  chicken.setAttribute('transform','translate('+x+' '+y+')');
  for(let j=0;j<legs.length;j++)legs[j].setAttribute('transform','rotate('+(Math.sin(step+j*Math.PI)*27)+' '+(j?16:-8)+' 28)');
  wing?.setAttribute('transform','rotate('+(Math.sin(step)*9)+' -10 -4)');
  head?.setAttribute('transform','translate(-38 -24) rotate('+(Math.sin(step)*5)+')');
  if(q<1)requestAnimationFrame(frame);else resolve();
 }requestAnimationFrame(frame)});
 group.remove();stageBusy=false;
}
async function intro(){
 setPhase('intro');scene('field',1,'THE CART THAT WAS NEVER FULL');sound.setMood('opening');loaded=0;harvested=0;shareCounts={home:0,seeds:0,sharing:0};quizIndex=0;
 setLabel('The Cart That Was Never Full');const token=epoch;await openingFlyover();if(token!==epoch)return;
 arrangeCast('storytellerIntro');sound.setMood('village');
 if(!reducedMotion.matches){
   const storyteller=actors[0];
   stageBusy=true;
   await storyteller.node.animate(
     [{translate:'0 '+(storyteller.height+70)+'px'},{translate:'0 0'}],
     {duration:700,easing:'cubic-bezier(.2,.8,.2,1)'}
   ).finished;
 }
 if(token!==epoch||!await speak('storytellerIntro'))return;
 scene('village',1,'THE EMERGENCY');
 arrangeCast('intro');cart(520,269,.78);decoratePile(3,430,558);
 setLabel('What is Chacha Baldev so worried about?');
 if(await speak('intro'))await inspectCourtyard();
}
async function walkTo(id,x,duration=1800){
 const actor=actors.find(a=>a.id===id),token=epoch;if(!actor)return;
 const view=x<actor.x?'left':'right';if(view!==actor.view){actor.view=view;actor.frame='';actor.art._sprite=null;actor.art.replaceChildren()}
 const from=actor.x,start=performance.now();if(id==='mehar')walkingFocus=id;actor.walkStart=start;actor.walking=true;
 await new Promise(resolve=>{function step(now){if(token!==epoch){resolve();return}const q=reducedMotion.matches?1:Math.min(1,(now-start)/duration);actor.x=from+(x-from)*q;actor.node.setAttribute('transform','translate('+actor.x+' '+actor.y+')');if(q<1)requestAnimationFrame(step);else resolve()}requestAnimationFrame(step)});
 if(walkingFocus===id)walkingFocus='';actor.walking=false;actor.walkStart=-Infinity;actor.frame='';renderActor(actor);
}
async function inspectCourtyard(){
 stageBusy=true;
 setLabel('Mehar inspects the wheat sacks');await walkTo('mehar',730,2100);await walkTo('baldev',365,950);await speak('courtyardInspect');
 stageBusy=true;const baldev=actors.find(a=>a.id==='baldev');if(baldev)baldev.action='reflect';reactionFocus='baldev';await wait(reducedMotion.matches?250:2400);reactionFocus='';if(baldev)baldev.action='idle';
 await speak('courtyardNarrator');await speak('courtyardDeparture');
 button('Follow Baldev to the fields →',async()=>{stageBusy=true;await Promise.all([walkTo('mehar',1180,1800),walkTo('baldev',1010,2600)]);harvest()});
}
function harvestSpark(x,y,kind='grain'){
 const group=n('g',{'pointer-events':'none',class:'harvest-spark'});fx.append(group);
 const colors=kind==='green'?['#a7db48','#76b93d','#d9f6a0']:['#ffdc72','#efaa36','#fff0ae'];
 for(let j=0;j<9;j++){
  const p=n('ellipse',{cx:x,cy:y,rx:3.4+(j%2),ry:1.9,fill:colors[j%3],stroke:'#a27435','stroke-width':.4});group.append(p);
  if(!reducedMotion.matches){const angle=j*2.4,dx=Math.cos(angle)*(20+j*4),dy=-20-Math.sin(angle)*30;p.animate([{transform:'translate(0px,0px)',opacity:1},{transform:'translate('+dx+'px,'+dy+'px)',opacity:0}],{duration:360,fill:'both'})}
 }
 setTimeout(()=>group.remove(),400);
}
function showSickle(x,y){
 const tool=img(asset.sickle,x-43,y-55,100,88,'sickle-swipe');fx.append(tool);
 if(!reducedMotion.matches)tool.animate([{transform:'translate(-24px,-16px) rotate(-6deg)'},{transform:'translate(36px,10px)',opacity:1},{transform:'translate(52px,20px)',opacity:0}],{duration:270,fill:'both'});
 setTimeout(()=>tool.remove(),300);harvestSpark(x,y);
}
function bundleFlight(item,x,y){
 const fromX=+item.getAttribute('x'),fromY=+item.getAttribute('y'),w=+item.getAttribute('width'),h=+item.getAttribute('height');
 const copy=img(asset.bundle,fromX,fromY,w,h);fx.append(copy);item.remove();
 if(!reducedMotion.matches)copy.animate([{transform:'translate(0px,0px)',opacity:1},{transform:'translate('+(x-fromX)+'px,'+(y-fromY)+'px) scale(.65)',opacity:1,offset:.75},{transform:'translate('+(x-fromX)+'px,'+(y-fromY)+'px) scale(.5)',opacity:0}],{duration:310,fill:'both'});
 setTimeout(()=>{copy.remove();harvestSpark(x+30,y+60)},320);
}
function grainPour(bundle,sack){
 const x=+bundle.getAttribute('x')+54,y=+bundle.getAttribute('y')+52,tx=+sack.getAttribute('x')+60,ty=+sack.getAttribute('y')+18;
 const group=n('g',{'pointer-events':'none',class:'grain-pour'});fx.append(group);
 for(let j=0;j<13;j++){const seed=n('ellipse',{cx:x+(j%4)*5,cy:y+(j%3)*4,rx:3,ry:6,fill:j%2?'#e7a937':'#ffdc7b',stroke:'#aa7728','stroke-width':.8});group.append(seed);if(!reducedMotion.matches)seed.animate([{opacity:1,transform:'translate(0px,0px)'},{opacity:1,transform:'translate('+(tx-x)+'px,'+(ty-y)+'px)',offset:.8},{opacity:0}],{duration:300+j*15,fill:'both'})}
 setTimeout(()=>{group.remove();harvestSpark(tx,ty)},550);
}
async function harvest(){
 setPhase('harvest');scene('field',2,'HARVEST FRENZY');sound.setMood('field');harvested=0;arrangeCast('harvest');
 await speak('fieldIntro');setLabel('Cut the six golden wheat patches','0 / 6','Tap or swipe each golden patch three times. Leave the green wheat.');
 const green=img(asset.patch,535,282,180,124,'tap-target','Unripe green wheat');green.style.filter='hue-rotate(53deg) saturate(.75)';green.style.pointerEvents='all';green.addEventListener('click',()=>{if(!stageBusy)banner('Not ready yet — let it grow!',1500)});props.append(green);
 for(let j=0;j<6;j++){
   const x=245+(j%3)*245,y=350+Math.floor(j/3)*112;
   const holder=n('g',{class:'wheat-target tap-target','data-patch':j,role:'button',tabindex:0,'aria-label':'Cut golden wheat patch '+(j+1)});
   const picture=img(asset.patch,x,y,205,139);picture.style.pointerEvents='all';holder.append(picture);holder.dataset.cuts='0';
   const cut=()=>{
     if(stageBusy||holder.dataset.done)return;
     const count=Number(holder.dataset.cuts)+1;holder.dataset.cuts=String(count);sound.cut();showSickle(x+105,y+86);
     picture.setAttribute('transform','translate(0 '+(count%2?4:-3)+')');picture.setAttribute('opacity',String(1-count*.27));banner('Wheat cut! '+count+' / 3',550);
     if(count>=3){holder.dataset.done='1';holder.style.pointerEvents='none';picture.remove();harvested++;holder.append(img(asset.bundle,x+75,y+25,58,90));sound.ping();setLabel('Cut six golden wheat patches',harvested+' / 6');
       if(harvested===6){stageBusy=true;setTimeout(collectHarvest,650)}}
   };
   holder.addEventListener('pointerdown',e=>{holder._start={x:e.clientX,y:e.clientY};holder.setPointerCapture(e.pointerId)});
   holder.addEventListener('pointerup',e=>{if(!holder._start)return;holder._start=null;cut()});
   holder.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();cut()}});
   props.append(holder);
 }
}
function harvestTarget(id,path,x,y,w,h,label,fn){
 const item=img(path,x,y,w,h,'harvest-target tap-target',label);item.dataset.harvest=id;item.style.pointerEvents='all';
 const activate=()=>{if(stageBusy||item.dataset.done)return;item.dataset.done='1';item.style.pointerEvents='none';item.setAttribute('opacity','.25');item.removeAttribute('tabindex');fn(item)};
 item.addEventListener('click',activate);item.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate()}});props.append(item);return item;
}
async function collectHarvest(){
 if(window.lpPhase!=='harvest')return;
 props.replaceChildren();setLabel('Gather the six cut wheat piles','0 / 6');await speak('collectIntro');let collected=0;
 for(let j=0;j<6;j++){const item=harvestTarget('collect',asset.bundle,270+j*117,448,92,162,'Collect wheat pile '+(j+1),()=>{
  collected++;bundleFlight(item,475+Math.ceil(collected/2)*90,310);sound.ping();setLabel('Gather the six cut wheat piles',collected+' / 6');
  if(collected%2===0){props.append(img(asset.bundle,475+collected/2*90,310,66,105));banner('One bundle ready!',900)}
  if(collected===6){stageBusy=true;setTimeout(packHarvest,750)}
 });}
}
async function packHarvest(){
 props.replaceChildren();setLabel('Prepare three sacks of grain','0 / 3');await speak('packIntro');let packed=0;
 for(let j=0;j<3;j++){
  const x=330+j*210;
  const sack=img(asset.sack,x+75,500,95,130);
  sack.dataset.packSack=String(j);sack.dataset.filled='false';props.append(sack);
  const bundle=harvestTarget('pack',asset.bundle,x,420,108,160,'Separate grain and pack sack '+(j+1),()=>{
   packed++;sound.load();grainPour(bundle,sack);
   // Enlarge the same sack about its bottom centre, never paint a second sack over it.
   for(const [key,value] of Object.entries({x:x+62.5,y:470,width:120,height:160}))sack.setAttribute(key,value);
   sack.dataset.filled='true';bundle.remove();if(!reducedMotion.matches)sack.animate([{opacity:.6},{opacity:1}],{duration:350});
   setLabel('Prepare three sacks of grain',packed+' / 3');banner('Sack filled!',800);
   if(packed===3){stageBusy=true;setTimeout(finishHarvest,750)}
  });
 }
}
async function finishHarvest(){
 if(window.lpPhase!=='harvest')return;
 sound.cheer();banner('3 bundles → 3 sacks!');props.replaceChildren();arrangeCast('load');loaded=0;drawFieldSacks();
 setLabel('Three sacks are ready!','3 / 3','Time to load the cart');
 const token=epoch;if(!await speak('harvestDone')||token!==epoch)return;
 if(!$('cartHost'))cart(365,278,.80);
 setPhase('fieldLoad');setLabel('Load three sacks into the cart','0 / 3','Tap or drag the sacks onto the cart');
}
function fieldLoad(){
 setPhase('fieldLoad');loaded=0;stageBusy=false;props.replaceChildren();cart(365,278,.80);arrangeCast('load');
 setLabel('Load three sacks into the cart','0 / 3','Tap or drag the sacks onto the cart');
 drawFieldSacks();
}
function drawFieldSacks(){looseSacks(3-loaded,async(im,from)=>{
 if(stageBusy)return;stageBusy=true;im.remove();await sackFlight(from,cartSlot(loaded+1),watchMode?490:720);loaded++;sound.load();updateCart();setLabel('Load three sacks into the cart',loaded+' / 3');
 if(loaded>=3){stageBusy=true;$('looseSacks')?.replaceChildren();sound.cheer();await speak('loadThree');button('Head to the storage courtyard →',()=>storage())}
 else{drawFieldSacks();stageBusy=false;}
})}
function storage(){
 scene('storage',3,'THE FIRST DELIVERY');loaded=3;setPhase('storage');
 sound.setMood('storage');arrangeCast('storage');
 setLabel('Deliver the first three sacks','0 / 3','The cart is arriving at the storage courtyard.');
 const token=epoch;stageBusy=true;
 rollFieldCartIn(token,300,261,.84,2400).then(()=>{
   if(token!==epoch)return;
   stageBusy=false;offerUnload();
 });
}
function offerUnload(){
 const stored=3-loaded;
 setLabel('Unload the sacks in the storage courtyard',stored+' / 3','Tap a sack on the cart to stack it in the courtyard.');
 const slot=cartSlot(loaded);
 harvestTarget('unload',asset.sack,slot.x,slot.y,slot.w,slot.h,'Unload sack '+(stored+1)+' of 3',async item=>{
   stageBusy=true;
   const token=epoch;
   item.remove();
   loaded--;updateCart();
   const drop={x:320+stored*99,y:535-(stored%2)*12,w:100,h:127};
   await sackFlight(slot,drop,watchMode?360:560,80);
   if(token!==epoch)return;
   props.append(img(asset.sack,drop.x,drop.y,drop.w,drop.h));sound.load();
   stageBusy=false;
   if(loaded){offerUnload();return}
   setLabel('First delivery complete','3 / 3');
   sound.cheer();banner('Three sacks safely stored!');
   button('Take the empty cart back to the fields →',returnToField);
 });
}
async function returnToField(){
 scene('field',3,'THE LAST TRIP');loaded=0;eighthAttempts=0;setPhase('returnField');
 stage.dataset.light='sunset';sound.setMood('field');arrangeCast('load');
 setLabel('Return to the wheat field at sunset');
 const token=epoch;stageBusy=true;
 await rollFieldCartIn(token,365,278,.80,2600);
 if(token!==epoch||!await speak('lastTrip'))return;
 drawReturnSacks();
}
function drawReturnSacks(){
 const target=loaded<5?5:loaded<7?7:8;
 looseSacks(Math.min(3,target-loaded),loadReturnSack);
 setLabel(loaded<5?'Load the second harvest':loaded<7?'Baldev asks for two more':'Baldev insists on one last sack',loaded+' / '+target,
   loaded<7?'Tap or drag the sacks onto the cart.':'Watch the wheel as you load the last sack.');
}
let crashPending=false;
function detachWheel(host,animate=true){
 if(!host||$('fallenWheel'))return;
 const original=host.querySelector('#right-wheel'), source=original?.querySelector('#right-wheel-spin');
 if(!source)return;
 const matrix=stage.getScreenCTM().inverse().multiply(original.getScreenCTM());
 const from={x:matrix.e,y:matrix.f,scale:Math.hypot(matrix.a,matrix.b)};
 const finale=window.lpPhase==='finale';const to=finale?{x:970,y:603}:{x:1020,y:613};
 const fallen=n('g',{id:'fallenWheel','aria-label':'Detached broken wooden cart wheel','pointer-events':'none'});
 const shadow=n('ellipse',{cx:0,cy:28,rx:78,ry:14,fill:'#4c3025',opacity:.19});
 const wheel=n('g',{stroke:'#1f140d','stroke-width':2.5,'stroke-linejoin':'round'});
 const copy=source.cloneNode(true);copy.removeAttribute('id');for(const node of copy.querySelectorAll('[id]')){const id=node.id;node.removeAttribute('id');if(id==='right-wheel-piece-a')node.setAttribute('transform','translate(-5 -5) rotate(-5)');if(id==='right-wheel-piece-b')node.setAttribute('transform','translate(6 6) rotate(5)')}
 wheel.append(copy,n('path',{d:'M-83 -13L-70 -3L-78 5L-66 15 M79 -13L65 -3L75 5L64 15',stroke:'#3a2014','stroke-width':5,fill:'none','stroke-linecap':'round'}));
 fallen.append(shadow,wheel);(finale?props:front).append(fallen);original.setAttribute('visibility','hidden');
 function draw(q){const e=q*q*(3-2*q),x=from.x+(to.x-from.x)*e,y=from.y+(to.y-from.y)*e-Math.sin(Math.PI*q)*55;
  fallen.setAttribute('transform','translate('+x+' '+y+')');wheel.setAttribute('transform','scale('+from.scale+' '+(from.scale*(1-.48*e))+') rotate('+(q*155)+')');shadow.setAttribute('opacity',String(.19*q));}
 if(!animate||reducedMotion.matches){draw(1);return}
 const start=performance.now(),token=epoch;function step(now){if(token!==epoch)return;const q=Math.min(1,(now-start)/850);draw(q);if(q<1)requestAnimationFrame(step);else dust(to.x,to.y+30)}requestAnimationFrame(step);
}
function triggerCartBreak(){
 if(!crashPending||window.lpPhase!=='returnField')return;crashPending=false;
 const host=$('cartHost');if(!host)return;
 const falling=[5,6,7,8].map(cartSlot);
 detachWheel(host);sound.crash();host.classList.add('cart-crash');host.dataset.broken='true';
 loaded=4;updateCart();host.querySelector('#ox-nervous-fx')?.setAttribute('opacity','1');
 props.append(img(asset.chicken,1000,528,110,115,'chicken-run'));
 for(let j=0;j<falling.length;j++){
   const to={x:510+j*103,y:559+(j%2)*14,w:100,h:128};
   sackFlight(falling[j],to,700+j*100,45,true).then(()=>dust(to.x+50,to.y+124));
 }
 for(const actor of actors)actor.action='alarm';
 dialoguePose='alarm';updateTalking();banner('CRAAACK! THE WHEEL BROKE!',2500);
}
async function loadReturnSack(im,from){
 if(stageBusy)return;stageBusy=true;im.remove();
 const token=epoch;
 await sackFlight(from,cartSlot(loaded+1),watchMode?360:630);
 if(token!==epoch)return;
 if(loaded===7){
   if(++eighthAttempts===1){
     sound.wobble();const host=$('cartHost');host?.classList.add('cart-wobble');
     const drop={x:390,y:555,w:108,h:140};await sackFlight(cartSlot(8),drop,850,15,true);dust(drop.x+54,drop.y+135);sound.load();
     banner('Oh no! The sack slides off!',1600);for(const actor of actors)actor.action='alarm';
     await speak('failedEighth');host?.classList.remove('cart-wobble');fx.replaceChildren();for(const actor of actors)actor.action='idle';drawReturnSacks();stageBusy=false;return;
   }
   loaded=8;updateCart();$('looseSacks')?.replaceChildren();crashPending=true;
   await speak('crash');triggerCartBreak();sound.setMood('reflection');for(const actor of actors)actor.action=actor.id==='baldev'?'reflect':'concern';
   if(!await speak('reflection')||!await speak('recoverHarvest'))return;
   button('Return to the village →',requests);return;
 }
 loaded++;sound.load();updateCart();
 if(loaded===5){stage.dataset.light='dusk';sound.wobble();await speak('five')}
 else if(loaded===7){stage.dataset.light='night';sound.wobble();$('cartHost')?.classList.add('cart-wobble');await speak('seven');$('cartHost')?.classList.remove('cart-wobble')}
 drawReturnSacks();stageBusy=false;
}
async function requests(){
 setPhase('requests');scene('village',4,'THE REAL HUNGER');sound.setMood('reflection');arrangeCast('requests');
 decoratePile(6,270,550);setLabel('Can Baldev understand why others need wheat?');
 await speak('requests');button('Visit Gurudwara Sahib →',()=>lesson());
}
async function lesson(){
 setPhase('lesson');scene('gurdwara',4,'GURU NANAK DEV JI’S WISDOM');sound.setMood('quiet');arrangeCast('lesson');
 setLabel('Listen to the wisdom of Japji Sahib');
 await speak('lessonIntro');
 $('verse').hidden=false;await speak('gurbani');await speak('lessonExplain');$('verse').hidden=true;
 button('Return and share the harvest →',()=>share());
}
let sharingIntro=false;
async function share(){
 setPhase('share');scene('village',5,'THE JOY OF SHARING');sound.setMood('village');arrangeCast('sharingGame');
 shareCounts={home:0,seeds:0,sharing:0};selectedSack=null;sharingIntro=true;
 showSharing();
 if(!await speak('shareIntro'))return;
 sharingIntro=false;
 if(sharingTotal()===8)finishSharing();
}
const sharingTotal=()=>shareCounts.home+shareCounts.seeds+shareCounts.sharing;
const canPlaceSharingSack=()=>window.lpPhase==='share'&&(!stageBusy||sharingIntro&&!watchMode);
const shareZone={x:192,y:509,spacing:302,width:292,height:130};
const shareTargets=[['home','HOME',3,'For Baldev\u2019s family','#8ccfb3'],['seeds','SEEDS',2,'For the next crop','#f6ca81'],['sharing','SHARING & LANGAR',3,'For those in need','#b7b6ef']];
function sharingSymbol(key,x,y){
 const icon=n('g',{transform:'translate('+x+' '+y+')','pointer-events':'none',stroke:'#385c46','stroke-width':2,'stroke-linejoin':'round'});
 if(key==='home')icon.innerHTML='<path d="M-12 0L0-11 12 0V12H-12Z" fill="#fff5d6"/><path d="M-4 12V3H4V12" fill="#b98653"/><path d="M-15 1L0-13 15 1" fill="none"/>';
 else if(key==='seeds')icon.innerHTML='<path d="M-13 11H13M0 11V-6M0 2Q-14 0-13-8Q-3-10 0-2M0-3Q2-14 12-11Q13-3 0 0" fill="#7fba64" stroke-linecap="round"/>';
 else icon.innerHTML='<path d="M-15 0H15Q12 12 0 12Q-12 12-15 0Z" fill="#f9e9c7"/><path d="M-7-3Q-11-8-6-12M3-3Q-1-8 4-12" fill="none" stroke-linecap="round"/>';
 return icon;
}
function showSharing(){
 props.replaceChildren();
 let stageTitle=n('g',{'id':'shareTargets'}),selected=selectedSack;
 for(let j=0;j<shareTargets.length;j++){
   const [key,title,cap,sub,color]=shareTargets[j],x=shareZone.x+j*shareZone.spacing,y=shareZone.y;
   const zone=n('g',{role:'button',tabindex:0,'aria-label':title+' '+shareCounts[key]+' of '+cap,'data-target':key});
   if(watchMode){
     // Restore the three educational destinations as part of the artwork, not a floating HUD.
     zone.append(n('rect',{x,y,width:shareZone.width,height:146,rx:19,fill:color,'fill-opacity':.83,stroke:'#44676c','stroke-width':3,'stroke-dasharray':'10 6',class:'watch-share-division'}));
     zone.append(sharingSymbol(key,x+22,y+19));zone.append(labelText(title+' · '+shareCounts[key]+'/'+cap,x+shareZone.width/2+11,y+25,title.length>12?18:22,'#263941'));
     for(let k=0;k<shareCounts[key];k++)zone.append(img(asset.sack,x+25+k*83,y+34,96,110));
   }else{
   zone.append(n('rect',{x,y,width:shareZone.width,height:shareZone.height,rx:21,fill:color,stroke:'#44676c','stroke-dasharray':'9 6','stroke-width':4,'class':'goal-zone'}));
   zone.append(labelText(title,x+shareZone.width/2,y+43,title.length>12?20:27,'#263941'));
   zone.append(labelText(shareCounts[key]+' / '+cap,x+shareZone.width/2,y+81,30,'#385c46'));
   zone.append(labelText(sub,x+shareZone.width/2,y+112,16,'#455956'));
   }
   zone.addEventListener('pointerup',()=>putSack(key));
   zone.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();putSack(key)}});
   stageTitle.append(zone);
 }
 props.append(stageTitle);
 const remaining=8-sharingTotal();
 const row=n('g',{id:'sharingSacks'});
 for(let j=0;j<remaining;j++){
   const x=194+j*110,y=359;
   const item=img(asset.sack,x,y,108,140,'sack-draggable tap-target','Choose sack '+(j+1));
   item.style.pointerEvents='all';item.setAttribute('tabindex','0');
   if(selected===j&&!watchMode){item.setAttribute('stroke','#ffe884');item.setAttribute('filter','drop-shadow(0px 0px 12px gold)')}
   item.addEventListener('pointerdown',e=>{if(!canPlaceSharingSack())return;item.setPointerCapture(e.pointerId);item._drag={x:e.clientX,y:e.clientY};e.preventDefault()});
   item.addEventListener('pointermove',e=>{if(!item._drag)return;const p=getXY(e);item.setAttribute('transform',`translate(${p.x-x-54} ${p.y-y-70})`)});
   item.addEventListener('pointerup',e=>{if(!item._drag)return;item._drag=null;item.removeAttribute('transform');const p=getXY(e);const target=shareTargets.find(([,_,__,___],idx)=>p.y>=shareZone.y&&p.y<=shareZone.y+shareZone.height&&p.x>=shareZone.x+idx*shareZone.spacing&&p.x<=shareZone.x+idx*shareZone.spacing+shareZone.width);selectedSack=j;if(target)putSack(target[0]);else{sound.ping();showSharing()}e.preventDefault()});
   item.addEventListener('pointercancel',()=>{item._drag=null;item.removeAttribute('transform')});
   item.addEventListener('keydown',e=>{
     if((e.key==='Enter'||e.key===' ')&&canPlaceSharingSack()){
       e.preventDefault();selectedSack=j;showSharing();
       $('shareTargets').querySelector('[data-target]').focus();
     }
   });
   row.append(item);
 }
 props.append(row);
 setLabel('Share the eight sacks wisely',(8-remaining)+' / 8','Select a sack, then choose Home, Seeds, or Sharing. Drag also works.');
}
async function putSack(key){
 if(!canPlaceSharingSack())return;
 if(selectedSack===null){banner('First tap a wheat sack, then choose a destination');return}
 const t=shareTargets.find(v=>v[0]===key);
 if(shareCounts[key]>=t[2]){banner(titleFor(key)+' is already full!');sound.wobble();return}
 if(watchMode){stageBusy=true;const item=$('sharingSacks')?.children[selectedSack];const j=shareTargets.findIndex(v=>v[0]===key);if(item){const from={x:+item.getAttribute('x'),y:+item.getAttribute('y'),w:108,h:140};item.remove();await sackFlight(from,{x:shareZone.x+j*shareZone.spacing+25+shareCounts[key]*83,y:shareZone.y+34,w:96,h:110},480,45)}stageBusy=false;}
 shareCounts[key]++;selectedSack=null;sound.load();banner('Thank you for sharing!',900);showSharing();save();
 if(sharingTotal()===8&&!sharingIntro)finishSharing();
}
async function finishSharing(){
 const token=epoch;stageBusy=true;sound.cheer();
 await wait(900);
 if(token!==epoch)return;
 props.replaceChildren();arrangeCast('shareDone');
 if(await speak('shareDone'))quiz();
}
function titleFor(key){return shareTargets.find(t=>t[0]===key)[1]}
function quiz(){
 if(watchMode){finishQuiz();return}
 setPhase('quiz');quizIndex=0;$('speech').hidden=true;stageBusy=false;
 $('quiz').hidden=false;setLabel('Three quick questions about Santokh');
 showQuestion();
}
function showQuestion(){
 const q=story.questions[quizIndex];if(!q){$('quiz').hidden=true;finishQuiz();return}
 $('quizCount').textContent='QUESTION '+(quizIndex+1)+' OF '+story.questions.length;
 $('quizQuestion').textContent=q.q;
 $('quizFeedback').textContent='';
 const box=$('quizChoices');box.replaceChildren();
 for(let i=0;i<q.options.length;i++){
   const btn=document.createElement('button');btn.textContent=String.fromCharCode(65+i)+'. '+q.options[i];
   btn.addEventListener('click',()=>{
     if(btn.disabled||$('quiz').dataset.answering==='true')return;
     if(i!==q.answer){btn.classList.add('wrong');$('quizFeedback').textContent='Good try! Think about what Baldev learned and choose again.';sound.wobble();return}
     $('quiz').dataset.answering='true';btn.classList.add('correct');$('quizFeedback').textContent='Shabash! '+q.explain;sound.cheer();
     setTimeout(()=>{quizIndex++;save();$('quiz').dataset.answering='false';showQuestion()},1250);
   });
   box.append(btn)
 }
}
async function finishQuiz(){
 setPhase('finale');scene('village',5,'A FULL HEART');sound.setMood('village');loaded=0;arrangeCast('finale');cart(340,275,.80);detachWheel($('cartHost'),false);$('cartHost')?.classList.add('cart-crash');setLabel('You helped Baldev discover Santokh');
 await speak('finale');sound.cheer();setPhase('complete');$('finish').hidden=watchMode;setLabel('Mission complete!','★ ★ ★');try{localStorage.removeItem(STORAGE_KEY)}catch{}
}
async function begin(resume=false){
 if(!story)return;
 $('opening').hidden=true;runStarted=true;sound.start();clipStop();loaded=0;harvested=0;
 if(resume){
  let saved;try{saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{}
  // Restart at the nearest safe milestone; always restore gameplay, never mid-dialogue.
  if(saved?.phase==='fieldLoad'){scene('field',2,'HARVEST FRENZY');loaded=0;arrangeCast('load');cart(365,278,.80);fieldLoad();return}
  if(saved?.phase==='storage'){storage();return}
  if(saved?.phase==='returnField'){returnToField();return}
  if(saved?.phase==='requests'){requests();return}
  if(saved?.phase==='lesson'){lesson();return}
  if(saved?.phase==='share'){share();return}
  if(saved?.phase==='quiz'){requests();return}
 }
 intro()
}
let watchMode=false,watchDue=0,watchActing=false,handPos=null,handRevision=0;
function setWatch(enabled){watchMode=enabled;if(!enabled)hideWatchHand(true);document.body.classList.toggle('episode-mode',enabled);watchDue=performance.now()+650;$('watchStop').hidden=!enabled;if(canPlaceSharingSack()&&runStarted&&$('sharingSacks'))showSharing()}
$('watch').onclick=()=>{setWatch(true);begin(false)};
$('watchStop').onclick=()=>{setWatch(false);if(window.lpPhase==='complete')$('finish').hidden=false};
function autoActivate(el){if(!el)return;el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}))}
const watchHand=n('g',{id:'watchPointer',visibility:'hidden','pointer-events':'none','aria-hidden':'true'});
const handPulse=n('circle',{cx:0,cy:0,r:10,fill:'none',stroke:'#41aaff','stroke-width':3,opacity:0});
const handArt=n('g',{transform:'scale(2.4) translate(-11 -2)'});
handArt.innerHTML='<path d="M9 13V4a2 2 0 0 1 4 0v6a2 2 0 0 1 4 0v2a2 2 0 0 1 4 0v5c0 4-2.8 7-7 7h-2c-2.5 0-3.8-1.5-5.1-3.4L3.3 15a2 2 0 0 1 3.1-2.4L9 15Z" fill="#268be3" stroke="white" stroke-width="1.35" stroke-linejoin="round"/><path d="M13 11v4m4-3v3" stroke="#1058a5" stroke-width=".9" fill="none" stroke-linecap="round"/>';
watchHand.append(handPulse,handArt);stage.append(watchHand);
function hideWatchHand(reset=false){watchHand.setAttribute('visibility','hidden');if(reset){handRevision++;handPos=null}}
function handTarget(el){
 if(!el?.isConnected)return null;
 const box=el.getBBox(),matrix=el.getScreenCTM();
 if(!matrix||!stage.getScreenCTM())return null;
 const p=stage.createSVGPoint();p.x=box.x+box.width*.5;p.y=box.y+box.height*.48;
 return p.matrixTransform(stage.getScreenCTM().inverse().multiply(matrix))
}
function placeHand(p){handPos={x:p.x,y:p.y};watchHand.setAttribute('transform','translate('+p.x+' '+p.y+')');watchHand.setAttribute('visibility','visible')}
async function watchTap(target,action,cadence){
 if(watchActing||!watchMode||!target)return;
 watchActing=true;const token=epoch,revision=++handRevision,start=performance.now(),from=handPos||{x:Math.min(1215,target.x+100),y:Math.min(655,target.y+80)};
 const valid=()=>watchMode&&token===epoch&&revision===handRevision&&!document.hidden;
 try{
  const reached=await new Promise(resolve=>{function step(now){
   if(!valid()){resolve(false);return}const q=reducedMotion.matches?1:Math.min(1,(now-start)/190),e=q*q*(3-2*q);
   placeHand({x:from.x+(target.x-from.x)*e,y:from.y+(target.y-from.y)*e});if(q<1)requestAnimationFrame(step);else resolve(true)
  }requestAnimationFrame(step)});
  if(!reached||!valid())return;
  if(!reducedMotion.matches)handPulse.animate([{opacity:.95,transform:'scale(.7)'},{opacity:0,transform:'scale(2.8)'}],{duration:380});
  await wait(45);if(!valid())return;action();await wait(100);if(valid())hideWatchHand();
 }finally{watchActing=false;watchDue=Math.max(performance.now()+45,start+cadence)}
}
function watchElement(el,cadence){const p=handTarget(el);if(p)watchTap(p,()=>{if(el.isConnected&&!stageBusy)autoActivate(el)},cadence)}

setInterval(()=>{
 if(!watchMode||!runStarted||document.hidden||watchActing||performance.now()<watchDue)return;
 if(!$('finish').hidden||window.lpPhase==='complete')return;
 if(!$('help').hidden)return;
 if(!$('speech').hidden){if((!voiceEnabled||(!currentVoice&&$('soundHint').textContent))&&performance.now()-dialogueStart>9000)$('nextLine').click();return}
 if(stageBusy)return;
 if(!$('sceneAction').hidden){$('sceneAction').click();watchDue=performance.now()+1000;return}
 if(!$('quiz').hidden){const q=story.questions[quizIndex];if(q&&$('quiz').dataset.answering!=='true')$('quizChoices').children[q.answer]?.click();watchDue=performance.now()+5000;return}
 const patch=props.querySelector('[data-patch]:not([data-done])');
 const task=props.querySelector('[data-harvest]:not([data-done])');
 const sack=front.querySelector('#looseSacks image');
 const shareItem=props.querySelector('#sharingSacks image');
 if(patch)watchElement(patch,570);
 else if(task)watchElement(task,850);
 else if(sack)watchElement(sack,950);
 else if(shareItem){if(selectedSack===null)watchElement(shareItem,600);else{const j=shareTargets.findIndex(([key,,cap])=>shareCounts[key]<cap);if(j>=0){const key=shareTargets[j][0];watchTap({x:shareZone.x+j*shareZone.spacing+76+shareCounts[key]*83,y:shareZone.y+65},()=>putSack(key),650)}}}
},80);
$('start').onclick=()=>{setWatch(false);begin(Boolean($('start').dataset.resume))};
$('restart').onclick=()=>{setWatch(false);begin(false)};
$('playAgain').onclick=()=>{setWatch(false);clipStop();begin(false)};
$('musicToggle').onclick=()=>{musicEnabled=!musicEnabled;$('musicToggle').textContent=musicEnabled?'♫ Music on':'♫ Music off';$('musicToggle').setAttribute('aria-pressed',String(musicEnabled));if(musicEnabled)sound.start()};
$('voiceToggle').onclick=()=>{voiceEnabled=!voiceEnabled;$('voiceToggle').textContent=voiceEnabled?'◉ Voice on':'◌ Voice off';$('voiceToggle').setAttribute('aria-pressed',String(voiceEnabled));if(!voiceEnabled){currentVoice?.pause();if('speechSynthesis'in window)speechSynthesis.cancel();captionRequired=true;updateCaptions()}else currentVoice?.play().catch(()=>{})};
$('helpBtn').onclick=()=>{$('help').hidden=false};
$('closeHelp').onclick=()=>{$('help').hidden=true};
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){$('help').hidden=true;if(watchMode){setWatch(false);if(window.lpPhase==='complete')$('finish').hidden=false}return}
 if(!e.defaultPrevented&&(e.key==='Enter'||e.key===' ')&&!$('speech').hidden&&!e.target.closest('button')){e.preventDefault();$('nextLine').click()}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){currentVoice?.pause();if(sound.ctx)sound.ctx.suspend()}else{if(voiceEnabled)currentVoice?.play().catch(()=>{});if(sound.ctx&&musicEnabled)sound.ctx.resume()}});
(async()=>{
 try{
   const [d,c,ch]=await Promise.all([fetch('dialogue.json?v=7'),fetch(imageOf('assets/cart/bullock-cart.svg')),fetch(imageOf(asset.chicken)).catch(()=>null)]);
   if(!d.ok)throw Error('Mission dialogue not available');
   story=await d.json();cartSource=c.ok?await c.text():null;chickenSource=ch?.ok?await ch.text():null;background('village');
   const existing=localStorage.getItem(STORAGE_KEY);if(existing){$('start').textContent='▶ Resume adventure';$('start').dataset.resume='true';$('restart').hidden=false}
   $('start').disabled=false;$('watch').disabled=false;
 }catch(err){$('start').textContent='Unable to load mission';$('start').disabled=true;banner(String(err),15000)}
})();
})();
