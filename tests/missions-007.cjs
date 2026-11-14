'use strict';
// Mission 007 is a direct sequel to the train-arrival ending of Mission 005.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Engine=require('../missions/mission-engine.js');
const Runner=require('../missions/sequence-runner.js');
const def=require('../missions/adventures/empty-carriage.json');
const previous=require('../missions/adventures/night-platform.json');
const voices=require('../voices.json');

assert.equal(previous.number,'005');
assert.equal(previous.dialogues.ticket.text.includes('North Bridge'),true,'Mission 005 should establish Kabir’s destination');
assert.equal(def.number,'007');
assert.equal(def.sequelTo,previous.id);
assert.equal(def.startScene,'home');
assert.equal(def.finalScene,'platform');
assert.equal(Object.keys(def.scenes).length,3);
assert(def.dialogues.intro.text.includes('blue signal'),'Must follow the 005 blue-signal finale');
assert(def.dialogues.intro.text.includes('Kabir'));
for(const [id,d] of Object.entries(def.dialogues)){
  assert(d.text&&voices[d.speaker],id+' must have subtitles and an assigned voice');
  for(const c of d.choices||[])assert(def.rules.some(r=>r.when===c.event),'No rule for choice '+c.event);
}
for(const r of def.rules){
  if(r.in)assert(def.scenes[r.in],r.when+' bad scene');
  for(const action of r.actions){
    const [type,id]=action.split(':');
    if(type==='message')assert(def.dialogues[id],r.when+' missing dialogue '+id);
    if(type==='scene')assert(def.scenes[id],r.when+' missing destination '+id);
    if(type==='sequence')assert(def.sequences[id],r.when+' missing sequence '+id);
  }
}
for(const sequence of Object.values(def.sequences)){
  for(const cue of sequence){
    if(cue.line)assert(def.dialogues[cue.line],'Missing line in cutscene');
    if(cue.effect)assert.equal(cue.effect,'bridgeRescue');
  }
}
// Generated clips are checked once present: CI can run before the voice workflow.
const audioPath=path.join(__dirname,'../missions/audio/empty-carriage.json');
if(fs.existsSync(audioPath)){
  const manifest=JSON.parse(fs.readFileSync(audioPath,'utf8'));
  assert.equal(manifest.mission,def.id);
  for(const [id,d] of Object.entries(def.dialogues)){
    const clip=manifest.lines[id];
    assert(clip&&clip.text===d.text&&clip.speaker===d.speaker,'Voice/subtitle mismatch '+id);
    assert(clip.src.startsWith('audio/empty-carriage/'),'Bad voice path');
    assert(fs.existsSync(path.join(__dirname,'../missions',clip.src)),'Missing MP3 '+id);
  }
}

function game(){
  const e=new Engine(def),heard=[],effects=[],views=[];
  const runner=new Runner({camera:()=>{},sound:()=>{},wait:async()=>{},
    effect:async id=>effects.push(id),line:async id=>heard.push(id),ending:()=>e.finish()});
  const act=async event=>{
    const result=e.trigger(event);
    for(const action of result.actions){
      const [kind,val]=action.split(':');
      if(kind==='sequence')await runner.run(def.sequences[val]);
      if(kind==='ending')e.finish();
    }
    views.push({event,scene:e.state.scene,flags:{...e.state.flags},inventory:[...e.state.inventory]});
    return result;
  };
  return {e,act,heard,effects,views};
}
(async()=>{
  for(const cluesFirst of [true,false]){
    const {e,act,heard,effects}=game();
    e.state.started=true;
    if(cluesFirst){await act('click:notice');await act('click:meena');}
    await act('click:cross');assert.equal(e.state.scene,'stall');
    await act('click:platform');assert.equal(e.state.scene,'platform');
    assert((await act('click:lever')).actions.includes('message:dead'));
    assert(!(await act('time:0017')).ok,'Do not bypass the mystery');
    await act('click:cabin');
    assert.equal(e.state.scene,'stall');
    assert((await act('click:token')).ok);
    assert(e.state.inventory.includes('token'));
    await act('click:platform');
    assert((await act('drop:token:panel')).ok);
    assert(e.state.flags.unlocked);
    assert(!e.state.inventory.includes('token'));
    assert(!(await act('drop:token:panel')).ok,'Prevent duplicate token use');
    if(!cluesFirst)assert((await act('click:lever')).actions.includes('message:unknown'));
    await act('click:cabin');
    assert((await act('click:note')).ok);
    assert(e.state.flags.readNote);
    assert((await act('click:note')).actions.includes('message:noteAgain'));
    if(!cluesFirst){
      await act('click:back');await act('click:meena');await act('click:notice');
      await act('click:cross');
    }
    await act('click:platform');
    assert((await act('click:lever')).actions.includes('message:choose'));
    assert((await act('time:0012')).actions.includes('message:retry'));
    assert((await act('time:0021')).actions.includes('message:retry'));
    assert(!e.state.complete,'Wrong time must not end the game');
    assert((await act('time:0017')).ok,'Correct 00:17 must work');
    assert(e.state.complete && e.state.flags.rescued,'Rescue failed');
    assert(effects.includes('bridgeRescue'));
    assert.deepEqual(heard,['rescue','relief','epilogue']);
    assert(!(await act('time:0017')).ok,'Do not replay completed ending via event');
    e.reset();
    assert(!e.state.complete);
    assert.deepEqual(e.state.flags,{});
    assert.deepEqual(e.state.inventory,[]);
  }
  console.log('PASS Mission 007 sequel: all clues in both orders, token, 00:17 puzzle, wrong-choice retries, voices, rescue finale, reset');
})().catch(error=>{console.error(error);process.exitCode=1;});
