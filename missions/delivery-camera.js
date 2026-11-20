/* Shared cinematic camera for UMTO and Little Panth: SVG and optional Three.js. */
(function(root){
'use strict';
const W=1280,H=720,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),num=(v,d)=>Number.isFinite(v)?v:d;
const widths=Object.freeze({wide:1280,'extreme-wide':1280,establishing:1280,full:1120,medium:760,'medium-close':600,'close-up':480,'extreme-close-up':300,'two-shot':1000,'over-the-shoulder':760,pov:900,detail:700,conversation:900,follow:1120,arrival:1060,intro:1190});
const angles=Object.freeze(['eye-level','high','low','birds-eye','worms-eye','dutch','over-the-shoulder','pov']);
function box(cx,cy,width){width=clamp(num(width,W),180,W);const h=width*H/W;return [clamp(num(cx,640)-width/2,0,W-width),clamp(num(cy,360)-h/2,0,H-h),width,h];}
function preset(name,focus){focus=focus||{x:640,y:360};if(name==='arrival')return box(650,365,1060);if(name==='intro')return box(560,370,1190);if(name==='follow')return box(focus.x,365,1120);return box(focus.x,focus.y,widths[name]||W);}
function framing(name,focus,options={}){return Number.isFinite(options.width)?box(focus?.x,focus?.y,options.width):preset(name,focus);}
const ease=t=>t*t*(3-2*t),mix=(a,b,t)=>a+(b-a)*t;
class DeliveryCamera{
 constructor(svg){this.svg=svg;this.current=preset('wide');this.from=[...this.current];this.target=[...this.current];this.mode='auto';this.name='wide';this.started=0;this.elapsed=0;this.duration=0;this.last=null;this.roll=0;this.fromRoll=0;this.targetRoll=0;this.track=null;this.parallax=false;}
 reduced(){return !!this.reduceMotion||!!root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;}
 to(name,focus,instant=false,options={}){
  if(this.mode==='wide'){name='wide';options={};}
  if(this.mode==='follow'&&name!=='wide'){name='follow';options={};}
  if(!Object.prototype.hasOwnProperty.call(widths,name))name='wide';
  const reduced=this.reduced();
  this.name=name;this.from=[...this.current];this.fromRoll=this.roll;this.motion=options.motion||'static';this.angle=angles.includes(options.angle)?options.angle:'eye-level';
  this.track=this.motion==='tracking'?options.track||'harpreet':null;
  this.parallax=!!options.parallax&&!reduced;
  this.target=framing(name,focus,options);this.targetRoll=reduced?0:clamp(num(options.roll,this.angle==='dutch'?6:0),-10,10);
  this.started=root.performance.now();this.last=this.started;this.elapsed=0;this.duration=instant||reduced?0:clamp(num(options.duration,650),0,60000);
  Object.assign(this.svg.dataset,{cameraPreset:name,cameraAngle:this.angle,cameraMotion:this.motion});
  if(!this.duration)this.update(this.started,null,false);
 }
 cue(cue,focus,instant=false){if(typeof cue==='string')cue={preset:cue};cue=cue||{};this.to(cue.preset||'wide',cue.focus||focus,instant||cue.cut===true,cue);}
 update(now,hero,paused){
  const dt=this.last===null?0:Math.max(0,now-this.last);this.last=now;if(paused)return;
  const reduced=this.reduced();
  if((this.mode==='follow'||this.track)&&hero&&!reduced){
   this.svg.dataset.cameraPreset=this.mode==='follow'?'follow':this.name;
   const target=this.mode==='follow'?preset('follow',hero):box(hero.x,hero.y-(hero.height||0)*.55,this.target[2]);
   const t=1-Math.exp(-Math.min(dt,100)/125);this.current=this.current.map((v,i)=>mix(v,target[i],t));this.roll=mix(this.roll,this.targetRoll,t);
  }else{
   this.elapsed+=dt;const t=reduced||!this.duration?1:ease(clamp(this.elapsed/this.duration,0,1));
   this.current=this.from.map((v,i)=>mix(v,this.target[i],t));this.roll=reduced?0:mix(this.fromRoll,this.targetRoll,t);
  }
  this.svg.setAttribute('viewBox',this.current.map(x=>x.toFixed(3)).join(' '));
  if(this.svg.style){this.svg.style.transformOrigin='center';this.svg.style.transform=this.roll?'scale('+(1+Math.abs(this.roll)*.023)+') rotate('+this.roll+'deg)':'';}
  // Only dedicated, noninteractive wrappers with overscan should be marked.
  if(this.svg.querySelectorAll)for(const layer of this.svg.querySelectorAll('[data-camera-depth]')){
   const depth=clamp(Number(layer.dataset.cameraDepth)||0,-1,1),offset=this.parallax&&!reduced?(this.current[0]+this.current[2]/2-640)*depth*.22:0;
   if(offset)layer.setAttribute('transform','translate('+offset.toFixed(2)+' 0)');else layer.removeAttribute('transform');
  }
 }
}
// True y-up camera geometry for future Three.js scenes (not SVG perspective distortion).
function spatialPose({target={x:0,y:1,z:0},distance=5,azimuth=0,angle='eye-level',elevation,roll}={}){
 const pitches={'eye-level':0,high:35,low:-22,'birds-eye':89,'worms-eye':-75,dutch:0,'over-the-shoulder':8,pov:0};
 const rad=Math.PI/180,p=clamp(num(elevation,pitches[angle]||0),-89,89)*rad,a=num(azimuth,0)*rad,d=Math.max(.1,num(distance,5));
 const t={x:num(target.x,0),y:num(target.y,1),z:num(target.z,0)};
 return {target:t,position:{x:t.x+d*Math.cos(p)*Math.sin(a),y:t.y+d*Math.sin(p),z:t.z+d*Math.cos(p)*Math.cos(a)},roll:num(roll,angle==='dutch'?6:0)*rad};
}
class SpatialCamera{
 constructor(camera){this.camera=camera;}
 apply(pose){const c=this.camera;c.position.set(pose.position.x,pose.position.y,pose.position.z);c.up.set(0,1,0);c.lookAt(pose.target.x,pose.target.y,pose.target.z);if(pose.roll)c.rotateZ(pose.roll);}
 interpolate(from,to,t){t=ease(clamp(t,0,1));const blend=(a,b)=>({x:mix(a.x,b.x,t),y:mix(a.y,b.y,t),z:mix(a.z,b.z,t)});this.apply({position:blend(from.position,to.position),target:blend(from.target,to.target),roll:mix(from.roll||0,to.roll||0,t)});}
}
root.DeliveryCamera=DeliveryCamera;root.UmtoCamera={DeliveryCamera,SpatialCamera,spatialPose,preset,framing,box,widths,angles};
if(typeof module!=='undefined'&&module.exports)module.exports=root.UmtoCamera;
})(typeof window!=='undefined'?window:globalThis);
