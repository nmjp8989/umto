#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { chromium } = require('playwright-core');

const url = process.env.LP018_URL || 'http://127.0.0.1:8765/little%20panth/mission-018/';
const output = '../lp18-qa';

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
    await page.waitForFunction(() => window.lp018Test || document.getElementById('loading').textContent.includes('ਨਹੀਂ'));
    assert.deepEqual(errors, []);

    const { scenes, clips } = await page.evaluate(() => window.lp018Test.state());
    const lines = scenes.flatMap(scene => scene.lines);
    assert.equal(scenes.length, 7);
    assert.equal(clips, 11);
    assert.ok(lines.every(line => line.aligned));
    assert.equal(new Set(lines.map(line => line.speaker)).size, 3);
    assert.equal(lines.reduce((total, line) => total + line.reading.words.length, 0), 180);
    assert.equal(await page.locator('button, header, nav, input, video[controls]').count(), 0);
    const art = await page.locator('.art-page').boundingBox();
    const reading = await page.locator('.reading-page').boundingBox();
    assert.equal(art.width, reading.width);
    assert.equal(art.height, reading.height);

    const stage = page.locator('#stage');
    const location = id => page.locator('#' + id).evaluate(node => node.transform.baseVal.getItem(0).matrix.e);
    const status = (id, key) => page.locator('#' + id).getAttribute('data-' + key);
    const opacity = async id => Number(await page.locator('#' + id).getAttribute('opacity'));
    const seek = (scene, ms) => page.evaluate(([index, time]) => window.lp018Test.seek(index, time), [scene, ms]);
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
      for (const id of ['mouse', 'friend']) {
        assert.equal(await status(id, 'speaking'), String(id === entry.speaker));
      }
    }

    async function checkBite(id, food) {
      assert.equal(await status(id, 'holding'), food);
      const distances = await page.evaluate(id => {
        const stage = document.getElementById('stage').getCTM().inverse();
        const mouse = document.getElementById(id);
        const piece = mouse.querySelector('[data-bite]');
        const paw = mouse.querySelector('[data-paw]');
        const head = mouse.querySelector('[data-head]');
        const food = new DOMPoint(0, 0).matrixTransform(piece.getCTM()).matrixTransform(stage);
        const grip = new DOMPoint(+paw.getAttribute('cx'), +paw.getAttribute('cy'))
          .matrixTransform(paw.getCTM()).matrixTransform(stage);
        const mouth = new DOMPoint(68, -18).matrixTransform(head.getCTM()).matrixTransform(stage);
        return [Math.hypot(food.x - grip.x, food.y - grip.y), Math.hypot(food.x - mouth.x, food.y - mouth.y)];
      }, id);
      assert.ok(distances[0] < 1, 'Food stays in the mouse’s paw');
      assert.ok(distances[1] < 2, 'The bite reaches the mouth');
    }

    await speak(0, 0, 4);
    assert.equal(await stage.getAttribute('data-camera-preset'), 'wide');
    assert.equal(await status('stage', 'place'), 'country');
    const visit = wordAt(0, 0, 'ਮਿਲਣ');
    await seek(0, visit - 780);
    assert.equal(await stage.getAttribute('data-camera-motion'), 'tracking');
    assert.ok(await location('friend') > 758);

    await seek(1, wordAt(1, 0, 'ਦਾਣੇ') + 1200);
    await checkBite('mouse', 'grain');
    assert.equal(await opacity('country-grain'), 0);
    await speak(1, 1, 5);

    await speak(2, 1, 4);
    assert.equal(await status('stage', 'place'), 'town');
    assert.equal(await page.locator('#book').getAttribute('data-layout'), 'cinema');
    assert.equal(await opacity('field-food'), 0);
    await page.screenshot({ path: output + '/01-town.png' });

    await seek(3, wordAt(3, 0, 'ਚੁੱਕਿਆ') + 665);
    await checkBite('mouse', 'sweet');
    assert.equal(await opacity('country-sweet'), 0);
    assert.equal(await opacity('cat-shadow'), 0);
    const steps = wordAt(3, 0, 'ਕਦਮਾਂ');
    await seek(3, steps + 625);
    assert.ok(await opacity('cat-shadow') > .55);
    assert.equal(await status('mouse', 'holding'), '');
    assert.equal(await opacity('loose-sweet'), 1);
    await page.screenshot({ path: output + '/02-cat-shadow.png' });
    await speak(3, 1, 4);
    assert.ok(await location('mouse') > 1000 && await location('friend') > 900);

    await speak(4, 1, 5);
    assert.equal(await opacity('cat-shadow'), 0);
    assert.ok(await location('mouse') < 740 && await location('friend') < 900);
    await seek(5, wordAt(5, 0, 'ਦਾਣਾ') + 652);
    assert.equal(await status('stage', 'place'), 'country');
    await checkBite('mouse', 'grain');
    const sharing = wordAt(6, 0, 'ਖਾਂਦੇ') + 856;
    await seek(6, sharing);
    await checkBite('mouse', 'grain');
    await checkBite('friend', 'grain');
    await page.screenshot({ path: output + '/03-shared-grains.png' });

    await page.locator('#movie').click();
    await page.waitForFunction(() => window.lp018Test.state().audioActive && window.lp018Test.state().position > 440);
    await page.setViewportSize({ width: 390, height: 844 });
    await seek(3, steps + 625);
    assert.ok((await page.locator('#reading').boundingBox()).width <= 390);
    await page.screenshot({ path: output + '/04-phone.png' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seek(0, visit - 780);
    assert.equal(await stage.getAttribute('data-camera-motion'), 'static');

    await page.goto(url + '?review=1&scene=footsteps&test=1');
    await page.waitForFunction(() => window.lp018Test);
    assert.equal(await page.locator('#review-scenes li').count(), 7);
    assert.equal(await page.locator('#review-title').textContent(), 'Footsteps by the door');
    assert.match(await page.locator('#review-audio').textContent(), /11\/11 voices · 11 aligned/);
    assert.equal(await page.locator('#review-progress').textContent(), '0 of 7 approved');
    await page.locator('#approve-scene').click();
    assert.equal(await page.locator('#review-progress').textContent(), '1 of 7 approved');
    assert.deepEqual(errors, []);
    console.log('PASS Mission 18: 180 Punjabi words, 11 aligned voices, grounded bites, timed hiding, mobile, and review.');
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
