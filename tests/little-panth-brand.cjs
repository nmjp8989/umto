const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const sandbox={};
vm.runInNewContext(fs.readFileSync('little panth/brand-motion.js','utf8'),sandbox);
const api=sandbox.LPLogoMotion;
const logo=fs.readFileSync('little panth/little-panth-logo.svg','utf8');
const template=api.build(logo);
assert.match(template,/viewBox="0 0 928 522"/);
assert.match(template,/patkaPink/);
assert.match(template,/patkaBlue/);
for(let i=0;i<11;i++)assert.match(template,new RegExp('data-motion="l'+i+'"'));
for(const id of ['k0','k1','s','r0','r1','r2'])assert.ok(template.includes('data-motion="'+id+'"'));
for(const intro of [true,false]){
 const t=api.timing(intro);
 assert.equal(t.duration,intro?4.5:3);
 assert.ok(t.duration-t.fade-t.animation>=1.3);
 assert.equal(api.progressAt(0,intro),0);
 assert.equal(api.progressAt(t.duration,intro),1);
 assert.equal(api.progressAt(t.animation,intro),.78);
 assert.equal(api.progressAt(t.duration-t.fade,intro),.78);
 assert.ok(t.voiceAt+1.9<t.duration);
 const initial=api.poses(0,intro),early=api.poses(.09,intro),settled=api.poses(.875,intro),last=api.poses(1,intro);
 for(let i=0;i<11;i++){assert.equal(initial['l'+i].opacity,0);assert.equal(settled['l'+i].opacity,1);}
 assert.ok(early.l0.opacity>early.l10.opacity);
 assert.equal(initial.k0.opacity,0);assert.equal(settled.k0.opacity,1);assert.equal(settled.k1.opacity,1);
 assert.equal(last.all.opacity,0);
 // All paths, including both children's nods, have completely settled before
 // the video fade. The preview preserves exactly that pose at its endpoint.
 const holdStart=api.poses(.78,intro),held=api.poses(1,intro,true);
 assert.equal(holdStart.all.opacity,1);
 assert.equal(held.all.opacity,1);
 for(const key of Object.keys(held)){
  assert.equal(holdStart[key].transform,'',key+' must settle before fade');
  assert.equal(held[key].transform,holdStart[key].transform);
  assert.equal(held[key].opacity,holdStart[key].opacity);
 }
 assert.equal(api.frame(template,1,intro,true),api.frame(template,.78,intro,true));
 const frame=api.frame(template,.45,intro);
 assert.ok(!frame.includes('data-motion='));
 assert.ok(!frame.includes('NaN'));
 assert.ok(!frame.includes('undefined'));
 assert.notEqual(frame,api.frame(template,.75,intro));
}
console.log('PASS supplied vector, independently animated letters, kids, swoosh, rays, deterministic frames, stable final pose, preview hold and video fade');
