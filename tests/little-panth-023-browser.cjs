#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { chromium } = require('playwright-core');

const url = process.env.LP023_URL || 'http://127.0.0.1:8765/little%20panth/mission-023/';
const output = '../lp23-qa';

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
    await page.waitForFunction(() => window.lp023Test || document.getElementById('loading').textContent.includes('ਨਹੀਂ'));
    assert.deepEqual(errors, []);

    const { scenes, clips } = await page.evaluate(() => window.lp023Test.state());
    const lines = scenes.flatMap(scene => scene.lines);
    assert.equal(scenes.length, 7);
    assert.equal(clips, 10);
    assert.ok(lines.every(line => line.aligned));
    assert.deepEqual([...new Set(lines.map(line => line.speaker))].sort(), ['dadi', 'mehar', 'narrator']);
    assert.equal(lines.reduce((total, line) => total + line.reading.words.length, 0), 181);
    assert.equal(await page.locator('#mehar').getAttribute('data-studio-preset'), 'kid-meher');
    assert.equal(await page.locator('#dadi').getAttribute('data-studio-preset'), 'elder-bibi-ji');
    assert.equal(await page.locator('button, header, nav, input').count(), 0);
    const art = await page.locator('.art-page').boundingBox();
    const reading = await page.locator('.reading-page').boundingBox();
    assert.equal(art.width, reading.width);
    assert.equal(art.height, reading.height);

    const stage = page.locator('#stage');
    const seek = (scene, ms) => page.evaluate(([index, time]) => window.lp023Test.seek(index, time), [scene, ms]);
    const times = (scene, line, word) => {
      const entry = scenes[scene].lines[line];
      const matches = entry.reading.words.flatMap((value, index) => value.replace(/\p{P}/gu, '') === word
        ? [entry.start + entry.reading.timings[index][0]] : []);
      assert.ok(matches.length > 0, 'Missing word ' + word);
      return matches;
    };
    const at = (scene, line, word) => times(scene, line, word)[0];
    const position = ([selector, x = 0, y = 0]) => page.evaluate(({ selector, x, y }) => {
      const node = document.querySelector(selector);
      const inverse = document.getElementById('stage').getScreenCTM().inverse();
      const point = new DOMPoint(x, y).matrixTransform(node.getScreenCTM()).matrixTransform(inverse);
      return { x: point.x, y: point.y };
    }, { selector, x, y });
    const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
    async function close(a, b, limit, message) {
      const [from, to] = await Promise.all([position(a), position(b)]);
      const gap = dist(from, to);
      assert.ok(gap < limit, message + ' (gap ' + gap.toFixed(2) + ')');
    }
    const palm = role => ['[data-hand="' + role + '-right"]', 0, 56];
    const jar = (x, y) => ['#almond-jar-front', x, y];
    const almond = index => ['#almond-' + index];
    const source = (mode) => page.locator('#almond-moving [data-source="' + mode + '"]').count();

    async function speak(scene, line, index) {
      const entry = scenes[scene].lines[line];
      const [from, to] = entry.reading.timings[index];
      await seek(scene, entry.start + (from + to) / 2);
      assert.equal(await page.locator('.word[aria-current="true"]').textContent(), entry.reading.words[index]);
      for (const id of ['mehar', 'dadi']) {
        assert.equal(await page.locator('#' + id).getAttribute('data-speaking'), String(entry.speaker === id));
      }
    }

    await speak(0, 1, 4);
    assert.equal(await stage.getAttribute('data-jar'), 'closed');
    await page.screenshot({ path: output + '/01-kitchen.png' });
    await seek(1, at(1, 0, 'ਲਾਹਿਆ') + 355);
    assert.equal(await page.locator('#almond-lid').getAttribute('data-owner'), 'mehar');
    await close(['#almond-lid'], palm('mehar'), 1, 'Mehar’s hand holds the lid');
    await seek(1, at(1, 0, 'ਪਾਇਆ') + 575);
    await close(jar(0, 36), palm('mehar'), 8, 'Mehar’s palm is inside the glass jar');
    await seek(1, at(1, 0, 'ਅਟਕ') + 320);
    assert.equal(await stage.getAttribute('data-jar'), 'stuck');
    assert.equal(await source('hand'), 5);
    await close(jar(0, 18), palm('mehar'), 5, 'The full fist stops inside the neck');
    await page.screenshot({ path: output + '/02-stuck.png' });
    await speak(2, 0, 3);

    await speak(3, 0, 8);
    assert.equal(await stage.getAttribute('data-jar'), 'steadied');
    await close(jar(38, 31), palm('dadi'), 7, 'Bibi Ji steadies the side of the jar');
    await page.screenshot({ path: output + '/03-bibi-helps.png' });

    for (const [index, tap] of times(4, 0, 'ਟਪ').entries()) {
      await seek(4, tap - 1);
      const before = await position(almond(index));
      assert.equal(await page.locator('#almond-' + index).getAttribute('data-source'), 'hand');
      await seek(4, tap + 1);
      assert.equal(await page.locator('#almond-' + index).getAttribute('data-source'), 'returned');
      assert.ok(dist(before, await position(almond(index))) < 1, 'The almond starts its fall from Mehar’s palm');
      await seek(4, tap + 235);
      assert.ok((await position(almond(index))).y > before.y + 11);
      assert.equal(await source('hand'), 4 - index);
      if (index === 1) await page.screenshot({ path: output + '/04-drop.png' });
    }
    assert.equal(await page.locator('#book').getAttribute('data-layout'), 'cinema');
    await seek(4, at(4, 0, 'ਬਾਹਰ') + 590);
    assert.equal(await stage.getAttribute('data-jar'), 'free');
    assert.equal(await source('hand'), 2);
    assert.ok((await position(palm('mehar'))).y < (await position(jar(0, 0))).y - 10);

    await speak(5, 0, 5);
    for (const [index, delivery] of times(5, 1, 'ਪਾਏ').entries()) {
      const kernel = index === 0 ? 3 : 5;
      const bowl = index === 0 ? 'green' : 'blue';
      await seek(5, delivery - 1);
      const before = await position(almond(kernel));
      await seek(5, delivery + 1);
      assert.ok(dist(before, await position(almond(kernel))) < 3, 'The pair falls from the palm');
      await seek(5, delivery + 400);
      assert.equal(await source(bowl + '-bowl'), 2);
      await close(almond(kernel), ['#almond-' + bowl + '-bowl'], 13, 'The pair is in the ' + bowl + ' bowl');
    }
    await page.screenshot({ path: output + '/05-two-each.png' });

    await seek(6, at(6, 0, 'ਲਾ') - 175);
    assert.equal(await page.locator('#almond-lid').getAttribute('data-owner'), 'dadi');
    await close(['#almond-lid'], palm('dadi'), 2, 'Bibi Ji’s hand carries the lid');
    await seek(6, at(6, 0, 'ਲਾ') + 310);
    assert.equal(await stage.getAttribute('data-jar'), 'closed');
    assert.equal(await source('green-bowl'), 2);
    assert.equal(await source('blue-bowl'), 2);
    await page.screenshot({ path: output + '/06-closed.png' });

    await page.locator('#movie').click();
    await page.waitForFunction(() => window.lp023Test.state().audioActive && window.lp023Test.state().position > 440);
    await page.setViewportSize({ width: 390, height: 844 });
    await seek(4, at(4, 0, 'ਟਪ') + 210);
    await page.screenshot({ path: output + '/07-phone.png' });
    assert.ok((await page.locator('#reading').boundingBox()).width <= 390);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seek(4, at(4, 0, 'ਟਪ') + 210);
    assert.equal(await stage.getAttribute('data-camera-motion'), 'static');

    await page.goto(url + '?review=1&scene=three-fall-back&test=1');
    await page.waitForFunction(() => window.lp023Test);
    assert.equal(await page.locator('#review-scenes li').count(), 7);
    assert.equal(await page.locator('#review-title').textContent(), 'Three almonds fall back');
    assert.match(await page.locator('#review-audio').textContent(), /10\/10 voices · 10 aligned/);
    assert.equal(await page.locator('#review-progress').textContent(), '0 of 7 approved');
    await page.locator('#approve-scene').click();
    assert.equal(await page.locator('#review-progress').textContent(), '1 of 7 approved');
    assert.deepEqual(errors, []);
    console.log('PASS Mission 23: 181 Punjabi words, 10 aligned clips, jar and almond contacts, mobile, and review.');
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
