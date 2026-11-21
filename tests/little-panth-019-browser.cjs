#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { chromium } = require('playwright-core');

const url = process.env.LP019_URL || 'http://127.0.0.1:8765/little%20panth/mission-019/';
const output = '../lp19-qa';

async function run() {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : { channel: 'chrome' }),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(url + '?test=1');
    await page.waitForFunction(() => window.lp019Test || document.getElementById('loading').textContent.includes('ਨਹੀਂ'));
    assert.deepEqual(errors, []);

    const { scenes, clips } = await page.evaluate(() => window.lp019Test.state());
    const lines = scenes.flatMap(scene => scene.lines);
    assert.equal(scenes.length, 7);
    assert.equal(clips, 11);
    assert.ok(lines.every(line => line.aligned));
    assert.equal(new Set(lines.map(line => line.speaker)).size, 3);
    assert.equal(lines.reduce((total, line) => total + line.reading.words.length, 0), 187);
    assert.equal(await page.locator('button, header, nav, input, video[controls]').count(), 0);
    const art = await page.locator('.art-page').boundingBox();
    const reading = await page.locator('.reading-page').boundingBox();
    assert.equal(art.width, reading.width);
    assert.equal(art.height, reading.height);
    assert.equal(await page.locator('#animals #wing-near').count(), 1);
    assert.equal(await page.locator('#animals #fox-tail').count(), 1);

    const stage = page.locator('#stage');
    const status = (id, key) => page.locator('#' + id).getAttribute('data-' + key);
    const seek = (scene, ms) => page.evaluate(([index, time]) => window.lp019Test.seek(index, time), [scene, ms]);
    const wordAt = (scene, line, word) => {
      const entry = scenes[scene].lines[line];
      const index = entry.reading.words.findIndex(value => value.replace(/\p{P}/gu, '') === word);
      assert.ok(index >= 0, 'Expected spoken word ' + word);
      return entry.start + entry.reading.timings[index][0];
    };

    async function speak(scene, line, word) {
      const entry = scenes[scene].lines[line];
      const [from, to] = entry.reading.timings[word];
      await seek(scene, entry.start + (from + to) / 2);
      assert.equal(await page.locator('.word[aria-current="true"]').textContent(), entry.reading.words[word]);
      for (const id of ['crow', 'fox']) {
        assert.equal(await status(id, 'speaking'), String(id === entry.speaker));
      }
    }

    const crowGrip = ['crow-head', 96, 19];
    const foxGrip = ['fox-head', 81, 15];
    const piece = ['paneer', 0, 0];
    const position = ([id, x, y]) => page.evaluate(({ id, x, y }) => {
      const screen = document.getElementById('stage').getCTM().inverse();
      const point = new DOMPoint(x, y).matrixTransform(document.getElementById(id).getCTM()).matrixTransform(screen);
      return { x: point.x, y: point.y };
    }, { id, x, y });
    async function gap(a, b) {
      const [from, to] = await Promise.all([position(a), position(b)]);
      return Math.hypot(from.x - to.x, from.y - to.y);
    }

    await seek(0, wordAt(0, 0, 'ਬੈਠਾ') - 950);
    assert.equal(await status('crow', 'flying'), 'true');
    assert.equal(await stage.getAttribute('data-camera-motion'), 'tracking');
    assert.ok(await gap(piece, crowGrip) < 2);
    await seek(0, scenes[0].duration - 95);
    assert.equal(await status('crow', 'flying'), 'false');
    assert.ok(Math.abs((await position(['crow-legs', 0, 0])).y - 281) < 1);

    await speak(2, 0, 5);
    assert.equal(await status('stage', 'paneer'), 'crow');
    assert.ok(await gap(piece, crowGrip) < 2);
    const call = wordAt(3, 1, 'ਖੋਲ੍ਹੀ');
    await seek(3, call + 119);
    const beforeRelease = await position(piece);
    assert.equal(await status('stage', 'paneer'), 'crow');
    await seek(3, call + 122);
    assert.equal(await status('stage', 'paneer'), 'falling');
    const afterRelease = await position(piece);
    assert.ok(Math.hypot(afterRelease.x - beforeRelease.x, afterRelease.y - beforeRelease.y) < 1);
    assert.equal(await status('crow', 'calling'), 'true');
    await seek(3, call + 775);
    assert.ok((await position(piece)).y > beforeRelease.y + 165);
    assert.equal(await page.locator('#book').getAttribute('data-layout'), 'cinema');
    await page.screenshot({ path: output + '/01-paneer-falls.png' });
    await seek(3, call + 1110);
    assert.equal(await status('stage', 'paneer'), 'ground');
    const landing = await position(piece);
    assert.ok(Math.hypot(landing.x - 655, landing.y - 613) < 1);

    const take = wordAt(4, 0, 'ਚੁੱਕ') + 120;
    await seek(4, take - 1);
    assert.equal(await status('stage', 'paneer'), 'ground');
    assert.ok(await gap(piece, foxGrip) < 2, 'Fox reaches the paneer before lifting it');
    await seek(4, take + 1);
    assert.equal(await status('stage', 'paneer'), 'fox');
    assert.ok(await gap(piece, foxGrip) < 2);
    await page.screenshot({ path: output + '/02-pickup.png' });
    await speak(4, 1, 5);
    await seek(5, wordAt(5, 0, 'ਚਲੀ') + 775);
    assert.ok(await gap(piece, foxGrip) < 2, 'Paneer remains in the fox’s mouth while she walks');
    await speak(5, 1, 6);
    await seek(6, wordAt(6, 0, 'ਉੱਡ') + 545);
    assert.equal(await status('crow', 'flying'), 'true');
    assert.equal(await status('stage', 'paneer'), 'none');

    await page.locator('#movie').click();
    await page.waitForFunction(() => window.lp019Test.state().audioActive && window.lp019Test.state().position > 440);
    await page.setViewportSize({ width: 390, height: 844 });
    await seek(3, call + 675);
    await page.screenshot({ path: output + '/03-phone.png' });
    assert.ok((await page.locator('#reading').boundingBox()).width <= 390);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seek(3, call + 675);
    assert.equal(await stage.getAttribute('data-camera-motion'), 'static');

    await page.goto(url + '?review=1&scene=song-and-fall&test=1');
    await page.waitForFunction(() => window.lp019Test);
    assert.equal(await page.locator('#review-scenes li').count(), 7);
    assert.equal(await page.locator('#review-title').textContent(), 'A song and a falling bite');
    assert.match(await page.locator('#review-audio').textContent(), /11\/11 voices · 11 aligned/);
    assert.equal(await page.locator('#review-progress').textContent(), '0 of 7 approved');
    await page.locator('#approve-scene').click();
    assert.equal(await page.locator('#review-progress').textContent(), '1 of 7 approved');
    assert.deepEqual(errors, []);
    console.log('PASS Mission 19: 187 Punjabi words, 11 aligned clips, continuous paneer contact and fall, mobile, and review.');
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
