'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Engine=require('../missions/mission-engine.js');
const def=require('../missions/adventures/midnight-math-vault.json');
const voices=require('../voices.json');
assert.equal(def.number,'010');
assert.equal(def.id,'midnight-math-vault');
assert.deepEqual(Object.keys(def.scenes),['courtyard','hallway','classroom','vault']);
assert.deepEqual(Object.keys(def.puzzles),['rounding','pattern','array','fractions','perimeter']);
assert.equal(def.puzzles.rounding.correct,3500);
assert.equal(def.puzzles.pattern.correct,36);
assert.equal(def.puzzles.array.rows*def.puzzles.array.cols,56);
assert.equal(def.puzzles.array.correct,56);
assert.equal(def.puzzles.fractions.total*def.puzzles.fractions.numerator/def.puzzles.fractions.denominator,9);
assert.equal(2*(def.puzzles.perimeter.length+def.puzzles.perimeter.width),24);
const src=fs.readFileSync(path.join(__dirname,'../missions/midnight-math-vault-art.js'),'utf8');
const sandbox={window:{},DeliveryArt:{icons:{}}};
vm.runInNewContext(src,sandbox);
for(const [id,s] of Object.entries(def.scenes)){
 assert.equal(typeof sandbox.DeliveryArt[id],'function','Missing SVG art '+id);
 assert(sandbox.DeliveryArt[id]().length>1700,'Scene needs a full illustration: '+id);
 const ids=s.objects.map(o=>o.id);
 assert.equal(new Set(ids).size,ids.length,'Duplicate hotspots '+id);
 for(const o of s.objects){
  assert(o.x>=0&&o.y>=0&&o.x+o.w<=1280&&o.y+o.h<=720,id+'/'+o.id+' is off stage');
  assert(sandbox.DeliveryArt.prop(o,{flags:{}}).length>30,'No object graphic '+o.id);
 }
}
assert(sandbox.window.MathVaultArt.reveal.includes('CASE CLOSED!'));
const events=new Set(def.rules.map(r=>r.when));
for(const [id,d] of Object.entries(def.dialogues)){
 assert(d.text&&voices[d.speaker],'Missing voice reference '+id);
 if(d.puzzle)assert(def.puzzles[d.puzzle],'Unknown puzzle '+id);
 for(const c of d.choices||[])assert(events.has(c.event),'Unknown event '+c.event);
}
for(const rule of def.rules){
 assert(def.scenes[rule.in],'Unknown scene '+rule.in);
 for(const action of rule.actions){
  const k=action.split(':')[0],v=action.slice(k.length+1);
  if(k==='message')assert(def.dialogues[v],'Unknown message '+v);
  if(k==='scene')assert(def.scenes[v],'Unknown destination '+v);
  if(k==='sequence')assert(def.sequences[v],'Unknown sequence '+v);
 }
}
assert(def.sequences.finale.some(x=>x.ending===true),'Missing ending');
const html=fs.readFileSync(path.join(__dirname,'../missions/midnight-math-vault.html'),'utf8');
const index=fs.readFileSync(path.join(__dirname,'../missions/index.html'),'utf8');
assert(html.includes('id="mathGame"')&&html.includes('midnight-math-vault-puzzles.js'));
assert(index.includes('href="midnight-math-vault.html"'));
const puzzleUI=fs.readFileSync(path.join(__dirname,'../missions/midnight-math-vault-puzzles.js'),'utf8');
assert(puzzleUI.includes('answer!==puzzle.correct')&&puzzleUI.includes('showModal()'));
assert(puzzleUI.includes('MathQuest')===false);
function run(){
 const engine=new Engine(def),act=e=>engine.trigger(e);
 assert.equal(engine.state.scene,'courtyard');
 assert(act('click:gate').actions.includes('message:gateQuestion'));
 assert.equal(engine.state.scene,'courtyard');
 act('solve:rounding');
 assert(engine.has('rounded'));
 act('click:gate');
 assert.equal(engine.state.scene,'hallway');
 assert(act('click:door').actions.includes('message:needHallway'));
 act('solve:pattern');
 assert(act('click:door').actions.includes('message:needHallway'));
 act('solve:array');
 act('click:door');
 assert.equal(engine.state.scene,'classroom');
 assert(act('click:vaultDoor').actions.includes('message:needLab'));
 act('solve:fractions');
 assert(act('click:vaultDoor').actions.includes('message:needLab'));
 act('solve:perimeter');
 act('click:vaultDoor');
 assert.equal(engine.state.scene,'vault');
 const result=act('click:capsule');
 assert(result.actions.includes('sequence:finale'));
 assert(engine.has('rounded+patternDone+arrayDone+fractionsDone+perimeterDone'));
}
run();
console.log('Mission 010: 5 Grade 4 mini-games, 4 illustrated locations, guarded locks and full path OK');
