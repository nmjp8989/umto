'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const code=html.slice(html.indexOf('const HAND_POSES='),html.indexOf('function applyFraming()'));
const ctx={state:{},catalogs:{},BODY_RIG:{forearm:228}};
vm.runInNewContext(code+';globalThis.draw=handSurface;globalThis.poses=HAND_POSES',ctx);
assert.equal(new Set(Object.values(ctx.poses).map(p=>p.edge)).size,Object.keys(ctx.poses).length);
for(const pose of Object.keys(ctx.poses)){
 for(const [surface,width] of Object.entries({back:1,palm:-1,up:-1,edge:.78})){
  for(const bend of [-85,0,60]){
   const hand=ctx.draw(pose,surface,bend);
   assert.equal(hand.width,width);
   assert(hand.d.startsWith('M-26 0 '));
   if(pose!=='relaxed'||surface!=='edge')assert(hand.d.includes(ctx.poses[pose].edge));
   assert(!/NaN|undefined|Infinity/.test(hand.d));
   assert.equal((hand.d.match(/M/g)||[]).length,pose==='okay'?2:1,'Only the OK sign has an interior hole');
  }
 }
}
assert.notEqual(ctx.draw('relaxed','edge',0).lines,ctx.draw('relaxed','back',0).lines);
assert.deepEqual(ctx.draw('unknown','back',0),ctx.draw('relaxed','back',0));
console.log('PASS: wrist-to-fingertip contours and handedness for every gesture');
