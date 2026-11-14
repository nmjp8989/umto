'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Engine=require('../missions/mission-engine.js');
const Runner=require('../missions/sequence-runner.js');
const def=require('../missions/adventures/sky-carnival.json');
const voices=require('../voices.json');
assert.equal(def.id,'sky-carnival');
assert.equal(def.number,'009');
assert.deepEqual(Object.keys(def.scenes),['fairground','workshop','launchpad','skydeck']);
const sandbox={window:{},DeliveryArt:{icons:{}}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../missions/sky-carnival-art.js'),'utf8'),sandbox);
for(const [id,scene] of Object.entries(def.scenes)){
 assert.equal(typeof sandbox.DeliveryArt[id],'function','Missing art '+id);
 assert(sandbox.DeliveryArt[id]().length>900,'Incomplete illustrated location '+id);
 assert.equal(new Set(scene.objects.map(o=>o.id)).size,scene.objects.length,'Duplicate target '+id);
 for(const o of scene.objects){
  assert(o.x>=0&&o.y>=0&&o.x+o.w<=1280&&o.y+o.h<=720,'Hotspot off stage '+id+'/'+o.id);
  assert(sandbox.DeliveryArt.prop(o,{flags:{}}).length>20,'Missing art '+id+'/'+o.id);
 }
}
assert(sandbox.window.SkyCarnivalArt.reveal.length>300,'Missing confetti and cake rescue finale');
const ruleEvents=new Set(def.rules.map(r=>r.when));
for(const [id,d] of Object.entries(def.dialogues)){
 assert(d.text&&voices[d.speaker],'Missing dialogue voice for '+id);
 for(const choice of d.choices||[])assert(ruleEvents.has(choice.event),'Missing dialogue event '+id+'/'+choice.event);
}
for(const rule of def.rules){
 assert(def.scenes[rule.in],'Unknown scene in '+rule.when);
 for(const action of rule.actions){
  const idx=action.indexOf(':'),kind=action.slice(0,idx),arg=action.slice(idx+1);
  if(kind==='message')assert(def.dialogues[arg],'Missing message '+arg);
  if(kind==='scene')assert(def.scenes[arg],'Missing scene '+arg);
  if(kind==='sequence')assert(def.sequences[arg],'Missing sequence '+arg);
  if(kind==='inventory'||kind==='remove')assert(def.inventoryItems[arg],'Missing inventory item '+arg);
 }
}
for(const cues of Object.values(def.sequences))for(const cue of cues){
 if(cue.line)assert(def.dialogues[cue.line]);
 if(cue.event)assert(ruleEvents.has(cue.event),'Missing cue event '+cue.event);
 if(cue.effect)assert.equal(cue.effect,'skyCarnivalFinale');
}
const html=fs.readFileSync(path.join(__dirname,'../missions/sky-carnival.html'),'utf8');
assert(html.includes('data-mission="sky-carnival"'));
assert(html.includes('cast=sky-carnival')&&html.includes('sky-carnival-art.js'));
assert(fs.readFileSync(path.join(__dirname,'../missions/index.html'),'utf8').includes('href="sky-carnival.html"'));
async function play(wrongFirst){
 const e=new Engine(def),spoken=[],effects=[];
 let runner;
 const act=async event=>{
  const result=e.trigger(event);
  for(const action of result.actions){
   const idx=action.indexOf(':'),type=action.slice(0,idx),arg=action.slice(idx+1);
   if(type==='sequence')await runner.run(def.sequences[arg]);
   if(type==='event')await act(arg);
  }
  return result;
 };
 runner=new Runner({camera:()=>{},sound:()=>{},wait:async()=>{},line:id=>spoken.push(id),
  event:act,effect:id=>effects.push(id),ending:()=>{e.state.ending=true;e.finish()}});
 e.state.started=true;
 assert.equal(e.state.scene,'fairground');
 assert((await act('click:goPad')).actions.includes('message:needParts'));
 await act('click:banner');await act('click:kabir');await act('click:meher');await act('click:baldev');
 await act('click:goWorkshop');assert.equal(e.state.scene,'workshop');
 await act('click:meena');await act('click:rohan');
 if(wrongFirst){await act('click:fan');await act('fan:storm');assert(!e.has('fanFixed'));}
 await act('click:fabric');await act('click:rope');await act('fan:gentle');
 assert(e.has('inventory.fabric+inventory.rope+fanFixed'));
 await act('click:pad');assert.equal(e.state.scene,'launchpad');
 assert(!(await act('click:board')).ok,'Cannot take off before equipment is attached');
 await act('drop:fabric:balloon');await act('drop:rope:balloon');
 assert(e.has('patched+tethered+!inventory.fabric+!inventory.rope'));
 if(wrongFirst){await act('wind:west');assert(!e.has('windEast'));}
 await act('wind:east');
 await act('click:board');assert.equal(e.state.scene,'skydeck');
 assert((await act('click:land')).actions.includes('message:needCake'));
 if(wrongFirst){await act('catch:jump');assert(!e.has('cakeCaught'));}
 await act('catch:rope');assert(e.has('cakeCaught'));
 await act('click:land');assert(e.state.complete,'Mission should finish');
 assert(spoken.includes('skyIntro')&&spoken.includes('finalKabir'),'Voice dialogue/cinematic ending should run');
 assert(effects.includes('skyCarnivalFinale'));
}
Promise.all([play(false),play(true)]).then(()=>console.log('Mission 009: bright rescue art, voices, wrong-answer retries, all 4 locations and completion OK')).catch(e=>{console.error(e);process.exitCode=1;});
