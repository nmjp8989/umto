(() => {'use strict';
const clamp=x=>Math.max(0,Math.min(1,x)),phase=(t,a,b)=>clamp((t-a)/Math.max(1,b-a)),ease=x=>x*x*(3-2*x),mix=(a,b,t)=>a+(b-a)*t;
const line=(s,id)=>s.lines.find(l=>l.id===id);
function wordAt(s,id,w){const l=line(s,id),i=l.reading.words.findIndex(v=>v.replace(/\p{P}/gu,'')===w);return l.start+(l.reading.timings[i]?.[0]??l.duration*.5);}
const tx=(n,v)=>n.setAttribute('transform',v),op=(n,v)=>n.setAttribute('opacity',String(v)),path=(n,v)=>n.setAttribute('d',v),xy=(x,y)=>x.toFixed(2)+' '+y.toFixed(2);
function cues(s){switch(s.id){case 'storm-coming':return {start:wordAt(s,'clouds','ਬੱਦਲ')-300};case 'strong-wind':return {fall:wordAt(s,'snap','ਟੁੱਟ')-150};case 'sun-returns':return {clear:wordAt(s,'calm','ਰੁਕ')-100};}return {};}
function eventsFor(s){const c=cues(s),e=s.id==='river-breeze'?[{ms:600,sound:'chirp'}]:s.id==='storm-coming'?[{ms:c.start+800,sound:'gust'}]:s.id==='strong-wind'?[{ms:450,sound:'gust'},{ms:c.fall,sound:'twig'},{ms:c.fall+750,sound:'twig'}]:s.id==='sun-returns'?[{ms:c.clear+900,sound:'chirp'}]:[];return e.filter(v=>v.ms>=0&&v.ms<=s.duration);}
class Stage{
constructor(svg){this.svg=svg;this.p=Object.fromEntries([...svg.querySelectorAll('[id]')].map(n=>[n.id,n]));this.camera=new window.UmtoCamera.DeliveryCamera(svg);this.reduced=window.matchMedia('(prefers-reduced-motion: reduce)');}
select(s){this.scene=s;this.c=cues(s);this.shot='';}
draw(ms,speech,word){const p=this.p,s=this.scene,c=this.c,still=this.reduced.matches;let storm=0,fallen=0,shot={preset:'wide',focus:{x:640,y:360},width:1280};const prog=(a,b)=>ease(phase(ms,a,b));const frame=(x,y,width,preset='medium')=>{shot={preset,focus:{x,y},width};};
switch(s.id){case 'proud-oak':if(speech.speaker==='oak')frame(422,375,860,'medium');else frame(906,465,760,'medium-close');break;case 'storm-coming':storm=prog(c.start,c.start+2200);break;case 'strong-wind':storm=1;fallen=prog(c.fall,c.fall+950);break;case 'sun-returns':storm=1-prog(c.clear,c.clear+1700);fallen=1;if(speech.speaker==='oak')frame(421,405,860,'medium');else if(speech.speaker==='reed')frame(910,465,760,'medium-close');break;case 'lesson':fallen=1;break;}
if(still&&s.id==='strong-wind')fallen=ms>=c.fall+350?1:0;
const sway=still?0:Math.sin(ms/420),bend=(14+storm*75)*(still?.9:1+sway*.15),oakBend=storm*(still?7:8+4*sway);
const x=410+oakBend;path(p['oak-body'],'M290 590Q349 558 365 492Q381 429 '+xy(370+oakBend*.45,365)+' Q340 328 '+xy(311+oakBend,292)+' L330 276 Q387 302 '+xy(397+oakBend,340)+' Q411 288 '+xy(437+oakBend,247)+' L460 259Q435 317 '+xy(434+oakBend,367)+' Q470 332 '+xy(507+oakBend,308)+' L522 327Q469 387 '+xy(455+oakBend*.45,429)+' Q447 500 464 554Q482 579 529 590Q473 607 425 587Q380 607 290 590Z');
path(p['oak-grain'],'M377 567Q405 486 '+xy(x-7,408)+' M440 565Q423 505 '+xy(x+22,441)+' M388 370Q386 339 '+xy(354+oakBend,309));
tx(p['oak-canopy'],'translate('+oakBend+' 0) rotate('+(storm*(still?0:sway*2))+' 410 365)');
const drop=fallen;tx(p['oak-bough'],'translate('+mix(oakBend,-58,drop)+' '+mix(0,224,drop)+') rotate('+mix(storm*(still?0:sway*3),58,drop)+' 439 401)');
tx(p['oak-face'],'translate('+(414+oakBend*.3)+' 469)');
const ot=speech.speaker==='oak'&&word>=0,rt=speech.speaker==='reed'&&word>=0,timing=speech.reading.timings[word],opening=timing?.length===2?.24+.7*Math.sin(Math.PI*phase(ms-speech.start,timing[0],timing[1])):0;
p['oak-mouth'].setAttribute('ry',ot?String(1+opening*6):'1');op(p['oak-mouth'],ot?1:0);op(p['oak-eyes'],!still&&(ms+800)%4100>3970?0:1);path(p['oak-smile'],storm>.5?'M-12 15q12-10 24 0':'M-12 9q12 12 24 0');
for(let i=0;i<7;i++){const root=828+i*33,h=[133,182,156,210,170,147,121][i],f=(i-3)*3,dx=bend*(.77+(i%3)*.13),topX=root+dx,topY=604-h+storm*(35+(i%2)*15);path(p['reed-body-'+i],'M'+xy(root,604)+' Q'+xy(root+f,604-h*.45)+' '+xy(topX,topY));path(p['reed-leaf-'+i],'M'+xy(root+dx*.35,604-h*.37)+' Q'+xy(root-34+dx*.35,604-h*.78)+' '+xy(root-36+dx*.68,604-h*.92)+' Q'+xy(root+9+dx*.45,604-h*.66)+' '+xy(root+dx*.35,604-h*.37)+' Z');tx(p['reed-tip-'+i],'translate('+topX+' '+topY+') rotate('+(Math.atan2(dx,h-storm*40)*180/Math.PI)+')');}
p['reed-mouth'].setAttribute('ry',rt?String(1+opening*2.8):'1');op(p['reed-mouth'],rt?1:0);
p.oak.dataset.rig='continuous-curves';p['reed-bank'].dataset.rig='continuous-curves';p.oak.dataset.speaking=String(ot);p['reed-bank'].dataset.speaking=String(rt);
op(p['storm-clouds'],storm);op(p.rain,storm*.68);op(p['wind-lines'],storm*.66);tx(p.rain,'translate('+(still?0:-(ms%130))+' '+(still?0:ms%130)+')');tx(p['moving-clouds'],'translate('+(still?0:(ms/70)%60)+' 0)');tx(p['water-lines'],'translate('+(still?0:Math.sin(ms/650)*14)+' 0)');tx(p['wind-lines'],'translate('+(still?0:sway*32)+' 0)');
const key=[shot.preset,shot.focus.x,shot.focus.y,shot.width].join('/');if(key!==this.shot){this.camera.cue({...shot,cut:true,motion:'static'});this.shot=key;}
Object.assign(this.svg.dataset,{scene:s.id,weather:storm>.8?'storm':storm<.2?'clear':'transition',bough:fallen>.99?'fallen':'attached'});
}}
window.LittlePanthStage={Stage,eventsFor};})();