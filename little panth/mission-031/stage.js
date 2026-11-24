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
  if(ms>=c.climb)jump(fox,ms,c.climb,c.perch,foxBottom,floor,610,558,53,still);
  if(ms>=c.escape)jump(fox,ms,c.escape,c.rim,610,558,399,rim,70,still);
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
// The near foreleg, chest, back and near hind leg are one deforming closed path.
// No shoulder/hip disks or outlines cross the main silhouette.  The feet follow
// a bounded stride arc; cubic control points follow them rather than rotating
// separate rigid upper/lower limb pieces.
const round=n=>Math.round(n*100)/100;
const xy=(x,y)=>round(x)+' '+round(y);
function foot(x,walk,reach,front,far,goat,brace=0){
 const sign=front===far?1:-1;
 return {x:x+walk*sign*(goat?.59:1.02)+reach*(front?(goat?18:47):(goat?-11:-27))+brace*(front?17:0),
 y:-(Math.max(0,walk*sign)*.29+reach*(goat?13:25)+brace*(front?28:0))};
}
function limb(p,startX,startY,front,goat,far){
 const w=goat?7:11,x=p.x,y=p.y,k=front?startX-2:startX-8;
 return 'M'+xy(startX-w*1.6,startY)+' C'+xy(startX-w*2,startY+18)+' '+xy(k-w, y-35)+' '+xy(x-w*.7,y-13)+' Q'+xy(x-w,y-3)+' '+xy(x-w*.65,y)+' L'+xy(x+w,y)+' Q'+xy(x+w*1.5,y-4)+' '+xy(x+w*.65,y-11)+' C'+xy(x+w*.15,y-30)+' '+xy(startX+w*1.5,startY+18)+' '+xy(startX+w*1.45,startY)+' Z';
}
function boot(p,w,h){return 'M'+xy(p.x-w*1.7,p.y-h)+' Q'+xy(p.x,p.y-h*.52)+' '+xy(p.x+w*1.7,p.y-h)+' L'+xy(p.x+w*2,p.y+3)+' H'+round(p.x-w*2)+' Z';}
function bendHead(angle,px,py,x,y){const t=angle*Math.PI/180;return {x:px+x*Math.cos(t)-y*Math.sin(t),y:py+x*Math.sin(t)+y*Math.cos(t)};}
function smoothAnimals(p,f,g,ms,still,ft,gt,opening){
 const set=(id,d)=>p[id].setAttribute('d',d);
 const fw=f.walk,fr=f.reach||0;
 const fH=f.head-fr*7+(ft&&!still?Math.sin(ms/300)*2:0);
 const fn=foot(58,fw,fr,true,false,false),rn=foot(-77,fw,fr,false,false,false);
 const ff=foot(34,fw,fr,true,true,false),rf=foot(-53,fw,fr,false,true,false);
 const fh=bendHead(fH,42,-124,-17,8),fc=bendHead(fH,42,-124,33,22);
 const fd='M-103 -90 C-108 -121 -85 -139 -52 -136 C-19 -132 0 -132 '+xy(fh.x-8,fh.y-12)+' Q'+xy(fh.x,fh.y-18)+' '+xy(fh.x+9,fh.y-11)+' C'+xy(fc.x+4,fc.y-20)+' '+xy(fc.x+12,fc.y-7)+' '+xy(fc.x+1,fc.y+4)+' C'+xy(80,-83)+' '+xy(fn.x+12,fn.y-40)+' '+xy(fn.x+8,fn.y-13)+' Q'+xy(fn.x+23,fn.y-5)+' '+xy(fn.x+16,fn.y)+' L'+xy(fn.x-8,fn.y)+' Q'+xy(fn.x-13,fn.y-2)+' '+xy(fn.x-12,fn.y-14)+' C'+xy(fn.x-9,fn.y-34)+' 36 -50 30 -68 C6 -58 -24 -59 -49 -70 C-52 -52 '+xy(rn.x-4,rn.y-37)+' '+xy(rn.x-8,rn.y-15)+' Q'+xy(rn.x+9,rn.y-7)+' '+xy(rn.x+12,rn.y)+' L'+xy(rn.x-12,rn.y)+' Q'+xy(rn.x-20,rn.y-4)+' '+xy(rn.x-20,rn.y-15)+' C'+xy(rn.x-19,rn.y-35)+' -79 -60 -83 -71 Q-104 -76 -103 -90Z';
 set('fox-body',fd);set('fox-clip-shape',fd);
 set('fox-front-far',limb(ff,30,-100,true,false,true));set('fox-rear-far',limb(rf,-65,-87,false,false,true));
 set('fox-far-paws',boot(ff,9,29)+boot(rf,9,29));
 set('fox-near-paws',boot(fn,12,40)+boot(rn,13,36));
 set('fox-leg-shade','M-89 -98Q-66 -82 -68 -61Q-81 -73 -89 -98Z M41 -98Q58 -86 48 -68Q52 -88 41 -98Z');
 tx(p['fox-head'],'translate(42 -124) rotate('+fH+')');
 tx(p['fox-tail'],'rotate('+((still?0:Math.sin(ms/430)*4)+fw*.14+fr*17)+' -83 -89)');
 tx(p['fox-ears'],'rotate('+(-7*f.worry)+' -6 -44)');
 tx(p['fox-brow'],'rotate('+(13*f.worry)+' 39 -31)');
 tx(p['fox-pupil'],'translate(0 '+(f.head>10?1.3:f.head<0?-1.3:0)+')');
 tx(p['fox-jaw'],'rotate('+(ft?opening*6:0)+' 33 12)');
 tx(p['fox-mouth'],'translate(0 12) scale(1 '+(.22+opening*.8)+') translate(0 -12)');op(p['fox-mouth'],ft?1:0);
 const fb=!still&&(ms+420)%3770>3630;op(p['fox-eye'],fb?0:1);op(p['fox-lid'],fb?1:0);
 const gw=g.walk,gr=g.reach||0,br=clamp(g.angle/38);
 const gh=g.head+(gt&&!still?Math.sin(ms/340)*1.5:0);
 const gn=foot(47,gw,gr,true,false,true,br),grn=foot(-47,gw,gr,false,false,true);
 const gf=foot(29,gw,gr,true,true,true,br),grf=foot(-30,gw,gr,false,true,true);
 // A flexible neck joins the moving head and body; its endpoints rotate with the head.
 const n=bendHead(gh,26,-74,1,9),m=bendHead(gh,26,-74,34,23);
 const gd='M-81 -65 C-83 -84 -66 -95 -44 -93 Q-14 -87 7 -92 C'+xy(n.x-16,n.y-4)+' '+xy(n.x-10,n.y-21)+' '+xy(n.x+1,n.y-18)+' Q'+xy(n.x+23,n.y-13)+' '+xy(m.x,m.y-9)+' C'+xy(m.x+5,m.y+3)+' 64 -48 '+xy(gn.x+8,gn.y-24)+' C'+xy(gn.x+5,gn.y-13)+' '+xy(gn.x+10,gn.y-9)+' '+xy(gn.x+11,gn.y-2)+' Q'+xy(gn.x+10,gn.y)+' '+xy(gn.x+6,gn.y)+' L'+xy(gn.x-7,gn.y)+' Q'+xy(gn.x-10,gn.y-4)+' '+xy(gn.x-9,gn.y-11)+' C'+xy(gn.x-10,gn.y-29)+' 28 -40 24 -47 Q-5 -35 -29 -47 C-30 -33 '+xy(grn.x-1,grn.y-25)+' '+xy(grn.x-4,grn.y-12)+' Q'+xy(grn.x+9,grn.y-6)+' '+xy(grn.x+8,grn.y)+' L'+xy(grn.x-9,grn.y)+' Q'+xy(grn.x-14,grn.y-3)+' '+xy(grn.x-14,grn.y-12)+' C'+xy(grn.x-17,grn.y-30)+' -58 -47 -62 -50 Q-78 -52 -81 -65Z';
 set('goat-body',gd);set('goat-clip-shape',gd);
 set('goat-far-front',limb(gf,32,-48,true,true,true));set('goat-far-back',limb(grf,-38,-51,false,true,true));
 set('goat-far-hooves',boot(gf,6,10)+boot(grf,6,10));set('goat-near-hooves',boot(gn,7,11)+boot(grn,7,11));
 set('goat-hoof-splits','M'+xy(gn.x+1,gn.y-7)+' L'+xy(gn.x+1,gn.y)+' M'+xy(grn.x+1,grn.y-7)+' L'+xy(grn.x+1,grn.y));
 set('goat-leg-shade','M-69 -67Q-50 -59 -52 -47Q-61 -55 -69 -67Z M33 -71Q42 -54 33 -40Q36 -59 33 -71Z');
 const c1=bendHead(gh,26,-74,0,24),c2=bendHead(gh,26,-74,35,27);
 set('goat-collar-band','M'+xy(c1.x,c1.y)+' Q'+xy((c1.x+c2.x)/2,(c1.y+c2.y)/2+12)+' '+xy(c2.x,c2.y)+' L'+xy(c2.x,c2.y+6)+' Q'+xy((c1.x+c2.x)/2,(c1.y+c2.y)/2+18)+' '+xy(c1.x,c1.y+6)+' Z');
 tx(p['goat-bell-pendant'],'translate('+round((c1.x+c2.x)/2-44)+' '+round((c1.y+c2.y)/2+13+48)+') rotate('+round(still?0:gw*.15)+' 44 -48)');
 tx(p['goat-ear-near'],'rotate('+(-9*g.worry+(still?0:Math.sin(ms/870)*1.5))+' 15 -16)');
 tx(p['goat-ear-far'],'rotate('+(5*g.worry)+' 39 -24)');
 tx(p['goat-brow'],'rotate('+(-15*g.worry)+' 40 -23)');
 const gaze=g.head>10?1:g.head<0?-1:0;
 tx(p['goat-pupil'],'translate(0 '+gaze+')');tx(p['goat-glint'],'translate(0 '+gaze+')');
 tx(p['goat-jaw'],'rotate('+(gt?opening*5:0)+' 48 25)');
 p['goat-mouth'].setAttribute('ry',gt?String(1+opening*3.2):'1');op(p['goat-mouth'],gt?1:0);
 const gb=!still&&(ms+1520)%3970>3830;
 for(const id of ['goat-eye','goat-pupil','goat-glint'])op(p[id],gb?0:1);
 op(p['goat-lid'],gb?1:0);
 return gh;
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
  tx(p.fox,'translate('+f.x+' '+(f.y-(still?0:Math.abs(f.walk)*.06))+') scale('+(f.facing*.71)+' .71)');
  p['fox-shadow'].setAttribute('cx',f.x);p['fox-shadow'].setAttribute('cy',f.y+4);
  op(p.goat,g.visible?1:0);op(p['goat-shadow'],g.visible&&g.y>=bank-7&&g.y<bank+9?.55:0);
  p['goat-shadow'].setAttribute('cx',g.x);p['goat-shadow'].setAttribute('cy',g.y+3);
  tx(p.goat,'translate('+g.x+' '+(g.y-(still?0:Math.abs(g.walk)*.06))+') rotate('+g.angle+') scale('+(g.facing*1.22)+' 1.22)');
  const gh=smoothAnimals(p,f,g,ms,still,ft,gt,opening);
  tx(this.goatHead,'translate(26 -74) rotate('+gh+')');
  tx(this.goatTail,'rotate('+(still?0:Math.sin(ms/410)*3)+' -67 -68)');
  p.fox.dataset.speaking=String(ft);p.fox.dataset.location=f.y>500?'well':'bank';
  p.goat.dataset.speaking=String(gt);p.goat.dataset.location=g.y>500?'well':'bank';
  p.fox.dataset.rig=p.goat.dataset.rig='continuous-curves';
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
