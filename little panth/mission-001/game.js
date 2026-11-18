/* Little Panth LP-001 — browser-only playable adventure.
   Static SVG art and cached Punjabi MP3s. No credentials or remote API at play time. */
(() => {
'use strict';
const $=id=>document.getElementById(id), NS='http://www.w3.org/2000/svg', BASE='../';
const imageOf=path=>new URL(BASE+path,location.href).href;
const backgrounds={village:'anchor set/village courtyard.svg',field:'anchor set/wheat field.svg',storage:'anchor set/village storage courtyard.svg',gurdwara:'anchor set/gurudwara courtyard.svg'};
const asset={patch:'assets/wheat/wheat-patch.svg',bundle:'assets/wheat/wheat-bundle.svg',sack:'assets/wheat/wheat-sack.svg',chicken:'assets/props/chicken.svg',basket:'assets/props/basket.svg',sickle:'assets/tools/sickle.svg'};
const n=(name,attrs={})=>{const el=document.createElementNS(NS,name);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,String(v));return el};
const stage=$('stage'),props=$('worldProps'),cast=$('characters'),fx=$('fx');
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
let story,cartSource,rig={},actors=[],currentVoice=null,voiceResolver=null,voiceEnabled=true,musicEnabled=true,
    epoch=0,activeSpeaker='',activeListener='',stageBusy=false,loaded=0,harvested=0,selectedSack=null,shareCounts={home:0,seeds:0,sharing:0},quizIndex=0,
    eighthAttempts=0,locationId='village',act=1,runStarted=false,firstLoad=true;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const getXY=e=>{const pt=stage.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;return pt.matrixTransform(stage.getScreenCTM().inverse())};
function setLabel(objective,counter='',instruction=''){
 $('objective').textContent=objective;$('counter').textContent=counter;$('instruction').textContent=instruction||objective;
}
function banner(text,ms=1500){const b=$('activity');b.textContent=text;b.hidden=false;clearTimeout(b._t);b._t=setTimeout(()=>b.hidden=true,ms)}
function background(id){locationId=id;$('background').setAttribute('href',imageOf(backgrounds[id]));$('location').textContent={village:'Village courtyard',field:'Golden wheat field',storage:'Baldev\u2019s storage yard',gurdwara:'Gurudwara Sahib'}[id];}
function clearStage(){hideNarrator();resetCamera();activeListener='';actors=[];clearTimeout($('activity')._t);$('activity').hidden=true;props.replaceChildren();fx.replaceChildren();$('verse').hidden=true;$('speech').hidden=true;$('sceneAction').hidden=true;$('quiz').hidden=true;$('finish').hidden=true;cast.replaceChildren();activeSpeaker='';selectedSack=null;stageBusy=false}
function scene(id,number,title){epoch++;clearStage();act=number;$('actBadge').textContent='ACT '+number+' / 5';$('chapter').textContent=title;background(id);save();}
function save(){if(!runStarted)return;try{localStorage.setItem(STORAGE_KEY,JSON.stringify({phase:window.lpPhase||'intro',loaded,harvested,shareCounts,quizIndex,ts:Date.now()}))}catch{}}
function setPhase(id){window.lpPhase=id;save()}
function button(text,fn){const el=$('sceneAction');el.textContent=text;el.hidden=false;el.onclick=()=>{el.hidden=true;sound.ping();fn()}}
function clipStop(){if(currentVoice){currentVoice.onended=null;currentVoice.onerror=null;currentVoice.pause();currentVoice=null;}if('speechSynthesis'in window)try{speechSynthesis.cancel()}catch{};if(voiceResolver){const f=voiceResolver;voiceResolver=null;f()}}
async function oneLine(id,token,autoRead) {
 if(token!==epoch)return;
 const line=story.lines[id];if(!line)return;
 activeSpeaker=line.speaker;
 activeListener=line.to||'';
 if(line.speaker==='narrator')showNarrator();else hideNarrator();
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
   const done=()=>{if(settled)return;settled=true;clearTimeout(readTimer);voiceResolver=null;if(currentVoice){currentVoice.onended=null;currentVoice.onerror=null;currentVoice.pause();currentVoice=null}if(utterance&&'speechSynthesis'in window)try{speechSynthesis.cancel()}catch{};resolve()};
   voiceResolver=done;$('nextLine').onclick=done;
   function startReadingTimer(){
     if(autoRead||watchMode){clearTimeout(readTimer);readTimer=setTimeout(done,Math.max(line.sacred?6500:3800,line.en.split(/\s+/).length*325));}
   }
   if(!voiceEnabled){startReadingTimer();return}
   let failed=false;
   const audio=new Audio('audio/'+id+'.mp3');currentVoice=audio;audio.volume=.94;
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
  musicTick(){if(!musicEnabled||!runStarted)return;this.tick++;const m=this.mood;if(m==='quiet')return;const notes=m==='storage'?[196,220,247,294,330]:m==='field'?[220,247,294,330,392]:[196,247,294,330,392];const i=this.tick;const rate=m==='reflection'?5:2;if(i%rate===0)this.tone(notes[Math.floor(i/rate)%notes.length],.43,m==='reflection'?.035:.061,'sine');if(i%8===0)this.tone(notes[0]/2,.94,.04,'triangle');if(m==='storage'&&i%4===3)this.tone(125,.08,.022,'triangle')},
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
function fallback(actor){
 if(actor.id==='narrator')return `<svg x="-50" y="-174" width="100" height="174" viewBox="0 0 100 174"><g stroke="#593c42" stroke-width="2" stroke-linejoin="round"><ellipse cx="50" cy="168" rx="29" ry="4" fill="#302b3b" opacity=".2"/><path d="M29 112L24 153 42 159 50 132 57 159 77 153 70 112Z" fill="#e8c89d"/><path d="M24 151Q16 164 38 164H43L42 153M76 151Q84 164 63 164H57L58 153" fill="#754d46"/><path d="M32 59Q50 51 68 59L80 126Q50 140 20 126Z" fill="#865b86"/><path d="M33 62Q26 84 17 92L8 84Q4 77 10 73L18 77 23 65Z" fill="#bb8969"/><path d="M68 62Q77 82 84 97L77 104Q69 105 67 97L59 75Z" fill="#bb8969"/><path d="M30 61Q42 77 70 64L69 77Q43 92 26 76Z" fill="#e6bf8e"/><circle cx="50" cy="34" r="27" fill="#c89975"/><path d="M24 38Q15 5 50 5Q80 6 77 37L66 17Q50 29 30 23Z" fill="#a5a1a5"/><circle cx="75" cy="12" r="10" fill="#a5a1a5"/><g fill="none"><rect x="29" y="32" width="18" height="12" rx="5"/><rect x="53" y="32" width="18" height="12" rx="5"/><path d="M47 36H53"/></g><circle cx="39" cy="38" r="2" fill="#38272a"/><circle cx="61" cy="38" r="2" fill="#38272a"/><path d="M43 50Q50 56 57 50" fill="none"/></g></svg>`;
 const size=actor.id==='mehar'?0.76:1;
 const c={baldev:['#bc7641','#df873d','#f1c165'],mehar:['#c17f49','#e9b450','#fd6f69'],baba:['#c19565','#d3c4a3','#7bb2ad'],farmer:['#b88256','#ad7c51','#9cb87d']}[actor.id];
 const turban=actor.id==='mehar'?'<path d="M-49-98Q-58-159 0-158Q51-158 49-103L25-131Q-10-126-38-101Z" fill="#30252c"/><path d="M-43-92Q-56-70-45-39L-37-23" stroke="#30252c" stroke-width="16" stroke-linecap="round"/><path d="M44-92Q58-70 46-39L39-23" stroke="#30252c" stroke-width="16" stroke-linecap="round"/>':'<path d="M-51-129q0-43 51-52q51 11 51 52v25h-102Z" fill="'+c[1]+'" stroke="#4c3125" stroke-width="4"/><path d="M-48-139q46 11 96-6M-45-122q40 10 89-9" fill="none" stroke="#faf2d3" stroke-width="4"/>';
 return `<svg x="${-actor.height*.28}" y="${-actor.height}" width="${actor.height*.56}" height="${actor.height}" viewBox="-115 -200 230 390" overflow="visible"><g class="fallback-body"><path d="M-40 58L-44 151H-9L-4 69 9 151H45L41 56Z" fill="#524b53" stroke="#302b29" stroke-width="6"/><path d="M-56-19Q0-32 56-19L74 100H-69Z" fill="${c[2]}" stroke="#402f29" stroke-width="6"/><path d="M-52-9l-27 81 20 8 28-56M53-9l27 81-20 8-28-56" fill="${c[0]}" stroke="#493126" stroke-width="6"/><circle cy="-102" r="48" fill="${c[0]}" stroke="#493126" stroke-width="5"/>${turban}<circle cx="${actor.view==='left'?-23:-11}" cy="-106" r="4" fill="#282321"/><circle cx="${actor.view==='left'?12:24}" cy="-106" r="4" fill="#282321"/><path d="M-12-84Q3-72 16-86" stroke="#733725" fill="none" stroke-width="3"/>${actor.id!=='mehar'?`<path d="${actor.id==='baba'?'M-35-83Q0-58 35-83Q40-36 0 1Q-40-36-35-83Z':actor.id==='farmer'?'M-35-83Q0-58 35-83Q32-36 0-24Q-32-36-35-83Z':'M-35-83Q0-58 35-83Q39-38 0-30Q-39-38-35-83Z'}" fill="${actor.id==='baba'?'#e0e1e1':actor.id==='farmer'?'#a8a8a2':'#34312d'}"/>`:''}</g></svg>`;
}
const narratorActor={id:'narrator',x:60,y:176,height:174,view:'right',frame:'',action:'idle',art:$('narratorArt')};
function showNarrator(){$('narratorFigure').classList.add('visible');renderActor(narratorActor)}
function hideNarrator(){$('narratorFigure').classList.remove('visible')}
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const storyPoses={
 lp005:'explain',lp010:'wonder',lp011:'point',lp012:'beckon',lp015:'point',lp028:'explain',
 lp001:'beckon',lp002:'wonder',lp003:'point',lp004:'point',lp006:'celebrate',
 lp007:'wonder',lp008:'celebrate',lp009:'point',lp013:'point',lp014:'alarm',
 lp016:'alarm',lp017:'alarm',lp018:'alarm',lp019:'reflect',lp020:'reflect',
 lp021:'offer',lp022:'offer',lp023:'reflect',lp024:'wonder',lp025:'beckon',
 lp026:'offer',lp027:'reflect',lp029:'point',lp030:'offer',lp031:'reflect',
 lp032:'point',lp033:'offer',lp034:'celebrate',lp035:'wonder',lp036:'offer',
 lp037:'wonder',lp038:'alarm'
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
const camera={x:0,y:0,w:1280,h:720};
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function resetCamera(){Object.assign(camera,{x:0,y:0,w:1280,h:720});stage.setAttribute('viewBox','0 0 1280 720')}
function animateCamera(now){
 if(reducedMotion.matches||!stageBusy){if(camera.w!==1280)resetCamera();return}
 if(!activeSpeaker){for(const [k,v] of Object.entries({x:0,y:0,w:1280,h:720}))camera[k]+=(v-camera[k])*.105;stage.setAttribute('viewBox',[camera.x,camera.y,camera.w,camera.h].map(v=>v.toFixed(2)).join(' '));return}
 const actor=actors.find(a=>a.id===activeSpeaker);
 const elapsed=Math.max(0,now-dialogueStart);
 const zoom=actor?1.27+.12*Math.min(1,elapsed/4000):1.06;
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
function renderActor(actor,now=performance.now()){
 const art=actor.art;
 const slot=rig[actor.id]?.[actor.view];
 const speaking=activeSpeaker===actor.id;
 const elapsed=now-dialogueStart;
 const clipPlaying=currentVoice&&!currentVoice.paused;
 const speakingTime=clipPlaying?currentVoice.currentTime*1000:elapsed;
 const mouth=!reducedMotion.matches&&speaking&&clipPlaying?['talkA','talkEE','idle','talkO','talkEE'][Math.floor(speakingTime/118)%5]:'idle';
 const blink=!reducedMotion.matches&&(now+actor.x*3)%4300<135;
 const reaction=speaking?dialoguePose:actor.action;
 const listener=Boolean(activeSpeaker&&activeSpeaker!=='narrator'&&!speaking);
  const gesture=reducedMotion.matches?'idle':speaking?(elapsed%3000<1900?reaction:(reaction==='explain'?'offer':'explain')):listener&&actor.action==='idle'&&(elapsed+actor.x)%3500<650?'nod':reaction;
 const walkTime=now-(actor.walkStart??-Infinity);
 const walk=!reducedMotion.matches&&walkTime>=0&&(actor.walking||walkTime<760);
 const pose=walk?'walk'+Math.floor((walkTime%760)/760*12):gesture;
 art.classList.toggle('alarm',reaction==='alarm');
 art.classList.toggle('celebrate',reaction==='celebrate');
 const frame=slot?.frames[pose]??slot?.frames.idle;
 if(!slot){
   if(!art.firstChild)art.innerHTML=fallback(actor);
    art.firstElementChild?.setAttribute('data-fallback-facing',actor.view);
   return;
 }
 if(!art._sprite){
   art.innerHTML=`<svg x="${-actor.height*.30}" y="${-actor.height}" width="${actor.height*.60}" height="${actor.height}" overflow="visible">${slot.base}</svg>`;
   art._sprite=art.firstElementChild;
   art._layers=Object.fromEntries([...art.querySelectorAll('[data-scene-layer]')].map(e=>[e.dataset.sceneLayer,e]));
   art._parts={};
 }
 const face=slot.frames[mouth];
 const key=[actor.view,pose,mouth,blink].join(':');
 if(key===actor.frame)return;
 actor.frame=key;
 for(const [part,original] of Object.entries(frame.parts)){
   let markup=original;
   if(blink&&part==='eyeGroup')markup=slot.frames.blink.parts[part];
   if(mouth!=='idle'&&['mouthGroup','beardGroup'].includes(part))markup=face.parts[part];
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
function updateCart(){
 const host=$('cartHost');if(!host)return;
 for(let i=1;i<=8;i++){const g=host.querySelector('#sack-pos-'+i);if(g)g.setAttribute('opacity',i<=loaded?'1':'0')}
 host.querySelector('#ox-nervous-fx')?.setAttribute('opacity',loaded>=7?'1':'0');
}
function decoratePile(count=5,x=350,y=555){for(let j=0;j<count;j++)props.appendChild(img(asset.sack,x+j*87,y-((j%2)*18),76,95))}
function looseSacks(count,onCollect){
 let container=$('looseSacks');if(!container){container=n('g',{id:'looseSacks'});props.append(container)}
 container.replaceChildren();
 for(let j=0;j<count;j++){
   const im=img(asset.sack,125+j*107,522,86,119,'sack-draggable tap-target','Load a wheat sack');
   im.style.pointerEvents='all';im.dataset.index=j;
   im.addEventListener('pointerdown',e=>{if(stageBusy)return;im.setPointerCapture(e.pointerId);im._drag={sx:e.clientX,sy:e.clientY};e.preventDefault()});
   im.addEventListener('pointermove',e=>{if(!im._drag)return;const p=getXY(e);im.setAttribute('transform',`translate(${p.x-(125+j*107)-43} ${p.y-582})`)});
   im.addEventListener('pointerup',e=>{if(!im._drag)return;im._drag=null;im.removeAttribute('transform');onCollect();e.preventDefault()});
   im.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!stageBusy){e.preventDefault();onCollect()}});
   container.appendChild(im)
 }
}
async function intro(){
 setPhase('intro');scene('village',1,'THE EMERGENCY');sound.setMood('village');loaded=0;harvested=0;shareCounts={home:0,seeds:0,sharing:0};quizIndex=0;
 arrangeCast('intro');cart(622,320,.55);decoratePile(3,430,558);for(const sack of Array.from(props.children).slice(-3)){sack.dataset.inspect='1';sack.classList.add('tap-target');sack.setAttribute('role','button');sack.setAttribute('tabindex','0');sack.setAttribute('aria-label','Inspect wheat sack');sack.addEventListener('click',()=>{if(!$('sceneAction').hidden)$('sceneAction').click()});sack.addEventListener('keydown',e=>{if(e.key==='Enter'&&!$('sceneAction').hidden)$('sceneAction').click()})}setLabel('What is Chacha Baldev so worried about?');
 await speak('intro');button('Inspect the wheat sacks →',inspectCourtyard);
 for(const sack of props.querySelectorAll('image[data-inspect]'))sack.style.pointerEvents='all';
}
async function walkTo(id,x,duration=1800){
 const actor=actors.find(a=>a.id===id),token=epoch;if(!actor)return;
 const view=x<actor.x?'left':'right';if(view!==actor.view){actor.view=view;actor.frame='';actor.art._sprite=null;actor.art.replaceChildren()}
 const from=actor.x,start=performance.now();actor.walkStart=start;actor.walking=true;
 await new Promise(resolve=>{function step(now){if(token!==epoch){resolve();return}const q=reducedMotion.matches?1:Math.min(1,(now-start)/duration);actor.x=from+(x-from)*q;actor.node.setAttribute('transform','translate('+actor.x+' '+actor.y+')');if(q<1)requestAnimationFrame(step);else resolve()}requestAnimationFrame(step)});
 actor.walking=false;actor.walkStart=-Infinity;actor.frame='';renderActor(actor);
}
async function inspectCourtyard(){
 stageBusy=true;for(const sack of props.querySelectorAll('[data-inspect]')){sack.style.pointerEvents='none';sack.removeAttribute('tabindex')}
 setLabel('Mehar inspects the wheat sacks');await walkTo('mehar',730,2100);await walkTo('baldev',365,950);await speak('courtyardInspect');
 button('Follow Baldev to the fields →',async()=>{stageBusy=true;await Promise.all([walkTo('mehar',1180,1800),walkTo('baldev',1010,2600)]);harvest()});
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
     const count=Number(holder.dataset.cuts)+1;holder.dataset.cuts=String(count);sound.cut();
     picture.setAttribute('transform','translate(0 '+(count%2?4:-3)+')');picture.setAttribute('opacity',String(1-count*.20));banner('Wheat cut! '+count+' / 3',550);
     if(count>=3){holder.dataset.done='1';holder.style.pointerEvents='none';picture.style.pointerEvents='none';harvested++;holder.append(img(asset.bundle,x+75,y+25,58,90));sound.ping();setLabel('Cut six golden wheat patches',harvested+' / 6');
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
 const activate=()=>{if(stageBusy||item.dataset.done)return;item.dataset.done='1';item.style.pointerEvents='none';item.setAttribute('opacity','.25');item.removeAttribute('tabindex');fn()};
 item.addEventListener('click',activate);item.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate()}});props.append(item);return item;
}
async function collectHarvest(){
 if(window.lpPhase!=='harvest')return;
 props.replaceChildren();setLabel('Gather the six cut wheat piles','0 / 6');await speak('collectIntro');let collected=0;
 for(let j=0;j<6;j++)harvestTarget('collect',asset.bundle,270+j*117,448,92,162,'Collect wheat pile '+(j+1),()=>{
  collected++;sound.ping();setLabel('Gather the six cut wheat piles',collected+' / 6');
  if(collected%2===0){props.append(img(asset.bundle,475+collected/2*90,310,66,105));banner('One bundle ready!',900)}
  if(collected===6){stageBusy=true;setTimeout(packHarvest,750)}
 });
}
async function packHarvest(){
 props.replaceChildren();setLabel('Prepare three sacks of grain','0 / 3');await speak('packIntro');let packed=0;
 for(let j=0;j<3;j++){
  const x=330+j*210;props.append(img(asset.sack,x+75,500,95,130));
  harvestTarget('pack',asset.bundle,x,420,108,160,'Separate grain and pack sack '+(j+1),()=>{
   packed++;sound.load();props.append(img(asset.sack,x+60,451,120,160));setLabel('Prepare three sacks of grain',packed+' / 3');banner('Sack filled!',800);
   if(packed===3){stageBusy=true;setTimeout(finishHarvest,750)}
  });
 }
}
async function finishHarvest(){
 if(window.lpPhase!=='harvest')return;
 sound.cheer();banner('3 bundles → 3 sacks!');props.replaceChildren();arrangeCast('load');
 setLabel('Three sacks are ready!','3 / 3','Time to load the cart');
 await speak('harvestDone');fieldLoad();
}
function fieldLoad(){
 setPhase('fieldLoad');loaded=0;stageBusy=false;props.replaceChildren();cart(435,320,.63);arrangeCast('load');
 setLabel('Load three sacks into the cart','0 / 3','Tap or drag the sacks onto the cart');
 drawFieldSacks();
}
function drawFieldSacks(){looseSacks(3-loaded,async()=>{
 if(stageBusy)return;loaded++;sound.load();updateCart();setLabel('Load three sacks into the cart',loaded+' / 3');
 if(loaded>=3){stageBusy=true;props.querySelector('#looseSacks')?.replaceChildren();sound.cheer();await speak('loadThree');button('Head to the storage courtyard →',()=>storage())}
 else drawFieldSacks();
})}
function storage(){
 setPhase('storage');scene('storage',3,'JUST ONE MORE!');sound.setMood('storage');loaded=3;eighthAttempts=0;arrangeCast('storage');
 cart(360,293,.68);setLabel('Add two sacks to reach five','3 / 5','Tap or drag another wheat sack into the cart');
 (async()=>{await speak('storageIntro');drawStorageSacks()})();
}
function drawStorageSacks(){
 if(window.lpPhase!=='storage')return;
 let count=loaded>=7?1:Math.min(2,7-loaded);
 looseSacks(count,loadStorageSack);
 setLabel(loaded<5?'Fill Baldev\u2019s cart to five':loaded<7?'Baldev now wants SEVEN sacks':'Can one more sack fit?',loaded+' / '+(loaded<5?5:loaded<7?7:8),
   loaded<7?'Tap or drag the sacks. Watch the wheels!':'Try placing the last enormous sack.');
}
async function loadStorageSack(){
 if(stageBusy)return;
 if(loaded===7){
   if(++eighthAttempts===1){stageBusy=true;sound.wobble();$('cartHost')?.classList.add('cart-wobble');banner('Oh no! The sack slides off!',1600);await speak('failedEighth');$('cartHost')?.classList.remove('cart-wobble');stageBusy=false;drawStorageSacks();return}
   stageBusy=true;loaded=8;updateCart();props.querySelector('#looseSacks')?.replaceChildren();sound.crash();$('cartHost')?.classList.add('cart-crash');
   props.append(img(asset.chicken,1000,528,110,115,'chicken-run'));
   for(let j=0;j<4;j++)props.append(img(asset.sack,555+j*91,568+(j%2)*20,80,107));
   for(const actor of actors)actor.action='alarm';
   banner('CRAAACK! THE WHEEL BROKE!',2500);
   await wait(1250);await speak('crash');sound.setMood('reflection');for(const actor of actors)actor.action=actor.id==='baldev'?'reflect':'idle';
   props.append(img(asset.basket,215,554,130,87));await speak('reflection');button('Return to the village →',()=>requests());return;
 }
 stageBusy=true;loaded++;sound.load();updateCart();drawStorageSacks();
 if(loaded===5){sound.cheer();await speak('five');drawStorageSacks()}
 else if(loaded===7){sound.wobble();$('cartHost')?.classList.add('cart-wobble');await speak('seven');$('cartHost')?.classList.remove('cart-wobble');drawStorageSacks()}
 stageBusy=false;
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
function share(){
 setPhase('share');scene('village',5,'THE JOY OF SHARING');sound.setMood('village');arrangeCast('share');
 shareCounts={home:0,seeds:0,sharing:0};selectedSack=null;
 (async()=>{await speak('shareIntro');arrangeCast('sharingGame');showSharing()})();
}
const shareZone={x:192,y:509,spacing:302,width:292,height:130};
const shareTargets=[['home','HOME',3,'For Baldev\u2019s family','#8ccfb3'],['seeds','SEEDS',2,'For the next crop','#f6ca81'],['sharing','SHARING & LANGAR',3,'For those in need','#b7b6ef']];
function showSharing(){
 props.replaceChildren();
 let stageTitle=n('g',{'id':'shareTargets'}),selected=selectedSack;
 for(let j=0;j<shareTargets.length;j++){
   const [key,title,cap,sub,color]=shareTargets[j],x=shareZone.x+j*shareZone.spacing,y=shareZone.y;
   const zone=n('g',{role:'button',tabindex:0,'aria-label':title+' '+shareCounts[key]+' of '+cap,'data-target':key});
   zone.append(n('rect',{x,y,width:shareZone.width,height:shareZone.height,rx:21,fill:color,stroke:'#44676c','stroke-dasharray':'9 6','stroke-width':4,'class':'goal-zone'}));
   zone.append(labelText(title,x+shareZone.width/2,y+43,title.length>12?20:27,'#263941'));
   zone.append(labelText(shareCounts[key]+' / '+cap,x+shareZone.width/2,y+81,30,'#385c46'));
   zone.append(labelText(sub,x+shareZone.width/2,y+112,16,'#455956'));
   zone.addEventListener('pointerup',()=>putSack(key));
   zone.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();putSack(key)}});
   stageTitle.append(zone);
 }
 props.append(stageTitle);
 const remaining=8-(shareCounts.home+shareCounts.seeds+shareCounts.sharing);
 const row=n('g',{id:'sharingSacks'});
 for(let j=0;j<remaining;j++){
   const x=219+j*105,y=389;
   const item=img(asset.sack,x,y,84,110,'sack-draggable tap-target','Choose sack '+(j+1));
   item.style.pointerEvents='all';item.setAttribute('tabindex','0');
   if(selected===j){item.setAttribute('stroke','#ffe884');item.setAttribute('filter','drop-shadow(0px 0px 12px gold)')}
   item.addEventListener('pointerdown',e=>{if(stageBusy)return;item.setPointerCapture(e.pointerId);item._drag={x:e.clientX,y:e.clientY};e.preventDefault()});
   item.addEventListener('pointermove',e=>{if(!item._drag)return;const p=getXY(e);item.setAttribute('transform',`translate(${p.x-x-42} ${p.y-y-55})`)});
   item.addEventListener('pointerup',e=>{if(!item._drag)return;item._drag=null;item.removeAttribute('transform');const p=getXY(e);const target=shareTargets.find(([,_,__,___],idx)=>p.y>=shareZone.y&&p.y<=shareZone.y+shareZone.height&&p.x>=shareZone.x+idx*shareZone.spacing&&p.x<=shareZone.x+idx*shareZone.spacing+shareZone.width);selectedSack=j;if(target)putSack(target[0]);else{sound.ping();showSharing()}e.preventDefault()});
   item.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectedSack=j;showSharing()}});
   row.append(item);
 }
 props.append(row);
 setLabel('Share the eight sacks wisely',(8-remaining)+' / 8','Select a sack, then choose Home, Seeds, or Sharing. Drag also works.');
}
function putSack(key){
 if(stageBusy)return;
 if(selectedSack===null){banner('First tap a wheat sack, then choose a destination');return}
 const t=shareTargets.find(v=>v[0]===key);
 if(shareCounts[key]>=t[2]){banner(titleFor(key)+' is already full!');sound.wobble();return}
 shareCounts[key]++;selectedSack=null;sound.load();banner('Thank you for sharing!',900);showSharing();save();
 if(Object.values(shareCounts).reduce((a,b)=>a+b,0)===8){stageBusy=true;sound.cheer();setTimeout(async()=>{props.replaceChildren();arrangeCast('shareDone');await speak('shareDone');quiz()},900)}
}
function titleFor(key){return shareTargets.find(t=>t[0]===key)[1]}
function quiz(){
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
 setPhase('finale');scene('village',5,'A FULL HEART');sound.setMood('village');loaded=0;arrangeCast('finale');cart(405,320,.55);$('cartHost')?.classList.add('cart-crash');setLabel('You helped Baldev discover Santokh');
 await speak('finale');sound.cheer();setPhase('complete');$('finish').hidden=false;setLabel('Mission complete!','★ ★ ★');try{localStorage.removeItem(STORAGE_KEY)}catch{}
}
async function begin(resume=false){
 if(!story)return;
 $('opening').hidden=true;runStarted=true;sound.start();clipStop();loaded=0;harvested=0;
 if(resume){
  let saved;try{saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{}
  // Restart at the nearest safe milestone; always restore gameplay, never mid-dialogue.
  if(saved?.phase==='fieldLoad'){scene('field',2,'HARVEST FRENZY');loaded=0;arrangeCast('load');cart(435,320,.63);fieldLoad();return}
  if(saved?.phase==='storage'){storage();return}
  if(saved?.phase==='requests'){requests();return}
  if(saved?.phase==='lesson'){lesson();return}
  if(saved?.phase==='share'){share();return}
  if(saved?.phase==='quiz'){requests();return}
 }
 intro()
}
let watchMode=false,watchDue=0;
function setWatch(enabled){watchMode=enabled;watchDue=performance.now()+1300;$('watchStop').hidden=!enabled}
$('watch').onclick=()=>{setWatch(true);begin(false)};
$('watchStop').onclick=()=>setWatch(false);
function autoActivate(el){if(!el)return;el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}))}
setInterval(()=>{
 if(!watchMode||!runStarted||document.hidden||performance.now()<watchDue)return;
 if(!$('finish').hidden){setWatch(false);return}
 if(!$('help').hidden)return;
 if(!$('speech').hidden){if((!voiceEnabled||(!currentVoice&&$('soundHint').textContent))&&performance.now()-dialogueStart>9000)$('nextLine').click();return}
 if(stageBusy)return;
 if(!$('sceneAction').hidden){$('sceneAction').click();watchDue=performance.now()+2500;return}
 if(!$('quiz').hidden){const q=story.questions[quizIndex];if(q&&$('quiz').dataset.answering!=='true')$('quizChoices').children[q.answer]?.click();watchDue=performance.now()+5000;return}
 const patch=props.querySelector('[data-patch]:not([data-done])');
 const task=props.querySelector('[data-harvest]:not([data-done])');
 const sack=props.querySelector('#looseSacks image');
 const shareItem=props.querySelector('#sharingSacks image');
 if(patch){autoActivate(patch);watchDue=performance.now()+1400}
 else if(task){autoActivate(task);watchDue=performance.now()+2100}
 else if(sack){autoActivate(sack);watchDue=performance.now()+2400}
 else if(shareItem){if(selectedSack===null)autoActivate(shareItem);else{const dest=shareTargets.find(([key,,cap])=>shareCounts[key]<cap);if(dest)putSack(dest[0])}watchDue=performance.now()+1400}
},200);
$('start').onclick=()=>{setWatch(false);begin(Boolean($('start').dataset.resume))};
$('restart').onclick=()=>{setWatch(false);begin(false)};
$('playAgain').onclick=()=>{setWatch(false);clipStop();begin(false)};
$('musicToggle').onclick=()=>{musicEnabled=!musicEnabled;$('musicToggle').textContent=musicEnabled?'♫ Music on':'♫ Music off';$('musicToggle').setAttribute('aria-pressed',String(musicEnabled));if(musicEnabled)sound.start()};
$('voiceToggle').onclick=()=>{voiceEnabled=!voiceEnabled;$('voiceToggle').textContent=voiceEnabled?'◉ Voice on':'◌ Voice off';$('voiceToggle').setAttribute('aria-pressed',String(voiceEnabled));if(!voiceEnabled){currentVoice?.pause();if('speechSynthesis'in window)speechSynthesis.cancel();captionRequired=true;updateCaptions()}else currentVoice?.play().catch(()=>{})};
$('helpBtn').onclick=()=>{$('help').hidden=false};
$('closeHelp').onclick=()=>{$('help').hidden=true};
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){$('help').hidden=true;return}
 if((e.key==='Enter'||e.key===' ')&&!$('speech').hidden&&!e.target.closest('button')){e.preventDefault();$('nextLine').click()}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){currentVoice?.pause();if(sound.ctx)sound.ctx.suspend()}else{if(voiceEnabled)currentVoice?.play().catch(()=>{});if(sound.ctx&&musicEnabled)sound.ctx.resume()}});
(async()=>{
 try{
   const [d,c]=await Promise.all([fetch('dialogue.json?v=3'),fetch(imageOf('assets/cart/bullock-cart.svg'))]);
   if(!d.ok)throw Error('Mission dialogue not available');
   story=await d.json();cartSource=c.ok?await c.text():null;background('village');
   const existing=localStorage.getItem(STORAGE_KEY);if(existing){$('start').textContent='▶ Resume adventure';$('start').dataset.resume='true';$('restart').hidden=false}
   $('start').disabled=false;$('watch').disabled=false;
 }catch(err){$('start').textContent='Unable to load mission';$('start').disabled=true;banner(String(err),15000)}
})();
})();
