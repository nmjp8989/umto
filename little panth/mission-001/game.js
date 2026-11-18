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
const STORAGE_KEY='little-panth-lp001-v1';
let story,cartSource,rig={},actorNodes=new Map(),actors=[],currentVoice=null,voiceResolver=null,voiceEnabled=true,musicEnabled=true,
    epoch=0,activeSpeaker='',stageBusy=false,loaded=0,harvested=0,selectedSack=null,shareCounts={home:0,seeds:0,sharing:0},quizIndex=0,
    eighthAttempts=0,locationId='village',act=1,runStarted=false,firstLoad=true;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const getXY=e=>{const pt=stage.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;return pt.matrixTransform(stage.getScreenCTM().inverse())};
function setLabel(objective,counter='',instruction=''){
 $('objective').textContent=objective;$('counter').textContent=counter;$('instruction').textContent=instruction||objective;
}
function banner(text,ms=1500){const b=$('activity');b.textContent=text;b.hidden=false;clearTimeout(b._t);b._t=setTimeout(()=>b.hidden=true,ms)}
function background(id){locationId=id;$('background').setAttribute('href',imageOf(backgrounds[id]));$('location').textContent={village:'Village courtyard',field:'Golden wheat field',storage:'Baldev\u2019s storage yard',gurdwara:'Gurudwara Sahib'}[id];}
function clearStage(){props.replaceChildren();fx.replaceChildren();$('verse').hidden=true;$('speech').hidden=true;$('sceneAction').hidden=true;$('quiz').hidden=true;$('finish').hidden=true;actorNodes.clear();cast.replaceChildren();activeSpeaker='';selectedSack=null;stageBusy=false}
function scene(id,number,title){epoch++;clearStage();act=number;$('actBadge').textContent='ACT '+number+' / 5';$('chapter').textContent=title;background(id);save();}
function save(){if(!runStarted)return;try{localStorage.setItem(STORAGE_KEY,JSON.stringify({phase:window.lpPhase||'intro',loaded,harvested,shareCounts,quizIndex,ts:Date.now()}))}catch{}}
function setPhase(id){window.lpPhase=id;save()}
function button(text,fn){const el=$('sceneAction');el.textContent=text;el.hidden=false;el.onclick=()=>{el.hidden=true;sound.ping();fn()}}
function clipStop(){if(currentVoice){currentVoice.onended=null;currentVoice.onerror=null;currentVoice.pause();currentVoice=null;}if('speechSynthesis'in window)try{speechSynthesis.cancel()}catch{};if(voiceResolver){const f=voiceResolver;voiceResolver=null;f()}}
async function oneLine(id,token) {
 if(token!==epoch)return;
 const line=story.lines[id];if(!line)return;
 activeSpeaker=line.speaker;updateTalking();
 $('speech').hidden=false;
 $('speaker').textContent=story.speakerDisplay[line.speaker]||line.speaker;
 $('spoken').textContent=line.pa;
 $('roman').textContent=line.roman;
 $('english').textContent=line.en;
 $('lineNo').textContent='PUNJABI • ENGLISH';
 $('soundHint').textContent=line.sacred?'🙏 Gurbani — review recorded pronunciation before final release':voiceEnabled?'🔊 Punjabi narration':'🔇 Narration muted';
 const lastFocus=document.activeElement;
 await new Promise(resolve=>{
   let settled=false;let utterance=null;
   const done=()=>{if(settled)return;settled=true;voiceResolver=null;if(currentVoice){currentVoice.onended=null;currentVoice.onerror=null;currentVoice.pause();currentVoice=null}if(utterance&&'speechSynthesis'in window)try{speechSynthesis.cancel()}catch{};resolve()};
   voiceResolver=done;$('nextLine').onclick=done;
   if(!voiceEnabled||line.sacred){return}
   const audio=new Audio('audio/'+id+'.mp3');currentVoice=audio;audio.volume=.94;
   audio.onended=()=>setTimeout(done,250);
   audio.onerror=()=>{
     currentVoice=null;
     // On a first deploy or offline run, keep text interactive instead of failing.
     if('speechSynthesis'in window && speechSynthesis.getVoices().some(v=>/^pa(-|_)/i.test(v.lang))) {
       utterance=new SpeechSynthesisUtterance(line.pa);
       utterance.lang='pa-IN';utterance.rate=.94;
       utterance.onend=()=>setTimeout(done,200);utterance.onerror=()=>{};
       speechSynthesis.speak(utterance);
     }else $('soundHint').textContent='Audio not yet generated — tap Continue';
   };
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
 const layouts={
 intro:[['baldev',345,665,420],['mehar',960,675,300]],
 harvest:[['baldev',160,657,320],['mehar',1130,666,260]],
 load:[['baldev',180,656,310],['mehar',1115,666,260]],
 storage:[['baldev',145,647,340],['mehar',1153,660,265]],
 requests:[['baldev',235,660,360],['mehar',510,660,275],['farmer',975,656,335],['baba',1140,660,325]],
 lesson:[['baldev',230,665,350],['mehar',450,665,250],['baba',1030,665,360]],
 share:[['baldev',120,650,300],['mehar',1120,650,250]],
 finale:[['baldev',300,670,365],['mehar',985,670,290]],
 };
 actors=(layouts[type]||layouts.intro).map(([id,x,y,height])=>({id,x,y,height,frame:'',action:'idle',node:null}));
 renderCast();
}
function fallback(actor){
 const size=actor.id==='mehar'?0.76:1;
 const c={baldev:['#bc7641','#df873d','#f1c165'],mehar:['#c17f49','#e9b450','#fd6f69'],baba:['#c19565','#d3c4a3','#7bb2ad'],farmer:['#b88256','#ad7c51','#9cb87d']}[actor.id];
 const turban=actor.id==='mehar'?'<path d="M-44-122q35-50 90-4v24h-90Z" fill="#e28d49" stroke="#573323" stroke-width="4"/>':'<path d="M-51-129q0-43 51-52q51 11 51 52v25h-102Z" fill="'+c[1]+'" stroke="#4c3125" stroke-width="4"/><path d="M-48-139q46 11 96-6M-45-122q40 10 89-9" fill="none" stroke="#faf2d3" stroke-width="4"/>';
 return `<svg x="${-actor.height*.28}" y="${-actor.height}" width="${actor.height*.56}" height="${actor.height}" viewBox="-115 -200 230 390" overflow="visible"><g class="fallback-body"><path d="M-40 58L-44 151H-9L-4 69 9 151H45L41 56Z" fill="#524b53" stroke="#302b29" stroke-width="6"/><path d="M-56-19Q0-32 56-19L74 100H-69Z" fill="${c[2]}" stroke="#402f29" stroke-width="6"/><path d="M-52-9l-27 81 20 8 28-56M53-9l27 81-20 8-28-56" fill="${c[0]}" stroke="#493126" stroke-width="6"/><circle cy="-102" r="48" fill="${c[0]}" stroke="#493126" stroke-width="5"/>${turban}<circle cx="-17" cy="-106" r="4" fill="#282321"/><circle cx="18" cy="-106" r="4" fill="#282321"/><path d="M-12-84Q3-72 16-86" stroke="#733725" fill="none" stroke-width="3"/>${actor.id!=='mehar'?'<path d="M-24-69Q0-52 24-69L14-50H-12Z" fill="#5d4537"/>':''}</g></svg>`;
}
function renderCast(){
 for(const actor of actors){let node=n('g',{'class':'actor',id:'actor-'+actor.id,transform:`translate(${actor.x} ${actor.y})`});actor.node=node;actorNodes.set(actor.id,node);cast.appendChild(node);renderActor(actor,true)}
}
function renderActor(actor,force=false){
 const node=actor.node;if(!node)return;
 const slot=rig[actor.id]?.right;
 const frame=activeSpeaker===actor.id?'talk'+(['A','EE','O'][Math.floor(performance.now()/210)%3]):actor.action==='walk'?'walk'+([0,3,6,9][Math.floor(performance.now()/180)%4]):actor.action==='gesture'?'gesture':actor.action==='panic'?'blink':actor.action==='happy'?'greet0':Math.floor(performance.now()/1000)%13===0?'blink':'idle';
 node.classList.toggle('talking',activeSpeaker===actor.id);node.classList.toggle('panicking',actor.action==='panic');node.classList.toggle('happy',actor.action==='happy');node.classList.toggle('walk',actor.action==='walk');
 if(!slot){if(force||!node.firstChild)node.innerHTML=fallback(actor);return}
 const pose=slot.frames[frame]||slot.frames.idle;
 if(force||!node._sprite){node.innerHTML=`<svg x="${-actor.height*.265}" y="${-actor.height}" width="${actor.height*.53}" height="${actor.height}" overflow="visible">${slot.base}</svg>`;node._sprite=node.firstElementChild;node._layers=Object.fromEntries([...node.querySelectorAll('[data-scene-layer]')].map(e=>[e.dataset.sceneLayer,e]));actor.frame='';node._parts={}}
 if(pose&&frame!==actor.frame){actor.frame=frame;for(const [key,markup]of Object.entries(pose.parts||{})){if(node._layers[key]&&node._parts[key]!==markup){node._layers[key].innerHTML=markup;node._parts[key]=markup;}}
   for(const name of slot.headLayers||[])node._layers[name]?.setAttribute('transform',pose.head||'');
 }
}
function updateTalking(){for(const actor of actors)renderActor(actor,true)}
let last=0;function animate(now){if(now-last>180){last=now;for(const actor of actors)renderActor(actor)}requestAnimationFrame(animate)}requestAnimationFrame(animate);
window.addEventListener('message',e=>{if(e.source!==$('rigBridge').contentWindow||e.origin!==location.origin)return;
 if(e.data?.type==='anitoons-delivery-cast'&&e.data.version===2){rig=e.data.bank||{};for(const actor of actors){actor.node._sprite=null;renderActor(actor,true)}}
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
 arrangeCast('intro');setLabel('What is Chacha Baldev so worried about?');
 await speak('intro');button('Follow Baldev to the fields →',()=>harvest());
}
async function harvest(){
 setPhase('harvest');scene('field',2,'HARVEST FRENZY');sound.setMood('field');harvested=0;arrangeCast('harvest');
 await speak('fieldIntro');setLabel('Swipe or tap each wheat patch five times','0 / 3 bundles','Swipe on the wheat to collect three bundles');
 for(let i=0;i<3;i++){
   const x=170+i*305,y=350;const holder=n('g',{'class':'wheat-target tap-target','data-patch':i,role:'button',tabindex:0,'aria-label':'Cut wheat patch '+(i+1)});
   const picture=img(asset.patch,x,y,260,208);holder.append(picture);holder.dataset.cuts='0';
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
 looseSacks(3,async()=>{
   if(stageBusy)return;loaded++;sound.load();updateCart();
   setLabel('Load three sacks into the cart',loaded+' / 3');looseSacks(3-loaded,()=>{}); // replaced with active handlers below
   if(loaded>=3){stageBusy=true;sound.cheer();await speak('loadThree');button('Head to the storage courtyard →',()=>storage())}
   else drawFieldSacks();
 });
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
   banner('CRAAACK! THE WHEEL BROKE!',2500);
   await wait(1250);await speak('crash');sound.setMood('reflection');actors.find(a=>a.id==='baldev').action='idle';
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
 (async()=>{await speak('shareIntro');showSharing()})();
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
 if(Object.values(shareCounts).reduce((a,b)=>a+b,0)===8){stageBusy=true;sound.cheer();setTimeout(async()=>{await speak('shareDone');quiz()},900)}
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
 setPhase('finale');scene('village',5,'A FULL HEART');sound.setMood('village');arrangeCast('finale');setLabel('You helped Baldev discover Santokh');
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
$('voiceToggle').onclick=()=>{voiceEnabled=!voiceEnabled;$('voiceToggle').textContent=voiceEnabled?'◉ Voice on':'◌ Voice off';$('voiceToggle').setAttribute('aria-pressed',String(voiceEnabled));if(!voiceEnabled&&currentVoice)currentVoice.pause()};
$('helpBtn').onclick=()=>{$('help').hidden=false};
$('closeHelp').onclick=()=>{$('help').hidden=true};
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){$('help').hidden=true;return}
 if((e.key==='Enter'||e.key===' ')&&!$('speech').hidden&&!e.target.closest('button')){e.preventDefault();$('nextLine').click()}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){currentVoice?.pause();if(sound.ctx)sound.ctx.suspend()}else{if(sound.ctx&&musicEnabled)sound.ctx.resume()}});
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
