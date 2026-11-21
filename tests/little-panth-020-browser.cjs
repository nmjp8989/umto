#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { chromium } = require('playwright-core');

const url = process.env.LP020_URL || 'http://127.0.0.1:8765/little%20panth/mission-020/';
const output = '../lp20-qa';

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
    await page.waitForFunction(() => window.lp020Test || document.getElementById('loading').textContent.includes('ਨਹੀਂ'));
    assert.deepEqual(errors, []);

    const { scenes, clips } = await page.evaluate(() => window.lp020Test.state());
    const lines = scenes.flatMap(scene => scene.lines);
    assert.equal(scenes.length, 7);
    assert.equal(clips, 11);
    assert.ok(lines.every(line => line.aligned));
    assert.equal(new Set(lines.map(line => line.speaker)).size, 4);
    assert.equal(lines.reduce((total, line) => total + line.reading.words.length, 0), 181);
    const art = await page.locator('.art-page').boundingBox();
    const reading = await page.locator('.reading-page').boundingBox();
    assert.equal(art.width, reading.width);
    assert.equal(art.height, reading.height);
    assert.equal(await page.locator('button, header, nav, input').count(), 0);
    for (const [role, preset] of [['dadi', 'elder-bibi-ji'], ['boy', 'kid-sidak'], ['mehar', 'kid-meher']]) {
      assert.equal(await page.locator('#' + role).getAttribute('data-studio-preset'), preset);
    }
    assert.equal(await page.locator('#hen-animal #asset-chicken #chicken-wing').count(), 1);

    const stage = page.locator('#stage');
    const seek = (scene, ms) => page.evaluate(([index, time]) => window.lp020Test.seek(index, time), [scene, ms]);
    const wordAt = (scene, line, word) => {
      const entry = scenes[scene].lines[line];
      const index = entry.reading.words.findIndex(value => value.replace(/\p{P}/gu, '') === word);
      assert.ok(index >= 0, 'Missing word ' + word);
      return entry.start + entry.reading.timings[index][0];
    };
    const position = ([selector, x = 0, y = 0]) => page.evaluate(({ selector, x, y }) => {
      const node = document.querySelector(selector);
      const inverse = document.getElementById('stage').getScreenCTM().inverse();
      const point = new DOMPoint(x, y).matrixTransform(node.getScreenCTM()).matrixTransform(inverse);
      return { x: point.x, y: point.y };
    }, { selector, x, y });
    async function gap(a, b) {
      const [from, to] = await Promise.all([position(a), position(b)]);
      return Math.hypot(from.x - to.x, from.y - to.y);
    }
    const beak = ['#chicken-head', -46, -16];
    const seed = ['#hen-seed'];
    const palm = role => ['[data-hand="' + role + '-right"]', 0, 56];
    async function speak(scene, line, index) {
      const entry = scenes[scene].lines[line];
      const [from, to] = entry.reading.timings[index];
      await seek(scene, entry.start + (from + to) / 2);
      assert.equal(await page.locator('.word[aria-current="true"]').textContent(), entry.reading.words[index]);
      for (const id of ['boy', 'mehar', 'dadi']) {
        assert.equal(await page.locator('#' + id).getAttribute('data-speaking'), String(entry.speaker === id));
      }
    }

    const pick = wordAt(0, 0, 'ਚੁੱਕ');
    const set = wordAt(0, 0, 'ਰੱਖੇ');
    await seek(0, pick - 1);
    assert.equal(await stage.getAttribute('data-seed'), 'ground');
    assert.ok(await gap(seed, beak) < 1);
    await seek(0, pick + 560);
    assert.equal(await stage.getAttribute('data-seed'), 'beak');
    assert.ok(await gap(seed, beak) < 1);
    await seek(0, set + 5);
    assert.equal(await stage.getAttribute('data-seed'), 'bed');
    assert.ok(await gap(seed, beak) < 1);
    await page.screenshot({ path: output + '/01-seed.png' });

    await speak(1, 1, 4);
    const drop = wordAt(2, 0, 'ਸੁੱਟ');
    await seek(2, drop - 1);
    assert.ok(await gap(seed, beak) < 1);
    await seek(2, drop + 1);
    assert.equal(await stage.getAttribute('data-seed'), 'soil');
    assert.ok(await gap(seed, beak) < 1);
    await seek(2, wordAt(2, 0, 'ਗਿੱਲੀ') + 100);
    assert.equal(await page.locator('#book').getAttribute('data-layout'), 'cinema');
    assert.ok(Number(await page.locator('#hen-wet-soil').getAttribute('opacity')) > .3);
    await page.screenshot({ path: output + '/02-planting.png' });

    await seek(3, wordAt(3, 0, 'ਨਿਕਲੇ') + 400);
    assert.equal(await stage.getAttribute('data-wheat'), 'green');
    await seek(3, wordAt(3, 0, 'ਪੱਕੀ') + 520);
    assert.equal(await stage.getAttribute('data-wheat'), 'gold');
    await page.screenshot({ path: output + '/03-wheat.png' });
    await speak(3, 1, 6);
    assert.ok(await gap(['#hen-basket'], palm('boy')) < 1);

    const grind = wordAt(4, 0, 'ਚੱਕੀ');
    await seek(4, grind + 420);
    const before = await page.locator('#hen-mill-etch').getAttribute('transform');
    assert.ok(await gap(['#hen-crank-contact'], palm('dadi')) < 1);
    await seek(4, grind + 1120);
    assert.ok(await gap(['#hen-crank-contact'], palm('dadi')) < 1);
    assert.notEqual(await page.locator('#hen-mill-etch').getAttribute('transform'), before);
    await page.screenshot({ path: output + '/04-mill.png' });
    await speak(4, 1, 3);

    const lift = wordAt(5, 0, 'ਲਾਹ');
    const plate = wordAt(5, 0, 'ਚੁੱਕੀ');
    const rotiSet = wordAt(5, 0, 'ਰੱਖੀ');
    await seek(5, (lift + rotiSet) / 2);
    assert.ok(await gap(['#hen-tong-contact'], palm('dadi')) < 1);
    const tips = (await page.locator('#hen-tong-near').getAttribute('d')).split(' ').slice(-2).map(Number);
    const roti = await position(['#hen-roti', -26, 0]);
    assert.ok(Math.hypot(roti.x - tips[0], roti.y - tips[1]) < 8);
    await page.screenshot({ path: output + '/05-roti.png' });
    await seek(5, plate + 600);
    assert.ok(await gap(['#hen-plate', 40, 0], palm('boy')) < 1);
    assert.ok(await gap(['#hen-plate'], ['#hen-roti']) < 2);
    const placeDish = wordAt(5, 0, 'ਰੱਖੇ');
    await seek(5, placeDish - 330);
    assert.ok(await gap(['#hen-feed', 21, -2], palm('mehar')) < 1);

    await speak(6, 0, 3);
    await seek(6, wordAt(6, 1, 'ਚੁਗੇ') + 21);
    assert.ok(await gap(beak, ['#hen-picked-grain']) < 1);
    const sizes = await page.evaluate(() => ['hen-animal', 'boy'].map(id => document.getElementById(id).getBoundingClientRect().height));
    assert.ok(sizes[0] / sizes[1] < .57);
    const eat = wordAt(6, 1, 'ਖਾਣਾ');
    for (const [id, time] of [['boy', eat + 185], ['mehar', eat + 475]]) {
      await seek(6, time);
      const mouth = await page.locator('#' + id + ' [data-scene-layer="mouthGroup"]').evaluate(node => {
        const box = node.getBBox();
        return [box.x + box.width / 2, box.y + box.height / 2];
      });
      assert.ok(await gap(['#hen-bite-' + id], ['#' + id + ' [data-scene-layer="mouthGroup"]', ...mouth]) < 9,
        'Roti reaches ' + id + '’s lips');
      assert.equal(await page.locator('#' + id).getAttribute('data-speaking'), 'false');
    }
    await page.screenshot({ path: output + '/06-meal.png' });

    await page.locator('#movie').click();
    await page.waitForFunction(() => window.lp020Test.state().audioActive && window.lp020Test.state().position > 440);
    await page.setViewportSize({ width: 390, height: 844 });
    await seek(5, (lift + rotiSet) / 2);
    await page.screenshot({ path: output + '/07-phone.png' });
    assert.ok((await page.locator('#reading').boundingBox()).width <= 390);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seek(0, pick + 550);
    assert.equal(await stage.getAttribute('data-camera-motion'), 'static');

    await page.goto(url + '?review=1&scene=mill&test=1');
    await page.waitForFunction(() => window.lp020Test);
    assert.equal(await page.locator('#review-scenes li').count(), 7);
    assert.equal(await page.locator('#review-title').textContent(), 'Grinding the grain');
    assert.match(await page.locator('#review-audio').textContent(), /11\/11 voices · 11 aligned/);
    assert.equal(await page.locator('#review-progress').textContent(), '0 of 7 approved');
    await page.locator('#approve-scene').click();
    assert.equal(await page.locator('#review-progress').textContent(), '1 of 7 approved');
    assert.deepEqual(errors, []);
    console.log('PASS Mission 20: 181 Punjabi words, 11 aligned clips, physical seed, crank, and serving contacts, mobile, and review.');
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
