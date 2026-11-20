#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { runInNewContext } = require('node:vm');
const { chromium } = require('playwright-core');

const mission = path.join(__dirname, '..', 'little panth', 'mission-004');
const { makeReading } = require(path.join(mission, 'reading.js'));
const scope = { window: {} };
runInNewContext(fs.readFileSync(path.join(mission, 'story.js'), 'utf8'), scope);
const beats = scope.window.LP004.beats;
const dialogues = JSON.parse(fs.readFileSync(path.join(mission, 'dialogue.json'), 'utf8')).lines;
const timings = JSON.parse(fs.readFileSync(path.join(mission, 'audio', 'word-timings.json'), 'utf8'));
const wordCount = beats.reduce((sum, beat) => sum + beat.pa.trim().split(/\s+/u).length, 0);
assert.equal(beats.length, 25);
assert.ok(wordCount >= 900 && wordCount <= 1250);
for (const beat of beats) {
  assert.equal(dialogues[beat.id].pa, beat.pa, 'Gemini narration and text must match');
  const track = timings[beat.id];
  const reading = makeReading(beat.pa, track.durationMs, track.words);
  assert.equal(reading.words.length, track.words.length);
  assert.ok(reading.phrases.every(phrase => phrase.end - phrase.first <= 8));
  assert.equal(reading.phrases.map(phrase => phrase.text).join(' '), beat.pa);
}
function executable() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium']) {
    try { return execFileSync('which', [name], { encoding: 'utf8' }).trim(); } catch {}
  }
  throw Error('No Chrome binary');
}

async function run() {
  const browser = await chromium.launch({
    executablePath: executable(),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const url = 'http://127.0.0.1:8765/little%20panth/mission-004/';
    await page.goto(url + '?test=1', { waitUntil: 'domcontentloaded' });
    await page.locator('#loading').waitFor({ state: 'hidden', timeout: 40000 });
    await page.waitForFunction(() => window.lp004Test.status().clipActive && window.lp004Test.status().elapsed > 0.2);
    assert.equal(await page.locator('#character-layer [data-actor="mehar"]').count(), 1);
    assert.equal(await page.locator('#character-layer [data-actor="baldev"]').count(), 1);
    assert.equal(await page.locator('button, video[controls], audio[controls], select, input, nav, header, footer').count(), 0);

    const art = page.locator('.art-page');
    const read = page.locator('.reading-page');
    const line = page.locator('#reading');
    const word = page.locator('.word[aria-current="true"]');
    const left = await art.boundingBox();
    const right = await read.boundingBox();
    assert.equal(left.width, right.width);
    assert.equal(left.height, right.height);
    assert.ok(await line.evaluate(node => parseFloat(getComputedStyle(node).fontSize)) >= 65);
    assert.ok(await page.evaluate(() => document.fonts.check('700 48px "Little Panth Gurmukhi"', 'ਪੰਜਾਬ')));

    const folder = path.join(process.cwd(), 'screenshots', 'little-panth-004');
    fs.mkdirSync(folder, { recursive: true });
    for (const [i, beat] of beats.entries()) {
      const track = timings[beat.id];
      const reading = makeReading(beat.pa, track.durationMs, track.words);
      const phrase = reading.phrases[Math.min(1, reading.phrases.length - 1)];
      const [start, end] = track.words[phrase.first];
      await page.evaluate(([scene, ms]) => window.lp004Test.jump(scene, ms), [i, (start + end) / 2]);
      assert.equal(await page.locator('#book').getAttribute('data-layout'), beat.layout || 'spread');
      assert.equal(await page.locator('[data-background="' + beat.location + '"]').getAttribute('opacity'), '1');
      assert.equal(await line.textContent(), phrase.text);
      assert.equal(await word.textContent(), reading.words[phrase.first]);
      assert.ok((await page.evaluate(() => window.lp004Test.status())).aligned);
      if (i === 0 || i === 4) {
        await page.screenshot({ path: path.join(folder, (i ? 'desktop-cinema' : 'desktop-spread') + '.png') });
      }
      if (beat.layout === 'cinema') {
        const screen = await page.locator('.movie').boundingBox();
        const caption = await line.boundingBox();
        assert.equal(screen.width, 1920);
        assert.equal(screen.height, 1080);
        assert.ok(caption.y > 540 && caption.y + caption.height < 1080);
      }
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.lp004Test.jump(0, 1300));
    assert.ok((await read.boundingBox()).y >= (await art.boundingBox()).height);
    assert.ok((await line.boundingBox()).width < 390);
    await page.screenshot({ path: path.join(folder, 'mobile-spread.png') });
    await page.evaluate(() => window.lp004Test.jump(4, 4500));
    const mobileMovie = await page.locator('.movie').boundingBox();
    const mobileCaption = await line.boundingBox();
    assert.ok(mobileCaption.y > mobileMovie.y && mobileCaption.y + mobileCaption.height <= mobileMovie.y + mobileMovie.height);
    await page.screenshot({ path: path.join(folder, 'mobile-cinema.png') });
    assert.deepEqual(errors, []);
    console.log('PASS Mission 04: 25 Gemini clips, word cues, 50/50 spread, four full-frame cuts, phone layout, and no controls.');
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
