#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { chromium } = require('playwright-core');

const url = process.env.LP024_URL || 'http://127.0.0.1:8765/little%20panth/mission-024/';
const output = '../lp24-qa';

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
    await page.waitForFunction(() => window.lp024Test || document.getElementById('loading').textContent.includes('ਨਹੀਂ'));
    assert.deepEqual(errors, []);
    const { scenes, clips } = await page.evaluate(() => window.lp024Test.state());
    const lines = scenes.flatMap(scene => scene.lines);
    assert.equal(scenes.length, 7);
    assert.equal(clips, 9);
    assert.ok(lines.every(line => line.aligned));
    assert.deepEqual([...new Set(lines.map(line => line.speaker))].sort(), ['jackal', 'narrator']);
    assert.equal(lines.reduce((total, line) => total + line.reading.words.length, 0), 194);
    assert.equal(await page.locator('button, header, nav, input').count(), 0);
    const art = await page.locator('.art-page').boundingBox();
    const reading = await page.locator('.reading-page').boundingBox();
    assert.equal(art.width, reading.width);
    assert.equal(art.height, reading.height);

    const stage = page.locator('#stage');
    const seek = (scene, ms) => page.evaluate(([index, time]) => window.lp024Test.seek(index, time), [scene, ms]);
    const times = (scene, line, word) => {
      const entry = scenes[scene].lines[line];
      const matches = entry.reading.words.flatMap((value, index) => value.replace(/\p{P}/gu, '') === word
        ? [entry.start + entry.reading.timings[index][0]] : []);
      assert.ok(matches.length > 0, 'Missing word ' + word);
      return matches;
    };
    const at = (scene, line, word) => times(scene, line, word)[0];
    const beatCues = scene => scenes[scene].events.filter(event => event.sound === 'drum').map(event => event.ms);
    const spoken = () => page.locator('.word[aria-current="true"]').textContent();
    async function speech(scene, line, index) {
      const entry = scenes[scene].lines[line];
      const [from, to] = entry.reading.timings[index];
      await seek(scene, entry.start + (from + to) / 2);
      assert.equal(await spoken(), entry.reading.words[index]);
      assert.equal(await page.locator('#jackal').getAttribute('data-speaking'), String(entry.speaker === 'jackal'));
    }
    const coordinates = selector => page.locator(selector).evaluate(node => {
      const x = Number(node.getAttribute('cx'));
      const y = Number(node.getAttribute('cy'));
      const inverse = document.getElementById('stage').getScreenCTM().inverse();
      const p = new DOMPoint(x, y).matrixTransform(node.getScreenCTM()).matrixTransform(inverse);
      return { x: p.x, y: p.y };
    });
    const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const twig = () => coordinates('#twig-tip');
    const paw = () => coordinates('#near-paw');

    await seek(0, 4450);
    assert.equal(await stage.getAttribute('data-drum'), 'hidden');
    assert.equal(await stage.getAttribute('data-camera-motion'), 'tracking');
    assert.deepEqual(beatCues(0), times(0, 0, 'ਢਮ'));
    await page.screenshot({ path: output + '/01-path.png' });
    await speech(1, 0, 3);
    await speech(1, 1, 5);

    const reveal = at(2, 0, 'ਢੋਲ');
    await seek(2, reveal - 220);
    assert.equal(await stage.getAttribute('data-drum'), 'hidden');
    await seek(2, reveal + 100);
    assert.equal(await stage.getAttribute('data-drum'), 'revealed');
    await page.screenshot({ path: output + '/02-reveal.png' });

    const strike = at(3, 0, 'ਵੱਜਿਆ');
    assert.deepEqual(beatCues(3), [strike]);
    await seek(3, strike - 950);
    assert.ok(gap(await twig(), { x: 782, y: 526 }) > 25);
    await seek(3, strike + 3);
    assert.equal(await stage.getAttribute('data-strike'), 'twig');
    assert.equal(await page.locator('#book').getAttribute('data-layout'), 'cinema');
    assert.ok(gap(await twig(), { x: 782, y: 526 }) < 1, 'Twig reaches the upper half of the drum skin');
    assert.equal(await spoken(), 'ਵੱਜਿਆ।');
    await page.screenshot({ path: output + '/03-twig-contact.png' });
    await seek(3, strike + 560);
    assert.equal(await stage.getAttribute('data-strike'), 'none');
    assert.ok(gap(await twig(), { x: 782, y: 526 }) > 30, 'Twig springs back after the beat');

    await speech(4, 0, 4);
    const taps = times(5, 0, 'ਥਾਪ');
    assert.deepEqual(beatCues(5), taps);
    await seek(5, at(5, 0, 'ਚੁੱਕਿਆ') + 300);
    assert.ok((await paw()).y < 595, 'The jackal lifts its paw before the first tap');
    for (const hit of taps) {
      await seek(5, hit - 180);
      assert.ok(gap(await paw(), { x: 760, y: 554 }) > 12);
      await seek(5, hit + 3);
      assert.equal(await stage.getAttribute('data-strike'), 'paw');
      assert.ok(gap(await paw(), { x: 760, y: 554 }) < 1, 'The paw lands on the drum skin on the beat');
      assert.equal(await spoken(), 'ਥਾਪ');
      await seek(5, hit + 570);
      assert.equal(await stage.getAttribute('data-strike'), 'none');
      assert.ok((await paw()).y > 620);
    }
    await seek(5, taps[1] + 25);
    await page.screenshot({ path: output + '/04-paw-contact.png' });
    await speech(5, 1, 6);
    assert.equal(beatCues(6).length, 2);
    await seek(6, at(6, 0, 'ਥਾਪ') + 3);
    assert.equal(await stage.getAttribute('data-strike'), 'twig');

    await page.setViewportSize({ width: 393, height: 852 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seek(3, strike + 155);
    const frame = await page.locator('#movie').boundingBox();
    assert.ok(frame.width <= 394 && frame.height > 140);
    assert.equal(await stage.getAttribute('data-camera-motion'), 'static');
    await page.screenshot({ path: output + '/05-mobile.png' });

    await page.goto(url + '?review=1&scene=twig-taps-skin&test=1');
    await page.waitForFunction(() => window.lp024Test);
    assert.equal(await page.locator('#review-scenes li').count(), 7);
    assert.equal(await page.locator('#review-title').textContent(), 'The twig taps the drum');
    assert.match(await page.locator('#review-audio').textContent(), /9\/9 voices · 9 aligned/);
    await seek(3, strike - 200);
    await page.locator('#watch-scene').click();
    await page.waitForFunction(time => {
      const state = window.lp024Test.state();
      return state.audioActive && state.position > time;
    }, strike);
    await page.locator('#watch-scene').click();
    await page.locator('#review-note').fill('The twig touches the skin at the beat.');
    await page.locator('#approve-scene').click();
    assert.equal(await page.locator('#review-progress').textContent(), '1 of 7 approved');
    assert.deepEqual(errors, []);
    console.log('PASS Mission 24: 194 Punjabi words, 9 aligned voice lines, drum contacts and beats, mobile and scene review.');
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
