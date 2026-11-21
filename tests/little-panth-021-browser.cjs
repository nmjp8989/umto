#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { chromium } = require('playwright-core');

const url = process.env.LP021_URL || 'http://127.0.0.1:8765/little%20panth/mission-021/';
const output = '../lp21-qa';

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
    await page.waitForFunction(() => window.lp021Test || document.getElementById('loading').textContent.includes('ਨਹੀਂ'));
    assert.deepEqual(errors, []);

    const { scenes, clips } = await page.evaluate(() => window.lp021Test.state());
    const lines = scenes.flatMap(scene => scene.lines);
    assert.equal(scenes.length, 7);
    assert.equal(clips, 10);
    assert.ok(lines.every(line => line.aligned));
    assert.deepEqual([...new Set(lines.map(line => line.speaker))].sort(), ['baldev', 'narrator', 'pari']);
    assert.equal(lines.reduce((total, line) => total + line.reading.words.length, 0), 179);
    const art = await page.locator('.art-page').boundingBox();
    const reading = await page.locator('.reading-page').boundingBox();
    assert.equal(art.width, reading.width);
    assert.equal(art.height, reading.height);
    assert.equal(await page.locator('button, header, nav, input').count(), 0);
    assert.equal(await page.locator('#baldev').getAttribute('data-studio-preset'), 'elder-baldev');
    assert.equal(await page.locator('#pari').getAttribute('data-studio-preset'), 'adult-anaya');

    const stage = page.locator('#stage');
    const seek = (scene, ms) => page.evaluate(([index, time]) => window.lp021Test.seek(index, time), [scene, ms]);
    const wordAt = (scene, line, word) => {
      const entry = scenes[scene].lines[line];
      const index = entry.reading.words.findIndex(value => value.replace(/\p{P}/gu, '') === word);
      assert.ok(index >= 0, 'Missing word ' + word);
      return entry.start + entry.reading.timings[index][0];
    };
    const position = ([selector, x = 0, y = 0]) => page.evaluate(({ selector, x, y }) => {
      const node = document.querySelector(selector);
      const inverse = document.getElementById('stage').getScreenCTM().inverse();
      const point = new DOMPoint(x, y).matrixTransform(node.getScreenCTM()).matrixTransform(inverse);
      return { x: point.x, y: point.y };
    }, { selector, x, y });
    const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
    async function gap(a, b) {
      const [from, to] = await Promise.all([position(a), position(b)]);
      return dist(from, to);
    }
    async function close(a, b, max, message) {
      const separation = await gap(a, b);
      assert.ok(separation < max, message + ' (gap ' + separation.toFixed(2) + ')');
    }
    const palm = (id, side = 'right') => ['[data-hand="' + id + '-' + side + '"]', 0, 56];
    const axe = metal => ['#' + metal + '-axe', 3, 11];
    const blade = ['#iron-axe', 35, -44];
    const owner = metal => page.locator('#' + metal + '-axe').getAttribute('data-owner');
    async function speak(scene, line, index) {
      const entry = scenes[scene].lines[line];
      const [from, to] = entry.reading.timings[index];
      await seek(scene, entry.start + (from + to) / 2);
      assert.equal(await page.locator('.word[aria-current="true"]').textContent(), entry.reading.words[index]);
      for (const id of ['baldev', 'pari']) {
        assert.equal(await page.locator('#' + id).getAttribute('data-speaking'), String(entry.speaker === id));
      }
    }

    await seek(0, 2250);
    assert.equal(await stage.getAttribute('data-camera-motion'), 'tracking');
    await close(axe('iron'), palm('baldev'), 1, 'Baldev carries the axe by the handle');
    await page.screenshot({ path: output + '/01-riverbank.png' });

    const slip = wordAt(1, 0, 'ਫਿਸਲ');
    const hit = Math.max(slip + 520, wordAt(1, 0, 'ਵੱਜੀ') + 25);
    const release = Math.max(slip + 55, hit - 1120);
    const water = Math.max(hit + 290, Math.min(hit + 1170, wordAt(1, 0, 'ਛਪਾਕ') + 80));
    await seek(1, release - 1);
    const before = await position(axe('iron'));
    await close(axe('iron'), palm('baldev'), 1, 'The axe begins in the palm');
    await seek(1, release + 1);
    assert.equal(await stage.getAttribute('data-tool'), 'falling');
    assert.ok(dist(before, await position(axe('iron'))) < 2, 'No jump at release');
    await seek(1, hit);
    assert.ok(dist(await position(blade), { x: 650, y: 549 }) < 1, 'The axe head meets the stone');
    await page.screenshot({ path: output + '/02-stone.png' });
    await seek(1, water);
    assert.ok(dist(await position(blade), { x: 721, y: 585 }) < 1, 'The axe meets the center of the splash');
    await seek(1, water + 155);
    assert.ok(Number(await page.locator('#woodcut-droplets').getAttribute('opacity')) > .6);
    assert.equal(await page.locator('#book').getAttribute('data-layout'), 'cinema');
    await page.screenshot({ path: output + '/03-splash.png' });

    await speak(2, 0, 5);
    await speak(3, 1, 5);
    await close(axe('gold'), palm('pari'), 1, 'The fairy holds the golden axe');
    await page.screenshot({ path: output + '/04-gold.png' });
    await speak(3, 2, 8);
    await speak(4, 0, 7);
    await close(axe('silver'), palm('pari'), 1, 'The fairy holds the silver axe');
    await seek(4, wordAt(4, 0, 'ਪੁਰਾਣੇ') + 1080);
    await close(axe('iron'), palm('pari'), 1, 'The fairy lifts the axe with the nick in its handle');
    assert.equal(await owner('gold'), 'none');
    assert.equal(await owner('silver'), 'none');
    await page.screenshot({ path: output + '/05-mark.png' });

    const give = wordAt(5, 1, 'ਲੈ') + 130;
    await speak(5, 0, 5);
    await seek(5, give - 1);
    assert.equal(await owner('iron'), 'pari');
    await close(axe('iron'), palm('pari'), 1, 'The fairy holds the handle before the transfer');
    await close(['#iron-axe', 4, 28], palm('baldev'), 7, 'Baldev reaches the offered handle');
    const receiving = await position(axe('iron'));
    await seek(5, give + 1);
    assert.equal(await owner('iron'), 'baldev');
    await close(['#iron-axe', 4, 28], palm('baldev'), 1, 'The handle stays in Baldev’s hand');
    assert.ok(dist(receiving, await position(axe('iron'))) < 7);
    await page.screenshot({ path: output + '/06-handoff.png' });

    await seek(6, scenes[6].duration - 145);
    assert.equal(await stage.getAttribute('data-tool'), 'packed');
    await close(['#woodcut-firewood'], palm('baldev'), 1, 'The tied wood stays in Baldev’s right hand');
    await close(['#woodcut-satchel'], palm('baldev', 'left'), 1, 'The bag stays in Baldev’s left hand');
    await page.screenshot({ path: output + '/07-home.png' });

    await page.locator('#movie').click();
    await page.waitForFunction(() => window.lp021Test.state().audioActive && window.lp021Test.state().position > 440);
    await page.setViewportSize({ width: 390, height: 844 });
    await seek(4, wordAt(4, 0, 'ਪੁਰਾਣੇ') + 1080);
    await page.screenshot({ path: output + '/08-phone.png' });
    assert.ok((await page.locator('#reading').boundingBox()).width <= 390);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seek(0, 2250);
    assert.equal(await stage.getAttribute('data-camera-motion'), 'static');

    await page.goto(url + '?review=1&scene=honest-return&test=1');
    await page.waitForFunction(() => window.lp021Test);
    assert.equal(await page.locator('#review-scenes li').count(), 7);
    assert.equal(await page.locator('#review-title').textContent(), 'Baldev recognizes his axe');
    assert.match(await page.locator('#review-audio').textContent(), /10\/10 voices · 10 aligned/);
    assert.equal(await page.locator('#review-progress').textContent(), '0 of 7 approved');
    await page.locator('#approve-scene').click();
    assert.equal(await page.locator('#review-progress').textContent(), '1 of 7 approved');
    assert.deepEqual(errors, []);
    console.log('PASS Mission 21: 179 Punjabi words, 10 aligned clips, separate voices, axe contact and handoff, mobile, and review.');
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
