#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { chromium } = require('playwright-core');
const manifest = require('../little panth/mission-027/audio/generation-manifest.json');

const url = process.env.LP027_URL || 'http://127.0.0.1:8765/little%20panth/mission-027/';
const output = '../lp27-qa';

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
    await page.waitForFunction(() => window.lp027Test || document.getElementById('loading').textContent.includes('ਨਹੀਂ'));
    assert.deepEqual(errors, []);
    const state = () => page.evaluate(() => window.lp027Test.state());
    const { scenes, clips, generatedScore } = await state();
    const lines = scenes.flatMap(scene => scene.lines);
    assert.equal(scenes.length, 6);
    assert.equal(clips, 10);
    assert.equal(generatedScore, true);
    assert.equal(lines.reduce((total, line) => total + line.reading.words.length, 0), 185);
    assert.ok(lines.every(line => line.aligned));
    assert.equal(new Set(Object.values(manifest).map(line => line.voice)).size, 3);
    const native = ['mehar', 'harpreet'];
    for (const [i, preset] of ['kid-meher', 'adult-harpreet'].entries()) {
      assert.equal(await page.locator('#' + native[i]).getAttribute('data-studio-preset'), preset);
    }
    assert.equal(await page.locator('button, header, nav, input').count(), 0);
    const art = await page.locator('.art-page').boundingBox();
    const words = await page.locator('.reading-page').boundingBox();
    assert.equal(art.width, words.width);
    assert.equal(art.height, words.height);

    const seek = (scene, ms) => page.evaluate(([index, time]) => window.lp027Test.seek(index, time), [scene, ms]);
    const at = (scene, line, word) => {
      const entry = scenes[scene].lines[line];
      const i = entry.reading.words.findIndex(value => value.replace(/\p{P}/gu, '') === word);
      assert.ok(i >= 0, 'Missing word ' + word);
      return entry.start + entry.reading.timings[i][0];
    };
    const position = (selector, x = 0, y = 0) => page.evaluate(({ selector, x, y }) => {
      const node = document.querySelector(selector);
      const inverse = document.getElementById('stage').getScreenCTM().inverse();
      const target = new DOMPoint(x, y).matrixTransform(node.getScreenCTM()).matrixTransform(inverse);
      return { x: target.x, y: target.y };
    }, { selector, x, y });
    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const opacity = async selector => Number(await page.locator(selector).getAttribute('opacity'));
    const shot = () => page.locator('#stage').getAttribute('data-shot');

    async function speech(scene, line, word) {
      const entry = scenes[scene].lines[line];
      const [from, to] = entry.reading.timings[word];
      await seek(scene, entry.start + (from + to) / 2);
      assert.equal(await page.locator('.word[aria-current="true"]').textContent(), entry.reading.words[word]);
      for (const id of native) {
        if (await opacity('#' + id) === 1 || id === 'mehar') {
          assert.equal(await page.locator('#' + id).getAttribute('data-speaking'), String(id === entry.speaker));
        }
      }
    }

    await speech(0, 0, 14);
    assert.equal(await opacity('#harpreet'), 0);
    await page.screenshot({ path: output + '/01-courtyard.png' });
    await speech(1, 1, 3);
    assert.equal(await opacity('#moon-round'), 1);
    assert.equal(await page.locator('#bowl-surface').getAttribute('clip-path'), 'url(#inside-the-water)');
    await page.screenshot({ path: output + '/02-sees-moon.png' });

    const touchTime = at(2, 0, 'ਛੁਹਾਈ');
    await seek(2, touchTime - 100);
    assert.equal(await opacity('#surface-rings'), 0);
    const firstFoot = await position('#mehar [data-rig-foot]');
    await seek(2, touchTime + 90);
    const tip = await position('[data-hand="mehar-right"]', -47, 146);
    const center = await page.locator('#water-contact').evaluate(node => ({ x: node.cx.baseVal.value, y: node.cy.baseVal.value }));
    assert.equal(await page.locator('#water-contact').getAttribute('data-touching'), 'true');
    assert.ok(distance(tip, center) < 2, 'The visible fingertip reaches the ripple origin, gap ' + distance(tip, center));
    assert.ok(distance(firstFoot, await position('#mehar [data-rig-foot]')) < 1);
    const inside = await page.locator('#inside-the-water ellipse').evaluate((node, p) =>
      node.isPointInFill(new DOMPoint(p.x, p.y)), center);
    assert.ok(inside);
    assert.equal(scenes[2].events[0].ms, touchTime);
    await page.screenshot({ path: output + '/03-touch.png' });
    await seek(2, at(2, 0, 'ਲਹਿਰਾਂ') + 500);
    assert.ok(await opacity('#moon-broken') > .9);
    assert.ok(await opacity('#moon-round') < .1);
    assert.ok(await opacity('#surface-rings') > .85);
    await page.screenshot({ path: output + '/04-ripples.png' });

    await seek(3, at(3, 0, 'ਇਸ਼ਾਰਾ') + 255);
    assert.equal(await page.locator('[data-hand="harpreet-right"]').getAttribute('data-action-hand'), 'point');
    const gazeDown = await page.locator('#mehar [data-scene-layer="eyeGroup"]').innerHTML();
    await seek(3, at(3, 0, 'ਚੁੱਕਿਆ') + 245);
    assert.equal(await shot(), 'revealed-moon');
    assert.notEqual(await page.locator('#mehar [data-scene-layer="eyeGroup"]').innerHTML(), gazeDown);
    const handUp = await position('[data-hand="harpreet-right"]', -47, 146);
    const shoulder = await position('[data-rig-arm="1"]:has([data-hand="harpreet-right"])', 0, 48);
    assert.ok(handUp.y < shoulder.y - 54 && handUp.x > shoulder.x + 20, 'Harpreet reaches upward beside his face');
    const skyMoon = await page.locator('#moon-in-sky circle').nth(1).boundingBox();
    const movie = await page.locator('#movie').boundingBox();
    assert.ok(skyMoon.y >= movie.y && skyMoon.y + skyMoon.height <= movie.y + movie.height, 'The moon is fully framed');
    await page.screenshot({ path: output + '/05-moon-reveal.png' });
    await speech(3, 1, 10);
    assert.equal(await shot(), 'two-shot');
    await page.screenshot({ path: output + '/06-explains.png' });

    await seek(4, at(4, 0, 'ਸ਼ਾਂਤ') + 420);
    assert.equal(await opacity('#moon-round'), 1);
    assert.equal(await opacity('#surface-rings'), 0);
    await speech(4, 1, 4);
    await speech(5, 0, 16);
    await page.screenshot({ path: output + '/07-finale.png' });

    await page.setViewportSize({ width: 393, height: 852 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seek(0, at(0, 0, 'ਆਈ'));
    assert.equal(await page.locator('#stage').getAttribute('data-camera-motion'), 'static');
    await speech(1, 1, 5);
    const narrow = await page.locator('#movie').boundingBox();
    assert.ok(narrow.width <= 394 && narrow.height > 140);
    await page.screenshot({ path: output + '/08-mobile.png' });

    await page.goto(url + '?review=1&scene=touch-the-water&test=1');
    await page.waitForFunction(() => window.lp027Test);
    assert.equal(await page.locator('#review-scenes li').count(), 6);
    assert.equal(await page.locator('#review-title').textContent(), 'One finger makes ripples');
    assert.match(await page.locator('#review-audio').textContent(), /10\/10 voices · 10 aligned/);
    await page.locator('#watch-scene').click();
    await page.waitForFunction(() => window.lp027Test.state().audioActive && window.lp027Test.state().position > 440);
    await page.locator('#watch-scene').click();
    await page.locator('#approve-scene').click();
    assert.equal(await page.locator('#review-progress').textContent(), '1 of 6 approved');
    assert.deepEqual(errors, []);
    console.log('PASS Mission 27: 185 Punjabi words, 10 aligned clips, three distinct voices, score, fingertip contact, moon reveal, mobile and scene approval.');
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
