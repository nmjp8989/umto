'use strict';
// Mission 008: deterministic motorbike, walking, house investigation and cellar-rescue tests.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Engine=require('../missions/mission-engine.js');
const Runner=require('../missions/sequence-runner.js');
const def=require('../missions/adventures/whispering-village.json');
const previous=require('../missions/adventures/empty-carriage.json');
const voices=require('../voices.json');

assert.equal(def.id,'whispering-village');
assert.equal(def.number,'008');
assert.equal(def.sequelTo,previous.id);
assert.equal(previous.number,'007');
assert.deepEqual(Object.keys(def.scenes),['home','lane','bibi','weaver','well','blue']);
assert(def.dialogues.intro.text.includes('motorbike'));
assert(def.dialogues.intro.text.includes('Kabir'));
assert(def.sequences.rideOut.some(c=>c.pose?.action==='ride'));
assert(def.sequences.rideOut.some(c=>c.effect==='villageRide'));
assert(def.sequences.findKabir.some(c=>c.effect==='villageReveal'));
const allObjects=Object.values(def.scenes).flatMap(s=>s.objects);
for(const [scene,location] of Object.entries(def.scenes)){
  const ids=location.objects.map(o=>o.id);
  assert.equal(new Set(ids).size,ids.length,'Duplicate object in '+scene);
  for(const o of location.objects){
    assert(typeof o.name==='string'&&o.name.length>8);
    assert(o.x>=0&&o.y>=0&&o.x+o.w<=1280&&o.y+o.h<=720,'Offscreen target: '+o.id+' in '+scene);
  }
}
for(const [id,d] of Object.entries(def.dialogues)){
  assert(d.text&&voices[d.speaker],'Dialogue speaker lacks MiMo reference voice: '+id);
  for(const c of d.choices||[])assert(def.rules.some(r=>r.when===c.event),'Unwired dialogue option '+c.event);
}
const validActions=new Set(['flag','unflag','inventory','remove','show','hide','pose','scene','ending','message','sequence','sound','event']);
const knownEvents=new Set(def.rules.map(r=>r.when));
for(const r of def.rules){
  if(r.in)assert(def.scenes[r.in],'Unknown rule location '+r.in);
  if(r.when.startsWith('click:')||r.when.startsWith('drop:')){
    const t=r.when.split(':');
    const objectId=t.at(-1);
    assert(def.scenes[r.in]?.objects.some(o=>o.id===objectId),r.when+' is not tappable in '+r.in);
  }
  for(const action of r.actions){
    const p=action.indexOf(':'),type=action.slice(0,p),id=action.slice(p+1);
    assert(validActions.has(type),'Unsupported action '+action);
    if(type==='message')assert(def.dialogues[id],r.when+' has unknown dialogue '+id);
    if(type==='scene')assert(def.scenes[id],r.when+' has unknown scene '+id);
    if(type==='sequence')assert(def.sequences[id],r.when+' has unknown sequence '+id);
    if(type==='inventory'||type==='remove')assert(def.inventoryItems[id],r.when+' unknown inventory item '+id);
    if(type==='event')assert(knownEvents.has(id),r.when+' missing event '+id);
  }
}
for(const [name,cues] of Object.entries(def.sequences)){
  for(const cue of cues){
    if(cue.line)assert(def.dialogues[cue.line],name+' unknown spoken line '+cue.line);
    if(cue.effect)assert(['villageRide','villageReveal'].includes(cue.effect),'Unknown effect '+cue.effect);
  }
}
const audioFile=path.join(__dirname,'../missions/audio/whispering-village.json');
if(fs.existsSync(audioFile)){
 const manifest=JSON.parse(fs.readFileSync(audioFile,'utf8'));
 assert.equal(manifest.mission,def.id);
 for(const [id,d] of Object.entries(def.dialogues)){
  const clip=manifest.lines[id];
  assert(clip&&clip.text===d.text&&clip.speaker===d.speaker,'Voice/subtitle mismatch '+id);
  assert(clip.src.startsWith('audio/whispering-village/')&&clip.src.endsWith('.mp3'));
  assert(fs.statSync(path.join(__dirname,'../missions',clip.src)).size>1000,'Missing/empty audio clip '+id);
 }
}
function game(){
  const engine=new Engine(def);const effects=[],speech=[],poses=[],screens=[];
  const runner=new Runner({
    camera:()=>{},wait:async()=>{},sound:()=>{},
    pose:p=>poses.push(p),effect:e=>effects.push(e),line:id=>speech.push(id),
    ending:()=>engine.finish()
  });
  async function act(evt){
    const before=engine.state.scene;const result=engine.trigger(evt);
    if(result.ok)for(const action of result.actions){
      const [type,value]=action.split(':');
      if(type==='sequence')await runner.run(def.sequences[value]);
    }
    screens.push([evt,before,engine.state.scene,result.ok]);
    return result;
  }
  return {engine,act,effects,speech,poses,screens};
}
(async()=>{
 for(const alternate of [false,true]){
  const {engine:e,act,effects,speech,poses}=game();
  e.state.started=true;
  assert(!(await act('click:houseBibi')).ok,'Cannot reach houses without riding');
  assert((await act('click:sign')).ok);
  assert((await act('click:bike')).ok);
  assert.equal(e.state.scene,'lane');assert(e.state.flags.villageArrived);
  assert(poses.some(x=>x.action==='ride'));
  assert(effects.includes('villageRide'));
  assert((await act('click:houseBlue')).actions.includes('message:gateLocked'));
  assert(!(await act('passage:cellar')).ok,'Do not bypass the investigation');
  if(alternate){
   await act('click:houseWeaver');
   await act('click:loom');
   await act('click:thread');
   assert(e.state.inventory.includes('thread'));
   await act('click:back');
   await act('click:wellPath');
   await act('click:bell');
   assert((await act('click:crank')).actions.includes('message:crankDark'));
   await act('click:back');
  }
  await act('click:houseBibi');
  await act('click:bibi');
  assert(e.state.flags.spokeBibi);
  await act('click:marks');
  assert(e.state.flags.readMarks);
  await act('click:lantern');
  assert(e.state.inventory.includes('lantern'));
  await act('click:back');
  if(!alternate){
    await act('click:houseWeaver');
    await act('click:shadow');
    await act('click:loom');
    await act('click:thread');
    await act('click:back');
  }
  assert(e.state.flags.examinedLoom);
  assert(e.state.inventory.includes('thread'));
  await act('click:wellPath');
  assert.equal(e.state.scene,'well');
  if(!alternate){
   assert((await act('click:crank')).actions.includes('message:crankDark'));
   await act('click:bell');
  }
  assert(e.state.flags.heardKnocks);
  assert((await act('drop:lantern:well')).ok);
  assert(e.state.flags.sawGlimmer);
  assert((await act('click:crank')).ok);
  assert(e.state.flags.keyFound&&e.state.inventory.includes('key'));
  assert((await act('click:crank')).actions.includes('message:crankAgain'));
  await act('click:back');
  assert((await act('click:bike')).ok,'Return motorbike is available');
  assert.equal(e.state.scene,'home');
  assert((await act('click:bike')).ok,'Can ride back to village');
  assert.equal(e.state.scene,'lane');
  assert((await act('drop:key:houseBlue')).ok);
  assert(e.state.flags.gateOpen&&!e.state.inventory.includes('key'));
  assert(!(await act('drop:key:houseBlue')).ok,'Do not duplicate the key');
  assert((await act('click:houseBlue')).ok);
  assert.equal(e.state.scene,'blue');
  assert((await act('click:cellarLatch')).actions.includes('message:latchStuck'));
  assert(!(await act('passage:cellar')).ok,'Cannot open cellar without thread');
  assert((await act('drop:thread:cellarLatch')).ok);
  assert(e.state.flags.latchClear&&!e.state.inventory.includes('thread'));
  assert((await act('click:cellarLatch')).actions.includes('message:choose'));
  assert((await act('passage:attic')).actions.includes('message:retry'));
  assert((await act('passage:yard')).actions.includes('message:retry'));
  assert(!e.state.complete);
  assert((await act('passage:cellar')).ok);
  assert(e.state.complete&&e.state.flags.kabirFound);
  assert(effects.includes('villageReveal'));
  assert.deepEqual(speech,['findKabir','rescued','lastWhisper','after']);
  assert(!(await act('passage:cellar')).ok,'No double ending');
  e.reset();
  assert(!e.state.complete);
  assert.deepEqual(e.state.inventory,[]);
 }
 console.log('PASS Mission 008: 6 locations, motorcycle both ways, 3 houses, item combos, wrong-choice retries, Kabir rescue, voice refs and reset');
})().catch(err=>{console.error(err);process.exitCode=1;});
