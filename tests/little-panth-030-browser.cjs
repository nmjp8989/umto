#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { chromium } = require('playwright-core');
const manifest = require('../little panth/mission-030/audio/generation-manifest.json');

const url = process.env.LP030_URL || 'http://127.0.0.1:8765/little%20panth/mission-030/';
const output = '../lp30-qa';

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
    await page.waitForFunction(() => window.lp030Test || document.getElementById('loading').textContent.includes('ਨਹੀਂ'));
    assert.deepEqual(errors, []);
    const { scenes, clips } = await page.evaluate(() => window.lp030Test.state());
    const lines = scenes.flatMap(scene => scene.lines);
    assert.equal(scenes.length, 6);
    assert.equal(clips, 10);
    assert.ok(lines.every(line => line.aligned));
    assert.equal(lines.reduce((total, line) => total + line.reading.words.length, 0), 181);
    assert.equal(new Set(Object.values(manifest).map(line => line.voice)).size, 3);
    assert.equal(await page.locator('#mehar').getAttribute('data-studio-preset'), 'kid-meher');
    assert.equal(await page.locator('#harpreet').getAttribute('data-studio-preset'), 'adult-harpreet');
    assert.equal(await page.locator('button, header, nav, input').count(), 0);
    const art = await page.locator('.art-page').boundingBox();
    const words = await page.locator('.reading-page').boundingBox();
    assert.equal(art.width, words.width);
    assert.equal(art.height, words.height);

    const seek = (scene, ms) => page.evaluate(([index, time]) => window.lp030Test.seek(index, time), [scene, ms]);
    const at = (scene, line, word) => {
      const entry = scenes[scene].lines[line];
      const index = entry.reading.words.findIndex(value => value.replace(/\p{P}/gu, '') === word);
      assert.ok(index >= 0, 'Missing word ' + word);
      return entry.start + entry.reading.timings[index][0];
    };
    const position = (selector, x = 0, y = 0) => page.evaluate(({ selector, x, y }) => {
      const node = document.querySelector(selector);
      const inverse = document.getElementById('stage').getScreenCTM().inverse();
      const target = new DOMPoint(x, y).matrixTransform(node.getScreenCTM()).matrixTransform(inverse);
      return { x: target.x, y: target.y };
    }, { selector, x, y });
    const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const attr = (selector, key) => page.locator(selector).getAttribute(key);
    const speed = async () => Number(await attr('#pinwheel', 'data-speed'));
    const rotor = () => attr('#wheel-rotor', 'transform');
    const photo = name => page.screenshot({ path: output + '/' + name + '.png' });
    async function attachment() {
      assert.ok(gap(await position('#pinwheel'), await position('[data-hand="mehar-right"]', -30, 84)) < 1);
      assert.ok(gap(await position('#wheel-hub'), await position('#wheel-rotor')) < 1);
    }
    async function speech(scene, line, index) {
      const entry = scenes[scene].lines[line];
      const [from, to] = entry.reading.timings[index];
      await seek(scene, entry.start + (from + to) / 2);
      assert.equal(await page.locator('.word[aria-current="true"]').textContent(), entry.reading.words[index]);
      for (const id of ['mehar', 'harpreet']) assert.equal(await attr('#' + id, 'data-speaking'), String(id === entry.speaker));
    }

    await speech(0, 0, 11);
    assert.equal(await speed(), 0);
    await attachment();
    await photo('01-wall-and-field');
    await speech(0, 1, 8);
    const nomotion = await rotor();
    const shake = at(1, 0, 'ਹਿਲਾਈ');
    await seek(1, shake + 370);
    assert.ok(await speed() > 40);
    assert.notEqual(await rotor(), nomotion);
    await attachment();
    await seek(1, at(1, 0, 'ਰੁਕ') + 370);
    assert.equal(await speed(), 0);
    await speech(1, 1, 5);
    await photo('02-ribbon');

    const raise = at(2, 0, 'ਉੱਚੀ');
    await seek(2, raise + 360);
    const out = await position('#mehar');
    assert.ok(out.x > 730, 'Mehar walks into the open');
    await attachment();
    assert.equal(await attr('#stage', 'data-camera-motion'), 'tracking');
    await photo('03-out-in-the-field');

    await seek(3, at(3, 0, 'ਘੁੰਮੀ') + 130);
    assert.ok(await speed() > 80 && await speed() < 160);
    await attachment();
    await photo('04-first-gust');
    await seek(3, at(3, 0, 'ਤੇਜ਼') + 810);
    assert.ok(await speed() >= 370);
    const ribbonA = await attr('#gate-ribbon', 'd');
    await seek(3, at(3, 0, 'ਤੇਜ਼') + 1010);
    assert.notEqual(await attr('#gate-ribbon', 'd'), ribbonA);
    await speech(3, 1, 4);

    await seek(3, scenes[3].duration);
    const beforeCut = await rotor();
    await seek(4, 0);
    assert.equal(await rotor(), beforeCut);
    await seek(4, at(4, 0, 'ਪਿੱਛੇ') + 1000);
    assert.ok((await position('#mehar')).x < out.x - 60, 'Mehar steps back into the shelter');
    assert.ok(await speed() < 25);
    await attachment();
    await photo('05-out-of-the-wind');
    await seek(4, at(4, 0, 'ਅੱਗੇ') + 1000);
    assert.ok((await position('#mehar')).x >= out.x - 1);
    assert.ok(await speed() >= 370);
    await speech(5, 0, 7);
    await speech(5, 1, 4);
    await photo('06-finale');

    await page.setViewportSize({ width: 393, height: 852 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seek(2, raise + 130);
    assert.equal(await attr('#stage', 'data-camera-motion'), 'static');
    const parked = await rotor();
    await seek(2, raise + 320);
    assert.equal(await rotor(), parked);
    const narrow = await page.locator('#movie').boundingBox();
    assert.ok(narrow.width <= 394 && narrow.height > 140);
    await photo('07-mobile');

    await page.goto(url + '?review=1&scene=one-step-to-test&test=1');
    await page.waitForFunction(() => window.lp030Test);
    assert.equal(await page.locator('#review-scenes li').count(), 6);
    assert.equal(await page.locator('#review-title').textContent(), 'A step back, then forward');
    assert.match(await page.locator('#review-audio').textContent(), /10\/10 voices · 10 aligned/);
    await page.locator('#watch-scene').click();
    await page.waitForFunction(() => window.lp030Test.state().audioActive && window.lp030Test.state().position > 440);
    await page.locator('#watch-scene').click();
    await page.locator('#approve-scene').click();
    assert.equal(await page.locator('#review-progress').textContent(), '1 of 6 approved');
    assert.deepEqual(errors, []);
    console.log('PASS Mission 30: 181 Punjabi words, 10 aligned voice clips, pinwheel attachment and wind response, mobile and scene approval.');
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
