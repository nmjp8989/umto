#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { chromium } = require('playwright-core');

const url = process.env.LP016_URL || 'http://127.0.0.1:8765/little%20panth/mission-016/';
const output = '../lp16-qa';

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
    const originalFox = page.waitForResponse(response =>
      response.url().endsWith('/mission-009/art/stage.svg') && response.ok());
    await page.goto(url + '?test=1');
    await page.waitForFunction(() => window.lp016Test || document.getElementById('loading').textContent.includes('ਨਹੀਂ'));
    assert.deepEqual(errors, []);
    await originalFox;

    const { scenes, clips } = await page.evaluate(() => window.lp016Test.state());
    const lines = scenes.flatMap(scene => scene.lines);
    assert.equal(scenes.length, 7);
    assert.equal(clips, 14);
    assert.ok(lines.every(line => line.aligned));
    assert.equal(new Set(lines.map(line => line.speaker)).size, 3);
    assert.equal(lines.reduce((total, line) => total + line.reading.words.length, 0), 194);
    assert.equal(await page.locator('button, header, nav, input, video[controls]').count(), 0);
    const art = await page.locator('.art-page').boundingBox();
    const reading = await page.locator('.reading-page').boundingBox();
    assert.equal(art.width, reading.width);
    assert.equal(art.height, reading.height);
    assert.equal(await page.locator('#fox-mount #fox-tail').count(), 1);
    assert.equal(await page.locator('#fox-face-plane #fox-head').count(), 1);

    const stage = page.locator('#stage');
    const opacity = async id => Number(await page.locator('#' + id).getAttribute('opacity'));
    const seek = (scene, ms) => page.evaluate(([index, time]) => window.lp016Test.seek(index, time), [scene, ms]);
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
      for (const id of ['fox', 'stork']) {
        assert.equal(await page.locator('#' + id).getAttribute('data-speaking'), String(id === entry.speaker));
      }
    }

    async function gap(a, b) {
      return page.evaluate(([a, b]) => {
        const stage = document.getElementById('stage').getCTM().inverse();
        const locate = ([id, x, y]) => new DOMPoint(x, y)
          .matrixTransform(document.getElementById(id).getCTM()).matrixTransform(stage);
        const from = locate(a);
        const to = locate(b);
        return Math.hypot(from.x - to.x, from.y - to.y);
      }, [a, b]);
    }
    const beak = ['stork-head', -124, 0];
    const tongue = ['fox-head', 78, 25];
    const food = ['fox-food', -20, 0];
    const jugSip = ['stork-jug', -3, -83];

    await speak(0, 0, 4);
    assert.equal(await stage.getAttribute('data-camera-preset'), 'wide');
    assert.equal(await stage.getAttribute('data-meal'), 'plates');
    await speak(0, 1, 4);
    await seek(1, wordAt(1, 0, 'ਛੇਤੀ') + 1140);
    assert.ok(await opacity('fox-tongue') > .95);
    assert.ok(await gap(tongue, food) < 2);
    await seek(1, wordAt(1, 0, 'ਚੱਟ') + 480);
    assert.equal(await stage.getAttribute('data-fox-food'), 'empty');
    assert.equal(await opacity('stork-plate'), 1);
    const dipping = wordAt(1, 0, 'ਚੁੰਝ') + 600;
    await seek(1, dipping);
    assert.equal(await page.locator('#book').getAttribute('data-layout'), 'cinema');
    assert.ok(await gap(beak, ['stork-plate', 34, -1]) < 2);
    await page.screenshot({ path: output + '/01-shallow-plate.png' });
    await speak(1, 1, 5);
    await speak(2, 1, 5);

    await seek(3, 1200);
    assert.equal(await stage.getAttribute('data-camera-motion'), 'tracking');
    assert.equal(await opacity('canal-scene'), 1);
    assert.equal(await stage.getAttribute('data-meal'), 'jugs');
    assert.equal(await opacity('stork-plate'), 0);
    await speak(3, 1, 4);
    await seek(4, wordAt(4, 0, 'ਚੁੰਝ') + 610);
    assert.ok(await gap(beak, jugSip) < 2);
    const mouthOffset = await page.evaluate(() => {
      const head = document.getElementById('stork-head').getCTM();
      const jug = document.getElementById('stork-jug').getCTM().inverse();
      const inJug = x => new DOMPoint(x, 0).matrixTransform(head).matrixTransform(jug);
      const tip = inJug(-124);
      const base = inJug(-26);
      const t = (-106 - tip.y) / (base.y - tip.y);
      return tip.x + t * (base.x - tip.x);
    });
    assert.ok(Math.abs(mouthOffset) < 12, 'The beak passes through the narrow jug opening');
    await seek(4, wordAt(4, 0, 'ਮੂੰਹ') + 660);
    assert.ok(await gap(['fox-head', 103, -4], ['fox-jug', -19, -104]) < 2);
    await speak(4, 1, 4);

    await speak(5, 0, 5);
    await seek(5, scenes[5].lines[0].end + 620);
    assert.ok(await gap(beak, ['fox-plate', 57, -4]) < 2);
    assert.equal(await opacity('pour-stream'), 0);
    const pouring = wordAt(5, 1, 'ਪਾ') + 550;
    await seek(5, pouring);
    assert.ok(await gap(beak, ['fox-jug', 55, -70]) < 2);
    assert.ok(await opacity('pour-stream') > .8);
    assert.equal(await stage.getAttribute('data-fox-food'), 'partial');
    await page.screenshot({ path: output + '/02-pouring.png' });
    await seek(5, scenes[5].duration - 70);
    assert.equal(await opacity('pour-stream'), 0);
    assert.equal(await stage.getAttribute('data-fox-food'), 'full');
    assert.equal(await page.locator('#cleared-jug #fox-jug').count(), 1);
    await speak(6, 0, 3);
    const meal = wordAt(6, 1, 'ਇਕੱਠੇ');
    for (const offset of [800, 1100, 1370]) {
      await seek(6, meal + offset);
      assert.equal(await stage.getAttribute('data-meal'), 'shared');
      assert.equal(await page.locator('#cleared-jug #fox-jug').count(), 1);
      assert.ok(await opacity('fox-tongue') > .95);
      assert.ok(await gap(tongue, food) < 2);
      assert.ok(await gap(beak, jugSip) < 2);
    }
    await page.screenshot({ path: output + '/03-shared-meal.png' });

    await page.locator('#movie').click();
    await page.waitForFunction(() => window.lp016Test.state().audioActive && window.lp016Test.state().position > 440);
    await page.setViewportSize({ width: 390, height: 844 });
    await seek(5, pouring);
    assert.ok((await page.locator('#reading').boundingBox()).width <= 390);
    await page.screenshot({ path: output + '/04-phone.png' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seek(3, 1200);
    assert.equal(await stage.getAttribute('data-camera-motion'), 'static');

    await page.goto(url + '?review=1&scene=new-plate&test=1');
    await page.waitForFunction(() => window.lp016Test);
    assert.equal(await page.locator('#review-scenes li').count(), 7);
    assert.equal(await page.locator('#review-title').textContent(), 'A plate for the fox');
    assert.match(await page.locator('#review-audio').textContent(), /14\/14 voices · 14 aligned/);
    assert.equal(await page.locator('#review-progress').textContent(), '0 of 7 approved');
    await page.locator('#approve-scene').click();
    assert.equal(await page.locator('#review-progress').textContent(), '1 of 7 approved');
    assert.deepEqual(errors, []);
    console.log('PASS Mission 16: aligned speech, plate and jug contact in every meal, empty jug cleared, mobile, and review.');
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
