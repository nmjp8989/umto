#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { chromium } = require('playwright-core');

const url = process.env.LP010_URL || 'http://127.0.0.1:8765/little%20panth/mission-010/';
const output = '../lp10-qa';

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
    await page.waitForFunction(() => window.lp010Test);
    const { scenes, clips } = await page.evaluate(() => window.lp010Test.state());
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
    const stage = page.locator('#stage');
    const cue = (scene, sound) => scenes[scene].events.find(event => event.sound === sound).ms;

    async function seek(scene, ms) {
      await page.evaluate(([scene, ms]) => window.lp010Test.seek(scene, ms), [scene, ms]);
    }

    async function speak(scene, lineIndex, wordIndex) {
      const line = scenes[scene].lines[lineIndex];
      const [from, to] = line.reading.timings[wordIndex];
      await seek(scene, line.start + (from + to) / 2);
      assert.equal(await page.locator('.word[aria-current="true"]').textContent(), line.reading.words[wordIndex]);
      for (const actor of ['ant', 'dove']) {
        assert.equal(await page.locator('#' + actor).getAttribute('data-speaking'), String(actor === line.speaker));
      }
    }

    await speak(0, 0, 7);
    assert.equal(await stage.getAttribute('data-camera-motion'), 'tracking');
    await page.screenshot({ path: output + '/01-river.png' });

    await seek(1, cue(1, 'plop') + 130);
    assert.equal(await stage.getAttribute('data-ant-place'), 'water');
    assert.ok(Number(await page.locator('#splash').getAttribute('opacity')) > .5);
    await speak(1, 1, 3);
    await page.screenshot({ path: output + '/02-ant.png' });

    await speak(2, 0, 3);
    assert.equal(await stage.getAttribute('data-camera-preset'), 'medium-close');
    await page.screenshot({ path: output + '/03-dove.png' });
    await seek(2, cue(2, 'plop') - 345);
    assert.equal(await page.locator('#book').getAttribute('data-layout'), 'cinema');
    assert.equal(await stage.getAttribute('data-camera-preset'), 'wide');
    await page.screenshot({ path: output + '/04-drop.png' });

    await seek(3, (cue(3, 'ribbon') + cue(3, 'step')) / 2);
    assert.equal(await stage.getAttribute('data-ant-place'), 'leaf');
    const [ant, leaf] = await page.evaluate(() => ['ant', 'rescue-leaf'].map(id => {
      const position = document.getElementById(id).transform.baseVal[0].matrix;
      return { x: position.e, y: position.f };
    }));
    assert.ok(Math.abs(ant.x - leaf.x) < 12 && Math.abs(ant.y - leaf.y) < 12);
    await page.screenshot({ path: output + '/05-raft.png' });
    await speak(3, 1, 2);
    assert.equal(await stage.getAttribute('data-ant-place'), 'bank');

    await seek(4, cue(4, 'twig') + 170);
    assert.equal(await stage.getAttribute('data-branch-state'), 'cracked');
    assert.equal(await stage.getAttribute('data-camera-preset'), 'detail');
    await speak(5, 0, 5);
    await seek(5, cue(5, 'wings') + 160);
    assert.equal(await stage.getAttribute('data-dove-airborne'), 'true');
    assert.equal(await stage.getAttribute('data-branch-state'), 'cracked');
    await seek(5, cue(5, 'plop') + 90);
    assert.equal(await stage.getAttribute('data-branch-state'), 'fallen');
    await page.screenshot({ path: output + '/06-warning.png' });

    await speak(6, 0, 2);
    assert.equal(await stage.getAttribute('data-dove-airborne'), 'false');
    assert.equal(await stage.getAttribute('data-ant-place'), 'bank');
    await speak(6, 1, 3);
    await page.screenshot({ path: output + '/07-friends.png' });
    await page.locator('#movie').click();
    await page.waitForFunction(() => window.lp010Test.state().audioActive && window.lp010Test.state().position > 420);

    await page.setViewportSize({ width: 390, height: 844 });
    await speak(6, 0, 4);
    assert.ok((await page.locator('#reading').boundingBox()).width < 390);
    await page.screenshot({ path: output + '/08-phone.png' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seek(0, 1600);
    assert.equal(await stage.getAttribute('data-camera-motion'), 'static');

    await page.goto(url + '?review=1&scene=warning&test=1');
    await page.waitForFunction(() => window.lp010Test);
    assert.equal(await page.locator('#review-scenes li').count(), 7);
    assert.equal(await page.locator('#review-title').textContent(), 'The ant calls back');
    assert.match(await page.locator('#review-audio').textContent(), /12\/12 voices · 12 aligned/);
    await page.locator('#approve-scene').click();
    assert.equal(await page.locator('#review-progress').textContent(), '1 of 7 approved');
    assert.deepEqual(errors, []);
    console.log('PASS Mission 10: seven scenes, 12 aligned lines, isolated mouth cues, a floating leaf, branch and flight timing, mobile, audio, and scene review.');
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
