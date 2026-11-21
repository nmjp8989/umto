#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { chromium } = require('playwright-core');
const manifest = require('../little panth/mission-028/audio/generation-manifest.json');

const url = process.env.LP028_URL || 'http://127.0.0.1:8765/little%20panth/mission-028/';
const output = '../lp28-qa';

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
    await page.waitForFunction(() => window.lp028Test || document.getElementById('loading').textContent.includes('ਨਹੀਂ'));
    assert.deepEqual(errors, []);
    const { scenes, clips } = await page.evaluate(() => window.lp028Test.state());
    const lines = scenes.flatMap(scene => scene.lines);
    assert.equal(scenes.length, 6);
    assert.equal(clips, 11);
    assert.ok(lines.every(line => line.aligned));
    assert.equal(lines.reduce((total, line) => total + line.reading.words.length, 0), 188);
    assert.equal(new Set(Object.values(manifest).map(line => line.voice)).size, 3);
    assert.equal(await page.locator('#mehar').getAttribute('data-studio-preset'), 'kid-meher');
    assert.equal(await page.locator('#sidak').getAttribute('data-studio-preset'), 'kid-sidak');
    assert.equal(await page.locator('button, header, nav, input').count(), 0);
    const art = await page.locator('.art-page').boundingBox();
    const reading = await page.locator('.reading-page').boundingBox();
    assert.equal(art.width, reading.width);
    assert.equal(art.height, reading.height);

    const seek = (scene, ms) => page.evaluate(([index, time]) => window.lp028Test.seek(index, time), [scene, ms]);
    const at = (scene, line, word) => {
      const entry = scenes[scene].lines[line];
      const index = entry.reading.words.findIndex(value => value.replace(/\p{P}/gu, '') === word);
      assert.ok(index >= 0, 'Missing word ' + word);
      return entry.start + entry.reading.timings[index][0];
    };
    const position = (selector, x, y) => page.evaluate(({ selector, x, y }) => {
      const node = document.querySelector(selector);
      const inverse = document.getElementById('stage').getScreenCTM().inverse();
      const center = new DOMPoint(x ?? node.cx?.baseVal.value ?? 0, y ?? node.cy?.baseVal.value ?? 0);
      const target = center.matrixTransform(node.getScreenCTM()).matrixTransform(inverse);
      return { x: target.x, y: target.y };
    }, { selector, x, y });
    const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const attribute = (selector, key) => page.locator(selector).getAttribute(key);
    const photo = (name) => page.screenshot({ path: output + '/' + name + '.png' });
    const state = () => attribute('#paper-boat', 'data-state');
    const boat = () => position('#paper-boat');

    async function speech(scene, line, index) {
      const entry = scenes[scene].lines[line];
      const [from, to] = entry.reading.timings[index];
      await seek(scene, entry.start + (from + to) / 2);
      assert.equal(await page.locator('.word[aria-current="true"]').textContent(), entry.reading.words[index]);
      for (const [id, speaker] of [['mehar', 'mehar'], ['sidak', 'friend']]) {
        assert.equal(await attribute('#' + id, 'data-speaking'), String(speaker === entry.speaker));
      }
    }

    await speech(0, 0, 23);
    assert.equal(await state(), 'held');
    assert.ok(gap(await position('#boat-grip-mark'), await position('[data-hand="mehar-right"]', -30, 84)) < 1);
    await photo('01-after-the-rain');
    await speech(1, 0, 4);
    assert.equal(await state(), 'held');
    const restFoot = await position('#mehar [data-rig-foot]');
    const release = at(1, 1, 'ਛੱਡ');
    await seek(1, release - 2);
    const grip = await position('[data-hand="mehar-right"]', -30, 84);
    const preRelease = await boat();
    assert.ok(gap(restFoot, await position('#mehar [data-rig-foot]')) < 1, 'Mehar keeps her feet planted');
    assert.ok(gap(grip, await position('#boat-grip-mark')) < 1);
    await photo('02-launch');
    await seek(1, release + 2);
    assert.equal(await state(), 'afloat');
    assert.ok(gap(preRelease, await boat()) < 3, 'The boat leaves the hand without jumping');
    await seek(1, release + 2010);
    assert.ok((await boat()).x > preRelease.x + 31, 'The boat floats downstream');

    const hit = at(2, 0, 'ਟਕਰਾਈ');
    await seek(2, hit + 530);
    assert.equal(await state(), 'stuck');
    assert.ok(gap(await position('#boat-bow'), await position('#leaf-edge')) < 1, 'The bow stops at the edge of the leaf');
    const firstStreak = await attribute('#water-streaks', 'transform');
    const firstBow = await position('#boat-bow');
    await seek(2, hit + 810);
    assert.ok(gap(firstBow, await position('#boat-bow')) < 1);
    assert.notEqual(await attribute('#water-streaks', 'transform'), firstStreak);
    await photo('03-stopped');

    await speech(3, 0, 3);
    const sidakFoot = await position('#sidak [data-rig-foot]');
    const pick = at(3, 1, 'ਚੁੱਕੀ');
    await seek(3, pick - 3);
    const beforePick = await position('#twig-grip');
    await seek(3, pick + 3);
    assert.equal(await attribute('#leaf-twig', 'data-held'), 'true');
    assert.ok(gap(beforePick, await position('#twig-grip')) < 4, 'The twig comes off the bank at the hand');
    const hook = at(3, 1, 'ਲਾਇਆ');
    await seek(3, hook + 120);
    const twigUnderLeaf = gap(await position('#leaf-under'), await position('#twig-tip'));
    assert.ok(twigUnderLeaf < 3, 'The twig reaches the underside of the leaf, gap ' + twigUnderLeaf);
    assert.ok(gap(sidakFoot, await position('#sidak [data-rig-foot]')) < 1, 'Sidak reaches from the dry bank');
    await photo('04-under-the-leaf');
    const lift = at(3, 1, 'ਚੁੱਕ');
    await seek(3, lift + 430);
    assert.equal(await attribute('#yellow-leaf', 'data-state'), 'lifting');
    assert.ok(gap(await position('#leaf-under'), await position('#twig-tip')) < 1);
    assert.ok((await position('#leaf-under')).y <= 549, 'The twig raises the leaf above the water');
    await photo('05-leaf-lift');
    await seek(3, at(3, 1, 'ਰੱਖ') + 400);
    assert.equal(await attribute('#yellow-leaf', 'data-state'), 'bank');
    assert.equal(await attribute('#leaf-twig', 'data-held'), 'false');
    assert.equal(await state(), 'afloat');

    const hidden = at(4, 0, 'ਗਾਇਬ');
    const emerged = at(4, 0, 'ਨਿਕਲ');
    const behindStone = () => page.evaluate(() => {
      const boat = document.querySelector('#paper-boat');
      const stone = document.querySelector('#bridge-stone-face');
      const p = new DOMPoint(2, -14).matrixTransform(boat.getScreenCTM()).matrixTransform(stone.getScreenCTM().inverse());
      return stone.isPointInFill(p);
    });
    await seek(4, hidden + 180);
    assert.ok(await behindStone(), 'The bridge stone occludes the boat in the shadow');
    await photo('06-under-the-bridge');
    await seek(4, emerged + 1020);
    assert.ok(!(await behindStone()), 'The boat comes back into view downstream');
    assert.ok((await boat()).x > 1025);
    await photo('07-emerges');
    await speech(5, 0, 3);
    await speech(5, 1, 4);
    await seek(5, at(5, 2, 'ਹਿਲਾ') + 280);
    assert.equal(await attribute('[data-hand="mehar-right"]', 'data-action-hand'), 'wave');
    assert.ok((await boat()).x > 1170 && (await boat()).x < 1270, 'Mehar waves while the boat rounds the visible bend');
    await photo('08-farewell');

    await page.setViewportSize({ width: 393, height: 852 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seek(4, emerged + 1020);
    assert.equal(await attribute('#stage', 'data-camera-motion'), 'static');
    const narrow = await page.locator('#movie').boundingBox();
    assert.ok(narrow.width <= 394 && narrow.height > 140);
    await speech(1, 0, 2);
    await photo('09-mobile');

    await page.goto(url + '?review=1&scene=lift-the-leaf&test=1');
    await page.waitForFunction(() => window.lp028Test);
    assert.equal(await page.locator('#review-scenes li').count(), 6);
    assert.equal(await page.locator('#review-title').textContent(), 'Sidak clears the way');
    assert.match(await page.locator('#review-audio').textContent(), /11\/11 voices · 11 aligned/);
    await page.locator('#watch-scene').click();
    await page.waitForFunction(() => window.lp028Test.state().audioActive && window.lp028Test.state().position > 440);
    await page.locator('#watch-scene').click();
    await page.locator('#approve-scene').click();
    assert.equal(await page.locator('#review-progress').textContent(), '1 of 6 approved');
    assert.deepEqual(errors, []);
    console.log('PASS Mission 28: 188 words, 11 aligned clips, separate voices, boat release, leaf and twig contact, bridge occlusion, mobile and scene approval.');
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
