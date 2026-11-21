#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { chromium } = require('playwright-core');

const url = process.env.LP015_URL || 'http://127.0.0.1:8765/little%20panth/mission-015/';
const output = '../lp15-qa';

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
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(url + '?test=1');
    await page.waitForFunction(() => window.lp015Test || document.getElementById('loading').textContent.includes('ਨਹੀਂ'));
    assert.deepEqual(errors, []);
    const { scenes, clips } = await page.evaluate(() => window.lp015Test.state());
    assert.equal(scenes.length, 7);
    assert.equal(clips, 13);
    const lines = scenes.flatMap(scene => scene.lines);
    assert.ok(lines.every(line => line.aligned));
    assert.equal(new Set(lines.map(line => line.speaker)).size, 3);
    assert.equal(lines.reduce((total, line) => total + line.reading.words.length, 0), 181);
    assert.equal(await page.locator('button, header, nav, input, video[controls]').count(), 0);
    const left = await page.locator('.art-page').boundingBox();
    const right = await page.locator('.reading-page').boundingBox();
    assert.equal(left.width, right.width);
    assert.equal(left.height, right.height);

    const stage = page.locator('#stage');
    const seek = (scene, ms) => page.evaluate(([index, time]) => window.lp015Test.seek(index, time), [scene, ms]);
    const status = (id, name) => page.locator('#' + id).getAttribute('data-' + name);
    const position = id => page.locator('#' + id).evaluate(node => node.transform.baseVal.getItem(0).matrix.e);
    const plank = () => page.locator('#creaking-board').evaluate(node => node.transform.baseVal.getItem(0).matrix.f);
    const wordAt = (scene, line, word) => {
      const entry = scenes[scene].lines[line];
      const index = entry.reading.words.findIndex(value => value.replace(/\p{P}/gu, '') === word);
      assert.ok(index >= 0, 'Expected spoken word ' + word);
      return entry.start + entry.reading.timings[index][0];
    };

    async function speak(scene, line, word) {
      const entry = scenes[scene].lines[line];
      const [from, to] = entry.reading.timings[word];
      await seek(scene, entry.start + (from + to) / 2);
      assert.equal(await page.locator('.word[aria-current="true"]').textContent(), entry.reading.words[word]);
      for (const actor of ['mehar', 'boy']) {
        assert.equal(await status(actor, 'speaking'), String(actor === entry.speaker));
      }
    }

    for (const [id, preset] of [['mehar', 'kid-meher'], ['boy', 'kid-sidak']]) {
      assert.equal(await status(id, 'studio-preset'), preset);
      assert.equal(await page.locator('#' + id + ' [data-rig-foot]').count(), 2);
    }
    await speak(0, 0, 7);
    assert.equal(await stage.getAttribute('data-camera-preset'), 'wide');
    assert.equal(await status('channi', 'location'), 'left-bank');
    assert.equal(await status('moti', 'location'), 'right-bank');
    await speak(0, 1, 3);
    await page.screenshot({ path: output + '/01-mehar.png' });

    await seek(1, wordAt(1, 0, 'ਰੁਕ') + 450);
    for (const name of ['channi', 'moti']) {
      assert.equal(await status(name, 'location'), 'bridge');
      assert.equal(await status(name, 'walking'), 'false');
    }
    assert.ok(await position('moti') - await position('channi') > 215);
    await speak(1, 1, 4);

    const creak = wordAt(2, 0, 'ਚਰਮਰਾਈ');
    await seek(2, creak - 300);
    assert.equal(await plank(), 0);
    await seek(2, creak + 195);
    assert.ok(await plank() > 2);
    assert.equal(await page.locator('#book').getAttribute('data-layout'), 'cinema');
    await seek(2, wordAt(2, 0, 'ਪਾਣੀ') + 360);
    assert.equal(await status('channi', 'looking-down'), 'true');
    assert.equal(await status('moti', 'looking-down'), 'true');
    await page.screenshot({ path: output + '/02-bridge.png' });

    await speak(3, 0, 4);
    const before = await position('moti');
    const back = wordAt(3, 1, 'ਪਿੱਛੇ') + 550;
    await seek(3, back);
    assert.equal(await stage.getAttribute('data-camera-motion'), 'tracking');
    assert.ok(await position('moti') > before);
    assert.equal(await status('channi', 'walking'), 'false');
    await seek(3, scenes[3].duration - 70);
    assert.equal(await status('moti', 'location'), 'right-bank');

    await speak(4, 0, 3);
    const channiCrossing = wordAt(4, 1, 'ਪਾਰ') + 250;
    await seek(4, channiCrossing);
    assert.equal(await status('channi', 'location'), 'bridge');
    assert.equal(await status('moti', 'location'), 'right-bank');
    assert.equal(await status('moti', 'walking'), 'false');
    await seek(4, scenes[4].duration - 55);
    assert.equal(await status('channi', 'location'), 'right-bank');
    const motiCrossing = wordAt(5, 0, 'ਵਾਰੀ') + 210;
    await seek(5, motiCrossing);
    assert.equal(await status('moti', 'location'), 'bridge');
    assert.equal(await status('channi', 'location'), 'right-bank');
    assert.equal(await status('channi', 'walking'), 'false');
    await page.screenshot({ path: output + '/03-one-at-a-time.png' });
    await seek(5, scenes[5].duration - 65);
    assert.equal(await status('moti', 'location'), 'left-bank');

    await speak(6, 1, 5);
    assert.equal(await status('channi', 'looking-down'), 'true');
    assert.equal(await status('moti', 'looking-down'), 'true');

    await page.locator('#movie').click();
    await page.waitForFunction(() => window.lp015Test.state().audioActive && window.lp015Test.state().position > 440);
    await page.setViewportSize({ width: 390, height: 844 });
    await seek(5, motiCrossing);
    assert.ok((await page.locator('#reading').boundingBox()).width <= 390);
    await page.screenshot({ path: output + '/04-phone.png' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seek(4, channiCrossing);
    assert.equal(await stage.getAttribute('data-camera-motion'), 'static');
    assert.equal(await status('channi', 'walking'), 'false');

    await page.goto(url + '?review=1&scene=creak&test=1');
    await page.waitForFunction(() => window.lp015Test);
    assert.equal(await page.locator('#review-scenes li').count(), 7);
    assert.equal(await page.locator('#review-title').textContent(), 'The plank creaks');
    assert.match(await page.locator('#review-audio').textContent(), /13\/13 voices · 13 aligned/);
    assert.equal(await page.locator('#review-progress').textContent(), '0 of 7 approved');
    await page.locator('#approve-scene').click();
    assert.equal(await page.locator('#review-progress').textContent(), '1 of 7 approved');
    assert.deepEqual(errors, []);
    console.log('PASS Mission 15: 181 Punjabi words, 13 aligned clips, Studio cast, separate turns, timed plank, mobile, and review.');
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
