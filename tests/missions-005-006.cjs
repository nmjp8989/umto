'use strict';
// End-to-end state smoke tests for the two dark cinematic missions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const MissionEngine = require('../missions/mission-engine.js');
const MissionSequenceRunner = require('../missions/sequence-runner.js');
const voices = require('../voices.json');

async function verify(number, id, item, repaired, useScene, useEvent, correct, wrongEvents, finaleEffect) {
  const def = require('../missions/adventures/' + id + '.json');
  const manifest = require('../missions/audio/' + id + '.json');
  assert.equal(def.number, number);
  assert.equal(def.id, id);
  assert.equal(manifest.mission, id);
  assert.equal(Object.keys(def.dialogues).length, Object.keys(manifest.lines).length, 'Every dialogue must have audio');

  for (const [lineId, dialogue] of Object.entries(def.dialogues)) {
    assert(dialogue.text && voices[dialogue.speaker], lineId + ': missing subtitle or voice');
    const audio = manifest.lines[lineId];
    assert(audio, lineId + ': missing audio');
    assert.equal(audio.text, dialogue.text, lineId + ': audio is out of sync with subtitle');
    assert.equal(audio.speaker, dialogue.speaker, lineId + ': incorrect voice');
    assert(/^audio\/[a-z0-9-]+\/[A-Za-z0-9_-]+\.mp3$/.test(audio.src), lineId + ': invalid audio path');
    assert(fs.existsSync(path.join(__dirname, '../missions', audio.src)), lineId + ': missing MP3');
    for (const choice of dialogue.choices || []) {
      assert(def.rules.some(rule => rule.when === choice.event), lineId + ': choice has no rule');
    }
  }
  for (const rule of def.rules) {
    if (rule.in) assert(def.scenes[rule.in], 'Unknown scene in rule ' + rule.when);
    for (const action of rule.actions) {
      const [kind, ref] = action.split(':');
      if (kind === 'message') assert(def.dialogues[ref], 'Unknown dialogue ' + ref);
      if (kind === 'scene') assert(def.scenes[ref], 'Unknown scene ' + ref);
      if (kind === 'sequence') assert(def.sequences[ref], 'Unknown sequence ' + ref);
    }
  }
  for (const cues of Object.values(def.sequences)) {
    for (const cue of cues) {
      if (cue.line) assert(def.dialogues[cue.line], 'Sequence refers to missing line');
      if (cue.effect) assert(typeof cue.effect === 'string', 'Bad effect cue');
    }
  }

  const engine = new MissionEngine(def);
  const heard = [], effects = [];
  const runner = new MissionSequenceRunner({
    camera: () => {}, sound: () => {}, wait: async () => {},
    effect: async type => { effects.push(type); },
    line: async id => { heard.push(id); },
    ending: () => engine.finish()
  });
  async function act(event) {
    const result = engine.trigger(event);
    for (const action of result.actions) {
      const i = action.indexOf(':'), kind = action.slice(0, i), value = action.slice(i + 1);
      if (kind === 'sequence') await runner.run(def.sequences[value]);
      if (kind === 'ending') engine.finish();
    }
    return result;
  }

  assert.equal(engine.state.scene, 'home');
  await act('click:cross');   // Enter work area.
  await act('click:platform'); // Inspect the blocked final control.
  assert((await act('click:lever')).actions.includes('message:dead'), 'Unrepaired control should be blocked');
  assert(!(await act(correct)).ok, 'Cannot win without repair and clues');

  await act('click:cabin');
  assert((await act('click:' + item)).ok, 'Cannot collect repair item');
  assert(engine.state.inventory.includes(item));
  if (useScene === 'platform') await act('click:platform');
  assert((await act(useEvent)).ok, 'Cannot fit the repair item');
  assert(engine.state.flags[repaired], 'Repair flag missing');
  assert(!engine.state.inventory.includes(item), 'Installed item remained in inventory');
  if (useScene === 'stall') await act('click:platform');
  assert((await act('click:lever')).actions.includes('message:unknown'), 'Clues must be required');

  await act('click:cabin');
  await act('click:back');
  await act('click:notice');
  await act('click:kabir');
  assert(engine.state.flags.destination && engine.state.flags.readNotice);
  await act('click:cross');
  await act('click:platform');
  assert((await act('click:lever')).actions.includes('message:choose'), 'Final choices did not appear');
  for (const wrong of wrongEvents) {
    assert((await act(wrong)).actions.includes('message:retry'), 'Wrong answer must allow retry');
    assert(!engine.state.complete);
  }
  assert((await act(correct)).ok, 'Correct answer was rejected');
  assert(engine.state.complete && engine.state.flags.signalSet, 'Finale did not complete');
  assert(effects.includes(finaleEffect), 'Missing finale animation effect');
  assert(heard.includes('thanks'), 'Missing closing dialogue');
  assert(!(await act(correct)).ok, 'Finale should not replay accidentally');
  engine.reset();
  assert.equal(engine.state.complete, false);
  assert.deepEqual(engine.state.inventory, []);
  assert.deepEqual(engine.state.flags, {});
  console.log('PASS Mission ' + number + ' (' + id + '): all voice clips, clue gates, repair, retries, ending and reset');
}

(async () => {
  await verify('005', 'night-platform', 'fuse', 'powered', 'stall',
    'drop:fuse:panel', 'route:blue', ['route:amber', 'route:violet'], 'midnightArrival');
  await verify('006', 'storm-beacon', 'lens', 'lensFitted', 'platform',
    'drop:lens:panel', 'signal:double', ['signal:steady', 'signal:triple'], 'stormBeacon');
})().catch(error => { console.error(error); process.exitCode = 1; });
