const assert=require('node:assert/strict');
const {preset,framing,DeliveryCamera,spatialPose,SpatialCamera,widths}=require('../missions/delivery-camera.js');
for(const name of Object.keys(widths))for(const f of [null,{x:0,y:0},{x:1280,y:720},{x:600,y:400}]){
 const [x,y,w,h]=preset(name,f);assert(x>=0&&y>=0&&x+w<=1280.001&&y+h<=720.001);assert(Math.abs(w/h-16/9)<1e-8);
}
assert(framing('close-up',{x:600,y:400})[2]<framing('medium',{x:600,y:400})[2]);
const svg={dataset:{},style:{},setAttribute(k,v){this[k]=v;},querySelectorAll(){return[];}};
const cam=new DeliveryCamera(svg);cam.cue({preset:'close-up',angle:'dutch',cut:true},{x:640,y:360});
assert.equal(cam.current[2],480);assert.match(svg.style.transform,/rotate/);
cam.cue({preset:'wide',duration:1000});cam.update(cam.started+500,null,false);
assert(cam.current[2]>480&&cam.current[2]<1280);const hold=[...cam.current];cam.update(cam.started+1000,null,true);assert.deepEqual(cam.current,hold);cam.update(cam.started+1500,null,false);assert.equal(cam.current[2],1280);assert.equal(svg.style.transform,'');
cam.reduceMotion=true;cam.cue({preset:'close-up',angle:'dutch'});assert.equal(cam.roll,0);
cam.mode='wide';cam.cue({preset:'close-up'});assert.equal(cam.current[2],1280);
assert(spatialPose({angle:'high'}).position.y>1);assert(spatialPose({angle:'low'}).position.y<1);assert(spatialPose({angle:'birds-eye'}).position.y>5);
let roll;new SpatialCamera({position:{set(){}},up:{set(){}},lookAt(){},rotateZ(v){roll=v;}}).apply(spatialPose({angle:'dutch'}));assert(roll>0);
console.log('PASS cinematic camera framing, pause, reduced motion and spatial geometry');
