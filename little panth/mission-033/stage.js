(() => {
'use strict';
const clamp=x=>Math.max(0,Math.min(1,x)),ease=t=>t*t*(3-2*t),phase=(v,a,b)=>clamp((v-a)/Math.max(1,b-a)),mix=(a,b,t)=>a+(b-a)*t;
const line=(s,id)=>s.lines.find(l=>l.id===id);
function wordAt(s,id,w){const l=line(s,id),i=l.reading.words.findIndex(v=>v.replace(/\p{P}/gu,'')===w);return l.start+(l.reading.timings[i]?.[0]??l.duration*.5);}
const xy=(x,y)=>Math.round(x*100)/100+' '+Math.round(y*100)/100;
const tx=(n,v)=>n.setAttribute('transform',v),op=(n,v)=>n.setAttribute('opacity',String(v)),path=(n,v)=>n.setAttribute('d',v);
const actor=(x,y,facing)=>({x,y,facing,walk:0,head:0,reach:0,worry:0,gesture:0}),ground=580;
function travel(a,ms,start,end,x,y,X,Y,still){const t=phase(ms,start,end),p=still?Math.round(t):ease(t);a.x=mix(x,X,p);a.y=mix(y,Y,p);a.walk=still?0:Math.sin(Math.PI*t)*Math.sin(Math.hypot(X-x,Y-y)*p/11)*24;return t;}
function hop(a,ms,start,end,x,y,X,Y,h,still){const t=phase(ms,start,end),p=still?Math.round(t):t;a.x=mix(x,X,p);a.y=mix(y,Y,p)-4*h*p*(1-p);a.reach=still?0:Math.sin(Math.PI*t);return t;}
function cues(s){switch(s.id){
case 'summer-meadow':return {walk:line(s,'summer').start+150,arrive:line(s,'summer').end-150,sing:line(s,'song').start};
case 'days-of-work':{const l=line(s,'work');return {start:l.start+100,store:wordAt(s,'work','ਭੰਡਾਰ'),end:l.end-100};}
case 'winter-arrives':return {cold:wordAt(s,'winter','ਸਰਦੀਆਂ')-200};
case 'at-the-door':{const l=line(s,'knock');return {walk:l.start+100,knock:wordAt(s,'knock','ਦਸਤਕ')-250,open:line(s,'share').start-200};}
case 'sharing-the-grain':return {share:wordAt(s,'meal','ਦਿੱਤੇ')-300};
}return {};}
function eventsFor(s){const c=cues(s);let e=[];switch(s.id){
case 'summer-meadow':e=[{ms:c.walk+350,sound:'step'},{ms:c.walk+800,sound:'step'},{ms:c.sing+450,sound:'chirp'}];break;
case 'days-of-work':e=[{ms:c.start+550,sound:'step'},{ms:c.store-160,sound:'twig'},{ms:c.store+700,sound:'chirp'}];break;
case 'winter-arrives':e=[{ms:c.cold+160,sound:'gust'},{ms:c.cold+2100,sound:'gust'}];break;
case 'at-the-door':e=[{ms:c.walk+350,sound:'step'},{ms:c.walk+850,sound:'step'},{ms:c.knock,sound:'twig'},{ms:c.knock+230,sound:'twig'}];break;
case 'sharing-the-grain':e=[{ms:c.share+350,sound:'step'},{ms:c.share+900,sound:'chirp'}];break;
}return e.filter(v=>v.ms>=0&&v.ms<=s.duration);}
function drawAnt(p,a,ms,still,talk,opening,carry){
 for(const far of [true,false])for(let i=0;i<3;i++){const sx=-56+i*33,sy=-42-i*3,step=a.walk*(i%2?1:-1)*(far?-1:1),x=sx+(i-1)*17+step,y=-Math.max(0,step)*.28;path(p['ant-'+(far?'far':'near')+'-'+i],'M'+xy(sx,sy)+' C'+xy(sx-8,sy+12)+' '+xy(x-9,y-23)+' '+xy(x,y-6)+' Q'+xy(x+7,y-1)+' '+xy(x+14,y-1));}
 const tilt=a.head+(talk&&!still?Math.sin(ms/310)*2:0);tx(p['ant-head'],'translate(47 -69) rotate('+tilt+')');
 tx(p['ant-antennae'],'rotate('+(still?0:Math.sin(ms/370)*4)+' 7 -43)');tx(p['ant-brow'],'rotate('+(a.worry*9)+' 25 -30)');
 const blink=!still&&(ms+320)%3970>3820;op(p['ant-eye'],blink?0:1);op(p['ant-lid'],blink?1:0);
 p['ant-mouth'].setAttribute('ry',talk?String(1+opening*3.3):'1');op(p['ant-mouth'],talk?1:0);
 const handY=carry?-40:-13-a.gesture*32;path(p['ant-carry-arm'],'M25 -54 Q49 -40 61 '+(handY+8)+' Q76 '+handY+' 83 '+handY);
 op(p['carried-grain'],carry?1:0);op(p['ant-carry-arm'],carry||a.gesture>0?1:0);p.ant.dataset.carrying=String(carry);
}
function drawHopper(p,a,ms,still,talk,opening){
 const w=a.walk,r=a.reach,hx=-73-w*.6-r*28,hy=-Math.max(0,-w)*.22-r*12,fx=38+w*.75+r*28,fy=-Math.max(0,w)*.25-r*16;
 path(p['hopper-far-leg'],'M-57 -78Q-76 -71 -61 -48C-48 -32 '+xy(hx+25,hy-22)+' '+xy(hx+24,hy-5)+' Q'+xy(hx+37,hy)+' '+xy(hx+43,hy)+' L'+xy(hx+16,hy)+' C'+xy(hx+7,hy-5)+' -86 -33 -84 -55Q-85 -72 -57 -78Z');
 path(p['hopper-hind-leg'],'M-37 -80C-59 -101 -91 -113 -112 -105C-122 -99 -111 -89 -96 -76L-72 -55Q-59 -30 '+xy(hx-3,hy-9)+' Q'+xy(hx-11,hy-3)+' '+xy(hx-2,hy)+' L'+xy(hx+22,hy)+' Q'+xy(hx+30,hy-6)+' '+xy(hx+18,hy-9)+' L-39 -42Q-15 -61 -37 -80Z');
 path(p['hopper-far-feet'],'M24 -63 Q31 -29 '+xy(fx-17,fy-3)+' L'+xy(fx-4,fy-3));path(p['hopper-front-feet'],'M42 -61 Q36 -31 '+xy(fx,fy-4)+' Q'+xy(fx+7,fy)+' '+xy(fx+19,fy)+' M15 -53 Q18 -24 '+xy(fx-18,fy-2)+' L'+xy(fx-5,fy-2));
 const tilt=a.head+(talk&&!still?Math.sin(ms/300)*2:0);tx(p['hopper-head'],'translate(52 -91) rotate('+tilt+')');
 tx(p['hopper-antennae'],'rotate('+((still?0:Math.sin(ms/380)*3)+a.worry*7)+' 4 -43)');tx(p['hopper-brow'],'rotate('+(-a.worry*13)+' 25 -30)');tx(p['hopper-wing'],'rotate('+((still?0:Math.sin(ms/230)*1.1)+r*8)+' -35 -86)');
 const blink=!still&&(ms+1260)%4120>3980;op(p['hopper-eye'],blink?0:1);op(p['hopper-lid'],blink?1:0);
 p['hopper-mouth'].setAttribute('ry',talk?String(1+opening*3.5):'1');op(p['hopper-mouth'],talk?1:0);
}
class MeadowStage{
 constructor(svg){this.svg=svg;this.p=Object.fromEntries([...svg.querySelectorAll('[id]')].map(n=>[n.id,n]));this.camera=new window.UmtoCamera.DeliveryCamera(svg);this.reduced=window.matchMedia('(prefers-reduced-motion: reduce)');}
 select(s){this.scene=s;this.c=cues(s);this.shot='';}
 draw(ms,speech,word){
 const p=this.p,s=this.scene,c=this.c,still=this.reduced.matches,a=actor(440,ground,1),g=actor(780,ground,-1);
 const motion=(b,e)=>still?Math.round(phase(ms,b,e)):ease(phase(ms,b,e));
 const at=speech.speaker==='ant'&&word>=0,gt=speech.speaker==='grasshopper'&&word>=0,timing=speech.reading.timings[word];
 const opening=timing?.length===2?.25+.7*Math.sin(Math.PI*phase(ms-speech.start,timing[0],timing[1])):0;
 let winter=0,inside=false,carry=false,song=0,door=0,pile=0,share=0,aVisible=1,shot={preset:'wide',focus:{x:640,y:360},width:1280};
 const frame=(x,y,width,preset='medium')=>{shot={preset,focus:{x,y},width};};
 switch(s.id){
 case 'summer-meadow':carry=true;travel(a,ms,c.walk,c.arrive,236,ground,440,ground,still);g.x=805;g.y=501;g.head=-9;if(ms>=c.sing){song=1;frame(680,405,1060,'full');}break;
 case 'a-friendly-warning':g.x=770;a.gesture=at?.9:0;g.head=gt?-8:0;if(speech.speaker==='ant')frame(470,465,680,'medium-close');else if(speech.speaker==='grasshopper')frame(730,456,710,'medium-close');else frame(600,445,880,'two-shot');break;
 case 'days-of-work':{carry=ms<c.store;travel(a,ms,c.start,c.store-120,440,ground,899,ground,still);if(ms>=c.store){door=1;pile=motion(c.store-150,c.store+400);travel(a,ms,c.store,c.end,899,ground,490,ground,still);a.facing=-1;}g.x=805;g.y=501;const j=Math.max(c.store+850,c.end-900);if(ms>=j&&ms<j+850)hop(g,ms,j,j+850,805,501,745,ground,45,still);else if(ms>=j+850){g.x=745;g.y=ground;}song=ms>=j?1:0;frame(690,410,1280,'wide');break;}
 case 'winter-arrives':winter=motion(c.cold,c.cold+1700);aVisible=0;g.x=720;g.worry=winter;g.head=17*winter;if(!still){g.x+=Math.sin(ms/75)*1.2*winter;g.y+=Math.sin(ms/115)*.8*winter;}frame(720,433,970,'full');break;
 case 'at-the-door':winter=1;g.facing=1;g.worry=1;travel(g,ms,c.walk,c.knock,575,ground,879,ground,still);if(ms>=c.knock&&ms<c.knock+650)g.head=-7+10*(still?0:Math.sin((ms-c.knock)/80));const retreat=motion(c.knock+420,c.open-100);g.x=mix(g.x,735,retreat);door=motion(c.open,c.open+430);a.x=1000-10*door;a.facing=-1;aVisible=door;if(speech.speaker==='ant'){a.gesture=.7;frame(914,466,730,'two-shot');}else if(speech.speaker==='grasshopper')frame(852,466,720,'medium-close');else frame(872,420,960,'full');break;
 case 'sharing-the-grain':inside=true;a.x=470;g.x=815;carry=ms<c.share;share=motion(c.share,c.share+450);if(ms>=c.share){g.head=18*(1-motion(c.share+600,c.share+1300));}if(speech.speaker==='grasshopper'){g.head=-8;frame(665,459,850,'two-shot');}else frame(640,400,1140,'wide');break;
 }
 const key=[shot.preset,shot.focus.x,shot.focus.y,shot.width].join('/');if(key!==this.shot){this.camera.cue({...shot,cut:true,motion:'static'});this.shot=key;}
 op(p.outside,inside?0:1);op(p.inside,inside?1:0);op(p['winter-layer'],winter);op(p['leaf-seat'],1-winter);op(p['fore-plants'],inside?0:1-winter);op(p['fore-dry'],inside?0:winter);
 op(p['outside-grain'],inside?0:(s.id==='summer-meadow'?1:0));op(p['work-pile'],inside?0:pile);tx(p['cold-wind'],'translate('+(still?0:Math.sin(ms/800)*28)+' 0)');
 tx(p.door,'translate(957 0) scale('+(1-door*.9)+' 1) translate(-957 0)');op(p.door,1-door);op(p['shared-grain'],share);
 op(p.ant,aVisible);tx(p.ant,'translate('+a.x+' '+a.y+') scale('+(a.facing*.77)+' .77)');tx(p.grasshopper,'translate('+g.x+' '+g.y+') scale('+(g.facing*.73)+' .73)');
 drawAnt(p,a,ms,still,at,opening,carry);drawHopper(p,g,ms,still,gt,opening);
 for(const [id,v,vis] of [['ant',a,aVisible],['grasshopper',g,1]]){p[id+'-shadow'].setAttribute('cx',v.x);p[id+'-shadow'].setAttribute('cy',v.y+4);op(p[id+'-shadow'],vis*(Math.abs(v.y-ground)<15?.58:0));p[id].dataset.rig='continuous-curves';}
 p.ant.dataset.speaking=String(at);p.grasshopper.dataset.speaking=String(gt);tx(p['musical-notes'],'translate('+(g.x+38)+' '+(g.y-175-(still?0:Math.sin(ms/420)*9))+') scale(.65)');op(p['musical-notes'],song*.82);
 Object.assign(this.svg.dataset,{scene:s.id,season:winter>.95?'winter':'summer',view:inside?'inside':'outside'});
 }
}
window.LittlePanthStage={Stage:MeadowStage,eventsFor};
})();