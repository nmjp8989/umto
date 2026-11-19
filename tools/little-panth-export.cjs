#!/usr/bin/env node
const { chromium } = require('playwright-core');
const { spawn, spawnSync } = require('node:child_process');
const { mkdir, rm, writeFile } = require('node:fs/promises');
const { once } = require('node:events');
const path = require('node:path');

const episode = process.argv[2] || 'mission-001';
const section = process.argv[3];
const out = path.resolve(process.argv[4] || 'little-panth-renders', section || 'assembled');
const sections = ['intro', 'harvest', 'storage', 'requests', 'share'];
const width = 1920;
const height = 1080;
const fps = 30;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function encoder(args) {
  const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  let errors = '';
  child.stderr.on('data', chunk => { errors = (errors + chunk).slice(-6000); });
  // A failed encoder can close its input before the producer sees the exit.
  child.stdin.on('error', () => {});
  const done = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(Error('FFmpeg exited ' + code + ': ' + errors)));
  });
  done.catch(() => {});
  return { child, done };
}

function beginAudio(file) {
  const audio = encoder([
    '-stats_period', '0.1', '-progress', 'pipe:1', '-f', 'pulse', '-fragment_size', '1920',
    '-i', 'lp_export.monitor', '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2', file
  ]);
  let resolveStart;
  const firstSample = new Promise(resolve => { resolveStart = resolve; });
  let output = '';
  audio.child.stdout.on('data', chunk => {
    output += chunk;
    const lines = output.split('\n');
    output = lines.pop();
    for (const line of lines) {
      const match = /^out_time_us=(\d+)$/.exec(line.trim());
      if (match && +match[1] > 0) resolveStart(Date.now() - Math.round(+match[1] / 1000));
    }
  });
  const timeout = setTimeout(() => audio.child.kill(), 20_000);
  return {
    ...audio,
    ready: Promise.race([firstSample, audio.done.then(() => { throw Error('Audio capture ended before playback'); })])
      .finally(() => clearTimeout(timeout)),
    async stop() {
      if (audio.child.exitCode === null && audio.child.signalCode === null) audio.child.stdin.end('q\n');
      await audio.done;
    }
  };
}

async function beginFrames(page, file) {
  const cdp = await page.context().newCDPSession(page);
  let latest;
  let received = 0;
  cdp.on('Page.screencastFrame', frame => {
    latest = Buffer.from(frame.data, 'base64');
    received++;
    cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: width, maxHeight: height });
  for (let attempt = 0; !latest && attempt < 50; attempt++) await delay(100);
  if (!latest) throw Error('Chromium provided no frames');

  const video = encoder([
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', 'pipe:0',
    '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
    '-threads', '2', '-pix_fmt', 'yuv420p', file
  ]);
  let timer;
  let written = 0;
  let blocked = false;
  const input = video.child.stdin;
  input.on('drain', () => { blocked = false; });
  function writeUntil(total) {
    while (!blocked && written < total) {
      if (input.destroyed) throw Error('Video encoder closed before the end of the section');
      blocked = !input.write(latest);
      written++;
    }
  }
  return {
    start(started) {
      timer = setInterval(() => {
        if (!input.destroyed) writeUntil(Math.floor((Date.now() - started) * fps / 1000));
      }, 12);
    },
    async stop(frameCount) {
      clearInterval(timer);
      if (frameCount) {
        // Finish any frames still waiting on FFmpeg input backpressure.
        while (written < frameCount) {
          if (blocked) await Promise.race([once(input, 'drain'), video.done.then(() => { throw Error('Video encoder exited early'); })]);
          writeUntil(frameCount);
        }
      }
      input.end();
      await cdp.send('Page.stopScreencast').catch(() => {});
      await video.done;
      console.log('Captured browser updates: ' + received + '; encoded frames: ' + written);
    },
    abort() {
      clearInterval(timer);
      video.child.kill();
    }
  };
}

function finalize(video, audio, trimStart) {
  const result = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'info', '-y', '-i', video, '-ss', trimStart.toFixed(3), '-i', audio,
    '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-af', 'volumedetect,apad',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', path.join(out, 'section.mp4')
  ], { encoding: 'utf8' });
  if (result.error || result.status !== 0) throw result.error || Error(result.stderr);
  const level = /mean_volume:\s*(-?[\d.]+) dB/.exec(result.stderr);
  if (!level || Number(level[1]) < -55) throw Error('The browser audio recording is silent or too quiet');
  console.log('Audio mean level: ' + level[1] + ' dB');
}

async function render() {
  if (!/^mission-\d{3}$/.test(episode) || !sections.includes(section)) {
    throw Error('Usage: node tools/little-panth-export.cjs mission-001 <section> [output directory]');
  }
  await mkdir(out, { recursive: true });
  const videoFile = path.join(out, 'picture.mp4');
  const audioFile = path.join(out, 'browser.wav');
  const browser = await chromium.launch({
    channel: 'chrome', headless: true,
    ignoreDefaultArgs: ['--mute-audio'],
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required']
  });
  let audio;
  let frames;
  let status;
  let trimStart;
  let finishedFrames = false;
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto('http://127.0.0.1:8765/little%20panth/' + episode + '/?export=1');
    await page.waitForFunction(() => window.lpExport?.ready(), null, { timeout: 60_000 });
    frames = await beginFrames(page, videoFile);
    audio = beginAudio(audioFile);
    const audioStart = await audio.ready;
    const started = await page.evaluate(name => window.lpExport.start(name), section);
    trimStart = Math.max(0, (started - audioStart) / 1000);
    frames.start(started);

    let thumbnail;
    if (section === 'storage') {
      thumbnail = page.locator('#stage[data-light="night"]').waitFor({ timeout: 150_000 })
        .then(() => page.screenshot({ path: path.join(out, 'thumbnail.png'), timeout: 10_000 }));
      thumbnail.catch(() => {});
    }
    const deadline = Date.now() + 4 * 60_000;
    do {
      if (pageErrors.length) throw Error(pageErrors.join('\n'));
      status = await page.evaluate(() => window.lpExport.status());
      if (status.error) throw Error(status.error);
      if (status.finished) break;
      await delay(80);
    } while (Date.now() < deadline);
    if (!status.finished) throw Error('Watch mode stalled in ' + status.phase);
    if (!status.captions.length) throw Error('No captions recorded in ' + section);
    await frames.stop(Math.round((status.finished - status.started) * fps / 1000));
    finishedFrames = true;
    await thumbnail;
  } finally {
    if (frames && !finishedFrames) frames.abort();
    try { if (audio) await audio.stop(); } finally { await browser.close(); }
  }
  finalize(videoFile, audioFile, trimStart);
  await writeFile(path.join(out, 'captions.json'), JSON.stringify(status.captions));
  await Promise.all([rm(videoFile), rm(audioFile)]);
  console.log(section + ' rendered in ' + ((status.finished - status.started) / 1000).toFixed(1) + ' seconds of episode time');
}

render().catch(error => { console.error(error); process.exitCode = 1; });
