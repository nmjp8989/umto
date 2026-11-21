#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { chromium } = require('playwright-core');

const url = process.env.LP008_URL || 'http://127.0.0.1:8765/little%20panth/mission-008/';
const output = '../lp08-qa';

async function run() {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : { channel: 'chrome' }),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    await page.goto(url + '?test=1');
    await page.waitForFunction(() => window.lp008Test, null, { timeout: 20000 });
    const state = await page.evaluate(() => window.lp008Test.state());
    assert.equal(state.scenes.length, 7);
    assert.equal(state.clips, 13);
    assert.equal(state.scenes.flatMap(scene => scene.lines).filter(line => line.aligned).length, 13);
    assert.equal(await page.locator('button, input, nav, header, footer, audio[controls], video[controls]').count(), 0);
    const left = await page.locator('.art-page').boundingBox();
    const right = await page.locator('.reading-page').boundingBox();
    assert.equal(left.width, right.width);
    assert.equal(left.height, right.height);

    async function seek(index, position) {
      await page.evaluate(([scene, ms]) => window.lp008Test.seek(scene, ms), [index, position]);
    }
    async function speak(index, lineIndex, word = 0) {
      const line = state.scenes[index].lines[lineIndex];
      const [start, end] = line.reading.timings[word];
      await seek(index, line.start + (start + end) / 2);
      assert.equal(await page.locator('.word[aria-current="true"]').textContent(), line.reading.words[word]);
      for (const name of ['wind', 'sun', 'traveller']) {
        assert.equal(await page.locator('#' + name).getAttribute('data-speaking'), String(name === line.speaker));
      }
    }
    await speak(0, 0, 5);
    await page.screenshot({ path: output + '/01-road.png' });
    await speak(1, 0, 4);
    assert.equal(await page.locator('#stage').getAttribute('data-camera-preset'), 'medium');
    await page.screenshot({ path: output + '/02-wind.png' });
    await speak(1, 1, 3);

    const gust = state.scenes[2];
    const gustCue = gust.events.find(event => event.sound === 'gust');
    await seek(2, gustCue.ms + 1100);
    assert.equal(await page.locator('#book').getAttribute('data-layout'), 'cinema');
    assert.ok(Number(await page.locator('#wind-streams').getAttribute('opacity')) > .4);
    await speak(2, 1, 2);
    await page.screenshot({ path: output + '/03-gust.png' });

    await seek(3, state.scenes[3].duration - 350);
    assert.equal(await page.locator('#stage').getAttribute('data-shawl'), 'wrapped');
    await seek(4, state.scenes[4].duration - 300);
    assert.equal(await page.locator('#book').getAttribute('data-layout'), 'cinema');
    assert.ok(Number(await page.locator('#stage').getAttribute('data-warmth')) > .9);
    await page.screenshot({ path: output + '/05-sunlight.png' });

    const fold = state.scenes[5];
    const clothCue = fold.events.find(event => event.sound === 'ribbon');
    await seek(5, clothCue.ms + 170);
    assert.equal(await page.locator('#stage').getAttribute('data-shawl'), 'removing');
    await seek(5, fold.duration - 220);
    assert.equal(await page.locator('#stage').getAttribute('data-shawl'), 'folded');
    assert.ok(Number(await page.locator('#shawl-folded').getAttribute('opacity')) > .95);
    await page.screenshot({ path: output + '/06-folded.png' });

    await page.locator('#movie').click();
    await page.waitForFunction(() => window.lp008Test.state().audioActive && window.lp008Test.state().position > 360);
    await page.setViewportSize({ width: 390, height: 844 });
    await speak(6, 0, 4);
    assert.ok((await page.locator('#reading').boundingBox()).width < 390);
    const windFaceVisible = await page.locator('#wind-eyes ellipse').first().evaluate(eye => {
      const center = new DOMPoint(eye.cx.baseVal.value, eye.cy.baseVal.value).matrixTransform(eye.getScreenCTM());
      return Boolean(document.elementFromPoint(center.x, center.y)?.closest('#wind'));
    });
    assert.ok(windFaceVisible, 'The speaking Wind should be visible above the foreground on a phone');
    await page.screenshot({ path: output + '/07-phone.png' });

    await page.goto(url + '?review=1&scene=fold&test=1');
    await page.waitForFunction(() => window.lp008Test);
    assert.equal(await page.locator('#review-scenes li').count(), 7);
    assert.equal(await page.locator('#review-title').textContent(), 'Off comes the shawl');
    assert.match(await page.locator('#review-audio').textContent(), /13\/13 voices · 13 aligned/);
    assert.deepEqual(failures, []);
    console.log('PASS Mission 08: 7 scenes, 13 aligned lines, 4 voices, timed gusts, sunlight and shawl cues, phone layout, sound, and scene review.');
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
