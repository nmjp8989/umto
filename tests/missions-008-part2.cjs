'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Engine=require('../missions/mission-engine.js');
const Runner=require('../missions/sequence-runner.js');
const previous=require('../missions/adventures/whispering-village.json');
const def=require('../missions/adventures/whispering-village-part2.json');
const voices=require('../voices.json');
assert.equal(def.number,'008-II');
assert.equal(def.sequelTo,previous.id);
assert.equal(def.id,'whispering-village-part2');
assert(def.dialogues.intro.text.includes('Kabir'));
assert.deepEqual(Object.keys(def.scenes),['home','stall','yard','shed','platform']);
const sandbox={window:{},DeliveryArt:{defs:'',icons:{}}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../missions/whispering-village-part2-art.js'),'utf8'),sandbox);
const art=sandbox.DeliveryArt;
for(const [scene,location] of Object.entries(def.scenes)){
 assert.equal(typeof art[scene],'function','Missing location artwork: '+scene);
 assert(art[scene]().length>550,'Incomplete art '+scene);
 assert(location.actors.some(x=>x.id==='kabir'),'Kabir must have an animated full-body rig in '+scene);
 assert.equal(new Set(location.objects.map(o=>o.id)).size,location.objects.length,'Duplicate hotspot');
 for(const o of location.objects){
  assert(o.x>=0&&o.y>=0&&o.x+o.w<=1280&&o.y+o.h<=720,'Hotspot off stage '+scene+':'+o.id);
  assert(art.prop(o,{flags:{}}).length>20,'Missing interactive artwork '+o.id);
 }
}
assert(sandbox.window.WhisperingVillagePart2Art?.reveal?.length>300,'Missing cinematic finale');
assert(art.icons.battery?.includes('path')&&art.icons.wire?.includes('path'));
const allRules=new Set(def.rules.map(r=>r.when));
for(const [id,d] of Object.entries(def.dialogues)){
 assert(d.text&&voices[d.speaker],'No voice reference for '+id);
 for(const c of d.choices||[])assert(allRules.has(c.event),'Missing choice event '+c.event);
}
for(const r of def.rules){
 assert(def.scenes[r.in],'Invalid rule scene '+r.when);
 for(const action of r.actions){
  const i=action.indexOf(':'),type=action.slice(0,i),value=action.slice(i+1);
  if(type==='message')assert(def.dialogues[value],'Unknown dialogue '+value);
  if(type==='scene')assert(def.scenes[value],'Unknown scene '+value);
  if(type==='sequence')assert(def.sequences[value],'Unknown sequence '+value);
  if(type==='inventory'||type==='remove')assert(def.inventoryItems[value],'Unknown item '+value);
 }
}
for(const cues of Object.values(def.sequences))for(const cue of cues){
 if(cue.line)assert(def.dialogues[cue.line]);
 if(cue.effect)assert.equal(cue.effect,'villagePart2Reveal');
}
const audio=path.join(__dirname,'../missions/audio/whispering-village-part2.json');
if(fs.existsSync(audio)){
 const manifest=JSON.parse(fs.readFileSync(audio,'utf8'));
 assert.equal(manifest.mission,def.id);
 for(const [id,d] of Object.entries(def.dialogues)){
  const line=manifest.lines[id];
  assert(line&&line.text===d.text&&line.speaker===d.speaker,'Audio mismatch '+id);
  assert(fs.statSync(path.join(__dirname,'../missions',line.src)).size>1000,'Missing MP3 '+id);
 }
}
function game(){
 const e=new Engine(def),lines=[],effects=[];
 const seq=new Runner({camera:()=>{},sound:()=>{},wait:async()=>{},line:id=>lines.push(id),effect:id=>effects.push(id),ending:()=>e.finish()});
 const act=async event=>{
  const result=e.trigger(event);
  for(const a of result.actions){
   const [kind,val]=a.split(':');
   if(kind==='sequence')await seq.run(def.sequences[val]);
  }
  return result;
 };
 return {e,act,lines,effects};
}
(async()=>{
 for(const alternate of [false,true]){
  const {e,act,lines,effects}=game();e.state.started=true;
  assert(!(await act('click:hatch')).ok,'Cannot skip to relay room');
  await act('click:kabir');await act('click:shutter');
  assert(e.state.flags.partnerBriefed&&e.state.flags.heardWindow);
  await act('click:cross');assert.equal(e.state.scene,'stall');
  assert((await act('click:panel')).actions.includes('message:panelDead'));
  await act('click:diagram');await act('click:back');
  if(alternate){
   await act('click:shedPath');
   await act('click:ledger');await act('click:battery');await act('click:back');
   await act('click:yardGate');
   await act('click:tracks');await act('click:wire');await act('click:back');
  }else{
   await act('click:yardGate');
   await act('click:wire');await act('click:tracks');await act('click:back');
   await act('click:shedPath');
   await act('click:battery');await act('click:ledger');await act('click:back');
  }
  assert(e.state.inventory.includes('wire')&&e.state.inventory.includes('battery'));
  assert(e.state.flags.readLedger&&e.state.flags.tracedSteps);
  await act('click:cross');
  assert((await act('drop:wire:panel')).actions.includes('message:wireTooSoon'));
  assert(!e.state.flags.wired);
  assert((await act('click:hatch')).actions.includes('message:doorLocked'));
  assert((await act('drop:battery:panel')).ok);
  assert(e.state.flags.powered&&!e.state.inventory.includes('battery'));
  assert((await act('drop:wire:panel')).ok);
  assert(e.state.flags.wired&&!e.state.inventory.includes('wire'));
  assert((await act('click:hatch')).ok);assert.equal(e.state.scene,'platform');
  assert((await act('click:knocker')).ok);
  assert((await act('click:switch')).actions.includes('message:choose'));
  assert((await act('signal:stop')).actions.includes('message:retry'));
  assert((await act('signal:wrong')).actions.includes('message:retry'));
  assert(!e.state.complete,'Wrong knock never completes the case');
  assert((await act('signal:open')).ok);
  assert(e.state.complete&&e.state.flags.rescuedCaretaker);
  assert.deepEqual(lines,['reveal','caretaker','explanation','final','closing']);
  assert.deepEqual(effects,['villagePart2Reveal']);
  assert(!(await act('signal:open')).ok,'Cannot complete twice');
  e.reset();assert(!e.state.complete);assert.equal(Object.keys(e.state.flags).length,0);
 }
 console.log('PASS Village Part 2: five scenes, full-body Kabir, two investigation orders, inventory, signal choices, voice and ending');
})().catch(e=>{console.error(e);process.exitCode=1;});
