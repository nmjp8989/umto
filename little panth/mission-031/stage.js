(() => {
'use strict';
const {open,Character}=window.UmtoNativeCharacterPlayer;
let studio;
const clamp = v => Math.max(0, Math.min(1, v));
const phase = (v,a,b) => clamp((v-a)/Math.max(1,b-a));
const ease = t => t*t*(3-2*t);
const mix = (a,b,t) => a+(b-a)*t;
const tx = (n,v) => n.setAttribute('transform',v);
const op = (n,v) => n.setAttribute('opacity',String(v));
const line = (scene,id) => scene.lines.find(l=>l.id===id);
const point=(x,y)=>({x,y});
const floor=642, bank=482, rim=410, foxBottom=755, goatBottom=535;
const actor=(x,y,facing)=>({x,y,facing,walk:0,head:0,angle:0,reach:0,visible:true,worry:0});
function wordAt(scene,id,word) {
 const l=line(scene,id),i=l.reading.words.findIndex(w=>w.replace(/\p{P}/gu,'')===word);
 return l.start+(l.reading.timings[i]?.[0]??l.duration*.5);
}
function cuesFor(s){
 switch(s.id){
 case 'the-old-well':{
  const look=wordAt(s,'fox-falls','ਝਾਕਣ'),fall=wordAt(s,'fox-falls','ਤਿਲਕ')-180;
  return {walk:line(s,'fox-falls').start+160,stop:look-850,step:look-630,look,fall,land:fall+760};
 }
 case 'no-way-out':return {jump:wordAt(s,'trapped','ਕੋਸ਼ਿਸ਼')-300};
 case 'an-invitation':return {arrive:line(s,'goat-arrives').start+100,stop:line(s,'goat-arrives').end-600,step:line(s,'goat-arrives').end-580};
 case 'into-the-well':{
  const jump=wordAt(s,'goat-jumps','ਛਾਲ')-180;
  return {jump,land:jump+820,drink:Math.max(jump+1040,wordAt(s,'goat-jumps','ਪੀਤਾ')-230)};
 }
 case 'a-clever-escape':{
  const l=line(s,'fox-escapes'),climb=wordAt(s,'fox-escapes','ਪਿੱਠ')-200;
  const escape=Math.max(climb+950,wordAt(s,'fox-escapes','ਛਾਲ')+200);
  return {brace:l.start+130,climb,perch:climb+680,escape,rim:escape+780,bank:Math.min(s.duration-60,escape+1350)};
 }
 case 'the-goat-calls':{
  const leave=line(s,'help-arrives').start+100,arrive=wordAt(s,'help-arrives','ਕਿਸਾਨ')-460;
  const lower=wordAt(s,'help-arrives','ਫੱਟਾ')-340;
  return {leave,arrive,farmerAt:Math.min(arrive+1850,lower-350),lower,set:Math.min(s.duration-150,lower+830)};
 }
 case 'think-before-you-leap':return {climb:line(s,'goat-climbs').start+120,top:line(s,'goat-climbs').end-240};
 }
 return {};
}
function eventsFor(s){
 const c=cuesFor(s);let events=[];
 switch(s.id){
 case 'the-old-well':events=[{ms:c.walk+440,sound:'step'},{ms:c.walk+880,sound:'step'},{ms:c.step+590,sound:'step'},{ms:c.land,sound:'plop'}];break;
 case 'no-way-out':events=[{ms:c.jump,sound:'spring'},{ms:c.jump+690,sound:'plop'}];break;
 case 'an-invitation':events=[{ms:c.arrive+350,sound:'step'},{ms:c.arrive+780,sound:'step'},{ms:c.step+550,sound:'step'}];break;
 case 'into-the-well':events=[{ms:c.jump,sound:'spring'},{ms:c.land,sound:'plop'},{ms:c.drink+330,sound:'sip'}];break;
 case 'a-clever-escape':events=[{ms:c.brace+450,sound:'step'},{ms:c.climb,sound:'spring'},{ms:c.escape,sound:'spring'},{ms:c.rim,sound:'step'},{ms:c.bank,sound:'step'}];break;
 case 'the-goat-calls':events=[{ms:c.leave+400,sound:'step'},{ms:c.leave+850,sound:'step'},{ms:c.arrive+380,sound:'step'},{ms:c.arrive+850,sound:'step'},{ms:c.set,sound:'twig'}];break;
 case 'think-before-you-leap':events=[{ms:c.climb+500,sound:'step'},{ms:c.climb+1000,sound:'step'},{ms:c.top,sound:'step'},{ms:c.top+500,sound:'chirp'}];break;
 }
 return events.filter(e=>e.ms>=0&&e.ms<=s.duration);
}
function travel(a,ms,start,end,x,y,X,Y,still){
 const t=phase(ms,start,end),p=still?Math.round(t):ease(t);
 a.x=mix(x,X,p);a.y=mix(y,Y,p);
 const distance=Math.hypot(X-x,Y-y)*p;
 a.walk=still?0:Math.sin(Math.PI*t)*Math.sin(distance/13)*28;
 return t;
}
function jump(a,ms,start,end,x,y,X,Y,height,still){
 const t=phase(ms,start,end),p=still?Math.round(t):t;
 a.x=mix(x,X,p);a.y=mix(y,Y,p)-height*4*p*(1-p);
 a.reach=still?0:Math.sin(Math.PI*t);return t;
}
function poseAt(s,c,ms,speech,still){
 const move=t=>still?Math.round(t):ease(t);
 const motion=(a,b)=>move(phase(ms,a,b));
 let fox=actor(foxBottom,floor,-1),goat=actor(314,bank,1);
 goat.visible=false;
 let cross=true,ramp=0,rampAngle=0,rampOffset=0,splash=0,splashX=foxBottom;
 const farmer={x:1260,y:bank,visible:0,lean:0,grips:[],expression:'neutral',gazeY:20};
 switch(s.id){
 case 'the-old-well':
  cross=ms>=c.fall;fox=actor(165,bank,1);
  travel(fox,ms,c.walk,c.stop,165,bank,308,bank,still);
  if(ms>=c.step){jump(fox,ms,c.step,c.look+170,308,bank,428,rim,20,still);}
  fox.head=23*motion(c.look-110,c.look+360);
  if(ms>=c.fall){jump(fox,ms,c.fall,c.land,428,rim,foxBottom,floor,18,still);fox.head=0;}
  if(ms>=c.land){fox.facing=-1;fox.worry=1;}
  splash=ms<c.land?0:1-phase(ms,c.land,c.land+1050);
  break;
 case 'no-way-out':
  fox.head=-21;fox.worry=.7;
  jump(fox,ms,c.jump,c.jump+690,foxBottom,floor,foxBottom,floor,78,still);
  splash=ms<c.jump+690?0:1-phase(ms,c.jump+690,c.jump+1240);
  break;
 case 'an-invitation':
  cross=speech.speaker==='fox';goat.visible=true;
  travel(goat,ms,c.arrive,c.stop,155,bank,300,bank,still);
  if(ms>=c.step)jump(goat,ms,c.step,c.step+520,300,bank,402,rim,22,still);
  goat.head=27*motion(c.step+340,c.step+770);
  fox.visible=cross;fox.head=-23;
  break;
 case 'into-the-well':
  cross=ms>=c.jump;fox.visible=cross;goat.visible=true;goat.x=402;goat.y=rim;goat.head=27;
  if(ms>=c.jump){jump(goat,ms,c.jump,c.land,402,rim,goatBottom,floor,22,still);goat.head=0;}
  if(ms>=c.drink)goat.head=61*motion(c.drink,c.drink+450)*(1-motion(c.drink+1000,c.drink+1500));
  if(speech.speaker==='goat'){goat.head=-14;goat.worry=1;fox.head=-6;}
  splashX=goatBottom;splash=ms<c.land?0:1-phase(ms,c.land,c.land+980);
  break;
 case 'a-clever-escape':{
  goat=actor(goatBottom,floor,1);fox.head=-7;
  const brace=motion(c.brace,c.brace+620),release=motion(c.rim,c.rim+400);
  if(brace>0){goat.facing=-1;goat.x=mix(goatBottom,510,brace)*(1-release)+goatBottom*release;goat.y=floor-25*brace*(1-release);goat.angle=38*brace*(1-release);goat.head=-6*brace*(1-release);}
  if(ms>=c.climb)jump(fox,ms,c.climb,c.perch,foxBottom,floor,610,549,53,still);
  if(ms>=c.escape)jump(fox,ms,c.escape,c.rim,610,549,399,rim,70,still);
  if(ms>=c.rim)jump(fox,ms,c.rim,c.bank,399,rim,287,bank,15,still);
  if(ms>=c.rim){cross=false;goat.visible=false;}
  if(ms>=c.bank)fox.facing=1;
  break;
 }
 case 'the-goat-calls':
  goat=actor(goatBottom,floor,-1);goat.head=-24;goat.worry=.8;
  fox=actor(287,bank,1);
  cross=speech.speaker!=='fox'&&ms<c.leave || ms>=c.lower-450;
  if(ms>=c.leave){fox.facing=-1;travel(fox,ms,c.leave,c.leave+1620,287,bank,-80,bank,still);if(ms>=c.leave+1620)fox.visible=false;}
  if(!cross)goat.visible=false;
  if(ms>=c.arrive){
   farmer.visible=1;
   const t=phase(ms,c.arrive,c.farmerAt);
   farmer.x=mix(1260,1062,move(t));if(t>0&&t<1&&!still)farmer.walk=(ms-c.arrive)/1000;
   farmer.lean=-6*motion(c.farmerAt,c.lower);
   farmer.expression='neutral';
   const set=motion(c.lower,c.set);
   ramp=1;rampAngle=41*(1-set);rampOffset=(farmer.x-1062)*.92;
   // The plank's top is carried beside the farmer, then remains on the rim while it rotates into the shaft.
   farmer.grips[0]={target:point(934+rampOffset,417),weight:1,hand:'fist'};
   farmer.grips[1]={target:point(977+(farmer.x-1062)*.8,401),weight:.82*(1-set),hand:'fist'};
   if(set>=1){farmer.expression='smile';farmer.lean=0;goat.facing=1;goat.head=-12;}
  }
  break;
 case 'think-before-you-leap':{
  ramp=1;fox.visible=false;goat=actor(goatBottom,floor,1);
  farmer.x=1093;farmer.visible=1;farmer.expression='smile';
  const base=c.climb+Math.min(650,(c.top-c.climb)*.16);
  const top=Math.max(base+250,c.top-650);
  if(ms<base)travel(goat,ms,c.climb,base,goatBottom,floor,657,648,still);
  else if(ms<top){const t=travel(goat,ms,base,top,657,648,927,rim,still);goat.angle=-39*move(phase(t,0,.10))*(1-move(phase(t,.90,1)));}
  else if(ms<c.top+140)jump(goat,ms,top,c.top+140,927,rim,979,bank,15,still);
  else {travel(goat,ms,c.top+140,c.top+550,979,bank,960,bank,still);goat.facing=-1;}
  if(ms>=top){cross=false;ramp=0;}
  if(speech.speaker==='goat'){goat.head=0;goat.worry=0;}
  farmer.grips[0]={target:point(1030,365),weight:.45*motion(top,top+700),hand:'relaxed'};
  break;
 }
 }
 return {fox,goat,cross,ramp,rampAngle,rampOffset,splash,splashX,farmer};
}
class WellStage{
 constructor(svg){
  this.svg=svg;this.camera=new window.UmtoCamera.DeliveryCamera(svg);
  this.reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  this.p=Object.fromEntries([...svg.querySelectorAll('[id]')].map(n=>[n.id,n]));
  this.goatLegs=[...this.p.goat.querySelectorAll('[data-leg]')];
  this.goatHead=this.p.goat.querySelector('[data-head]');this.goatTail=this.p.goat.querySelector('[data-tail]');
  this.farmer=new Character(studio,svg,this.p.farmer,this.p['farmer-props'],{preset:'elder-baldev',view:'left',height:245,serial:631});
 }
 select(s){this.scene=s;this.c=cuesFor(s);this.shot='';}
 cameraFor(s,ms,speech,a,still){
  const c=this.c,f=a.fox,g=a.goat;
  const shot=(preset,x,y,width,motion='static')=>({preset,focus:point(x,y),width,motion,parallax:motion==='tracking'});
  switch(s.id){
  case 'the-old-well':
   if(ms<c.walk+500)return shot('establishing',640,360,1280);
   if(ms<c.step)return shot('full',Math.round(mix(530,595,phase(f.x,165,308))),407,1100,still?'static':'tracking');
   if(ms<c.fall)return shot('medium',500,347,790);
   return shot('full',660,475,1050);
  case 'no-way-out':
   return shot(ms<c.jump-350?'medium':'detail',665,530,ms<c.jump-350?870:790);
  case 'an-invitation':
   if(speech.speaker==='goat')return shot('medium-close',477,333,690);
   if(speech.speaker==='fox')return shot('medium',710,530,730);
   return shot('full',545,395,1080);
  case 'into-the-well':
   if(ms<c.jump)return shot('medium',495,350,820);
   if(ms<c.land+430)return shot('full',660,470,1030);
   if(ms>c.drink&&ms<c.drink+1450)return shot('detail',542,568,625);
   return shot('two-shot',659,540,825);
  case 'a-clever-escape':
   if(ms<c.climb)return shot('two-shot',660,533,850);
   if(ms<c.escape)return shot('medium',615,550,815);
   if(ms<c.rim)return shot('full',600,465,1000);
   return shot('medium',390,375,780);
  case 'the-goat-calls':
   if(speech.speaker==='goat')return shot('medium',575,537,755);
   if(speech.speaker==='fox')return shot('medium-close',345,385,690);
   if(ms<c.arrive)return shot('wide',640,360,1280);
   if(ms<c.lower)return shot('full',Math.round(mix(810,860,phase(a.farmer.x,1260,1062))),395,1060,still?'static':'tracking');
   return shot('full',780,451,1120);
  case 'think-before-you-leap':
   if(speech.speaker==='goat')return shot('two-shot',1012,368,690);
   if(speech.id==='moral')return shot('wide',640,360,1280);
   return shot('full',785,450,1120);
  }
  return shot('wide',640,360,1280);
 }
 draw(ms,speech,word){
  const still=this.reduced.matches,p=this.p,s=this.scene,a=poseAt(s,this.c,ms,speech,still),f=a.fox,g=a.goat;
  const timing=speech.reading.timings[word];
  const opening=timing?.length===2 ? .24+.75*Math.sin(Math.PI*phase(ms-speech.start,timing[0],timing[1])):0;
  const ft=f.visible&&speech.speaker==='fox'&&word>=0,gt=g.visible&&speech.speaker==='goat'&&word>=0;
  const shot=this.cameraFor(s,ms,speech,a,still),key=[shot.preset,shot.focus.x,shot.focus.y,shot.width,shot.motion].join('/');
  if(key!==this.shot){this.camera.cue({...shot,cut:true});this.shot=key;}
  op(p['exterior-back'],a.cross?0:1);op(p['exterior-front'],a.cross?0:1);
  op(p.cutaway,a.cross?1:0);op(p['water-front'],a.cross?1:0);op(p['foreground-garden'],a.cross?0:1);
  op(p.fox,f.visible?1:0);op(p['fox-shadow'],f.visible&&f.y>=bank-8&&f.y<bank+9?.58:0);
  tx(p.fox,'translate('+f.x+' '+(f.y-(still?0:Math.abs(f.walk)*.13))+') scale('+(f.facing*.79)+' .79)');
  p['fox-shadow'].setAttribute('cx',f.x);p['fox-shadow'].setAttribute('cy',f.y+4);
  for(const [id,x,y,sign,reach] of [['fox-rear-far',-77,-84,-1,19],['fox-rear-near',-76,-88,1,-38],['fox-front-far',29,-104,1,-62],['fox-front-near',52,-101,-1,-110]]){
   tx(p[id],'rotate('+(f.walk*sign+f.reach*reach)+' '+x+' '+y+')');
  }
  tx(p['fox-tail'],'rotate('+((still?0:Math.sin(ms/370)*3.5)+f.walk*.2+f.reach*22)+' -83 -89)');
  tx(p['fox-head'],'translate(42 -124) rotate('+(f.head-f.reach*7+(ft&&!still?Math.sin(ms/300)*2:0))+')');
  tx(p['fox-ears'],'rotate('+(-11*f.worry)+' -6 -44)');
  tx(p['fox-brow'],'rotate('+(17*f.worry)+' 39 -31)');
  tx(p['fox-pupil'],'translate(0 '+(f.head>10?2:f.head<0?-2:0)+')');
  tx(p['fox-jaw'],'rotate('+(ft?opening*16:0)+' 20 8)');
  tx(p['fox-mouth'],'translate(0 '+(ft?-6*opening:0)+') scale(1 '+(.25+opening*.92)+')');op(p['fox-mouth'],ft?1:0);
  const fb=!still&&(ms+420)%3770>3630;op(p['fox-eye'],fb?0:1);op(p['fox-lid'],fb?1:0);
  p.fox.dataset.speaking=String(ft);p.fox.dataset.location=f.y>500?'well':'bank';
  op(p.goat,g.visible?1:0);op(p['goat-shadow'],g.visible&&g.y>=bank-7&&g.y<bank+9?.55:0);
  p['goat-shadow'].setAttribute('cx',g.x);p['goat-shadow'].setAttribute('cy',g.y+3);
  tx(p.goat,'translate('+g.x+' '+(g.y-(still?0:Math.abs(g.walk)*.11))+') rotate('+g.angle+') scale('+(g.facing*1.35)+' 1.35)');
  const pins=[[-43,-44],[35,-44],[-32,-44],[50,-44]];
  this.goatLegs.forEach((n,i)=>{const [x,y]=pins[i];tx(n,'translate('+x+' '+y+') rotate('+(g.walk*(i===0||i===3?1:-1)-(g.reach||0)*18+(g.angle>0&&(i===1||i===3)?-g.angle*.57:0))+')');});
  tx(this.goatHead,'translate(26 -74) rotate('+(g.head+(gt&&!still?Math.sin(ms/340)*2:0))+')');
  tx(this.goatTail,'rotate('+(still?0:Math.sin(ms/340)*4)+' -67 -68)');
  p['goat-mouth'].setAttribute('ry',gt?String(1+opening*3.7):'1');op(p['goat-mouth'],gt?1:0);
  const gb=!still&&(ms+1520)%3970>3830;
  for(const id of ['goat-eye','goat-pupil','goat-glint'])op(p[id],gb?0:1);
  op(p['goat-lid'],gb?1:0);p.goat.dataset.speaking=String(gt);p.goat.dataset.location=g.y>500?'well':'bank';
  const showRamp=a.ramp>0;
  op(p['rescue-ramp'],showRamp?1:0);
  tx(p['rescue-ramp'],'translate('+a.rampOffset+' 0) translate(934 417) rotate('+a.rampAngle+') translate(-934 -417)');
  op(p['farmer-plane'],a.farmer.visible);op(p['farmer-shadow'],a.farmer.visible*.64);
  p['farmer-shadow'].setAttribute('cx',a.farmer.x);p['farmer-shadow'].setAttribute('cy',a.farmer.y+4);
  if(a.farmer.visible)this.farmer.paint(a.farmer,ms,null,still);
  const ripple=a.splash;op(p.ripples,a.cross?ripple*.85:0);op(p.splash,still||!a.cross?0:ripple);
  tx(p.splash,'translate('+a.splashX+' '+(642-(1-ripple)*29)+')');
  for(const [i,id] of ['splash-ring','splash-ring2'].entries()){
   p[id].setAttribute('cx',a.splashX);p[id].setAttribute('rx',20+i*12+(1-ripple)*62);p[id].setAttribute('ry',4+i*2+(1-ripple)*8);
  }
  tx(p['water-lines'],'translate('+(still?0:Math.sin(ms/900)*13)+' 0)');
  Object.assign(this.svg.dataset,{ramp:String(showRamp&&Math.abs(a.rampAngle)<.01),scene:s.id,view:a.cross?'cutaway':'exterior',farmer:String(a.farmer.visible>0)});
 }
}
async function prepare(){studio=await open(document.getElementById('well-studio'));}
window.LittlePanthStage={Stage:WellStage,eventsFor,prepare};
})();
