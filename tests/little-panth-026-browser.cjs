#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { chromium } = require('playwright-core');

const url = process.env.LP026_URL || 'http://127.0.0.1:8765/little%20panth/mission-026/';
const output = '../lp26-qa';

async function run() {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : { channel: 'chrome' }),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(url + '?test=1');
    await page.waitForFunction(() => window.lp026Test || document.getElementById('loading').textContent.includes('ਨਹੀਂ'));
    assert.deepEqual(errors, []);
    const { scenes, clips } = await page.evaluate(() => window.lp026Test.state());
    const lines = scenes.flatMap(scene => scene.lines);
    assert.equal(scenes.length, 7);
    assert.equal(clips, 12);
    assert.ok(lines.every(line => line.aligned));
    assert.deepEqual([...new Set(lines.map(line => line.speaker))].sort(), ['goose', 'mehar', 'narrator', 'second-goose', 'tortoise']);
    assert.equal(lines.reduce((total, line) => total + line.reading.words.length, 0), 181);
    assert.equal(await page.locator('#mehar').getAttribute('data-studio-preset'), 'kid-meher');
    assert.equal(await page.locator('#friend').getAttribute('data-studio-preset'), 'kid-amir');
    assert.equal(await page.locator('button, header, nav, input').count(), 0);
    const art = await page.locator('.art-page').boundingBox();
    const reading = await page.locator('.reading-page').boundingBox();
    assert.equal(art.width, reading.width);
    assert.equal(art.height, reading.height);

    const seek = (scene, ms) => page.evaluate(([index, time]) => window.lp026Test.seek(index, time), [scene, ms]);
    const entry = (scene, line) => scenes[scene].lines[line];
    const word = (scene, line, text) => {
      const item = entry(scene, line);
      const index = item.reading.words.findIndex(value => value.replace(/\p{P}/gu, '') === text);
      assert.ok(index >= 0, 'Missing word ' + text);
      return item.start + item.reading.timings[index][0];
    };
    const position = selector => page.locator(selector).evaluate(node => {
      const local = new DOMPoint(Number(node.getAttribute('cx')) || 0, Number(node.getAttribute('cy')) || 0);
      const view = document.getElementById('stage').getScreenCTM().inverse();
      const value = local.matrixTransform(node.getScreenCTM()).matrixTransform(view);
      return { x: value.x, y: value.y };
    });
    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    async function close(a, b, max, description) {
      const gap = distance(await position(a), await position(b));
      assert.ok(gap < max, description + ' (gap ' + gap.toFixed(2) + ')');
    }
    const state = () => page.locator('#tortoise').getAttribute('data-state');
    const stick = ['#stick-first', '#stick-middle', '#stick-second'];
    const bill = ['#goose [data-beak]', '#second-goose [data-beak]'];
    const turtle = '#tortoise-bite';
    const show = id => page.locator(id).getAttribute('visibility');
    async function speaks(scene, line, index) {
      const current = entry(scene, line);
      const [from, to] = current.reading.timings[index];
      await seek(scene, current.start + (from + to) / 2);
      assert.equal(await page.locator('.word[aria-current="true"]').textContent(), current.reading.words[index]);
      for (const role of ['goose', 'second-goose', 'tortoise', 'mehar']) {
        if (role === 'mehar' && scene !== 3) continue;
        assert.equal(await page.locator('#' + role).getAttribute('data-speaking'), String(current.speaker === role));
      }
    }
    async function birdGrips() {
      await close(bill[0], stick[0], 1, 'The first goose grips its end');
      await close(bill[1], stick[2], 1, 'The second goose grips its end');
    }

    await speaks(0, 1, 5);
    assert.equal(await show('#small-pool'), 'visible');
    assert.equal(await show('#new-pond'), 'hidden');
    await page.screenshot({ path: output + '/01-dry-pond.png' });
    await speaks(1, 0, 9);
    assert.equal(await state(), 'ashore');
    await seek(1, word(1, 1, 'ਫੜਿਆ') + 25);
    await birdGrips();
    await close(turtle, stick[1], 1, 'The tortoise grips the middle before lifting off');
    assert.equal(await state(), 'holding');
    await seek(1, word(1, 1, 'ਉੱਪਰ') + 660);
    await birdGrips();
    await close(turtle, stick[1], 1, 'The tortoise keeps hold during takeoff');
    await seek(2, 1820);
    assert.equal(await show('#field-landscape'), 'visible');
    assert.equal(await page.locator('#book').getAttribute('data-layout'), 'cinema');
    assert.equal(await page.locator('#stage').getAttribute('data-camera-motion'), 'tracking');
    await birdGrips();
    await close(turtle, stick[1], 1, 'All three grips stay in place over the fields');
    await page.screenshot({ path: output + '/02-flight.png' });
    await speaks(3, 1, 1);
    assert.equal(await show('#children'), 'visible');
    assert.equal(await page.locator('#friend').getAttribute('data-speaking'), 'false');
    await page.screenshot({ path: output + '/03-children.png' });

    const release = word(4, 0, 'ਛੁੱਟ');
    const hit = word(4, 0, 'ਛਪਾਕ');
    await seek(4, release - 1);
    assert.equal(await state(), 'holding');
    assert.equal(await page.locator('#tortoise').getAttribute('data-mouth-open'), 'true');
    await close(turtle, stick[1], 1, 'The tortoise is still attached at the start of the release');
    const before = await position(turtle);
    await seek(4, release + 1);
    const after = await position(turtle);
    assert.ok(distance(before, after) < 2, 'The fall starts at the old grip');
    assert.equal(await state(), 'falling');
    await seek(4, release + 800);
    await birdGrips();
    assert.ok(distance(await position(turtle), await position(stick[1])) > 45, 'The tortoise separates from the stick');
    await page.screenshot({ path: output + '/04-release.png' });
    await seek(4, hit - 2);
    assert.equal(await page.locator('#pond-impact').getAttribute('opacity'), '0');
    await seek(4, hit + 80);
    assert.equal(await state(), 'submerged');
    assert.equal(await show('#new-pond'), 'visible');
    assert.ok(Number(await page.locator('#pond-impact').getAttribute('opacity')) > .8);
    assert.ok(distance(await position('#pond-impact'), { x: 713, y: 588 }) < 1);
    await page.screenshot({ path: output + '/05-splash.png' });

    await seek(5, word(5, 0, 'ਤੈਰ') + 760);
    assert.equal(await state(), 'swimming');
    assert.ok(Number(await page.locator('#tortoise-wake').getAttribute('opacity')) > .7);
    await page.screenshot({ path: output + '/06-swim.png' });
    await speaks(5, 1, 2);
    assert.equal(await state(), 'ashore');
    await speaks(5, 2, 3);
    await seek(6, word(6, 0, 'ਛਾਂ') + 2000);
    assert.equal(await page.locator('#pond-shade').getAttribute('opacity'), '1');
    await page.screenshot({ path: output + '/07-shade.png' });

    await page.setViewportSize({ width: 393, height: 852 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seek(2, 1650);
    assert.equal(await page.locator('#stage').getAttribute('data-camera-motion'), 'static');
    await birdGrips();
    await close(turtle, stick[1], 1, 'The reduced-motion flight keeps the grips in place');
    const frame = await page.locator('#movie').boundingBox();
    assert.ok(frame.width <= 394 && frame.height > 140);
    await page.screenshot({ path: output + '/08-mobile.png' });

    await page.goto(url + '?review=1&scene=splash&test=1');
    await page.waitForFunction(() => window.lp026Test);
    assert.equal(await page.locator('#review-scenes li').count(), 7);
    assert.equal(await page.locator('#review-title').textContent(), 'A splash in the new pond');
    assert.match(await page.locator('#review-audio').textContent(), /12\/12 voices · 12 aligned/);
    await page.locator('#watch-scene').click();
    await page.waitForFunction(() => window.lp026Test.state().audioActive && window.lp026Test.state().position > 440);
    await page.locator('#watch-scene').click();
    await page.locator('#approve-scene').click();
    assert.equal(await page.locator('#review-progress').textContent(), '1 of 7 approved');
    assert.deepEqual(errors, []);
    console.log('PASS Mission 26: 181 Punjabi words, 12 aligned clips, flight grips, release, splash, swim, mobile and review.');
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
