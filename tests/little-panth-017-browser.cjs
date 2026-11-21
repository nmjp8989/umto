#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { chromium } = require('playwright-core');

const url = process.env.LP017_URL || 'http://127.0.0.1:8765/little%20panth/mission-017/';
const output = '../lp17-qa';

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
    await page.waitForFunction(() => window.lp017Test || document.getElementById('loading').textContent.includes('ਨਹੀਂ'));
    assert.deepEqual(errors, []);

    const { scenes, clips } = await page.evaluate(() => window.lp017Test.state());
    const lines = scenes.flatMap(scene => scene.lines);
    assert.equal(scenes.length, 7);
    assert.equal(clips, 10);
    assert.ok(lines.every(line => line.aligned));
    assert.equal(new Set(lines.map(line => line.speaker)).size, 3);
    assert.equal(lines.reduce((total, line) => total + line.reading.words.length, 0), 179);
    assert.equal(await page.locator('button, header, nav, input, video[controls]').count(), 0);
    const art = await page.locator('.art-page').boundingBox();
    const reading = await page.locator('.reading-page').boundingBox();
    assert.equal(art.width, reading.width);
    assert.equal(art.height, reading.height);

    const stage = page.locator('#stage');
    const status = (id, key) => page.locator('#' + id).getAttribute('data-' + key);
    const opacity = async id => Number(await page.locator('#' + id).getAttribute('opacity'));
    const seek = (scene, ms) => page.evaluate(([index, time]) => window.lp017Test.seek(index, time), [scene, ms]);
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
      for (const id of ['mehar', 'boy']) {
        assert.equal(await status(id, 'speaking'), String(id === entry.speaker));
      }
      assert.equal(await status('sheru', 'barking'), 'false');
    }

    for (const [id, preset] of [['mehar', 'kid-meher'], ['boy', 'kid-sidak']]) {
      assert.equal(await status(id, 'studio-preset'), preset);
      assert.equal(await page.locator('#' + id + ' [data-rig-foot]').count(), 2);
    }
    await speak(0, 0, 3);
    assert.equal(await stage.getAttribute('data-camera-preset'), 'wide');
    assert.equal(await opacity('charpai'), 1);
    const transfer = wordAt(0, 1, 'ਲੈ') + 250;
    await seek(0, transfer - 65);
    assert.equal(await status('stage', 'bread'), 'offered');
    await seek(0, transfer + 75);
    assert.equal(await status('stage', 'bread'), 'carried');
    assert.equal(await opacity('free-bread'), 0);
    const handoffGap = await page.evaluate(() => {
      const hand = document.querySelector('[data-hand="mehar-right"]');
      const palm = new DOMPoint(0, Number(hand.dataset.gripY)).matrixTransform(hand.getCTM());
      const bread = new DOMPoint(0, 0).matrixTransform(document.getElementById('dog-bread').getCTM());
      return Math.hypot(palm.x - bread.x, palm.y - bread.y);
    });
    assert.ok(handoffGap < 2, 'The handoff joins the hand and mouth');
    await speak(0, 1, 4);

    await seek(1, 2080);
    assert.equal(await stage.getAttribute('data-camera-motion'), 'tracking');
    assert.equal(await status('sheru', 'walking'), 'true');
    assert.equal(await status('stage', 'bread'), 'carried');
    await seek(2, wordAt(2, 0, 'ਦਿਸਿਆ') + 380);
    assert.equal(await page.locator('#book').getAttribute('data-layout'), 'cinema');
    assert.equal(await page.locator('#reflection-image').getAttribute('href'), '#sheru');
    const matrix = await page.locator('#reflection-image').evaluate(node => {
      const { a, d, e } = node.transform.baseVal.consolidate().matrix;
      return { a, d, e };
    });
    assert.equal(matrix.a, 1);
    assert.equal(matrix.e, 0);
    assert.ok(matrix.d < 0, 'The reflection inverts the dog vertically');
    assert.ok(await opacity('reflection') > .55);
    assert.equal(await opacity('dog-bread'), 1);
    await page.screenshot({ path: output + '/01-reflection.png' });

    const bark = wordAt(3, 0, 'ਭੌਂਕਿਆ');
    assert.ok(scenes[3].events.some(cue => cue.sound === 'bark' && Math.abs(cue.ms - bark) < 190));
    await seek(3, bark - 280);
    assert.equal(await status('sheru', 'holding'), 'true');
    assert.equal(await status('sheru', 'barking'), 'false');
    await seek(3, bark + 237);
    assert.equal(await status('sheru', 'holding'), 'false');
    assert.equal(await status('sheru', 'barking'), 'true');
    assert.equal(await status('stage', 'bread'), 'loose');
    assert.equal(await opacity('splash-drops'), 0);
    await seek(3, bark + 806);
    assert.equal(await status('stage', 'water'), 'rippling');
    assert.ok(await opacity('splash-drops') > .85);
    await page.screenshot({ path: output + '/02-splash.png' });

    await seek(3, scenes[3].duration);
    const beforeCut = await page.locator('#free-bread').getAttribute('transform');
    await seek(4, 0);
    assert.equal(await status('stage', 'water'), 'rippling');
    assert.equal(await page.locator('#free-bread').getAttribute('transform'), beforeCut);
    await seek(4, wordAt(4, 0, 'ਠਹਿਰੀਆਂ') + 525);
    assert.equal(await status('stage', 'water'), 'still');
    assert.equal(await status('stage', 'bread'), 'gone');
    assert.ok(await opacity('reflection') > .55);
    assert.equal(await opacity('dog-bread'), 0);

    await seek(5, wordAt(5, 0, 'ਟੇਢਾ') + 720);
    const tilted = await page.locator('#dog-head').getAttribute('transform');
    assert.equal(tilted, 'translate(42 -108) rotate(38)');
    await speak(5, 1, 5);
    await speak(6, 0, 5);
    await seek(6, wordAt(6, 1, 'ਤੁਰ') + 2090);
    assert.equal(await status('sheru', 'walking'), 'true');
    assert.equal(await opacity('reflection'), 0);

    await page.locator('#movie').click();
    await page.waitForFunction(() => window.lp017Test.state().audioActive && window.lp017Test.state().position > 440);
    await page.setViewportSize({ width: 390, height: 844 });
    await seek(2, wordAt(2, 0, 'ਦਿਸਿਆ') + 380);
    assert.ok((await page.locator('#reading').boundingBox()).width <= 390);
    await page.screenshot({ path: output + '/03-phone.png' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seek(1, 2080);
    assert.equal(await stage.getAttribute('data-camera-motion'), 'static');
    assert.equal(await status('sheru', 'walking'), 'false');

    await page.goto(url + '?review=1&scene=splash&test=1');
    await page.waitForFunction(() => window.lp017Test);
    assert.equal(await page.locator('#review-scenes li').count(), 7);
    assert.equal(await page.locator('#review-title').textContent(), 'The roti falls');
    assert.match(await page.locator('#review-audio').textContent(), /10\/10 voices · 10 aligned/);
    assert.equal(await page.locator('#review-progress').textContent(), '0 of 7 approved');
    await page.locator('#approve-scene').click();
    assert.equal(await page.locator('#review-progress').textContent(), '1 of 7 approved');
    assert.deepEqual(errors, []);
    console.log('PASS Mission 17: 179 Punjabi words, 10 aligned clips, Studio cast, reflected roti and continuous splash, mobile, and review.');
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
