(() => {
'use strict';
const clamp = v => Math.max(0, Math.min(1, v));
const phase = (v,a,b) => clamp((v-a)/Math.max(1,b-a));
const ease = t => t*t*(3-2*t);
const mix = (a,b,t) => a+(b-a)*t;
const tx = (n,v) => n.setAttribute('transform',v);
const op = (n,v) => n.setAttribute('opacity',String(v));
const line = (scene,id) => scene.lines.find(l=>l.id===id);
function wordAt(scene,id,word) {
 const l=line(scene,id);
 const i=l.reading.words.findIndex(w=>w.replace(/\p{P}/gu,'')===word);
 return l.start+(l.reading.timings[i]?.[0]??l.duration*.5);
}
function cuesFor(s) {
 switch(s.id){
 case 'the-old-well': {const fall=wordAt(s,'fox-falls','ਤਿਲਕ');return {walk:line(s,'fox-falls').start+160,stop:wordAt(s,'fox-falls','ਝਾਕਣ')-220,fall:Math.max(350,fall-220)};}
 case 'no-way-out': return {jump:wordAt(s,'trapped','ਕੋਸ਼ਿਸ਼')-180};
 case 'an-invitation': return {arrive:line(s,'goat-arrives').start+120,stop:line(s,'goat-arrives').end-100};
 case 'into-the-well': return {jump:wordAt(s,'goat-jumps','ਛਾਲ')-220,drink:wordAt(s,'goat-jumps','ਪੀਤਾ')-200};
 case 'a-clever-escape': {const l=line(s,'fox-escapes');return {brace:l.start+140,climb:wordAt(s,'fox-escapes','ਪਿੱਠ')-180,escape:wordAt(s,'fox-escapes','ਛਾਲ')+180};}
 case 'the-goat-calls': return {leave:line(s,'help-arrives').start+100,ramp:wordAt(s,'help-arrives','ਫੱਟਾ')-500};
 case 'think-before-you-leap': return {climb:line(s,'goat-climbs').start+160,top:line(s,'goat-climbs').end-200};
 }
 return {};
}
function eventsFor(s) {
 const c=cuesFor(s);
 switch(s.id){
 case 'the-old-well':return [{ms:c.walk+450,sound:'step'},{ms:c.walk+900,sound:'step'},{ms:c.fall+780,sound:'plop'}];
 case 'no-way-out':return [{ms:c.jump,sound:'spring'},{ms:c.jump+650,sound:'plop'}];
 case 'an-invitation':return [{ms:c.arrive+350,sound:'step'},{ms:c.arrive+780,sound:'step'}];
 case 'into-the-well':return [{ms:c.jump,sound:'spring'},{ms:c.jump+820,sound:'plop'},{ms:c.drink+300,sound:'sip'}];
 case 'a-clever-escape':return [{ms:c.brace+350,sound:'step'},{ms:c.climb,sound:'spring'},{ms:c.escape,sound:'spring'},{ms:c.escape+850,sound:'step'}];
 case 'the-goat-calls':return [{ms:c.leave+400,sound:'step'},{ms:c.leave+850,sound:'step'},{ms:c.ramp+750,sound:'twig'}];
 case 'think-before-you-leap':return [{ms:c.climb+500,sound:'step'},{ms:c.climb+1000,sound:'step'},{ms:c.top-220,sound:'step'},{ms:c.top+500,sound:'chirp'}];
 }
 return [];
}
const actor=(x,y,facing)=>({x,y,facing,walk:0,head:0,angle:0,reach:0,visible:true});
function travel(a,ms,start,end,x,y,X,Y,still) {
 const t=phase(ms,start,end), p=still?Math.round(t):ease(t);
 a.x=mix(x,X,p);a.y=mix(y,Y,p);
 a.walk=still?0:Math.sin(Math.PI*t)*Math.sin((ms-start)/92)*25;
 return t;
}
function jump(a,ms,start,end,x,y,X,Y,height,still){
 const t=phase(ms,start,end),p=still?Math.round(t):t;
 a.x=mix(x,X,p);a.y=mix(y,Y,p)-height*4*p*(1-p);
 a.reach=still?0:Math.sin(Math.PI*t);
 return t;
}
function frame(s,c,ms,still) {
 let fox=actor(735,632,-1),goat=actor(350,451,1);goat.visible=false;
 let ramp=0,splash=0,splashX=735;
 const move=t=>still?Math.round(t):ease(t);
 switch(s.id){
 case 'the-old-well':
  fox=actor(175,452,1);
  travel(fox,ms,c.walk,c.stop,175,452,412,452,still);
  fox.head=18*move(phase(ms,c.stop-250,c.stop+160));
  if(ms>=c.fall){jump(fox,ms,c.fall,c.fall+820,412,452,735,632,35,still);fox.head=0;}
  if(ms>=c.fall+820)fox.facing=-1;
  splashX=735;splash=1-phase(ms,c.fall+820,c.fall+1590);if(ms<c.fall+820)splash=0;
  break;
 case 'no-way-out':
  fox.head=-18;
  jump(fox,ms,c.jump,c.jump+690,735,632,735,632,76,still);
  splash=ms<c.jump+690?0:1-phase(ms,c.jump+690,c.jump+1300);
  break;
 case 'an-invitation':
  goat.visible=true;travel(goat,ms,c.arrive,c.stop,165,452,396,452,still);
  goat.head=24*move(phase(ms,c.stop-150,c.stop+350));fox.head=-19;
  break;
 case 'into-the-well':
  goat.visible=true;goat.x=396;goat.y=452;goat.head=20;
  if(ms>=c.jump){jump(goat,ms,c.jump,c.jump+860,396,452,570,632,30,still);goat.head=0;}
  if(ms>=c.drink)goat.head=58*move(phase(ms,c.drink,c.drink+420))*(1-move(phase(ms,c.drink+1000,c.drink+1500)));
  splashX=570;splash=ms<c.jump+860?0:1-phase(ms,c.jump+860,c.jump+1570);
  break;
 case 'a-clever-escape': {
  goat=actor(570,632,1);
  if(ms>=c.brace){goat.facing=-1;goat.x=mix(570,570,1);goat.angle=33*move(phase(ms,c.brace,c.brace+650));goat.head=-5*move(phase(ms,c.brace,c.brace+650));}
  if(ms>=c.climb)jump(fox,ms,c.climb,c.climb+630,735,632,611,560,52,still);
  if(ms>=c.escape)jump(fox,ms,c.escape,c.escape+850,611,560,369,452,87,still);
  if(ms>=c.escape+850){goat.angle=33*(1-move(phase(ms,c.escape+850,c.escape+1300)));goat.head=-17;}
  break;
 }
 case 'the-goat-calls':
  goat=actor(570,632,-1);goat.head=-24;
  fox=actor(369,452,1);
  if(ms>=c.leave){fox.facing=-1;travel(fox,ms,c.leave,c.leave+1800,369,452,30,452,still);if(ms>=c.leave+1800)fox.visible=false;}
  ramp=move(phase(ms,c.ramp,c.ramp+750));
  if(ramp>.8){goat.facing=1;goat.head=-16;}
  break;
 case 'think-before-you-leap': {
  ramp=1;fox.visible=false;goat=actor(570,632,1);
  const base=c.climb+Math.min(650,(c.top-c.climb)*.15);
  if(ms<base){travel(goat,ms,c.climb,base,570,632,661,639,still);}
  else if(ms<c.top){const t=travel(goat,ms,base,c.top,661,639,905,445,still);goat.angle=-38*move(phase(t,0,.1))*(1-move(phase(t,.9,1)));}
  else travel(goat,ms,c.top,c.top+520,905,445,1030,452,still);
  break;
 }
 }
 return {fox,goat,ramp,splash,splashX};
}
class WellStage {
 constructor(svg) {
  this.svg=svg;this.camera=new window.UmtoCamera.DeliveryCamera(svg);
  this.reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  this.p=Object.fromEntries([...svg.querySelectorAll('[id]')].map(n=>[n.id,n]));
  this.goatLegs=[...this.p.goat.querySelectorAll('[data-leg]')];
  this.goatHead=this.p.goat.querySelector('[data-head]');
  this.goatTail=this.p.goat.querySelector('[data-tail]');
 }
 select(s){this.scene=s;this.c=cuesFor(s);this.shot='';}
 draw(ms,speech,word){
  const still=this.reduced.matches,p=this.p,s=this.scene;
  const a=frame(s,this.c,ms,still),f=a.fox,g=a.goat;
  const opening=word>=0 ? .25+.7*Math.sin(Math.PI*phase(ms-speech.start,...speech.reading.timings[word])):0;
  const ft=speech.speaker==='fox'&&word>=0,gt=speech.speaker==='goat'&&word>=0;
  let shot={preset:s.framing,focus:s.focus};
  if(s.id==='the-old-well'&&ms>=this.c.fall)shot={preset:'full',focus:{x:625,y:425},width:1160};
  if(s.id==='no-way-out')shot={preset:'medium',focus:{x:672,y:532},width:820};
  if(s.id==='an-invitation'&&speech.speaker==='goat')shot={preset:'medium-close',focus:{x:435,y:385},width:660};
  if(s.id==='an-invitation'&&speech.speaker==='fox')shot={preset:'medium',focus:{x:693,y:525},width:780};
  if(s.id==='into-the-well'&&speech.speaker==='goat')shot={preset:'two-shot',focus:{x:660,y:540},width:890};
  if(s.id==='a-clever-escape'&&speech.speaker==='fox')shot={preset:'two-shot',focus:{x:665,y:530},width:890};
  if(s.id==='the-goat-calls'&&speech.speaker==='goat')shot={preset:'two-shot',focus:{x:520,y:505},width:920};
  if(s.id==='the-goat-calls'&&speech.speaker==='fox')shot={preset:'medium',focus:{x:430,y:420},width:850};
  if(s.id==='think-before-you-leap'&&speech.speaker==='goat')shot={preset:'medium-close',focus:{x:1020,y:375},width:680};
  const key=[shot.preset,shot.focus.x,shot.focus.y,shot.width].join('/');
  if(key!==this.shot){this.camera.cue({...shot,cut:true});this.shot=key;}
  op(p.fox,f.visible?1:0);op(p['fox-shadow'],f.visible&&f.y<475?.6:0);
  tx(p.fox,'translate('+f.x+' '+(f.y-(still?0:Math.abs(f.walk)*.13))+') scale('+(f.facing*.65)+' .65)');
  p['fox-shadow'].setAttribute('cx',f.x);p['fox-shadow'].setAttribute('cy',f.y+4);
  for(const [id,x,y,sign,reach] of [['fox-rear-far',-77,-84,-1,19],['fox-rear-near',-76,-88,1,-38],['fox-front-far',29,-104,1,-62],['fox-front-near',52,-101,-1,-110]]){
   tx(p[id],'rotate('+(f.walk*sign+f.reach*reach)+' '+x+' '+y+')');
  }
  tx(p['fox-tail'],'rotate('+((still?0:Math.sin(ms/370)*4)+f.walk*.2+f.reach*22)+' -83 -89)');
  tx(p['fox-head'],'translate(42 -124) rotate('+(f.head-f.reach*7)+')');
  tx(p['fox-jaw'],'rotate('+(ft?opening*16:0)+' 20 8)');
  tx(p['fox-mouth'],'translate(0 '+(ft?-6*opening:0)+') scale(1 '+(.25+opening*.92)+')');op(p['fox-mouth'],ft?1:0);
  const fb=!still&&(ms+420)%3770>3630;op(p['fox-eye'],fb?0:1);op(p['fox-lid'],fb?1:0);
  p.fox.dataset.speaking=String(ft);p.fox.dataset.location=f.y>490?'well':'bank';
  op(p.goat,g.visible?1:0);
  tx(p.goat,'translate('+g.x+' '+(g.y-(still?0:Math.abs(g.walk)*.11))+') rotate('+g.angle+') scale('+(g.facing*1.23)+' 1.23)');
  const pins=[[-43,-44],[35,-44],[-32,-44],[50,-44]];
  this.goatLegs.forEach((n,i)=>{const [x,y]=pins[i];tx(n,'translate('+x+' '+y+') rotate('+(g.walk*(i===0||i===3?1:-1)-(g.reach||0)*18)+')');});
  tx(this.goatHead,'translate(26 -74) rotate('+g.head+')');
  tx(this.goatTail,'rotate('+(still?0:Math.sin(ms/340)*4)+' -67 -68)');
  p['goat-mouth'].setAttribute('ry',gt?String(1+opening*3.7):'1');op(p['goat-mouth'],gt?1:0);
  const gb=!still&&(ms+1520)%3970>3830;
  for(const id of ['goat-eye','goat-pupil','goat-glint'])op(p[id],gb?0:1);
  op(p['goat-lid'],gb?1:0);p.goat.dataset.speaking=String(gt);p.goat.dataset.location=g.y>490?'well':'bank';
  op(p['rescue-ramp'],a.ramp>0?1:0);tx(p['rescue-ramp'],'translate('+((1-a.ramp)*200)+' '+((a.ramp-1)*270)+')');
  const ripple=a.splash;
  op(p.ripples,ripple*.85);op(p.splash,still?0:ripple);
  tx(p.splash,'translate('+a.splashX+' '+(632-(1-ripple)*24)+')');
  for(const [i,id] of ['splash-ring','splash-ring2'].entries()){p[id].setAttribute('cx',a.splashX);p[id].setAttribute('rx',20+i*12+(1-ripple)*62);p[id].setAttribute('ry',4+i*2+(1-ripple)*8);}
  tx(p['water-lines'],'translate('+(still?0:Math.sin(ms/900)*13)+' 0)');
  this.svg.dataset.ramp=String(a.ramp===1);this.svg.dataset.scene=s.id;
 }
}
window.LittlePanthStage={Stage:WellStage,eventsFor};
})();
