#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { chromium } = require('playwright-core');

const url = process.env.LP009_URL || 'http://127.0.0.1:8765/little%20panth/mission-009/';
const output = '../lp09-qa';

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
    await page.goto(url + '?test=1');
    await page.waitForFunction(() => window.lp009Test);
    const { scenes, clips } = await page.evaluate(() => window.lp009Test.state());
    const lines = scenes.flatMap(scene => scene.lines);
    assert.equal(scenes.length, 7);
    assert.equal(clips, 12);
    assert.ok(lines.every(line => line.aligned));
    assert.equal(new Set(lines.map(line => line.speaker)).size, 3);
    assert.equal(await page.locator('button, header, nav, input, video[controls]').count(), 0);
    const left = await page.locator('.art-page').boundingBox();
    const right = await page.locator('.reading-page').boundingBox();
    assert.equal(left.width, right.width);
    assert.equal(left.height, right.height);

    async function actorState(speaker) {
      for (const actor of ['fox', 'sparrow']) {
        assert.equal(await page.locator('#' + actor).getAttribute('data-speaking'), String(actor === speaker));
      }
      assert.equal(await page.locator('#fox-mouth').getAttribute('opacity'), speaker === 'fox' ? '1' : '0');
    }

    async function seek(scene, ms) {
      await page.evaluate(([scene, ms]) => window.lp009Test.seek(scene, ms), [scene, ms]);
    }

    async function speak(scene, lineIndex, wordIndex) {
      const line = scenes[scene].lines[lineIndex];
      const [from, to] = line.reading.timings[wordIndex];
      await seek(scene, line.start + (from + to) / 2);
      await actorState(line.speaker);
      assert.equal(await page.locator('.word[aria-current="true"]').textContent(), line.reading.words[wordIndex]);
    }

    await seek(0, 690);
    assert.equal(await page.locator('#stage').getAttribute('data-camera-motion'), 'tracking');
    await speak(0, 0, 8);
    await page.screenshot({ path: output + '/01-arrival.png' });
    await speak(1, 1, 6);
    assert.equal(await page.locator('#stage').getAttribute('data-camera-preset'), 'medium');
    await page.screenshot({ path: output + '/02-fox.png' });

    const first = scenes[2].events.find(event => event.sound === 'spring').ms;
    await seek(2, first + 440);
    assert.equal(await page.locator('#stage').getAttribute('data-leaf-touched'), 'false');
    await actorState('narrator');
    const firstHeight = await page.locator('#fox').evaluate(fox => fox.transform.baseVal[0].matrix.f);
    assert.ok(firstHeight < 500 && firstHeight > 475);
    await page.screenshot({ path: output + '/03-short.png' });

    const contact = scenes[3].events.find(event => event.sound === 'ribbon').ms;
    await seek(3, contact - 80);
    assert.equal(await page.locator('#book').getAttribute('data-layout'), 'cinema');
    assert.equal(await page.locator('#stage').getAttribute('data-leaf-touched'), 'false');
    const grapes = await page.locator('#grapes').getAttribute('transform');
    await seek(3, contact + 28);
    assert.equal(await page.locator('#stage').getAttribute('data-leaf-touched'), 'true');
    assert.equal(await page.locator('#grapes').getAttribute('transform'), grapes);
    const secondHeight = await page.locator('#fox').evaluate(fox => fox.transform.baseVal[0].matrix.f);
    assert.ok(secondHeight < firstHeight - 25);
    await page.screenshot({ path: output + '/04-contact.png' });

    await speak(4, 1, 4);
    await speak(4, 2, 4);
    await page.screenshot({ path: output + '/05-sparrow.png' });
    const ends = scenes[6].duration;
    await seek(6, ends);
    assert.equal(await page.locator('#book').getAttribute('data-layout'), 'spread');
    await actorState('narrator');

    await page.locator('#movie').click();
    await page.waitForFunction(() => window.lp009Test.state().audioActive && window.lp009Test.state().position > 400);
    await page.setViewportSize({ width: 390, height: 844 });
    await speak(4, 2, 5);
    assert.ok((await page.locator('#reading').boundingBox()).width < 390);
    await page.screenshot({ path: output + '/06-phone.png' });
    await seek(3, contact + 28);
    await page.screenshot({ path: output + '/07-phone-contact.png' });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seek(0, 1400);
    assert.equal(await page.locator('#stage').getAttribute('data-camera-motion'), 'static');

    await page.goto(url + '?review=1&scene=run-up&test=1');
    await page.waitForFunction(() => window.lp009Test);
    assert.equal(await page.locator('#review-scenes li').count(), 7);
    assert.equal(await page.locator('#review-title').textContent(), 'A running jump');
    assert.match(await page.locator('#review-audio').textContent(), /12\/12 voices · 12 aligned/);
    await page.locator('#approve-scene').click();
    assert.equal(await page.locator('#review-progress').textContent(), '1 of 7 approved');
    await page.locator('#change-scene').click();
    assert.equal(await page.locator('#review-progress').textContent(), '0 of 7 approved');
    assert.deepEqual(errors, []);
    console.log('PASS Mission 09: seven scenes, 12 aligned clips, separate mouth animation, two jumps, leaf cue, music, mobile layout, and scene review.');
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
