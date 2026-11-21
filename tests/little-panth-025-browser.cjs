#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { chromium } = require('playwright-core');

const url = process.env.LP025_URL || 'http://127.0.0.1:8765/little%20panth/mission-025/';
const output = '../lp25-qa';

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
    await page.waitForFunction(() => window.lp025Test || document.getElementById('loading').textContent.includes('ਨਹੀਂ'));
    assert.deepEqual(errors, []);
    const { scenes, clips } = await page.evaluate(() => window.lp025Test.state());
    const lines = scenes.flatMap(scene => scene.lines);
    assert.equal(scenes.length, 6);
    assert.equal(clips, 11);
    assert.ok(lines.every(line => line.aligned));
    assert.deepEqual([...new Set(lines.map(line => line.speaker))].sort(), ['elephant', 'harpreet', 'narrator']);
    assert.equal(lines.reduce((total, line) => total + line.reading.words.length, 0), 184);
    assert.equal(await page.locator('#harpreet').getAttribute('data-studio-preset'), 'adult-harpreet');
    assert.equal(await page.locator('button, header, nav, input').count(), 0);
    const art = await page.locator('.art-page').boundingBox();
    const reading = await page.locator('.reading-page').boundingBox();
    assert.equal(art.width, reading.width);
    assert.equal(art.height, reading.height);

    const seek = (scene, ms) => page.evaluate(([index, time]) => window.lp025Test.seek(index, time), [scene, ms]);
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
      const target = new DOMPoint(x, y).matrixTransform(node.getScreenCTM()).matrixTransform(inverse);
      return { x: target.x, y: target.y };
    }, { selector, x, y });
    const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const toes = () => page.locator('#elephant [data-leg-toes]').evaluateAll(nodes => {
      const inverse = document.getElementById('stage').getScreenCTM().inverse();
      return nodes.map(node => {
        const p = node.getPointAtLength(0).matrixTransform(node.getScreenCTM()).matrixTransform(inverse);
        return { x: p.x, y: p.y };
      });
    });
    async function close(a, b, limit, description) {
      const distance = gap(await position(a), await position(b));
      assert.ok(distance < limit, description + ' (gap ' + distance.toFixed(2) + ')');
    }

    async function speech(scene, line, index) {
      const entry = scenes[scene].lines[line];
      const [from, to] = entry.reading.timings[index];
      await seek(scene, entry.start + (from + to) / 2);
      assert.equal(await page.locator('.word[aria-current="true"]').textContent(), entry.reading.words[index]);
      for (const id of ['harpreet', 'elephant']) {
        assert.equal(await page.locator('#' + id).getAttribute('data-speaking'), String(entry.speaker === id));
      }
    }

    const tub = ['#tailor-tub'];
    const handle = ['#tub-handle-grip', 104, -25];
    const trunk = ['#trunk-tip'];
    const hand = ['[data-hand="harpreet-right"]', 0, 56];
    const fabric = page.locator('#cloth-shape');
    const clothLeft = ['#cloth-left'];
    const clothRight = ['#cloth-right'];
    const arrival = at(0, 0, 'ਆਇਆ');
    await seek(0, arrival - 1600);
    const firstStep = await toes();
    const walker = await position(['#elephant']);
    const restSkin = await page.locator('#elephant-head-skin').getAttribute('d');
    await seek(0, arrival - 1550);
    const nextStep = await toes();
    assert.ok(gap(walker, await position(['#elephant'])) > 4, 'The elephant advances');
    assert.ok(firstStep.some((toe, i) => gap(toe, nextStep[i]) < .5), 'A stance foot stays on its mark');
    assert.ok(firstStep.some((toe, i) => nextStep[i].y < toe.y - 1), 'Another foot lifts');
    await speech(0, 1, 5);
    await page.screenshot({ path: output + '/01-courtyard.png' });
    await speech(1, 0, 4);

    const grasp = at(1, 1, 'ਫੜਿਆ');
    const lift = at(1, 1, 'ਚੁੱਕ');
    const land = at(1, 1, 'ਰੱਖਿਆ');
    await seek(1, grasp);
    await close(trunk, handle, 1, 'The elephant takes the tub by its handle');
    const before = await position(tub);
    await seek(1, lift + 790);
    await close(trunk, handle, 1, 'The trunk stays on the handle while carrying the tub');
    assert.ok((await position(tub)).y < before.y - 35);
    await page.screenshot({ path: output + '/02-tub.png' });
    await seek(1, land + 55);
    await close(trunk, handle, 1, 'The trunk holds on until the tub is back on the floor');
    await seek(1, land + 660);
    assert.equal(await page.locator('#elephant-trunk').getAttribute('data-grip'), 'none');
    assert.ok(gap(await position(trunk), await position(handle)) > 19);

    const splash = at(2, 0, 'ਛਪਾਕ');
    const release = at(2, 0, 'ਪਾਇਆ') + 100;
    await seek(2, release - 2);
    await close(clothLeft, hand, 1, 'Harpreet carries the cloth by a corner');
    const held = await position(clothLeft);
    await seek(2, release + 2);
    assert.equal(await fabric.getAttribute('data-state'), 'falling');
    assert.ok(gap(held, await position(clothLeft)) < 8, 'The cloth releases from the hand continuously');
    await seek(2, splash);
    assert.equal(await fabric.getAttribute('data-state'), 'in-tub');
    assert.ok(gap(await position(clothLeft), { x: 596, y: 552 }) < 1);
    assert.ok(Number(await page.locator('#wash-splash').getAttribute('opacity')) > .8);
    await seek(2, splash + 215);
    await page.screenshot({ path: output + '/03-splash.png' });
    const stir = at(2, 0, 'ਹਿਲਾਇਆ');
    const feet = ['#harpreet [data-rig-foot]'];
    const face = ['#harpreet [data-scene-layer="face"]', 627, 600];
    await seek(2, stir - 675);
    const planted = await position(feet);
    const upright = await position(face);
    await seek(2, stir + 20);
    assert.ok(gap(planted, await position(feet)) < 1, 'Harpreet plants his feet as he bends');
    assert.ok((await position(face)).x > upright.x + 20, 'Harpreet bends forward above the hips');
    await close(clothLeft, hand, 1, 'His hand stays on the cloth while he stirs');
    await page.screenshot({ path: output + '/07-stir.png' });

    await seek(3, at(3, 0, 'ਖਿੱਚਿਆ') + 160);
    await close(trunk, ['#tailor-pail', 1, 2], 1, 'The trunk reaches the water in the pail');
    await seek(3, at(3, 0, 'ਛੱਡੀ') + 270);
    assert.ok(Number(await page.locator('#rinse-spray').getAttribute('opacity')) > .95);
    const skin = await page.locator('#elephant-head-skin').evaluate(node => ({
      path: node.getAttribute('d'), joined: node.isPointInFill(new DOMPoint(-104, -145))
    }));
    assert.notEqual(skin.path, restSkin);
    assert.equal(skin.path.match(/M/g).length, 1);
    assert.ok(skin.joined, 'The trunk root remains within the continuous head silhouette');
    const sprayStart = await page.locator('#rinse-stream').evaluate(node => {
      const p = node.getPointAtLength(0);
      return { x: p.x, y: p.y };
    });
    assert.ok(gap(sprayStart, await position(trunk)) < 1);
    const landing = await position(['#rinse-hit']);
    const left = await position(clothLeft);
    const right = await position(clothRight);
    assert.ok(landing.x > left.x && landing.x < right.x);
    assert.ok(landing.y >= right.y && landing.y < left.y + 18);
    await page.screenshot({ path: output + '/04-rinse.png' });
    await speech(3, 1, 5);
    assert.equal(await page.locator('#cloth-dust').getAttribute('opacity'), '0');

    const together = at(4, 1, 'ਚੁੱਕਿਆ');
    const hang = at(4, 1, 'ਟੰਗ');
    await seek(4, together + 480);
    await close(clothLeft, hand, 1, 'Harpreet’s hand stays on the cloth during the lift');
    await close(clothRight, trunk, 1, 'The elephant’s trunk stays on the opposite corner');
    await seek(4, hang + 240);
    assert.equal(await fabric.getAttribute('data-state'), 'hung');
    assert.ok(gap(await position(clothLeft), { x: 582, y: 416 }) < 1);
    assert.ok(gap(await position(clothRight), { x: 704, y: 416 }) < 1);
    await close(clothLeft, hand, 11, 'Harpreet’s hand reaches the line before releasing');
    await close(clothRight, trunk, 1, 'The trunk reaches the line before releasing');
    await page.screenshot({ path: output + '/05-hang.png' });
    await speech(5, 0, 5);
    await speech(5, 1, 4);
    assert.equal(await page.locator('#line-pegs').getAttribute('opacity'), '1');

    await page.setViewportSize({ width: 393, height: 852 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seek(3, at(3, 0, 'ਛੱਡੀ') + 270);
    assert.equal(await page.locator('#stage').getAttribute('data-camera-motion'), 'static');
    const frame = await page.locator('#movie').boundingBox();
    assert.ok(frame.width <= 394 && frame.height > 140);
    await page.screenshot({ path: output + '/06-mobile.png' });

    await page.goto(url + '?review=1&scene=spray-and-rinse&test=1');
    await page.waitForFunction(() => window.lp025Test);
    assert.equal(await page.locator('#review-scenes li').count(), 6);
    assert.equal(await page.locator('#review-title').textContent(), 'The trunk rinses the cloth');
    assert.match(await page.locator('#review-audio').textContent(), /11\/11 voices · 11 aligned/);
    await page.locator('#watch-scene').click();
    await page.waitForFunction(() => window.lp025Test.state().audioActive && window.lp025Test.state().position > 440);
    await page.locator('#watch-scene').click();
    await page.locator('#approve-scene').click();
    assert.equal(await page.locator('#review-progress').textContent(), '1 of 6 approved');
    assert.deepEqual(errors, []);
    console.log('PASS Mission 25: 184 Punjabi words, 11 aligned voice clips, planted steps and hip bend, tub, rinse and cloth contacts, mobile and review.');
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
