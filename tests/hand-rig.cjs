'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const code=html.slice(html.indexOf('const HAND_POSES='),html.indexOf('function applyFraming()'));
const ctx={state:{},catalogs:{},rigDetail:()=>''};
vm.runInNewContext(code+';globalThis.draw=actionHandSvg;globalThis.poses=HAND_POSES',ctx);
assert.equal(new Set(Object.values(ctx.poses).map(p=>p.d)).size,9);
for(const pose of Object.keys(ctx.poses)){
 for(const [surface,width] of Object.entries({back:1,palm:-1,up:-1,edge:.76})){
  const svg=ctx.draw(pose,surface);
  assert(svg.includes('scale('+width+' 1)'));
  assert(svg.includes(ctx.poses[pose].d));
  assert(!/NaN|undefined/.test(svg));
 }
}
assert.equal(ctx.draw('unknown'),ctx.draw('relaxed'));
console.log('PASS: nine distinct hand outlines with side-correct palm and back orientation');
