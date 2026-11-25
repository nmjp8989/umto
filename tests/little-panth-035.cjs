#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'little panth/mission-035');
const read = file => fs.readFileSync(path.join(dir, file), 'utf8');
const data = JSON.parse(read('dialogue.json'));
const expectedScenes = [
  ['quiet-store', ['storeroom', 'quiet-paws']],
  ['mice-meet', ['meeting', 'mouse-worry']],
  ['bright-idea', ['young-idea', 'bell-explained', 'cheer']],
  ['wise-question', ['elder-question', 'silence']],
  ['no-volunteer', ['young-hesitates', 'elder-reminds']],
  ['safe-and-thoughtful', ['cat-passes', 'moral']]
];
const voices = { narrator: 'Aoede', mouse: 'Leda', 'elder-mouse': 'Charon', 'friend-mouse': 'Puck' };
const spoken = data.scenes.flatMap(scene => scene.lines);
const words = spoken.reduce((total, id) => total + data.lines[id].pa.trim().split(/\s+/u).length, 0);

assert.equal(data.mission, 35);
assert.equal(data.title, 'ਬਿੱਲੀ ਦੇ ਗਲ ਘੰਟੀ');
assert.equal(data.englishTitle, 'Belling the Cat');
assert.deepEqual(data.scenes.map(scene => [scene.id, scene.lines]), expectedScenes);
assert.equal(spoken.length, 13);
assert.equal(new Set(spoken).size, 13, 'Every recorded line occurs once in story order');
assert.deepEqual([...spoken].sort(), Object.keys(data.lines).sort());
assert.ok(words >= 170 && words <= 200, 'New stories contain170–200 spoken Punjabi words: ' + words);
assert.deepEqual(Object.keys(data.speakers).sort(), Object.keys(voices).sort());
for (const id of spoken) {
  const line = data.lines[id];
  assert.ok(voices[line.speaker], id + ' has a configured character voice');
  assert.match(line.pa, /[\u0a00-\u0a7f]/u, id + ' contains Gurmukhi Punjabi');
}
assert.equal(data.lines.cheer.speaker, 'friend-mouse');
assert.equal(data.lines['elder-question'].speaker, 'elder-mouse');
assert.equal(data.source.url, 'https://www.read.gov/aesop/003.html');
assert.equal(data.source.editionYear, 1919);
assert.equal(data.source.status, 'public-domain');
assert.ok(read('SHOT_LIST.md').includes(data.source.url));
for (const [scene] of expectedScenes) assert.ok(read('SHOT_LIST.md').includes('`' + scene + '`'));

const svg = read('art/stage.svg');
const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'SVG IDs are unique, including reused animal artwork');
for (const id of ['stage', 'mouse-young', 'mouse-elder', 'mouse-friend', 'cat', 'bell']) {
  assert.ok(ids.includes(id), 'Stage contains ' + id);
}
assert.doesNotMatch(svg, /\b(?:NaN|Infinity|undefined)\b/);
assert.ok((svg.match(/data-mouse-foot=/g) || []).length >= 12, 'Each mouse has four measurable supporting paws');
assert.ok((svg.match(/data-face(?:=|\s|>)/g) || []).length >= 4, 'All animal faces have independent separation bounds');
const html = read('index.html');
for (const match of html.matchAll(/(?:src|href)="([^"#?]+)(?:[?#][^"]*)?"/g)) {
  if (/^(?:https?:|data:|\/)/.test(match[1])) continue;
  const target = path.resolve(dir, match[1]);
  assert.ok(fs.existsSync(target), 'Referenced asset exists: ' + match[1]);
}
for (const filename of ['little panth/index.html', 'little panth/all-missions.html']) {
  const catalogue = fs.readFileSync(path.join(root, filename), 'utf8');
  const row = catalogue.match(/<tr\b[^>]*>(?:(?!<\/tr>)[\s\S])*?value="035"(?:(?!<\/tr>)[\s\S])*?<\/tr>/)?.[0];
  assert.ok(row, filename + ' includes the new selection row');
  assert.ok(row.includes(data.source.url), 'Catalogue links the original fable source');
  assert.match(row, /data-seconds="[1-9]\d*"/);
  for (const input of row.matchAll(/<input\b[^>]*>/g)) {
    assert.doesNotMatch(input[0], /\schecked(?:\s|=|>)/, 'New catalogue controls have no baked-in approval or selection');
  }
}

let speechMs = 0;
if (process.argv.includes('--audio')) {
  const manifest = JSON.parse(read('audio/generation-manifest.json'));
  const aligned = JSON.parse(read('audio/word-timings.json'));
  assert.deepEqual(Object.keys(manifest).sort(), [...spoken].sort());
  assert.deepEqual(Object.keys(aligned).sort(), [...spoken].sort());
  for (const id of spoken) {
    const line = data.lines[id], clip = manifest[id], timing = aligned[id];
    assert.equal(clip.text, line.pa, id + ': recorded script is current');
    assert.equal(clip.speaker, line.speaker);
    assert.equal(clip.voice, voices[line.speaker]);
    assert.match(clip.model, /^gemini-.*-tts$/);
    assert.match(clip.hash, /^[0-9a-f]{64}$/);
    const audio = fs.readFileSync(path.join(dir, 'audio', id + '.mp3'));
    assert.ok(audio.length > 2048, id + ': real MP3 exists');
    assert.equal(timing.audioSha256, createHash('sha256').update(audio).digest('hex'), id + ': alignment is for these exact audio bytes');
    assert.equal(timing.dialogueHash, clip.hash, id + ': alignment matches the voice/script cache');
    assert.ok(Number.isFinite(timing.durationMs) && timing.durationMs > 500 && timing.durationMs < 35000);
    assert.equal(timing.words.length, line.pa.trim().split(/\s+/u).length);
    let previousEnd = 0;
    for (const [start, end] of timing.words) {
      assert.ok(Number.isFinite(start) && Number.isFinite(end) && start >= previousEnd && end > start && end <= timing.durationMs + 1,
        id + ': every aligned word is ordered and inside the recorded clip');
      previousEnd = end;
    }
    speechMs += timing.durationMs;
  }
}

const option = name => {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  assert.ok(process.argv[index + 1] && !process.argv[index + 1].startsWith('--'), name + ' needs a path');
  return path.resolve(process.argv[index + 1]);
};
const rendered = option('--render');
if (rendered) {
  assert.ok(process.argv.includes('--audio'), 'Verify an export against its actual recorded source clips');
  const reportPath = option('--browser-report');
  assert.ok(reportPath, 'The real browser ready/status duration is required');
  const browserReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(browserReport.passed, true, 'Focused playback/contact checks passed before rendering');
  const render = JSON.parse(fs.readFileSync(path.join(rendered, 'render.json'), 'utf8'));
  assert.equal(render.episode, 'mission-035');
  const expected = browserReport.compilation.total / 1000;
  assert.ok(Number.isFinite(expected) && expected > speechMs / 1000, 'Compilation includes every recording and scene holds');
  assert.ok(Math.abs(render.seconds - expected) < 1.25, 'Completed playback duration matches the entire selected episode');
  const file = path.join(rendered, 'episode.mp4');
  assert.ok(fs.statSync(file).size > 100000, 'A completed MP4 was produced');
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8' });
  assert.equal(probe.status, 0, probe.stderr || 'ffprobe failed');
  const metadata = JSON.parse(probe.stdout);
  const video = metadata.streams.find(stream => stream.codec_type === 'video');
  const audio = metadata.streams.find(stream => stream.codec_type === 'audio');
  assert.equal(video?.codec_name, 'h264');
  assert.equal(video.width, 1920);
  assert.equal(video.height, 1080);
  assert.equal(video.r_frame_rate, '30/1');
  assert.equal(audio?.codec_name, 'aac');
  assert.equal(Number(audio.sample_rate), 48000);
  assert.ok(Math.abs(Number(metadata.format.duration) - expected) < 1.3, 'Encoded picture and complete playback have the same duration');
  assert.ok(Math.abs(Number(video.duration) - Number(audio.duration)) < 0.2, 'Recorded audio lasts to the final video frame');
  const levels = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-vn', '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  assert.equal(levels.status, 0, levels.stderr);
  const meanDb = Number(/mean_volume:\s*(-?[\d.]+) dB/.exec(levels.stderr)?.[1]);
  assert.ok(Number.isFinite(meanDb) && meanDb > -55, 'The exported recorded audio is audible');
  fs.writeFileSync(path.join(rendered, 'verification.json'), JSON.stringify({
    kind: 'test-render', episode: 'mission-035', recordedClips: spoken.length, spokenWords: words,
    expectedSeconds: expected, playbackSeconds: render.seconds, encodedSeconds: Number(metadata.format.duration),
    video: { codec: video.codec_name, width: video.width, height: video.height, fps: video.r_frame_rate },
    audio: { codec: audio.codec_name, sampleRate: Number(audio.sample_rate), meanDb },
    productionHistoryWritten: false
  }, null, 2));
}

console.log('PASS Mission35: ' + words + ' Punjabi words,13 lines,6 planned scenes and source assets' +
  (speechMs ? '; all recorded voices and word alignments verified' : '') +
  (rendered ? '; actual selected-episode H.264/AAC test MP4 verified' : ''));
