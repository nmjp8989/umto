#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { chromium } = require('playwright-core');

const url = process.env.LP014_URL || 'http://127.0.0.1:8765/little%20panth/mission-014/';
const output = '../lp14-qa';

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
    const hens = page.waitForResponse(response => response.url().endsWith('/assets/props/chicken.svg') && response.ok());
    await page.goto(url + '?test=1');
    await page.waitForFunction(() => window.lp014Test || document.getElementById('loading').textContent.includes('ਨਹੀਂ'));
    assert.deepEqual(errors, []);
    await hens;
    const { scenes, clips } = await page.evaluate(() => window.lp014Test.state());
    assert.equal(scenes.length, 7);
    assert.equal(clips, 14);
    const lines = scenes.flatMap(scene => scene.lines);
    assert.ok(lines.every(line => line.aligned));
    assert.equal(new Set(lines.map(line => line.speaker)).size, 4);
    assert.equal(lines.reduce((total, line) => total + line.reading.words.length, 0), 184);
    assert.equal(await page.locator('button, header, nav, input, video[controls]').count(), 0);
    const left = await page.locator('.art-page').boundingBox();
    const right = await page.locator('.reading-page').boundingBox();
    assert.equal(left.width, right.width);
    assert.equal(left.height, right.height);

    const stage = page.locator('#stage');
    const pail = page.locator('#pail');
    const owner = () => pail.evaluate(node => node.parentElement.id);
    const opacity = async id => Number(await page.locator('#' + id).getAttribute('opacity'));
    const seek = (scene, ms) => page.evaluate(([index, time]) => window.lp014Test.seek(index, time), [scene, ms]);
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

    async function assertHeldBy(actor) {
      assert.equal(await owner(), actor + '-props');
      const gap = await page.evaluate(id => {
        const hand = document.querySelector('[data-hand="' + id + '-right"]');
        const handle = new DOMPoint(0, 0).matrixTransform(document.getElementById('pail').getCTM());
        const palm = new DOMPoint(0, Number(hand.dataset.gripY)).matrixTransform(hand.getCTM());
        return Math.hypot(handle.x - palm.x, handle.y - palm.y);
      }, actor);
      assert.ok(gap < 2, actor + ' holds the pail by its handle, observed ' + gap.toFixed(1) + ' px gap');
    }

    for (const [id, preset] of [['mehar', 'kid-meher'], ['boy', 'kid-sidak'], ['dadi', 'elder-bibi-ji']]) {
      assert.equal(await page.locator('#' + id).getAttribute('data-studio-preset'), preset);
      assert.equal(await page.locator('#' + id + ' [data-rig-foot]').count(), 2);
    }
    await speak(0, 0, 3);
    await assertHeldBy('dadi');
    await speak(0, 1, 4);
    await assertHeldBy('mehar');
    await page.screenshot({ path: output + '/01-handoff.png' });

    await seek(1, 1250);
    assert.equal(await stage.getAttribute('data-camera-motion'), 'tracking');
    assert.equal(await page.locator('#mehar').getAttribute('data-studio-motion'), 'walk');
    await assertHeldBy('mehar');
    assert.equal(await stage.getAttribute('data-pail'), 'full');
    await speak(1, 1, 3);

    const hatch = wordAt(2, 0, 'ਨਿਕਲਣਗੇ');
    await seek(2, hatch - 410);
    assert.equal(await page.locator('#book').getAttribute('data-layout'), 'cinema');
    assert.equal(await page.locator('#hatchery [data-hatched="true"]').count(), 0);
    await seek(2, hatch + 780);
    assert.equal(await page.locator('#hatchery [data-hatched="true"]').count(), 3);
    await page.screenshot({ path: output + '/02-chicks.png' });
    await seek(2, wordAt(2, 1, 'ਦੇਣਗੀਆਂ') + 810);
    assert.equal(await opacity('chicken-yard'), 1);
    assert.equal(await opacity('new-eggs'), 1);
    await seek(3, wordAt(3, 0, 'ਚੁੰਨੀ') + 450);
    assert.equal(await opacity('imagined-scarf'), 1);

    const tip = wordAt(4, 0, 'ਝੁਕ');
    await seek(4, tip - 160);
    assert.equal(await opacity('imagined-scarf'), 0);
    assert.equal(await opacity('spill-stream'), 0);
    const spilling = wordAt(4, 0, 'ਦੁੱਧ') + 410;
    await seek(4, spilling);
    assert.equal(await stage.getAttribute('data-pail'), 'pouring');
    assert.ok(await opacity('spill-stream') > .35);
    await page.screenshot({ path: output + '/03-spill.png' });
    await seek(4, scenes[4].duration - 90);
    assert.equal(await stage.getAttribute('data-pail'), 'empty');
    assert.equal(await opacity('puddle'), 1);
    assert.equal(await opacity('spill-stream'), 0);
    assert.equal(await owner(), 'objects');

    await speak(5, 1, 4);
    await assertHeldBy('boy');
    await speak(5, 2, 7);
    assert.equal(await page.locator('#book').getAttribute('data-layout'), 'spread');
    const rinse = wordAt(6, 0, 'ਧੋ');
    await seek(6, rinse + 300);
    assert.ok(await opacity('rinse-stream') > .55);
    assert.equal(await opacity('yard-background'), 1);
    await speak(6, 1, 5);
    assert.equal(await opacity('rinse-stream'), 0);
    assert.equal(await owner(), 'objects');

    await page.locator('#movie').click();
    await page.waitForFunction(() => window.lp014Test.state().audioActive && window.lp014Test.state().position > 440);
    await page.setViewportSize({ width: 390, height: 844 });
    await seek(4, spilling);
    assert.ok((await page.locator('#reading').boundingBox()).width <= 390);
    await page.screenshot({ path: output + '/04-phone.png' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seek(1, 1250);
    assert.equal(await stage.getAttribute('data-camera-motion'), 'static');
    assert.equal(await page.locator('#mehar').getAttribute('data-studio-motion'), 'stand');

    await page.goto(url + '?review=1&scene=spill&test=1');
    await page.waitForFunction(() => window.lp014Test);
    assert.equal(await page.locator('#review-scenes li').count(), 7);
    assert.equal(await page.locator('#review-title').textContent(), 'The pail tips');
    assert.match(await page.locator('#review-audio').textContent(), /14\/14 voices · 14 aligned/);
    assert.equal(await page.locator('#review-progress').textContent(), '0 of 7 approved');
    await page.locator('#approve-scene').click();
    assert.equal(await page.locator('#review-progress').textContent(), '1 of 7 approved');
    assert.deepEqual(errors, []);
    console.log('PASS Mission 14: 184 Punjabi words, 14 aligned clips, native cast and grips, hatching, spill, rinse, mobile, and review.');
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
