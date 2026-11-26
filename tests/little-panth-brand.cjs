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
 const initial=api.poses(0,intro),early=api.poses(.09,intro),settled=api.poses(.875,intro),last=api.poses(1,intro);
 for(let i=0;i<11;i++){assert.equal(initial['l'+i].opacity,0);assert.equal(settled['l'+i].opacity,1);}
 assert.ok(early.l0.opacity>early.l10.opacity);
 assert.equal(initial.k0.opacity,0);assert.equal(settled.k0.opacity,1);assert.equal(settled.k1.opacity,1);
 assert.equal(last.all.opacity,0);
 const frame=api.frame(template,.45,intro);
 assert.ok(!frame.includes('data-motion='));
 assert.ok(!frame.includes('NaN'));
 assert.ok(!frame.includes('undefined'));
 assert.notEqual(frame,api.frame(template,.75,intro));
}
console.log('PASS supplied vector, independently animated letters, kids, swoosh, rays, deterministic frames and fade');
