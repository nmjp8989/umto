#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { chromium } = require('playwright-core');

const url = process.env.LP013_URL || 'http://127.0.0.1:8765/little%20panth/mission-013/';
const output = '../lp13-qa';

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
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    const field = page.waitForResponse(response => response.url().endsWith('/mission-003/art/banyan.webp') && response.ok());
    await page.goto(url + '?test=1');
    await page.waitForFunction(() => window.lp013Test || document.getElementById('loading').textContent.includes('ਨਹੀਂ'));
    assert.deepEqual(errors, []);
    await field;
    const { scenes, clips } = await page.evaluate(() => window.lp013Test.state());
    assert.equal(scenes.length, 7);
    assert.equal(clips, 21);
    const lines = scenes.flatMap(scene => scene.lines);
    assert.ok(lines.every(line => line.aligned));
    assert.equal(new Set(lines.map(line => line.speaker)).size, 4);
    assert.equal(lines.reduce((total, line) => total + line.reading.words.length, 0), 190);
    assert.equal(await page.locator('button, header, nav, input, video[controls]').count(), 0);
    const left = await page.locator('.art-page').boundingBox();
    const right = await page.locator('.reading-page').boundingBox();
    assert.equal(left.width, right.width);
    assert.equal(left.height, right.height);

    const stage = page.locator('#stage');
    const location = page.locator('#flock > [data-location="pen"]');
    const opacity = async id => Number(await page.locator('#' + id).getAttribute('opacity'));
    const seek = (scene, ms) => page.evaluate(([index, time]) => window.lp013Test.seek(index, time), [scene, ms]);
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
      for (const actor of ['mehar', 'boy', 'dadi']) {
        assert.equal(await page.locator('#' + actor).getAttribute('data-speaking'), String(actor === entry.speaker));
      }
    }

    for (const [id, preset] of [['mehar', 'kid-meher'], ['boy', 'kid-sidak'], ['dadi', 'elder-bibi-ji']]) {
      assert.equal(await page.locator('#' + id).getAttribute('data-studio-preset'), preset);
      assert.equal(await page.locator('#' + id + ' [data-rig-foot]').count(), 2);
    }
    await speak(0, 0, 5);
    assert.equal(await stage.getAttribute('data-camera-preset'), 'wide');
    assert.equal(await stage.getAttribute('data-gate'), 'open');
    await page.screenshot({ path: output + '/01-morning.png' });

    await speak(1, 1, 2);
    assert.equal(await opacity('wolf'), 0);
    assert.equal(await page.locator('#flock > [data-activity="grazing"]').count(), 4);
    const arrive = wordAt(1, 2, 'ਦੌੜ');
    await seek(1, arrive + 450);
    assert.equal(await stage.getAttribute('data-camera-motion'), 'tracking');
    assert.equal(await page.locator('#mehar').getAttribute('data-studio-motion'), 'walk');
    await speak(1, 3, 4);
    await speak(2, 3, 5);
    assert.equal(await opacity('wolf'), 0);
    assert.equal(await page.locator('#flock > [data-activity="grazing"]').count(), 4);
    await page.screenshot({ path: output + '/02-bibi-warns.png' });

    const rush = wordAt(3, 1, 'ਡਰ');
    await seek(3, wordAt(3, 0, 'ਖੜਕਾ') + 80);
    assert.equal(await opacity('wolf'), 0);
    assert.equal(await stage.getAttribute('data-camera-preset'), 'detail');
    await seek(3, rush + 490);
    assert.equal(await opacity('wolf'), 1);
    assert.equal(await page.locator('#flock > [data-activity="running"]').count(), 4);
    assert.equal(await page.locator('#book').getAttribute('data-layout'), 'cinema');
    await page.screenshot({ path: output + '/03-wolf-and-flock.png' });
    await speak(3, 2, 4);
    await speak(4, 0, 4);
    assert.equal(await page.locator('#book').getAttribute('data-layout'), 'spread');

    const close = wordAt(5, 0, 'ਬੰਦ');
    await seek(5, 0);
    assert.equal(await location.count(), 0);
    await seek(5, close - 100);
    assert.equal(await location.count(), 4);
    assert.equal(await stage.getAttribute('data-gate'), 'open');
    await seek(5, close + 250);
    assert.equal(await stage.getAttribute('data-gate'), 'closing');
    const grip = await page.evaluate(() => {
      const gate = document.getElementById('gate');
      const hand = document.querySelector('[data-hand="boy-left"]');
      const handle = new DOMPoint(-40, -88).matrixTransform(gate.getCTM());
      const palm = new DOMPoint(0, Number(hand.dataset.gripY)).matrixTransform(hand.getCTM());
      return Math.hypot(handle.x - palm.x, handle.y - palm.y);
    });
    assert.ok(grip < 6, 'Sidak reaches the moving gate handle within 6 px, observed ' + grip.toFixed(1));
    await seek(5, close + 450);
    assert.equal(await stage.getAttribute('data-gate'), 'closed');
    assert.equal(await location.count(), 4);
    await page.screenshot({ path: output + '/04-gate-closed.png' });
    await speak(5, 2, 6);
    assert.equal(await opacity('wolf'), 0);
    await speak(6, 2, 3);
    assert.equal(await location.count(), 4);

    await page.locator('#movie').click();
    await page.waitForFunction(() => window.lp013Test.state().audioActive && window.lp013Test.state().position > 440);
    await page.setViewportSize({ width: 390, height: 844 });
    await speak(3, 2, 4);
    assert.ok((await page.locator('#reading').boundingBox()).width <= 390);
    await page.screenshot({ path: output + '/05-phone.png' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seek(1, arrive + 450);
    assert.equal(await stage.getAttribute('data-camera-motion'), 'static');
    assert.equal(await page.locator('#mehar').getAttribute('data-studio-motion'), 'stand');
    await seek(3, rush + 490);
    assert.equal(await page.locator('#flock > [data-activity="running"]').count(), 0);

    await page.goto(url + '?review=1&scene=safe-pen&test=1');
    await page.waitForFunction(() => window.lp013Test);
    assert.equal(await page.locator('#review-scenes li').count(), 7);
    assert.equal(await page.locator('#review-title').textContent(), 'Sidak closes the gate');
    assert.match(await page.locator('#review-audio').textContent(), /21\/21 voices · 21 aligned/);
    assert.equal(await page.locator('#review-progress').textContent(), '0 of 7 approved');
    await page.locator('#approve-scene').click();
    assert.equal(await page.locator('#review-progress').textContent(), '1 of 7 approved');
    await page.locator('#change-scene').click();
    assert.equal(await page.locator('#review-progress').textContent(), '0 of 7 approved');
    assert.deepEqual(errors, []);
    console.log('PASS Mission 13: 190 Punjabi words, 21 aligned clips, Studio cast, speaker-specific lips, timed flock and gate, mobile and review.');
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
