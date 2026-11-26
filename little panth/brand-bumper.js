(() => {
'use strict';
const logoURL=new URL('little-panth-logo.svg?v=2',document.currentScript.src).href;
const motion=window.LPLogoMotion;
let template=null,loading=null;
function loadLogo(){if(template)return Promise.resolve(template);if(!loading)loading=fetch(logoURL).then(r=>{if(!r.ok)throw Error('Could not load the Little Panth SVG.');return r.text();}).then(svg=>template=motion.build(svg)).catch(e=>{loading=null;throw e;});return loading;}
const voiceURL=new URL('brand-voice.mp3?v=1',document.currentScript.src).href;
let context=null,source=null,voiceSource=null,voiceBuffer=null,layer=null;
let voiceBytes=null;
async function loadVoice(){
 if(!voiceBytes){
  const r=await fetch(voiceURL,{cache:'no-cache'});
  if(!r.ok)return null;
  voiceBytes=await r.arrayBuffer();
 }
 return context.decodeAudioData(voiceBytes.slice(0));
}
const previewMounts=new WeakMap();
function previewPose(parent){
 let entry=previewMounts.get(parent);
 if(!entry||entry.svg.parentNode!==parent){
  const pose=motion.mount(parent,template);
  entry={pose,svg:parent.querySelector('svg')};previewMounts.set(parent,entry);
 }
 return entry.pose;
}
async function showStill(parent){await loadLogo();previewPose(parent)(1,true,true);}
const seconds=count=>count>0?motion.timing(true).duration+motion.timing(false).duration*(count-1):0;
async function prepare(){
 const C=window.AudioContext||window.webkitAudioContext;
 if(!C)throw Error('Brand audio is not supported in this browser.');
 if(!context||context.state==='closed')context=new C();
 const resumed=context.resume();
 await Promise.all([resumed,loadLogo()]);
 voiceBuffer=await loadVoice().catch(()=>null);
 if(context.state!=='running')throw Error('Brand audio could not start.');
}
function sound(intro,duration){
 const rate=context.sampleRate,b=context.createBuffer(1,Math.round(rate*duration),rate),data=b.getChannelData(0);
 const notes=intro?[[.19,659.25],[.34,880],[.50,1046.5]]:[[.17,783.99],[.32,1046.5]];
 let random=2157,smooth=0;
 for(let i=0;i<data.length;i++){
  const t=i/rate;
  random=(Math.imul(1664525,random)+1013904223)>>>0;
  smooth=.94*smooth+.06*(random/4294967296*2-1);
  const u=t/.42;
  let v=u<1?.10*smooth*Math.sin(Math.PI*u)**2:0;
  for(const [start,hz] of notes){
   const d=t-start;
   if(d>=0&&d<.72)v+=.12*Math.min(1,d/.008)*Math.exp(-6*d)*Math.min(1,(.72-d)/.08)*(Math.sin(2*Math.PI*hz*d)+.22*Math.sin(2*Math.PI*hz*2.01*d));
  }
  data[i]=v*Math.min(1,Math.max(0,(duration-t)/.06));
 }
 source=context.createBufferSource();source.buffer=b;source.connect(context.destination);
 const at=context.currentTime+.025;
 source.start(at);
 if(voiceBuffer){
  voiceSource=context.createBufferSource();voiceSource.buffer=voiceBuffer;
  const gain=context.createGain();gain.gain.value=.90;voiceSource.connect(gain);gain.connect(context.destination);
  voiceSource.start(at+motion.timing(intro).voiceAt);
 }
}
async function play(parent,intro,isActive=()=>true,{hold=false}={}){
 if(!context||context.state!=='running')throw Error('Prepare brand audio before playback.');
 if(!isActive())throw Error('Recording cancelled.');
 const duration=motion.timing(intro).duration,ms=duration*1000;
 if(!template)throw Error('Prepare the logo before playback.');
 // The preview reuses the same inline SVG before, during and after playback.
 // Recording retains its original full-screen overlay and white fade to the story.
 let pose;
 if(hold){
  pose=previewPose(parent);pose(0,intro,true);
 }else{
  layer=document.createElement('div');layer.className='lp-brand-layer';
  Object.assign(layer.style,{position:'absolute',width:'100%',height:'100%',maxWidth:'177.7778vh',maxHeight:'56.25vw',inset:'0',margin:'auto',display:'grid',placeItems:'center',overflow:'hidden',background:'#fff',zIndex:'20'});
  pose=motion.mount(layer,template);pose(0,intro);parent.append(layer);
 }
 try{
  sound(intro,duration);
  const started=performance.now();
  await new Promise((resolve,reject)=>{
   function tick(now){
    if(!isActive()){reject(Error('Recording cancelled.'));return;}
    const elapsed=Math.min(duration,(now-started)/1000);pose(motion.progressAt(elapsed,intro),intro,hold);
    if(elapsed>=duration)resolve();else requestAnimationFrame(tick);
   }
   requestAnimationFrame(tick);
  });
  if(!isActive())throw Error('Recording cancelled.');
 }finally{
  if(hold)pose(1,intro,true);
  else{layer?.remove();layer=null;}
  if(source){try{source.stop();}catch{}source.disconnect();source=null;}
  if(voiceSource){try{voiceSource.stop();}catch{}voiceSource.disconnect();voiceSource=null;}
 }
}
function close(){
 layer?.remove();layer=null;
 if(source){try{source.stop();}catch{}source.disconnect();source=null;}
 if(voiceSource){try{voiceSource.stop();}catch{}voiceSource.disconnect();voiceSource=null;}
 if(context){context.close().catch(()=>{});context=null;}
 voiceBuffer=null;
}
window.LPBrand={seconds,prepare,play,close,showStill,hasVoice:()=>Boolean(voiceBuffer)};
})();
