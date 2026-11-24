(() => {
'use strict';
const clamp=v=>Math.max(0,Math.min(1,v)),phase=(v,a,b)=>clamp((v-a)/Math.max(1,b-a)),ease=t=>t*t*(3-2*t),mix=(a,b,t)=>a+(b-a)*t;
const tx=(n,v)=>n.setAttribute('transform',v),op=(n,v)=>n.setAttribute('opacity',String(v));
const line=(s,id)=>s.lines.find(l=>l.id===id);
function wordAt(s,id,w){const l=line(s,id),i=l.reading.words.findIndex(v=>v.replace(/\p{P}/gu,'')===w);return l.start+(l.reading.timings[i]?.[0]??l.duration*.5);}
const actor=(x,y,facing)=>({x,y,facing,walk:0,head:0,angle:0,reach:0,worry:0});
const ground=580;
function travel(a,ms,b,e,x,y,X,Y,still){const t=phase(ms,b,e),p=still?Math.round(t):ease(t);a.x=mix(x,X,p);a.y=mix(y,Y,p);a.walk=still?0:Math.sin(Math.PI*t)*Math.sin(Math.hypot(X-x,Y-y)*p/13)*23;return t;}
function leap(a,ms,b,e,x,y,X,Y,h,still){const t=phase(ms,b,e),p=still?Math.round(t):t;a.x=mix(x,X,p);a.y=mix(y,Y,p)-h*4*p*(1-p);a.reach=still?0:Math.sin(Math.PI*t);return t;}
function cues(s){
 switch(s.id){
 case 'forest-meeting':return {arrive:line(s,'meeting').start+200,stop:Math.max(950,wordAt(s,'meeting','ਰੁਕ')-150)};
 case 'hundred-tricks':return {laugh:line(s,'fox-laughs').start};
 case 'a-distant-sound':return {hear:wordAt(s,'barking','ਭੌਂਕਣ')-160};
 case 'one-useful-skill':{const l=line(s,'cat-climbs');const j=wordAt(s,'cat-climbs','ਛਾਲ')-220;return {jump:j,climb:j+740,branch:Math.max(j+1380,l.end-330)};}
 case 'a-place-to-hide':{const l=line(s,'fox-hides');return {notice:wordAt(s,'fox-hides','ਝਾੜੀ')-200,hide:Math.max(l.start+900,wordAt(s,'fox-hides','ਲੁਕ')-100),quiet:l.end-200};}
 case 'a-lesson-learned':{const l=line(s,'reunion');return {down:wordAt(s,'reunion','ਉਤਰੀ')-450,return:wordAt(s,'reunion','ਬਾਹਰ')-350,meet:l.end-100};}
 }return {};
}
function eventsFor(s){const c=cues(s);let e=[];switch(s.id){case 'forest-meeting':e=[{ms:c.arrive+350,sound:'step'},{ms:c.arrive+780,sound:'step'}];break;case 'a-distant-sound':e=[{ms:c.hear,sound:'rustle'},{ms:c.hear+650,sound:'rustle'}];break;case 'one-useful-skill':e=[{ms:c.jump,sound:'spring'},{ms:c.climb,sound:'twig'},{ms:c.branch,sound:'step'}];break;case 'a-place-to-hide':e=[{ms:c.hide+250,sound:'step'},{ms:c.hide+650,sound:'step'},{ms:c.hide+1150,sound:'rustle'}];break;case 'a-lesson-learned':e=[{ms:c.down+650,sound:'step'},{ms:c.return+450,sound:'step'},{ms:c.meet+400,sound:'chirp'}];break;}return e.filter(a=>a.ms>=0&&a.ms<=s.duration);}
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
function drawFox(p,f,ms,still,ft,opening){
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

}

function drawCat(p,c,ms,still,talking,opening){
 const set=(id,d)=>p[id].setAttribute('d',d);
 const w=c.walk,r=c.reach,head=c.head+(talking&&!still?Math.sin(ms/310)*1.8:0);
 const fn=foot(43,w,r,true,false,false),rn=foot(-55,w,r,false,false,false),ff=foot(28,w,r,true,true,false),rf=foot(-36,w,r,false,true,false);
 const h=bendHead(head,34,-106,-19,13),m=bendHead(head,34,-106,20,18);
 const d='M-78 -75C-82 -99 -61 -115 -34 -111Q-12 -106 7 -109C'+xy(h.x-12,h.y-5)+' '+xy(h.x-9,h.y-21)+' '+xy(h.x+3,h.y-22)+' Q'+xy(m.x+2,m.y-18)+' '+xy(m.x,m.y+1)+' C'+xy(m.x+10,m.y+20)+' '+xy(fn.x+6,fn.y-33)+' '+xy(fn.x+7,fn.y-10)+' Q'+xy(fn.x+17,fn.y-5)+' '+xy(fn.x+11,fn.y)+' L'+xy(fn.x-8,fn.y)+' Q'+xy(fn.x-12,fn.y-3)+' '+xy(fn.x-10,fn.y-12)+' C'+xy(fn.x-10,fn.y-29)+' 24 -40 20 -49 Q-6 -39 -32 -52 C-31 -34 '+xy(rn.x-2,rn.y-29)+' '+xy(rn.x-6,rn.y-12)+' Q'+xy(rn.x+9,rn.y-5)+' '+xy(rn.x+9,rn.y)+' L'+xy(rn.x-10,rn.y)+' Q'+xy(rn.x-16,rn.y-4)+' '+xy(rn.x-14,rn.y-13)+' C'+xy(rn.x-14,rn.y-32)+' -65 -44 -64 -56 Q-77 -61 -78 -75Z';
 set('cat-body',d);set('cat-clip-shape',d);set('cat-rear-far',limb(rf,-45,-66,false,false,true));set('cat-front-far',limb(ff,25,-81,true,false,true));set('cat-paws',boot(fn,9,12)+boot(rn,10,12));
 const sway=still?0:Math.sin(ms/420)*11+w*.2;
 // Use an independent, overlapping tail-tip curve; the silhouette stays rounded.
 set('cat-tail','M-71 -83 C-111 -67 -141 -88 -138 -124 C-136 -145 '+xy(-118+sway,-158)+' '+xy(-107+sway,-147));
 set('cat-tail-tip','M'+xy(-118+sway*.6,-150)+' Q'+xy(-111+sway,-155)+' '+xy(-107+sway,-147));
 tx(p['cat-head'],'translate(34 -106) rotate('+head+')');
 tx(p['cat-brows'],'rotate('+(c.worry*9)+' 3 -30)');
 tx(p['cat-pupils'],'translate('+(c.head<0?1:0)+' '+(c.head<0?-1:1)+')');
 const blink=!still&&(ms+1100)%4150>4000;
 op(p['cat-eye'],blink?0:1);op(p['cat-lids'],blink?1:0);
 p['cat-mouth'].setAttribute('ry',talking?String(1+opening*3.5):'1');op(p['cat-mouth'],talking?1:0);
}
class ForestStage{
 constructor(svg){this.svg=svg;this.p=Object.fromEntries([...svg.querySelectorAll('[id]')].map(n=>[n.id,n]));this.camera=new window.UmtoCamera.DeliveryCamera(svg);this.reduced=window.matchMedia('(prefers-reduced-motion: reduce)');}
 select(s){this.scene=s;this.c=cues(s);this.shot='';}
 draw(ms,speech,word){
  const s=this.scene,c=this.c,still=this.reduced.matches,p=this.p;
  const f=actor(440,ground,1),a=actor(620,ground,-1);
  const motion=(b,e)=>still?Math.round(phase(ms,b,e)):ease(phase(ms,b,e));
  const ft=speech.speaker==='fox'&&word>=0,ct=speech.speaker==='cat'&&word>=0;
  const timing=speech.reading.timings[word],opening=timing?.length===2?.24+.75*Math.sin(Math.PI*phase(ms-speech.start,timing[0],timing[1])):0;
  let rustle=0,shot={preset:'wide',focus:{x:640,y:360},width:1280};
  const frame=(x,y,width,preset='medium')=>{shot={preset,focus:{x,y},width};};
  switch(s.id){
   case 'forest-meeting':
    travel(f,ms,c.arrive,c.stop,175,ground,440,ground,still);
    travel(a,ms,c.arrive,c.stop,950,ground,620,ground,still);
    break;
   case 'hundred-tricks':
    if(speech.speaker==='fox'){f.head= -8;frame(480,470,740,'medium-close');}
    else if(speech.speaker==='cat'){a.head=-7;frame(610,470,690,'medium-close');}
    else {f.head=-14*(still?1:Math.sin(phase(ms,c.laugh,c.laugh+1000)*Math.PI));frame(545,465,790,'two-shot');}
    break;
   case 'a-distant-sound':
    if(ms>=c.hear){a.facing=1;f.head=-14; a.head=-22;f.worry=.8;a.worry=.8;rustle=1-motion(c.hear+900,c.hear+2600);}
    frame(670,455,1050,'full');break;
   case 'one-useful-skill':
    a.facing=1;a.head=-20;
    if(ms<c.jump){a.x=620;}
    else if(ms<c.climb){leap(a,ms,c.jump,c.climb,620,ground,751,463,46,still);a.angle=-26*motion(c.jump,c.climb);}
    else if(ms<c.branch){const t=travel(a,ms,c.climb,c.branch,751,463,854,319,still);a.angle=-55*(1-motion(c.branch-430,c.branch));a.reach=still?0:Math.sin(t*Math.PI)*.7;}
    else {a.x=854;a.y=319;a.facing=-1;a.head=15;}
    f.worry=1;f.head=-20;
    if(speech.speaker==='fox')frame(460,457,720,'medium-close');else frame(710,365,1050,'full');
    break;
   case 'a-place-to-hide':
    a.x=854;a.y=319;a.head=18;
    f.head=-11;f.worry=.85;
    if(ms<c.notice){f.facing=ms%1200<600?1:-1;}
    else {f.facing=-1;f.head=0;}
    if(ms>=c.hide){travel(f,ms,c.hide,c.hide+1200,440,ground,208,ground,still);}
    if(ms>c.hide+1050){f.x=208;f.y=598;}
    rustle=ms<c.hide?1:1-motion(c.hide,c.quiet);
    frame(620,390,1280,'wide');break;
   case 'a-lesson-learned':
    a.x=854;a.y=319;f.x=208;f.y=598;f.facing=1;
    if(ms>=c.down){leap(a,ms,c.down,c.down+1000,854,319,620,ground,28,still);a.angle=-5;}
    if(ms>=c.down+1000){a.angle=0;a.head=0;}
    if(ms>=c.return)travel(f,ms,c.return,Math.max(c.return+850,c.meet),208,598,440,ground,still);
    if(speech.speaker==='fox'){frame(530,465,790,'two-shot');f.head=-6;}
    break;
  }
  const key=[shot.preset,shot.focus.x,shot.focus.y,shot.width].join('/');
  if(this.shot!==key){this.camera.cue({...shot,cut:true,motion:'static'});this.shot=key;}
  tx(p.fox,'translate('+f.x+' '+f.y+') scale('+(f.facing*.71)+' .71)');
  tx(p.cat,'translate('+a.x+' '+a.y+') rotate('+a.angle+') scale('+(a.facing*.91)+' .91)');
  drawFox(p,f,ms,still,ft,opening);drawCat(p,a,ms,still,ct,opening);
  for(const [id,v] of [['fox',f],['cat',a]]){p[id+'-shadow'].setAttribute('cx',v.x);p[id+'-shadow'].setAttribute('cy',v.y+4);op(p[id+'-shadow'],Math.abs(v.y-ground)<12?.55:0);p[id].dataset.rig='continuous-curves';p[id].dataset.location=v.y<350?'branch':'ground';}
  p.fox.dataset.speaking=String(ft);p.cat.dataset.speaking=String(ct);
  op(p['sound-rustle'],rustle*.8);tx(p['sound-rustle'],'translate(0 '+(still?0:Math.sin(ms/110)*3)+')');
  this.svg.dataset.scene=s.id;
 }
}
window.LittlePanthStage={Stage:ForestStage,eventsFor};
})();