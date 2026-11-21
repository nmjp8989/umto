#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { mkdir, readFile } = require('node:fs/promises');
const { chromium } = require('playwright-core');

const url = process.env.LP007_URL || 'http://127.0.0.1:8765/little%20panth/mission-007/';
const output = '../lp07-qa';

async function run() {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : { channel: 'chrome' }),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url + '?test=1');
    await page.waitForFunction(() => window.lp007Test, null, { timeout: 20000 });
    assert.equal(await page.locator('button, input, nav, header, footer, audio[controls], video[controls]').count(), 0);

    const state = await page.evaluate(() => window.lp007Test.state());
    assert.equal(state.scenes.length, 7);
    assert.equal(state.clips, 15);
    const lines = state.scenes.flatMap(scene => scene.lines);
    assert.equal(lines.filter(line => line.aligned).length, 15);
    assert.deepEqual([...new Set(lines.map(line => line.speaker))].sort(), ['hare', 'narrator', 'tortoise']);
    const art = await page.locator('.art-page').boundingBox();
    const reading = await page.locator('.reading-page').boundingBox();
    assert.equal(art.width, reading.width);
    assert.equal(art.height, reading.height);

    const seek = (scene, ms) => page.evaluate(([index, at]) => window.lp007Test.seek(index, at), [scene, ms]);
    const speaking = async (scene, line, word = 0) => {
      const record = state.scenes[scene].lines[line];
      const [start, end] = record.reading.timings[word];
      await seek(scene, record.start + (start + end) / 2);
      assert.equal(await page.locator('.word[aria-current="true"]').textContent(), record.reading.words[word]);
      assert.equal(await page.locator('#hare').getAttribute('data-speaking'), String(record.speaker === 'hare'));
      assert.equal(await page.locator('#tortoise').getAttribute('data-speaking'), String(record.speaker === 'tortoise'));
    };
    await speaking(0, 0, 2);
    await speaking(0, 1, 3);
    await page.screenshot({ path: output + '/01-invitation.png' });
    await speaking(0, 2, 2);

    const start = state.scenes[1];
    await seek(1, start.events[0].ms + 200);
    assert.equal(await page.locator('#book').getAttribute('data-layout'), 'cinema');
    assert.equal(await page.locator('#stage').getAttribute('data-camera-motion'), 'tracking');
    assert.equal((await page.locator('#movie').boundingBox()).height, 1080);
    await page.screenshot({ path: output + '/02-start.png' });
    await seek(2, state.scenes[2].duration - 200);
    assert.equal(await page.locator('#hare').getAttribute('data-sleeping'), 'true');
    await speaking(3, 1, 1);
    assert.equal(await page.locator('#hare').getAttribute('data-sleeping'), 'true');
    await page.screenshot({ path: output + '/04-one-step.png' });

    const finish = state.scenes[5];
    const cross = finish.events.find(cue => cue.sound === 'ribbon').ms;
    await seek(5, cross - 30);
    assert.equal(await page.locator('#stage').getAttribute('data-ribbon'), 'ready');
    await seek(5, cross + 70);
    assert.equal(await page.locator('#stage').getAttribute('data-ribbon'), 'crossed');
    assert.equal(await page.locator('#book').getAttribute('data-caption'), 'top');
    await page.screenshot({ path: output + '/06-finish.png' });

    await page.locator('#movie').click();
    await page.waitForFunction(() => window.lp007Test.state().audioActive && window.lp007Test.state().position > 350);
    assert.equal(await page.evaluate(() => window.lp007Test.state().scene), 0);
    await page.setViewportSize({ width: 390, height: 844 });
    await speaking(6, 0, 1);
    assert.ok((await page.locator('#reading').boundingBox()).width < 390);
    await page.screenshot({ path: output + '/07-phone.png' });

    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(url + '?review=1&scene=finish&test=1');
    await page.waitForFunction(() => window.lp007Test);
    assert.equal(await page.locator('#review-scenes li').count(), 7);
    await page.locator('#watch-scene').click();
    await page.waitForFunction(() => window.lp007Test.state().audioActive && window.lp007Test.state().position > 220);
    await page.locator('#watch-scene').click();
    assert.equal(await page.locator('#watch-scene').textContent(), 'Play scene');
    await page.locator('#approve-scene').click();
    assert.equal(await page.locator('#review-progress').textContent(), '1 of 7 approved');
    const downloading = page.waitForEvent('download');
    await page.locator('#download-review').click();
    const report = JSON.parse(await readFile(await (await downloading).path(), 'utf8'));
    assert.equal(report.mission, 7);
    assert.equal(report.scenes.find(scene => scene.id === 'finish').decision, 'approved');
    assert.deepEqual(errors, []);
    console.log('PASS Mission 07: 7 scenes, 15 aligned voices, two isolated speaking rigs, race and ribbon cues, phone layout, playback, and review.');
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
