#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { chromium } = require('playwright-core');

const url = process.env.LP022_URL || 'http://127.0.0.1:8765/little%20panth/mission-022/';
const output = '../lp22-qa';

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
    await page.waitForFunction(() => window.lp022Test || document.getElementById('loading').textContent.includes('ਨਹੀਂ'));
    assert.deepEqual(errors, []);

    const { scenes, clips } = await page.evaluate(() => window.lp022Test.state());
    const lines = scenes.flatMap(scene => scene.lines);
    assert.equal(scenes.length, 7);
    assert.equal(clips, 10);
    assert.ok(lines.every(line => line.aligned));
    assert.deepEqual([...new Set(lines.map(line => line.speaker))].sort(), ['friend', 'narrator']);
    assert.equal(lines.reduce((total, line) => total + line.reading.words.length, 0), 180);
    assert.equal(await page.locator('#rohan').getAttribute('data-studio-preset'), 'kid-rohan');
    assert.equal(await page.locator('#cap-monkeys [data-monkey-crown]').count(), 3);
    assert.equal(await page.locator('button, header, nav, input').count(), 0);
    const art = await page.locator('.art-page').boundingBox();
    const reading = await page.locator('.reading-page').boundingBox();
    assert.equal(art.width, reading.width);
    assert.equal(art.height, reading.height);

    const stage = page.locator('#stage');
    const seek = (scene, ms) => page.evaluate(([index, time]) => window.lp022Test.seek(index, time), [scene, ms]);
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
    async function close(a, b, limit, message) {
      const [from, to] = await Promise.all([position(a), position(b)]);
      const gap = dist(from, to);
      assert.ok(gap < limit, message + ' (gap ' + gap.toFixed(2) + ')');
    }
    const palm = (side = 'right') => ['[data-hand="rohan-' + side + '"]', 0, 56];
    const owner = name => page.locator('#' + name).getAttribute('data-owner');
    const pose = name => ['#' + name];
    const basket = pose('cap-basket');
    async function speak(scene, line, index) {
      const entry = scenes[scene].lines[line];
      const [from, to] = entry.reading.timings[index];
      await seek(scene, entry.start + (from + to) / 2);
      assert.equal(await page.locator('.word[aria-current="true"]').textContent(), entry.reading.words[index]);
      assert.equal(await page.locator('#rohan').getAttribute('data-speaking'), String(entry.speaker === 'friend'));
    }

    await seek(0, 2870);
    assert.equal(await stage.getAttribute('data-camera-motion'), 'tracking');
    assert.equal(await owner('red-cap'), 'rohan-head');
    assert.equal(await owner('cap-basket'), 'rohan');
    await close(basket, palm(), 1, 'Basket follows Rohan’s palm');
    assert.equal(await page.locator('#cap-basket-slots > g').count(), 3);
    await page.screenshot({ path: output + '/01-walk.png' });

    await speak(1, 0, 3);
    const set = wordAt(1, 1, 'ਰੱਖੀ') + 170;
    await seek(1, set - 1);
    const inHand = await position(basket);
    await seek(1, set + 1);
    assert.equal(await owner('cap-basket'), 'stone');
    assert.ok(dist(inHand, await position(basket)) < 8, 'Basket touches the stone before Rohan lets go');
    await speak(1, 1, 14);

    for (const [color, word] of [['blue', 'ਨੀਲੀ'], ['yellow', 'ਪੀਲੀ'], ['green', 'ਹਰੀ']]) {
      const cap = pose(color + '-cap');
      const take = wordAt(2, 0, word) + 140;
      await seek(2, take - 1);
      assert.equal(await owner(color + '-cap'), 'basket');
      await close(['#' + color + '-cap', -8, 3], ['#' + color + '-monkey [data-arm="near"] [data-paw]'],
        1, 'Monkey’s paw contacts the ' + color + ' cap before pickup');
      await seek(2, take + 315);
      assert.equal(await owner(color + '-cap'), 'monkey-paw');
      await close(['#' + color + '-cap', -8, 3], ['#' + color + '-monkey [data-arm="near"] [data-paw]'],
        2, 'The ' + color + ' cap stays with the monkey’s paw');
      if (color === 'blue') await page.screenshot({ path: output + '/02-pickup.png' });
      const before = await position(cap);
      await seek(2, take + 800);
      assert.equal(await owner(color + '-cap'), 'monkey-head');
      assert.ok(dist(before, await position(cap)) > 8);
      await close(cap, ['#' + color + '-monkey [data-monkey-crown]', 0, -96], 1, 'Cap stays on the monkey’s head');
    }
    await speak(3, 0, 2);

    const redLanding = wordAt(4, 0, 'ਡਿੱਗੀ') + 80;
    await seek(4, redLanding - 726);
    const onHead = await position(pose('red-cap'));
    await seek(4, redLanding - 724);
    assert.equal(await owner('red-cap'), 'red-flight');
    assert.ok(dist(onHead, await position(pose('red-cap'))) < 2, 'The red cap leaves Rohan’s head smoothly');
    await seek(4, redLanding - 330);
    await page.screenshot({ path: output + '/03-red-drop.png' });
    await seek(4, redLanding + 5);
    assert.equal(await owner('red-cap'), 'basket');

    for (const [color, word] of [['blue', 'ਇੱਕ'], ['yellow', 'ਦੋ'], ['green', 'ਤਿੰਨ']]) {
      const fall = wordAt(5, 0, word);
      const cap = pose(color + '-cap');
      await seek(5, fall - 1);
      const before = await position(cap);
      assert.equal(await owner(color + '-cap'), 'monkey-head');
      await seek(5, fall + 1);
      assert.equal(await page.locator('.word[aria-current="true"]').textContent(), { blue: 'ਇੱਕ,', yellow: 'ਦੋ,', green: 'ਤਿੰਨ!' }[color]);
      assert.equal(await owner(color + '-cap'), 'monkey-flight');
      assert.ok(dist(before, await position(cap)) < 2, 'The ' + color + ' cap leaves the crown without a jump');
      await seek(5, fall + 804);
      const beforeLanding = await position(cap);
      await seek(5, fall + 806);
      assert.equal(await owner(color + '-cap'), 'basket');
      assert.ok(dist(beforeLanding, await position(cap)) < 2, 'The ' + color + ' cap lands inside the basket');
      if (color === 'green') await page.screenshot({ path: output + '/04-packed.png' });
    }
    assert.equal(await page.locator('#cap-basket-slots > g').count(), 4);

    await speak(6, 0, 4);
    const lift = wordAt(6, 1, 'ਚੁੱਕੀ');
    await seek(6, lift - 1);
    await close(['#red-cap', -8, 3], palm('left'), 8, 'Rohan’s left hand reaches the red cap');
    await seek(6, lift + 100);
    assert.equal(await owner('red-cap'), 'rohan-hand');
    await close(['#red-cap', -8, 3], palm('left'), 1, 'The red cap stays in Rohan’s left hand');
    const bag = wordAt(6, 1, 'ਫੜੀ');
    await seek(6, bag - 1);
    await close(basket, palm(), 8, 'Rohan grips the basket handle before lifting it');
    await seek(6, wordAt(6, 1, 'ਤੁਰ') + 1240);
    await close(basket, palm(), 1, 'The basket stays in Rohan’s right hand as he walks');
    assert.equal(await page.locator('#cap-basket-slots > g').count(), 3);
    await page.screenshot({ path: output + '/05-walk-home.png' });

    await page.locator('#movie').click();
    await page.waitForFunction(() => window.lp022Test.state().audioActive && window.lp022Test.state().position > 440);
    await page.setViewportSize({ width: 390, height: 844 });
    await seek(5, wordAt(5, 0, 'ਦੋ') + 335);
    await page.screenshot({ path: output + '/06-phone.png' });
    assert.ok((await page.locator('#reading').boundingBox()).width <= 390);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seek(0, 2870);
    assert.equal(await stage.getAttribute('data-camera-motion'), 'static');

    await page.goto(url + '?review=1&scene=caps-tumble&test=1');
    await page.waitForFunction(() => window.lp022Test);
    assert.equal(await page.locator('#review-scenes li').count(), 7);
    assert.equal(await page.locator('#review-title').textContent(), 'One, two, three!');
    assert.match(await page.locator('#review-audio').textContent(), /10\/10 voices · 10 aligned/);
    assert.equal(await page.locator('#review-progress').textContent(), '0 of 7 approved');
    await page.locator('#approve-scene').click();
    assert.equal(await page.locator('#review-progress').textContent(), '1 of 7 approved');
    assert.deepEqual(errors, []);
    console.log('PASS Mission 22: 180 Punjabi words, 10 aligned clips, continuous cap pickups and drops, mobile, and review.');
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
