#!/usr/bin/env node
const { chromium } = require('playwright-core');
const { spawn, spawnSync } = require('node:child_process');
const { mkdir, mkdtemp, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');

const episode = process.argv[2] || 'mission-001';
const section = process.argv[3];
const out = path.resolve(process.argv[4] || 'little-panth-renders', section || 'assembled');
const sections = ['intro', 'harvest', 'storage', 'requests', 'share'];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
  if (result.error || result.status !== 0) throw result.error || Error('FFmpeg exited with ' + result.status);
}

function capture(file) {
  let offset;
  let output = '';
  let errors = '';
  const processHandle = spawn('ffmpeg', [
    '-hide_banner', '-loglevel', 'warning', '-y', '-stats_period', '0.1', '-progress', 'pipe:1',
    '-thread_queue_size', '16', '-probesize', '32768', '-analyzeduration', '0',
    '-f', 'x11grab', '-draw_mouse', '0', '-framerate', '30', '-video_size', '1920x1080',
    '-i', process.env.DISPLAY + '+0,0',
    '-thread_queue_size', '256', '-f', 'pulse', '-fragment_size', '1920', '-i', 'lp_export.monitor',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-threads', '3', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2', file
  ], { stdio: ['pipe', 'pipe', 'pipe'] });
  const closed = new Promise((resolve, reject) => {
    processHandle.once('error', reject);
    processHandle.once('close', code => {
      if (code === 0) resolve();
      else reject(Error('Capture stopped (' + code + '): ' + errors));
    });
  });
  closed.catch(() => {});
  let ready;
  const started = new Promise(resolve => { ready = resolve; });
  processHandle.stdout.on('data', chunk => {
    output += chunk;
    const lines = output.split('\n');
    output = lines.pop();
    for (const line of lines) {
      const match = /^out_time_us=(\d+)$/.exec(line.trim());
      if (match && +match[1] > 0 && offset === undefined) {
        offset = Date.now() - Math.round(+match[1] / 1000);
        ready(offset);
      }
    }
  });
  processHandle.stderr.on('data', chunk => { errors = (errors + chunk).slice(-6000); });
  const timeout = setTimeout(() => processHandle.kill(), 25_000);
  return {
    ready: Promise.race([started, closed.then(() => { throw Error('Capture ended before its first frame'); })])
      .finally(() => clearTimeout(timeout)),
    async stop() {
      if (processHandle.exitCode === null && processHandle.signalCode === null) processHandle.stdin.end('q\n');
      await closed;
    }
  };
}

async function render() {
  if (!/^mission-\d{3}$/.test(episode) || !sections.includes(section)) {
    throw Error('Usage: node tools/little-panth-export.cjs mission-001 <section> [output directory]');
  }
  if (!process.env.DISPLAY) throw Error('An X display and the lp_export PulseAudio sink are required');
  await mkdir(out, { recursive: true });
  const profile = await mkdtemp(path.join(tmpdir(), 'little-panth-chrome-'));
  let browser;
  const recording = path.join(out, 'capture.mkv');
  let recorder;
  let status;
  let trimStart;
  try {
    browser = await chromium.launchPersistentContext(profile, {
      viewport: null, channel: 'chrome', headless: false, ignoreDefaultArgs: ['--mute-audio'],
      args: ['--no-sandbox', '--app=about:blank', '--autoplay-policy=no-user-gesture-required',
        '--window-position=0,0', '--window-size=1920,1080', '--force-device-scale-factor=1']
    });
    const page = browser.pages()[0] || await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto('http://127.0.0.1:8765/little%20panth/' + episode + '/?export=1');
    await page.waitForFunction(() => window.lpExport?.ready(), null, { timeout: 60_000 });
    await page.evaluate(() => {
      document.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        document.documentElement.requestFullscreen().catch(error => { window.lpFullscreenError = error.message; });
      }, { once: true, capture: true });
    });
    await page.mouse.click(8, 8);
    try {
      await page.waitForFunction(() => document.fullscreenElement && innerWidth === 1920 && innerHeight === 1080, null, { timeout: 10_000 });
    } catch {
      throw Error('Expected a 1920×1080 fullscreen viewport, got ' + await page.evaluate(() => innerWidth + '×' + innerHeight + (window.lpFullscreenError ? ': ' + window.lpFullscreenError : '')));
    }
    await delay(2100); // Let Chrome's temporary fullscreen notice leave the capture area.
    recorder = capture(recording);
    const captureStart = await recorder.ready;
    const started = await page.evaluate(name => window.lpExport.start(name), section);
    trimStart = Math.max(0, (started - captureStart) / 1000);

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
      await delay(200);
    } while (Date.now() < deadline);
    if (!status.finished) throw Error('Watch mode stalled in ' + status.phase);
    if (!status.captions.length) throw Error('No captions recorded in ' + section);
    await thumbnail;
    await delay(500);
  } finally {
    try {
      if (recorder) await recorder.stop();
    } finally {
      try { await browser?.close(); } finally { await rm(profile, { recursive: true, force: true }); }
    }
  }
  const seconds = (status.finished - status.started) / 1000;
  ffmpeg(['-ss', trimStart.toFixed(3), '-i', recording, '-t', seconds.toFixed(3),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-threads', '3',
    '-r', '30', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    path.join(out, 'section.mp4')]);
  await writeFile(path.join(out, 'captions.json'), JSON.stringify(status.captions));
  await rm(recording);
  console.log(section + ' rendered in ' + seconds.toFixed(1) + ' seconds of episode time');
}

render().catch(error => { console.error(error); process.exitCode = 1; });
