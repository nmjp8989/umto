#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { chromium } = require('playwright-core');

const url = process.env.LP011_URL || 'http://127.0.0.1:8765/little%20panth/mission-011/';
const output = '../lp11-qa';

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
    const backdrop = page.waitForResponse(response => response.url().endsWith('/mission-003/art/courtyard.webp') && response.ok());
    await page.goto(url + '?test=1');
    await page.waitForFunction(() => window.lp011Test);
    await backdrop;
    const { scenes, clips } = await page.evaluate(() => window.lp011Test.state());
    const lines = scenes.flatMap(scene => scene.lines);
    assert.equal(scenes.length, 7);
    assert.equal(clips, 13);
    assert.ok(lines.every(line => line.aligned));
    assert.equal(new Set(lines.map(line => line.speaker)).size, 4);
    assert.equal(lines.reduce((total, line) => total + line.reading.words.length, 0), 186);
    assert.equal(await page.locator('button, header, nav, input, video[controls]').count(), 0);
    const left = await page.locator('.art-page').boundingBox();
    const right = await page.locator('.reading-page').boundingBox();
    assert.equal(left.width, right.width);
    assert.equal(left.height, right.height);
    const stage = page.locator('#stage');

    async function seek(scene, ms) {
      await page.evaluate(([scene, ms]) => window.lp011Test.seek(scene, ms), [scene, ms]);
    }

    async function speak(scene, lineIndex, wordIndex) {
      const line = scenes[scene].lines[lineIndex];
      const [from, to] = line.reading.timings[wordIndex];
      await seek(scene, line.start + (from + to) / 2);
      assert.equal(await page.locator('.word[aria-current="true"]').textContent(), line.reading.words[wordIndex]);
      for (const who of ['mehar', 'boy', 'dadi']) {
        assert.equal(await page.locator('#' + who).getAttribute('data-speaking'), String(who === line.speaker));
      }
    }

    const coordinate = (id, axis) => page.locator('#' + id)
      .evaluate((node, member) => node.transform.baseVal[0].matrix[member], axis);
    const parent = id => page.locator('#' + id).evaluate(node => node.parentElement.id);
    const gripDistance = (actor, side, target, x, y) => page.evaluate(({ actor, side, target, x, y }) => {
      const hand = document.querySelector('[data-hand="' + actor + '-' + side + '"]');
      const item = document.getElementById(target);
      const held = new DOMPoint(x, y).matrixTransform(item.getCTM());
      const wrist = new DOMPoint().matrixTransform(hand.getCTM());
      return Math.hypot(held.x - wrist.x, held.y - wrist.y);
    }, { actor, side, target, x, y });

    for (const [id, preset] of [['mehar', 'kid-meher'], ['boy', 'kid-sidak'], ['dadi', 'elder-bibi-ji']]) {
      assert.equal(await page.locator('#' + id).getAttribute('data-studio-preset'), preset);
    }
    const rearHands = await page.locator('#dadi-hands').evaluate(hands =>
      ['mehar-plane', 'boy-plane'].every(id =>
        hands.compareDocumentPosition(document.getElementById(id)) & Node.DOCUMENT_POSITION_FOLLOWING));
    assert.ok(rearHands, 'Bibi Ji’s hand layer must paint behind both children');
    await speak(0, 0, 6);
    await page.screenshot({ path: output + '/01-courtyard.png' });
    await speak(1, 0, 4);
    await page.screenshot({ path: output + '/02-turn.png' });
    await speak(1, 1, 4);
    await speak(2, 0, 5);
    assert.equal(await parent('bundle'), 'dadi-props');
    assert.ok(await gripDistance('dadi', 'left', 'bundle', -62, 2) < 2);
    assert.ok(await gripDistance('dadi', 'right', 'bundle', 62, 2) < 2);
    await page.screenshot({ path: output + '/03-bibi.png' });
    const setDown = scenes[2].events.at(-1).ms;
    for (const before of [600, 340, 40]) {
      await seek(2, setDown - before);
      assert.ok(await gripDistance('dadi', 'left', 'bundle', -62, 2) < 2);
      assert.ok(await gripDistance('dadi', 'right', 'bundle', 62, 2) < 2);
    }
    await seek(2, setDown + 175);
    assert.equal(await parent('bundle'), 'stool-props');

    const efforts = scenes[3].events.filter(event => event.sound === 'ribbon');
    assert.equal(efforts.length, 2);
    for (const [i, event] of efforts.entries()) {
      await seek(3, event.ms);
      assert.equal(await stage.getAttribute('data-bundle'), 'tied');
      assert.equal(await stage.getAttribute('data-stick-snaps'), '0');
      assert.ok(await coordinate('bundle', 'f') < 486);
      const owner = i === 0 ? 'mehar' : 'boy';
      assert.equal(await parent('bundle'), owner + '-props');
      assert.ok(await gripDistance(owner, 'left', 'bundle', -54, -2) < 6);
      assert.ok(await gripDistance(owner, 'right', 'bundle', 54, -2) < 6);
    }
    await page.screenshot({ path: output + '/04-bundle.png' });
    const untie = scenes[4].events.find(event => event.sound === 'ribbon').ms;
    await seek(4, untie + 265);
    assert.ok(await gripDistance('dadi', 'right', 'free-cord', 0, 0) < 2);
    const snaps = scenes[4].events.filter(event => event.sound === 'twig');
    assert.equal(snaps.length, 2);
    await seek(4, snaps[0].ms - 20);
    assert.equal(await stage.getAttribute('data-bundle'), 'untied');
    assert.equal(await stage.getAttribute('data-stick-snaps'), '0');
    assert.equal(await page.locator('#book').getAttribute('data-layout'), 'cinema');
    await seek(4, snaps[0].ms + 140);
    assert.equal(await stage.getAttribute('data-stick-snaps'), '1');
    await seek(4, snaps[1].ms + 190);
    assert.equal(await stage.getAttribute('data-stick-snaps'), '2');
    assert.ok(await coordinate('boy-stick-left', 'e') < -8);
    for (const actor of ['mehar', 'boy']) {
      assert.ok(await gripDistance(actor, 'left', actor + '-stick-left', -45, 1) < 2);
      assert.ok(await gripDistance(actor, 'right', actor + '-stick-right', 45, 1) < 2);
    }
    await page.screenshot({ path: output + '/05-snaps.png' });
    await speak(5, 0, 5);
    await speak(5, 1, 2);
    await speak(5, 2, 4);

    const rolls = scenes[6].events;
    await seek(6, rolls[0].ms + 700);
    assert.ok(await coordinate('ball', 'e') > 550);
    await seek(6, rolls.at(-1).ms + 1180);
    assert.ok(await coordinate('ball', 'e') < 470);
    assert.equal(await stage.getAttribute('data-camera-motion'), 'tracking');
    await page.screenshot({ path: output + '/06-play.png' });
    await page.locator('#movie').click();
    await page.waitForFunction(() => window.lp011Test.state().audioActive && window.lp011Test.state().position > 440);

    await page.setViewportSize({ width: 390, height: 844 });
    await speak(2, 0, 7);
    assert.ok((await page.locator('#reading').boundingBox()).width < 390);
    await page.screenshot({ path: output + '/07-phone.png' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seek(6, rolls.at(-1).ms + 600);
    assert.equal(await stage.getAttribute('data-camera-motion'), 'static');

    await page.goto(url + '?review=1&scene=loose-sticks&test=1');
    await page.waitForFunction(() => window.lp011Test);
    assert.equal(await page.locator('#review-scenes li').count(), 7);
    assert.equal(await page.locator('#review-title').textContent(), 'One stick each');
    assert.match(await page.locator('#review-audio').textContent(), /13\/13 voices · 13 aligned/);
    await page.locator('#approve-scene').click();
    assert.equal(await page.locator('#review-progress').textContent(), '1 of 7 approved');
    assert.deepEqual(errors, []);
    console.log('PASS Mission 11: Studio cast, 186 words, 13 aligned clips, independent mouth poses, rear hand layer, anchored wooden props, mobile, and review.');
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
