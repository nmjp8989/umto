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
    epoch=0,activeSpeaker='',stageBusy=false,loaded=0,harvested=0,selectedSack=null,shareCounts={home:0,seeds:0,sharing:0},quizIndex=0,
    eighthAttempts=0,locationId='village',act=1,runStarted=false,firstLoad=true;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const getXY=e=>{const pt=stage.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;return pt.matrixTransform(stage.getScreenCTM().inverse())};
function setLabel(objective,counter='',instruction=''){
 $('objective').textContent=objective;$('counter').textContent=counter;$('instruction').textContent=instruction||objective;
}
function banner(text,ms=1500){const b=$('activity');b.textContent=text;b.hidden=false;clearTimeout(b._t);b._t=setTimeout(()=>b.hidden=true,ms)}
function background(id){locationId=id;$('background').setAttribute('href',imageOf(backgrounds[id]));$('location').textContent={village:'Village courtyard',field:'Golden wheat field',storage:'Baldev\u2019s storage yard',gurdwara:'Gurudwara Sahib'}[id];}
function clearStage(){clearTimeout($('activity')._t);$('activity').hidden=true;props.replaceChildren();fx.replaceChildren();$('verse').hidden=true;$('speech').hidden=true;$('sceneAction').hidden=true;$('quiz').hidden=true;$('finish').hidden=true;cast.replaceChildren();activeSpeaker='';selectedSack=null;stageBusy=false}
function scene(id,number,title){epoch++;clearStage();act=number;$('actBadge').textContent='ACT '+number+' / 5';$('chapter').textContent=title;background(id);save();}
function save(){if(!runStarted)return;try{localStorage.setItem(STORAGE_KEY,JSON.stringify({phase:window.lpPhase||'intro',loaded,harvested,shareCounts,quizIndex,ts:Date.now()}))}catch{}}
function setPhase(id){window.lpPhase=id;save()}
function button(text,fn){const el=$('sceneAction');el.textContent=text;el.hidden=false;el.onclick=()=>{el.hidden=true;sound.ping();fn()}}
function clipStop(){if(currentVoice){currentVoice.onended=null;currentVoice.onerror=null;currentVoice.pause();currentVoice=null;}if('speechSynthesis'in window)try{speechSynthesis.cancel()}catch{};if(voiceResolver){const f=voiceResolver;voiceResolver=null;f()}}
async function oneLine(id,token) {
 if(token!==epoch)return;
 const line=story.lines[id];if(!line)return;
 activeSpeaker=line.speaker;
 dialoguePose=storyPoses[id]||'idle';
 dialogueStart=performance.now();
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
   let settled=false;let utterance=null;
   const done=()=>{if(settled)return;settled=true;voiceResolver=null;if(currentVoice){currentVoice.onended=null;currentVoice.onerror=null;currentVoice.pause();currentVoice=null}if(utterance&&'speechSynthesis'in window)try{speechSynthesis.cancel()}catch{};resolve()};
   voiceResolver=done;$('nextLine').onclick=done;
   if(!voiceEnabled||line.sacred){return}
   let failed=false;
   const audio=new Audio('audio/'+id+'.mp3');currentVoice=audio;audio.volume=.94;
   audio.onended=()=>setTimeout(done,250);
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
   }
   audio.play().catch(()=>{audio.onerror?.()});
 });
 if(token!==epoch)return;
 if(lastFocus&&typeof lastFocus.focus==='function'&&lastFocus!==$('nextLine'))try{lastFocus.focus({preventScroll:true})}catch{}
}
async function speak(beat){const token=epoch;const ids=story.beats[beat]||[];stageBusy=true;for(const id of ids){if(token!==epoch)break;await oneLine(id,token);}if(token===epoch){$('speech').hidden=true;activeSpeaker='';updateTalking();stageBusy=false;}return token===epoch}
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
 intro:[['baldev',265,660,430],['mehar',1110,675,320,'left']],
 harvest:[['baldev',160,657,320],['mehar',1100,666,290,'left']],
 load:[['baldev',180,656,310],['mehar',1115,666,280,'left']],
 storage:[['baldev',145,647,340],['mehar',1125,660,290,'left']],
 requests:[['baldev',235,660,360],['mehar',510,660,275],['farmer',910,656,365,'left'],['baba',1130,660,350,'left']],
 lesson:[['baldev',230,665,350],['mehar',450,665,250],['baba',1020,665,415,'left']],
 share:[['baldev',245,660,390],['mehar',1100,655,285,'left']],
 sharingGame:[['baldev',320,340,245],['mehar',945,340,205,'left']],
 shareDone:[['baldev',290,660,365],['mehar',665,655,280],['farmer',1040,655,345,'left']],
 finale:[['baldev',300,670,365],['mehar',1035,670,320,'left']],
 };
 actors=(layouts[type]||layouts.intro).map(([id,x,y,height,view='right'])=>({id,x,y,height,view,frame:'',action:'idle',node:null}));
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
 const size=actor.id==='mehar'?0.76:1;
 const c={baldev:['#bc7641','#df873d','#f1c165'],mehar:['#c17f49','#e9b450','#fd6f69'],baba:['#c19565','#d3c4a3','#7bb2ad'],farmer:['#b88256','#ad7c51','#9cb87d']}[actor.id];
 const turban=actor.id==='mehar'?'<path d="M-44-122q35-50 90-4v24h-90Z" fill="#e28d49" stroke="#573323" stroke-width="4"/>':'<path d="M-51-129q0-43 51-52q51 11 51 52v25h-102Z" fill="'+c[1]+'" stroke="#4c3125" stroke-width="4"/><path d="M-48-139q46 11 96-6M-45-122q40 10 89-9" fill="none" stroke="#faf2d3" stroke-width="4"/>';
 return `<svg x="${-actor.height*.28}" y="${-actor.height}" width="${actor.height*.56}" height="${actor.height}" viewBox="-115 -200 230 390" overflow="visible"><g class="fallback-body"><path d="M-40 58L-44 151H-9L-4 69 9 151H45L41 56Z" fill="#524b53" stroke="#302b29" stroke-width="6"/><path d="M-56-19Q0-32 56-19L74 100H-69Z" fill="${c[2]}" stroke="#402f29" stroke-width="6"/><path d="M-52-9l-27 81 20 8 28-56M53-9l27 81-20 8-28-56" fill="${c[0]}" stroke="#493126" stroke-width="6"/><circle cy="-102" r="48" fill="${c[0]}" stroke="#493126" stroke-width="5"/>${turban}<circle cx="-17" cy="-106" r="4" fill="#282321"/><circle cx="18" cy="-106" r="4" fill="#282321"/><path d="M-12-84Q3-72 16-86" stroke="#733725" fill="none" stroke-width="3"/>${actor.id!=='mehar'?'<path d="M-24-69Q0-52 24-69L14-50H-12Z" fill="#5d4537"/>':''}</g></svg>`;
}
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const storyPoses={
 lp001:'beckon',lp002:'wonder',lp003:'point',lp004:'point',lp006:'celebrate',
 lp007:'wonder',lp008:'celebrate',lp009:'point',lp013:'point',lp014:'alarm',
 lp016:'alarm',lp017:'alarm',lp018:'alarm',lp019:'reflect',lp020:'reflect',
 lp021:'offer',lp022:'offer',lp023:'reflect',lp024:'wonder',lp025:'beckon',
 lp026:'offer',lp027:'reflect',lp029:'point',lp030:'offer',lp031:'reflect',
 lp032:'point',lp033:'offer',lp034:'celebrate',lp035:'wonder',lp036:'offer',
 lp037:'wonder',lp038:'alarm'
};
let dialoguePose='idle', dialogueStart=0;
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
 const gesture=speaking&&!reducedMotion.matches&&elapsed>1450&&elapsed%2400>1450?'idle':reaction;
 const walkTime=now-(actor.walkStart??-Infinity);
 const walk=walkTime>=0&&walkTime<760;
 const pose=walk?'walk'+Math.floor(walkTime/760*12):gesture;
 art.classList.toggle('alarm',reaction==='alarm');
 art.classList.toggle('celebrate',reaction==='celebrate');
 const frame=slot?.frames[pose]??slot?.frames.idle;
 if(!slot){
   if(!art.firstChild)art.innerHTML=fallback(actor);
   return;
 }
 if(!art._sprite){
   art.innerHTML=`<svg x="${-actor.height*.30}" y="${-actor.height}" width="${actor.height*.60}" height="${actor.height}" overflow="visible">${slot.base}</svg>`;
   art._sprite=art.firstElementChild;
   art._layers=Object.fromEntries([...art.querySelectorAll('[data-scene-layer]')].map(e=>[e.dataset.sceneLayer,e]));
   art._parts={};
 }
 const face=slot.frames[mouth];
 const key=[pose,mouth,blink].join(':');
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
 if(now-last>55){last=now;for(const actor of actors)renderActor(actor,now)}
 requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
window.addEventListener('message',e=>{if(e.source!==$('rigBridge').contentWindow||e.origin!==location.origin)return;
 if(e.data?.type==='anitoons-delivery-cast'&&e.data.version===2){rig=e.data.bank||{};for(const actor of actors){actor.art._sprite=null;actor.frame='';renderActor(actor)}}
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
 arrangeCast('intro');cart(622,320,.55);decoratePile(3,430,558);setLabel('What is Chacha Baldev so worried about?');
 await speak('intro');button('Follow Baldev to the fields →',()=>harvest());
}
async function harvest(){
 setPhase('harvest');scene('field',2,'HARVEST FRENZY');sound.setMood('field');harvested=0;arrangeCast('harvest');
 await speak('fieldIntro');setLabel('Swipe or tap each wheat patch five times','0 / 3 bundles','Swipe on the wheat to collect three bundles');
 for(let i=0;i<3;i++){
   const x=170+i*305,y=350;const holder=n('g',{'class':'wheat-target tap-target','data-patch':i,role:'button',tabindex:0,'aria-label':'Cut wheat patch '+(i+1)});
   const picture=img(asset.patch,x,y,260,208);picture.style.pointerEvents='all';holder.append(picture);holder.dataset.cuts='0';
   const cut=()=>{
     if(stageBusy||holder.dataset.done)return;
     const count=Number(holder.dataset.cuts)+1;holder.dataset.cuts=String(count);sound.cut();
     picture.setAttribute('transform',`translate(0 ${count%2?4:-3}) rotate(${count%2?-1.2:1.2} ${x+130} ${y+170})`);
     banner('Wheat cut! '+count+' / 5',600);
     if(count>=5){
       holder.dataset.done='1';harvested++;picture.setAttribute('opacity','.18');
       holder.append(img(asset.bundle,x+74,y+7,105,177));sound.ping();setLabel('Gather three wheat bundles',harvested+' / 3','Great! Keep harvesting.');
       if(harvested===3){stageBusy=true;setTimeout(finishHarvest,700)}
     }
   };
   holder.addEventListener('pointerdown',e=>{holder._start={x:e.clientX,y:e.clientY};holder.setPointerCapture(e.pointerId)});
   holder.addEventListener('pointerup',e=>{if(!holder._start)return;holder._start=null;cut();const p=getXY(e);const distance=Math.abs(p.x-(x+130));if(distance>60&&Number(holder.dataset.cuts)<5)cut();});
   holder.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();cut()}});
   props.appendChild(holder);
 }
}
async function finishHarvest(){
 if(window.lpPhase!=='harvest')return;
 sound.cheer();banner('3 bundles → 3 sacks!');props.replaceChildren();arrangeCast('load');
 setLabel('Three bundles became wheat sacks!','3 / 3','Time to load the cart');
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
const shareTargets=[['home','HOME',3,'For Baldev\u2019s family','#8ccfb3'],['seeds','SEEDS',2,'For the next crop','#f6ca81'],['sharing','SHARING & LANGAR',3,'For those in need','#b7b6ef']];
function showSharing(){
 props.replaceChildren();
 let stageTitle=n('g',{'id':'shareTargets'}),selected=selectedSack;
 for(let j=0;j<shareTargets.length;j++){
   const [key,title,cap,sub,color]=shareTargets[j],x=95+j*365,y=500;
   const zone=n('g',{role:'button',tabindex:0,'aria-label':title+' '+shareCounts[key]+' of '+cap,'data-target':key});
   zone.append(n('rect',{x,y,width:336,height:130,rx:21,fill:color,stroke:'#44676c','stroke-dasharray':'9 6','stroke-width':4,'class':'goal-zone'}));
   zone.append(labelText(title,x+168,y+43,title.length>12?20:27,'#263941'));
   zone.append(labelText(shareCounts[key]+' / '+cap,x+168,y+81,30,'#385c46'));
   zone.append(labelText(sub,x+168,y+112,16,'#455956'));
   zone.addEventListener('pointerup',()=>putSack(key));
   zone.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();putSack(key)}});
   stageTitle.append(zone);
 }
 props.append(stageTitle);
 const remaining=8-(shareCounts.home+shareCounts.seeds+shareCounts.sharing);
 const row=n('g',{id:'sharingSacks'});
 for(let j=0;j<remaining;j++){
   const x=215+j*106,y=346;
   const item=img(asset.sack,x,y,84,110,'sack-draggable tap-target','Choose sack '+(j+1));
   item.style.pointerEvents='all';item.setAttribute('tabindex','0');
   if(selected===j){item.setAttribute('stroke','#ffe884');item.setAttribute('filter','drop-shadow(0px 0px 12px gold)')}
   item.addEventListener('pointerdown',e=>{if(stageBusy)return;item.setPointerCapture(e.pointerId);item._drag={x:e.clientX,y:e.clientY};e.preventDefault()});
   item.addEventListener('pointermove',e=>{if(!item._drag)return;const p=getXY(e);item.setAttribute('transform',`translate(${p.x-x-42} ${p.y-y-55})`)});
   item.addEventListener('pointerup',e=>{if(!item._drag)return;item._drag=null;item.removeAttribute('transform');const p=getXY(e);const target=shareTargets.find(([,_,__,___],idx)=>p.y>500&&p.x>95+idx*365&&p.x<431+idx*365);selectedSack=j;if(target)putSack(target[0]);else{sound.ping();showSharing()}e.preventDefault()});
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
 setPhase('finale');scene('village',5,'A FULL HEART');sound.setMood('village');loaded=0;arrangeCast('finale');cart(570,320,.55);$('cartHost')?.classList.add('cart-crash');setLabel('You helped Baldev discover Santokh');
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
$('start').onclick=()=>begin(Boolean($('start').dataset.resume));
$('restart').onclick=()=>begin(false);
$('playAgain').onclick=()=>{clipStop();begin(false)};
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
   const [d,c]=await Promise.all([fetch('dialogue.json?v=1'),fetch(imageOf('assets/cart/bullock-cart.svg'))]);
   if(!d.ok)throw Error('Mission dialogue not available');
   story=await d.json();cartSource=c.ok?await c.text():null;background('village');
   const existing=localStorage.getItem(STORAGE_KEY);if(existing){$('start').textContent='▶ Resume adventure';$('start').dataset.resume='true';$('restart').hidden=false}
   $('start').disabled=false;
 }catch(err){$('start').textContent='Unable to load mission';$('start').disabled=true;banner(String(err),15000)}
})();
})();
