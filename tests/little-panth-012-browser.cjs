#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { chromium } = require('playwright-core');

const url = process.env.LP012_URL || 'http://127.0.0.1:8765/little%20panth/mission-012/';
const output = '../lp12-qa';

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
    const courtyard = page.waitForResponse(response => response.url().endsWith('/mission-003/art/courtyard.webp') && response.ok());
    const field = page.waitForResponse(response => response.url().endsWith('/mission-003/art/banyan.webp') && response.ok());
    await page.goto(url + '?test=1');
    await page.waitForFunction(() => window.lp012Test || document.getElementById('loading').textContent.includes('ਨਹੀਂ'));
    assert.deepEqual(errors, []);
    await Promise.all([courtyard, field]);
    const { scenes, clips } = await page.evaluate(() => window.lp012Test.state());
    assert.equal(scenes.length, 7);
    assert.equal(clips, 14);
    const lines = scenes.flatMap(scene => scene.lines);
    assert.ok(lines.every(line => line.aligned));
    assert.equal(new Set(lines.map(line => line.speaker)).size, 4);
    assert.equal(lines.reduce((total, line) => total + line.reading.words.length, 0), 185);
    assert.equal(await page.locator('button, header, nav, input, video[controls]').count(), 0);
    const left = await page.locator('.art-page').boundingBox();
    const right = await page.locator('.reading-page').boundingBox();
    assert.equal(left.width, right.width);
    assert.equal(left.height, right.height);

    const stage = page.locator('#stage');
    const parent = id => page.locator('#' + id).evaluate(node => node.parentElement.id);
    const opacity = async id => Number(await page.locator('#' + id).getAttribute('opacity'));
    const seek = (scene, ms) => page.evaluate(([index, time]) => window.lp012Test.seek(index, time), [scene, ms]);
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
    const gripDistance = (actor, side, target, x, y) => page.evaluate(({ actor, side, target, x, y }) => {
      const hand = document.querySelector('[data-hand="' + actor + '-' + side + '"]');
      const item = document.getElementById(target);
      const held = new DOMPoint(x, y).matrixTransform(item.getCTM());
      const palm = new DOMPoint(0, Number(hand.dataset.gripY)).matrixTransform(hand.getCTM());
      return Math.hypot(held.x - palm.x, held.y - palm.y);
    }, { actor, side, target, x, y });

    for (const [id, preset] of [['mehar', 'kid-meher'], ['boy', 'kid-sidak'], ['dadi', 'elder-bibi-ji']]) {
      assert.equal(await page.locator('#' + id).getAttribute('data-studio-preset'), preset);
      assert.equal(await page.locator('#' + id + ' [data-rig-foot]').count(), 2);
    }
    await seek(0, 460);
    assert.equal(await opacity('opening-field'), 1);
    await speak(0, 1, 9);
    assert.equal(await opacity('opening-field'), 0);
    assert.equal(await stage.getAttribute('data-camera-preset'), 'medium');
    await page.screenshot({ path: output + '/01-seeds.png' });

    const water = wordAt(1, 0, 'ਪਾਣੀ');
    await seek(1, water - 300);
    assert.equal(await stage.getAttribute('data-watering'), 'false');
    await seek(1, water + 300);
    assert.equal(await page.locator('#book').getAttribute('data-layout'), 'cinema');
    assert.equal(await stage.getAttribute('data-watering'), 'true');
    assert.equal(await parent('watering-can'), 'mehar-props');
    assert.ok(await gripDistance('mehar', 'right', 'watering-can', -43, 7) < 5);
    await page.screenshot({ path: output + '/02-watering.png' });

    await seek(2, wordAt(2, 0, 'ਦਿਨ') + 1080);
    assert.ok(await opacity('dusk') > .35);
    await speak(2, 1, 4);
    assert.equal(await stage.getAttribute('data-growth'), 'empty');
    assert.equal(await opacity('mehar-growth'), 0);

    await seek(3, wordAt(3, 0, 'ਸਿਦਕ') + 450);
    assert.equal(await stage.getAttribute('data-camera-motion'), 'tracking');
    assert.equal(await page.locator('#boy').getAttribute('data-studio-motion'), 'walk');
    assert.equal(await parent('sidak-pot'), 'boy-props');
    assert.ok(await gripDistance('boy', 'left', 'sidak-pot', -34, -33) < 5);
    assert.ok(await gripDistance('boy', 'right', 'sidak-pot', 34, -33) < 5);
    await speak(3, 1, 4);
    assert.equal(await parent('mehar-pot'), 'mehar-props');
    await page.screenshot({ path: output + '/03-two-pots.png' });

    await speak(4, 0, 5);
    assert.equal(await opacity('mehar-growth'), 0);
    await speak(5, 0, 6);
    await speak(5, 1, 5);
    assert.equal(await parent('sidak-pot'), 'bench-props');
    await page.screenshot({ path: output + '/04-reveal.png' });

    const leaves = wordAt(6, 0, 'ਪੱਤੇ');
    await seek(6, leaves - 380);
    assert.equal(await stage.getAttribute('data-growth'), 'empty');
    await seek(6, leaves + 870);
    assert.equal(await stage.getAttribute('data-growth'), 'sprouted');
    assert.equal(await opacity('mehar-growth'), 1);
    assert.equal(await opacity('sidak-growth'), 1);
    await page.screenshot({ path: output + '/05-new-leaves.png' });

    await page.locator('#movie').click();
    await page.waitForFunction(() => window.lp012Test.state().audioActive && window.lp012Test.state().position > 440);
    await page.setViewportSize({ width: 390, height: 844 });
    await speak(4, 0, 8);
    assert.ok((await page.locator('#reading').boundingBox()).width < 390);
    await page.screenshot({ path: output + '/06-phone.png' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seek(3, wordAt(3, 0, 'ਸਿਦਕ') + 450);
    assert.equal(await stage.getAttribute('data-camera-motion'), 'static');
    assert.equal(await page.locator('#boy').getAttribute('data-studio-motion'), 'stand');

    await page.goto(url + '?review=1&scene=reveal&test=1');
    await page.waitForFunction(() => window.lp012Test);
    assert.equal(await page.locator('#review-scenes li').count(), 7);
    assert.equal(await page.locator('#review-title').textContent(), 'What happened to the seeds');
    assert.match(await page.locator('#review-audio').textContent(), /14\/14 voices · 14 aligned/);
    await page.locator('#approve-scene').click();
    assert.equal(await page.locator('#review-progress').textContent(), '1 of 7 approved');
    assert.deepEqual(errors, []);
    console.log('PASS Mission 12: 185 Punjabi words, 14 aligned clips, Studio cast and walking pot grips, timed watering and sprouts, mobile and review.');
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
