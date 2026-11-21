#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { chromium } = require('playwright-core');
const manifest = require('../little panth/mission-029/audio/generation-manifest.json');

const url = process.env.LP029_URL || 'http://127.0.0.1:8765/little%20panth/mission-029/';
const output = '../lp29-qa';

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
    await page.waitForFunction(() => window.lp029Test || document.getElementById('loading').textContent.includes('ਨਹੀਂ'));
    assert.deepEqual(errors, []);
    const { scenes, clips } = await page.evaluate(() => window.lp029Test.state());
    const lines = scenes.flatMap(scene => scene.lines);
    assert.equal(scenes.length, 6);
    assert.equal(clips, 10);
    assert.ok(lines.every(line => line.aligned));
    assert.equal(lines.reduce((total, line) => total + line.reading.words.length, 0), 177);
    assert.equal(new Set(Object.values(manifest).map(line => line.voice)).size, 3);
    assert.equal(await page.locator('#sidak').getAttribute('data-studio-preset'), 'kid-sidak');
    assert.equal(await page.locator('#bibi').getAttribute('data-studio-preset'), 'elder-bibi-ji');
    assert.equal(await page.locator('button, header, nav, input').count(), 0);
    const art = await page.locator('.art-page').boundingBox();
    const reading = await page.locator('.reading-page').boundingBox();
    assert.equal(art.width, reading.width);
    assert.equal(art.height, reading.height);

    const seek = (scene, ms) => page.evaluate(([index, time]) => window.lp029Test.seek(index, time), [scene, ms]);
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
    const attr = (selector, key) => page.locator(selector).getAttribute(key);
    const photo = name => page.screenshot({ path: output + '/' + name + '.png' });
    const hand = () => position('[data-hand="sidak-right"]', -30, 84);
    const jutti = () => position('#lost-jutti');
    const ball = () => position('#cloth-ball');
    const elbowBelow = async () => {
      const arm = '#sidak [data-rig-arm="1"]';
      return (await position(arm + ' [data-rig-elbow]')).y - (await position(arm, 0, 48)).y > 7;
    };

    async function speech(scene, line, index) {
      const entry = scenes[scene].lines[line];
      const [from, to] = entry.reading.timings[index];
      await seek(scene, entry.start + (from + to) / 2);
      assert.equal(await page.locator('.word[aria-current="true"]').textContent(), entry.reading.words[index]);
      assert.equal(await attr('#sidak', 'data-speaking'), String(entry.speaker === 'friend'));
      assert.equal(await attr('#bibi', 'data-speaking'), String(entry.speaker === 'dadi'));
      assert.equal(await attr('#dog-open-mouth', 'opacity'), '0');
    }

    await speech(0, 1, 4);
    assert.equal(await page.locator('#puppy-back #lost-jutti').count(), 1);
    const ear = page.locator('#bibi [data-scene-layer="earLeft"] .thin').first();
    assert.equal(await ear.evaluate(el => getComputedStyle(el).fill), 'none');
    await photo('01-fair-day');
    const rustle = at(1, 0, 'ਖੜਖੜਾਹਟ');
    await seek(1, rustle - 60);
    const stillCloth = await attr('#charpai-quilt', 'transform');
    const planted = await position('#sidak [data-rig-foot]');
    const stillFace = await position('#sidak [data-scene-layer="face"]', 627, 600);
    await seek(1, rustle + 330);
    assert.notEqual(await attr('#charpai-quilt', 'transform'), stillCloth);
    await seek(1, at(1, 0, 'ਝੁਕ') + 360);
    assert.ok(gap(planted, await position('#sidak [data-rig-foot]')) < 1, 'Sidak keeps his feet planted');
    assert.ok((await position('#sidak [data-scene-layer="face"]', 627, 600)).x > stillFace.x + 18);
    await speech(1, 1, 4);
    await photo('02-tail');

    const out = at(2, 0, 'ਨਿਕਲਿਆ');
    await seek(2, out + 800);
    assert.equal(await page.locator('#puppy-front #moti').count(), 1);
    assert.equal(await attr('#lost-jutti', 'data-owner'), 'dog');
    assert.ok(gap(await position('#moti-mouth'), await position('#jutti-grip')) < 1);
    const dogBox = await page.locator('#moti').boundingBox();
    const boyBox = await page.locator('#sidak').boundingBox();
    assert.ok(dogBox.height < boyBox.height * .55, 'Moti reads as a puppy beside Sidak');
    await photo('03-the-missing-jutti');
    await speech(2, 1, 4);

    const pickBall = at(3, 0, 'ਚੁੱਕੀ');
    await seek(3, pickBall - 2);
    const beforeBall = await ball();
    await seek(3, pickBall + 2);
    assert.ok(gap(beforeBall, await ball()) < 5, 'The ball lifts at Sidak’s hand');
    assert.ok(await elbowBelow(), 'Sidak keeps his elbow below his shoulder when he picks up the ball');
    assert.ok(gap(await position('#ball-grip'), await hand()) < 1);
    const roll = at(3, 0, 'ਰੋੜ੍ਹ');
    await seek(3, roll - 2);
    const ballInHand = await ball();
    await photo('04-roll');
    await seek(3, roll + 2);
    assert.equal(await attr('#cloth-ball', 'data-owner'), 'rolling');
    const rollGap = gap(ballInHand, await ball());
    assert.ok(rollGap < 5, 'The ball leaves his hand continuously, gap ' + rollGap);
    const drop = at(3, 0, 'ਛੱਡੀ');
    await seek(3, drop - 2);
    const shoeInMouth = await jutti();
    await seek(3, drop + 2);
    assert.equal(await attr('#lost-jutti', 'data-owner'), 'falling');
    assert.ok(gap(shoeInMouth, await jutti()) < 2);
    await seek(3, drop + 560);
    assert.equal(await attr('#lost-jutti', 'data-owner'), 'stool');
    const shoeAtRest = await jutti();
    assert.ok(shoeAtRest.y > shoeInMouth.y + 8, 'The dropped jutti falls onto the stool');
    await seek(3, scenes[3].duration - 65);
    assert.ok(gap(shoeAtRest, await jutti()) < 1, 'The shoe stays behind when Moti runs');
    assert.equal(await attr('#cloth-ball', 'data-owner'), 'dog');
    assert.ok(gap(await ball(), await position('#moti-mouth')) < 9);
    await photo('05-reaches-the-ball');

    const lift = at(4, 0, 'ਚੁੱਕ');
    await seek(4, lift + 2);
    assert.equal(await attr('#lost-jutti', 'data-owner'), 'boy');
    const pickupGap = gap(shoeAtRest, await jutti());
    assert.ok(pickupGap < 5, 'The shoe lifts up from the woven stool, gap ' + pickupGap);
    await seek(4, lift + 590);
    assert.ok(gap(await position('#jutti-grip'), await hand()) < 1);
    await photo('06-carry-the-jutti');
    const set = at(4, 0, 'ਰੱਖ');
    await seek(4, set + 98);
    const beforeSet = await jutti();
    assert.ok(await elbowBelow(), 'Sidak lowers his elbow when he sets down the jutti');
    await seek(4, set + 102);
    assert.equal(await attr('#lost-jutti', 'data-owner'), 'pair');
    assert.ok(gap(beforeSet, await jutti()) < 5, 'The shoe is set down without jumping');
    assert.ok(gap(await position('#left-jutti'), await jutti()) < 60);
    await speech(4, 1, 3);
    await photo('07-pair');

    await seek(5, at(5, 0, 'ਆਇਆ') + 650);
    assert.equal(await attr('#cloth-ball', 'data-owner'), 'dog');
    assert.equal(await attr('#lost-jutti', 'data-owner'), 'pair');
    assert.ok(gap(await ball(), await position('#moti-mouth')) < 9);
    await photo('08-finale');
    await seek(5, at(5, 0, 'ਖੇਡਿਆ') + 400);
    assert.equal(await attr('#cloth-ball', 'data-owner'), 'rolling');

    await page.setViewportSize({ width: 393, height: 852 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seek(3, drop + 350);
    assert.equal(await attr('#stage', 'data-camera-motion'), 'static');
    const narrow = await page.locator('#movie').boundingBox();
    assert.ok(narrow.width <= 394 && narrow.height > 140);
    await speech(2, 1, 4);
    await photo('09-mobile');

    await page.goto(url + '?review=1&scene=roll-the-ball&test=1');
    await page.waitForFunction(() => window.lp029Test);
    assert.equal(await page.locator('#review-scenes li').count(), 6);
    assert.equal(await page.locator('#review-title').textContent(), 'A ball rolls across the courtyard');
    assert.match(await page.locator('#review-audio').textContent(), /10\/10 voices · 10 aligned/);
    await page.locator('#watch-scene').click();
    await page.waitForFunction(() => window.lp029Test.state().audioActive && window.lp029Test.state().position > 440);
    await page.locator('#watch-scene').click();
    await page.locator('#approve-scene').click();
    assert.equal(await page.locator('#review-progress').textContent(), '1 of 6 approved');
    assert.deepEqual(errors, []);
    console.log('PASS Mission 29: 177 words, 10 aligned clips, separate voices, puppy scale, shoe and ball contacts, mobile and scene approval.');
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
