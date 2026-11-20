#!/usr/bin/env node
'use strict';

// Render the browser's actual reading layout against the same clock as the PCM track.
const { chromium } = require('playwright-core');
const { spawn, execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { once } = require('node:events');
const { mkdir, mkdtemp, readFile, rename, rm, writeFile } = require('node:fs/promises');
const { runInNewContext } = require('node:vm');
const path = require('node:path');

const mission = path.resolve(__dirname, '../little panth/mission-004');
const { makeReading } = require(path.join(mission, 'reading.js'));
const out = path.resolve(process.argv[2] || 'little-panth-004-video');
const width = 1920;
const height = 1080;
const captureFps = 15;
const outputFps = 30;
const sampleRate = 48000;
const samplesPerFrame = sampleRate / captureFps;

function encoder(args) {
  const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    stdio: ['pipe', 'ignore', 'pipe']
  });
  let errors = '';
  child.stderr.on('data', chunk => { errors = (errors + chunk).slice(-6000); });
  child.stdin.on('error', () => {});
  const done = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(Error('FFmpeg failed: ' + errors)));
  });
  done.catch(() => {});
  return { child, done };
}

function validateAlignment(beat, track, voice, source) {
  const digest = createHash('sha256').update(source).digest('hex');
  const count = beat.pa.trim().split(/\s+/u).length;
  if (voice?.text !== beat.pa || !track || track.dialogueHash !== voice.hash ||
      track.audioSha256 !== digest || !Number.isFinite(track.durationMs) || track.words?.length !== count) {
    throw Error('Missing current word alignment for ' + beat.id);
  }
  let previousEnd = 0;
  for (const [start, end] of track.words) {
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < previousEnd ||
        end <= start || end > track.durationMs) {
      throw Error('Invalid word timings for ' + beat.id);
    }
    previousEnd = end;
  }
}

async function buildTimeline(work) {
  const audio = path.join(mission, 'audio');
  const readJson = async name => JSON.parse(await readFile(path.join(audio, name), 'utf8'));
  const [source, manifest, tracks] = await Promise.all([
    readFile(path.join(mission, 'story.js'), 'utf8'),
    readJson('generation-manifest.json'),
    readJson('word-timings.json')
  ]);
  const scope = { window: {} };
  runInNewContext(source, scope);
  const beats = scope.window.LP004.beats;
  const scenes = [];
  const chunks = [];
  let offset = 0;
  for (const [index, beat] of beats.entries()) {
    const file = path.join(audio, beat.id + '.mp3');
    const track = tracks[beat.id];
    validateAlignment(beat, track, manifest[beat.id], await readFile(file));
    const pcm = execFileSync('ffmpeg', [
      '-v', 'error', '-nostdin', '-i', file, '-f', 's16le', '-ac', '1', '-ar', String(sampleRate), 'pipe:1'
    ], { maxBuffer: 12 * 1024 * 1024 });
    const pause = index === beats.length - 1 ? 1.8 : 0.18;
    const frameCount = Math.ceil(pcm.length / 2 / samplesPerFrame + pause * captureFps);
    const durationMs = frameCount * 1000 / captureFps;
    if (Math.abs(track.durationMs - pcm.length / 2 / sampleRate * 1000) > 30) {
      throw Error('Recording length changed for ' + beat.id);
    }
    chunks.push(pcm, Buffer.alloc(frameCount * samplesPerFrame * 2 - pcm.length));
    const reading = makeReading(beat.pa, track.durationMs, track.words);
    scenes.push({ index, frameCount, offset, durationMs, beat, phrases: reading.phrases });
    offset += durationMs;
  }
  const audioFile = path.join(work, 'dialogue.pcm');
  await writeFile(audioFile, Buffer.concat(chunks));
  return { scenes, audioFile, durationMs: offset };
}

async function renderBatch(browser, scenes, video, thumbnail) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let process;
  try {
    await page.goto('http://127.0.0.1:8765/little%20panth/mission-004/?export=1', { waitUntil: 'load' });
    await page.waitForFunction(() => window.lp004Export?.ready() || window.lp004Export?.error(), null, { timeout: 90000 });
    const pageError = await page.evaluate(() => window.lp004Export.error());
    if (pageError) throw Error(pageError);
    const cdp = await page.context().newCDPSession(page);
    process = encoder([
      '-f', 'image2pipe', '-framerate', String(captureFps), '-threads', '1', '-c:v', 'mjpeg', '-i', 'pipe:0',
      '-an', '-filter_threads', '1', '-vf', 'fps=' + outputFps,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-threads', '2', '-pix_fmt', 'yuv420p', video
    ]);
    const input = process.child.stdin;
    for (const scene of scenes) {
      for (let frame = 0; frame < scene.frameCount; frame++) {
        const ms = frame * 1000 / captureFps;
        await page.evaluate(([index, at]) => window.lp004Export.frame(index, at), [scene.index, ms]);
        if (scene.index === 0 && frame === 54) await page.screenshot({ path: thumbnail });
        const image = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 93, optimizeForSpeed: true });
        if (input.destroyed) throw Error('The encoder stopped before the scene ended');
        if (!input.write(Buffer.from(image.data, 'base64'))) {
          await Promise.race([once(input, 'drain'), process.done.then(() => { throw Error('The encoder closed early'); })]);
        }
      }
      if (errors.length) throw Error('Browser errors: ' + errors.join(', '));
      console.log('Rendered ' + scene.beat.id + ' (' + scene.frameCount + ' frames).');
    }
    input.end();
    await process.done;
  } catch (error) {
    process?.child.kill();
    // Include the underlying encoder diagnostic if it is already available.
    if (process?.child.exitCode) await process.done;
    throw error;
  } finally {
    await page.close();
  }
}

function stamp(ms) {
  const time = Math.max(0, Math.round(ms));
  const h = Math.floor(time / 3600000);
  const m = Math.floor(time / 60000) % 60;
  const s = Math.floor(time / 1000) % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':') + ',' + String(time % 1000).padStart(3, '0');
}

async function render() {
  await mkdir(out, { recursive: true });
  const work = await mkdtemp(path.join(out, '.render-'));
  const thumbnail = path.join(work, 'thumbnail.png');
  let browser;
  try {
    const { scenes, audioFile, durationMs } = await buildTimeline(work);
    const chrome = process.env.CHROME_BIN ?
      { executablePath: process.env.CHROME_BIN } : { channel: 'chrome' };
    browser = await chromium.launch({
      ...chrome, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage']
    });

    const batchSize = Math.ceil(scenes.length / 2);
    const batches = [scenes.slice(0, batchSize), scenes.slice(batchSize)];
    const videos = batches.map((_, index) => path.join(work, 'picture-' + index + '.mp4'));
    const renders = await Promise.allSettled(batches.map((batch, i) => renderBatch(browser, batch, videos[i], thumbnail)));
    const failure = renders.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;

    const concat = path.join(work, 'pictures.txt');
    await writeFile(concat, videos.map(file => "file '" + path.basename(file) + "'").join('\n') + '\n');
    const stagedVideo = path.join(work, 'mission-004.mp4');
    const mux = encoder([
      '-f', 'concat', '-safe', '1', '-i', concat, '-f', 's16le', '-ar', String(sampleRate), '-ac', '1', '-i', audioFile,
      '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart',
      stagedVideo
    ]);
    mux.child.stdin.end();
    await mux.done;

    const dialogues = scenes.map(scene => ({
      start: Math.round(scene.offset), end: Math.round(scene.offset + scene.durationMs), text: scene.beat.pa
    }));
    const phrases = scenes.flatMap(scene => scene.phrases.map(phrase => ({
      start: scene.offset + phrase.startMs, end: scene.offset + phrase.endMs, text: phrase.text
    })));
    const srt = phrases.map((phrase, i) => [
      i + 1, stamp(phrase.start) + ' --> ' + stamp(phrase.end), phrase.text, ''
    ].join('\n')).join('\n');
    await writeFile(path.join(out, 'mission-004-pa.srt'), srt, 'utf8');
    await writeFile(path.join(out, 'dialogue-timings.json'), JSON.stringify(dialogues, null, 2) + '\n', 'utf8');
    await rename(thumbnail, path.join(out, 'thumbnail.png'));
    await rename(stagedVideo, path.join(out, 'mission-004.mp4'));
    console.log('Exported ' + scenes.length + ' scenes and ' + phrases.length + ' captions: ' + (durationMs / 1000).toFixed(1) + 's at 1920x1080, 30 fps.');
  } finally {
    await browser?.close();
    await rm(work, { recursive: true, force: true });
  }
}

render().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
