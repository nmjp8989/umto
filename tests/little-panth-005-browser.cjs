#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { mkdir, readFile } = require('node:fs/promises');
const { chromium } = require('playwright-core');

const live = process.env.LP005_TEST_URL || 'http://127.0.0.1:8765/little%20panth/mission-005/';
const output = '../lp05-qa';

async function run() {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : { channel: 'chrome' }),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
  });
  try {
    const errors = [];
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(live + '?test=1');
    await page.waitForFunction(() => window.lp005Test, null, { timeout: 20000 });
    assert.equal(await page.locator('button, input, nav, header, footer, video[controls], audio[controls]').count(), 0);
    const state = await page.evaluate(() => window.lp005Test.state());
    assert.equal(state.scenes.length, 8);
    assert.equal(state.scenes.flatMap(scene => scene.lines).length, 19);
    assert.equal(state.scenes.flatMap(scene => scene.lines.flatMap(line => line.reading.words)).length, 186);
    if (process.env.LP005_REQUIRE_AUDIO === '1') {
      assert.equal(state.clips, 19, 'Every turn needs its own playable voice clip');
      assert.equal(state.scenes.flatMap(scene => scene.lines).filter(line => line.aligned).length, 19);
    }
    function centerOfWord(line, i) {
      const [start, end] = line.reading.timings[i];
      return line.start + (start + end) / 2;
    }
    async function jump(scene, ms) {
      await page.evaluate(([index, position]) => window.lp005Test.seek(index, position), [scene, ms]);
    }
    const first = state.scenes[0];
    await jump(0, centerOfWord(first.lines[0], 1));
    assert.equal(await page.locator('.word[aria-current="true"]').textContent(), first.lines[0].reading.words[1]);
    assert.equal(await page.locator('#crow').getAttribute('data-speaking'), 'false');
    assert.equal(await page.locator('#lower-beak').getAttribute('transform'), 'rotate(0 49 13)');
    const art = await page.locator('.art-page').boundingBox();
    const reading = await page.locator('.reading-page').boundingBox();
    assert.equal(art.width, reading.width);
    assert.equal(art.height, reading.height);
    await page.screenshot({ path: output + '/01-sunny-fields.png' });

    const speechMs = centerOfWord(first.lines[1], 1);
    await jump(0, speechMs);
    assert.equal(await page.locator('#crow').getAttribute('data-speaking'), 'true');
    assert.notEqual(await page.locator('#lower-beak').getAttribute('transform'), 'rotate(0 49 13)');
    assert.equal(await page.locator('.word[aria-current="true"]').textContent(), first.lines[1].reading.words[1]);
    await jump(0, first.lines[1].end + 100);
    assert.equal(await page.locator('#crow').getAttribute('data-speaking'), 'false');

    const find = state.scenes[2];
    await jump(2, centerOfWord(find.lines[1], 2));
    assert.equal(await page.locator('#book').getAttribute('data-layout'), 'cinema');
    assert.equal(await page.locator('#courtyard').getAttribute('opacity'), '1');
    const cinema = await page.locator('#movie').boundingBox();
    assert.equal(cinema.width, 1920);
    assert.equal(cinema.height, 1080);
    await page.screenshot({ path: output + '/03-find-pot.png' });

    const reach = state.scenes[3];
    await jump(3, centerOfWord(reach.lines[0], 11) + 150);
    assert.equal(await page.locator('#book').getAttribute('data-layout'), 'spread');
    assert.equal(await page.locator('#jar-cutaway').getAttribute('opacity'), '1');
    assert.equal(await page.locator('#props').getAttribute('data-stones'), '0');
    const reachFrame = await page.locator('#stage').evaluate(svg => svg.viewBox.baseVal.y + svg.viewBox.baseVal.height);
    assert.ok(reachFrame > 650, 'The cutaway shot must show the bottom of the pot');
    await page.screenshot({ path: output + '/04-low-water.png' });

    const drops = state.scenes[5];
    assert.equal(drops.events.length, 4);
    let water = 615;
    for (const [i, cue] of drops.events.entries()) {
      await jump(5, cue.ms + 100);
      assert.equal(Number(await page.locator('#props').getAttribute('data-stones')), i + 1);
      const newWater = Number(await page.locator('#props').getAttribute('data-water-level'));
      assert.ok(newWater < water);
      water = newWater;
    }
    await jump(5, centerOfWord(drops.lines[2], 3));
    assert.equal(await page.locator('#book').getAttribute('data-caption'), 'top');
    const dropsFrame = await page.locator('#stage').evaluate(svg => {
      const { y, height } = svg.viewBox.baseVal;
      return { y, bottom: y + height };
    });
    assert.ok(dropsFrame.y < 230 && dropsFrame.bottom > 650, 'Frame the crow and the complete cutaway');
    await page.screenshot({ path: output + '/06-pebbles.png' });

    await page.setViewportSize({ width: 390, height: 844 });
    const drink = state.scenes[6];
    await jump(6, centerOfWord(drink.lines[1], 12));
    assert.equal(await page.locator('#props').getAttribute('data-stones'), '4');
    assert.ok((await page.locator('#reading').boundingBox()).width < 390);
    await page.screenshot({ path: output + '/07-phone.png' });

    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(live + '?review=1&scene=drops&test=1');
    await page.waitForFunction(() => window.lp005Test);
    assert.equal(await page.locator('#review-scenes li').count(), 8);
    assert.equal(await page.locator('#review-progress').textContent(), '0 of 8 approved');
    await page.locator('#watch-scene').click();
    await page.waitForFunction(() => window.lp005Test.state().audioActive && window.lp005Test.state().position > 190);
    await page.locator('#watch-scene').click();
    const moment = await page.evaluate(() => window.lp005Test.state().position);
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => window.lp005Test.state().position), moment);
    await page.locator('#review-note').fill('Check the splash frame.');
    await page.locator('#note-time').click();
    await page.locator('#change-scene').click();
    assert.equal(await page.locator('#review-scenes [data-scene="drops"]').getAttribute('data-decision'), 'changes');
    await page.locator('#review-scenes [data-scene="heat"]').click();
    await page.locator('#approve-scene').click();
    assert.equal(await page.locator('#review-progress').textContent(), '1 of 8 approved');
    await page.reload();
    await page.waitForFunction(() => window.lp005Test);
    assert.equal(await page.locator('#review-progress').textContent(), '1 of 8 approved');
    await page.locator('#review-scenes [data-scene="drops"]').click();
    assert.match(await page.locator('#review-note').inputValue(), /Check the splash frame\.\n\[0:\d\d\]/);
    const download = page.waitForEvent('download');
    await page.locator('#download-review').click();
    const file = await download;
    const report = JSON.parse(await readFile(await file.path(), 'utf8'));
    assert.equal(report.scenes.length, 8);
    assert.equal(report.approved, false);
    assert.equal(report.scenes.find(scene => scene.id === 'drops').decision, 'changes');
    assert.match(report.scenes.find(scene => scene.id === 'drops').note, /splash frame/);
    await page.screenshot({ path: output + '/08-review.png' });
    assert.deepEqual(errors, []);
    console.log('PASS Mission 05: 8 scenes, 19 turns, exact spread, 4 synchronized water rises, lip-sync isolated to crow turns, phone and review flow.');
    console.log('Loaded ' + state.clips + '/19 recorded clips. Lyria score: ' + Boolean(state.generatedScore) + '.');
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
