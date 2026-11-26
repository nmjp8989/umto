(() => {
'use strict';
const logoURL=new URL('little-panth-logo.svg?v=2',document.currentScript.src).href;
const motion=window.LPLogoMotion;
let template=null,loading=null;
function loadLogo(){if(template)return Promise.resolve(template);if(!loading)loading=fetch(logoURL).then(r=>{if(!r.ok)throw Error('Could not load the Little Panth SVG.');return r.text();}).then(svg=>template=motion.build(svg)).catch(e=>{loading=null;throw e;});return loading;}
let context=null,source=null,layer=null;
const seconds=count=>count>0?2.4+1.2*(count-1):0;
async function prepare(){
 const C=window.AudioContext||window.webkitAudioContext;
 if(!C)throw Error('Brand audio is not supported in this browser.');
 if(!context||context.state==='closed')context=new C();
 const resumed=context.resume();
 await Promise.all([resumed,loadLogo()]);
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
 source=context.createBufferSource();source.buffer=b;source.connect(context.destination);source.start();
}
async function play(parent,intro,isActive=()=>true){
 if(!context||context.state!=='running')throw Error('Prepare brand audio before playback.');
 if(!isActive())throw Error('Recording cancelled.');
 const duration=intro?2.4:1.2,ms=duration*1000;
 if(!template)throw Error('Prepare the logo before playback.');
 layer=document.createElement('div');layer.className='lp-brand-layer';
 Object.assign(layer.style,{position:'absolute',width:'100%',height:'100%',maxWidth:'177.7778vh',maxHeight:'56.25vw',inset:'0',margin:'auto',display:'grid',placeItems:'center',overflow:'hidden',background:'#fff',zIndex:'20'});
 const pose=motion.mount(layer,template);pose(0,intro);parent.append(layer);
 try{
  sound(intro,duration);
  const started=performance.now();
  await new Promise((resolve,reject)=>{
   function tick(now){
    if(!isActive()){reject(Error('Recording cancelled.'));return;}
    const p=Math.min(1,(now-started)/ms);pose(p,intro);
    if(p>=1)resolve();else requestAnimationFrame(tick);
   }
   requestAnimationFrame(tick);
  });
  if(!isActive())throw Error('Recording cancelled.');
 }finally{
  layer?.remove();layer=null;
  if(source){try{source.stop();}catch{}source.disconnect();source=null;}
 }
}
function close(){
 layer?.remove();layer=null;
 if(source){try{source.stop();}catch{}source.disconnect();source=null;}
 if(context){context.close().catch(()=>{});context=null;}
}
window.LPBrand={seconds,prepare,play,close};
})();
