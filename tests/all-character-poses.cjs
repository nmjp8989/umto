'use strict';
// npm install --no-save jsdom sharp (or set JSDOM_PATH and SHARP_PATH).
// Renders every preset, view, standing pose and animation, plus a complete walk cycle.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require(process.env.JSDOM_PATH||'jsdom');
const sharp=require(process.env.SHARP_PATH||'sharp');
const out=process.env.RENDER_OUTPUT||'/tmp/umto-character-review';fs.mkdirSync(out,{recursive:true});
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),{url:'https://nmjp8989.github.io/umto/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
 w.matchMedia=()=>({matches:false,addEventListener(){}});w.requestAnimationFrame=()=>0;w.cancelAnimationFrame=()=>{};
 w.ResizeObserver=class{observe(){}};w.fetch=async()=>({ok:false,json:async()=>({})});w.HTMLMediaElement.prototype.pause=()=>{};
 w.HTMLCanvasElement.prototype.getContext=()=>null;
}});
const w=dom.window;
w.eval(`
 globalThis.reviewPresets=premadeCharacters.map(p=>({id:p.id,name:p.name}));
 globalThis.reviewActions=headshotAnimations.map(a=>a[0]);
 globalThis.prepareReview=(id,view)=>{applyPremade(premadeCharacters.find(p=>p.id===id));state.framing='full';state.backgroundColour='#f0f3f1';cameraView=view;delete svg.dataset.animationFrame;applyColours();render(true);globalThis.reviewTorso=document.getElementById('torso').innerHTML;};
 globalThis.reviewFrame=(key,time)=>{
  document.getElementById('torso').innerHTML=reviewTorso;
  if(key.startsWith('stand-')){state.pose=key.slice(6);document.getElementById('torso').innerHTML=bodyRigSvg(state.pose,cameraView,true);reaction.key='neutral';}
  else {state.pose='relaxed';reaction.key=key;}
  reaction.playing=true;reaction.started=0;reaction.last='';reactionTick(time*1000);reaction.playing=false;
  const art=svg.cloneNode(true);art.setAttribute('viewBox','-200 -200 1654 2600');art.setAttribute('width','160');art.setAttribute('height','252');
  art.querySelector('#background').remove();
  const xml=new XMLSerializer().serializeToString(art);
  if(/NaN|undefined|Infinity/.test(xml))throw Error('Invalid geometry '+key);
  if(art.querySelectorAll('[data-rig-arm]').length!==2||art.querySelectorAll('[data-rig-foot]').length!==2)throw Error('Missing limbs');
  return xml;
 };
 for(const side of [-1,1])for(let i=0;i<240;i++){
  const t=i/200,g=walkingStep(t,side),next=walkingStep(t+.00001,side),loop=walkingStep(t+1.2,side);
  if(g.stance&&(g.lift!==0||g.footPitch!==0))throw Error('Support foot moved off ground');
  if(!g.stance&&!walkingStep(t,-side).stance)throw Error('Both feet airborne');
  if(Math.abs(next.forward-g.forward)>1||Math.abs(loop.forward-g.forward)>1e-8)throw Error('Gait seam');
 }
`);
(async()=>{
 let rendered=0;const overview=[];
 for(const [index,preset] of w.reviewPresets.entries()){
  const tiles=[];let tile=0;
  for(const view of ['front','left','right']){
   w.prepareReview(preset.id,view);
   const cases=[...w.reviewActions.map(key=>[key,1.3]),...['relaxed','straight','wide','hip'].map(p=>['stand-'+p,1.3]),...Array.from({length:12},(_,i)=>['walk',i*.1])];
   for(const [key,t] of cases){
    const xml=w.reviewFrame(key,t),png=await sharp(Buffer.from(xml)).png().toBuffer();
    const stats=await sharp(png).stats();assert(stats.channels[3].max>0,'Empty render '+preset.id);
    tiles.push({input:png,left:(tile%12)*160,top:Math.floor(tile/12)*274});
    const label=Buffer.from(`<svg width="160" height="22"><text x="4" y="15" font-size="11">${view} · ${key} · ${t.toFixed(1)}</text></svg>`);
    tiles.push({input:label,left:(tile%12)*160,top:Math.floor(tile/12)*274+252});
    if(view==='front'&&((key==='walk'&&t===.8)||key==='stand-relaxed'))overview.push({input:png,left:(index%10)*320+(key==='walk'?160:0),top:Math.floor(index/10)*274});
    tile++;rendered++;
   }
  }
  await sharp({create:{width:1920,height:Math.ceil(tile/12)*274,channels:4,background:'#f0f3f1'}}).composite(tiles).png().toFile(path.join(out,preset.id+'.png'));
  console.log(`${index+1}/${w.reviewPresets.length} ${preset.id}: ${tile} renders`);
 }
 await sharp({create:{width:3200,height:Math.ceil(w.reviewPresets.length/10)*274,channels:4,background:'#f0f3f1'}}).composite(overview).png().toFile(path.join(out,'all-characters.png'));
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({characters:w.reviewPresets.length,actions:w.reviewActions.length,views:3,standingPoses:4,walkFrames:12,rendered,errors},null,2));
 console.log('PASS',rendered,'raster renders; all presets, poses, three views, and gait continuity');dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exit(1)});
