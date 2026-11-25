#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { mkdir, writeFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const { chromium } = require('playwright-core');

const url = process.env.LP011_URL || 'http://127.0.0.1:8765/little%20panth/mission-011/';
const output = resolve(process.env.LP011_OUTPUT || 'screenshots/little-panth-011');
const isDefaultFavicon = resource => {
  try {
    const requested = new URL(resource);
    return requested.origin === new URL(url).origin && requested.pathname === '/favicon.ico';
  } catch { return false; }
};

function renderedArms() {
  const stage = document.getElementById('stage'), world = stage.getScreenCTM().inverse();
  const point = (node, x = 0, y = 0) => {
    const p = new DOMPoint(x, y).matrixTransform(node.getScreenCTM()).matrixTransform(world);
    return { x: p.x, y: p.y };
  };
  return Object.fromEntries(['mehar', 'boy', 'dadi'].map(id => [id,
    [...document.querySelectorAll('#' + id + ' [data-rig-arm]')]
      .sort((a, b) => Number(a.dataset.rigArm) - Number(b.dataset.rigArm)).map((arm, index) => {
        const hand = arm.querySelector('[data-action-hand]');
        const shoulder = point(arm, 0, 48), elbow = point(arm.querySelector('[data-rig-elbow]'));
        return { index, shoulder, elbow, wrist: point(arm.querySelector('[data-rig-wrist]')),
          palm: point(hand, 0, Number(hand.dataset.gripY)),
          below: elbow.y - shoulder.y, outward: (elbow.x - shoulder.x) * (index ? 1 : -1) };
      })]));
}

function assertNatural(arms, actor, indices = [0, 1], down = 7, outward = 4) {
  for (const index of indices) {
    const arm = arms[actor][index];
    assert.ok(arm.below > down, actor + ' arm ' + index + ' lowers its elbow: ' + arm.below);
    assert.ok(arm.outward > outward, actor + ' arm ' + index + ' keeps its elbow beside the waist: ' + arm.outward);
  }
}

async function run() {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : { channel: 'chrome' }),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
  });
  let page;
  const report = { checkpoints: [], errors: [], failedResources: [], ignoredFavicons: [] };
  let failurePoses = [];
  async function capture(name, actors = []) {
    await page.screenshot({ path: output + '/' + name + '.png' });
    const state = await page.evaluate(() => window.lp011Test.state());
    report.checkpoints.push({ name, scene: state.scenes[state.scene].id, ms: state.position,
      arms: await page.evaluate(renderedArms) });
    const movie = await page.locator('#movie').boundingBox(), viewport = page.viewportSize();
    for (const actor of actors) {
      const bounds = await page.locator('#' + actor).boundingBox();
      const x = Math.max(0, movie.x, bounds.x - 24), y = Math.max(0, movie.y, bounds.y - 24);
      const right = Math.min(viewport.width, movie.x + movie.width, bounds.x + bounds.width + 24);
      const bottom = Math.min(viewport.height, movie.y + movie.height, bounds.y + bounds.height + 24);
      if (right > x && bottom > y) await page.screenshot({ path: output + '/' + name + '-' + actor + '.png',
        clip: { x, y, width: right - x, height: bottom - y } });
    }
    await writeFile(output + '/checkpoints.json', JSON.stringify(report, null, 2));
  }
  try {
    page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const errors = report.errors;
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() !== 'error') return;
      const source = message.location().url || '';
      if (!isDefaultFavicon(source)) errors.push(message.text() + (source ? ' [' + source + ']' : ' [no source URL]'));
    });
    page.on('response', response => {
      if (response.status() < 400) return;
      const failure = { url: response.url(), status: response.status() };
      (isDefaultFavicon(failure.url) ? report.ignoredFavicons : report.failedResources).push(failure);
    });
    const backdrop = page.waitForResponse(response => response.url().endsWith('/mission-003/art/courtyard.webp') && response.ok());
    await page.goto(url + '?test=1');
    await page.waitForFunction(() => window.lp011Test || document.getElementById('loading').textContent.includes('ਨਹੀਂ'));
    const { scenes, clips } = await page.evaluate(() => window.lp011Test.state());
    const lines = scenes.flatMap(scene => scene.lines);
    const attempts = scenes[3].events.filter(event => event.sound === 'ribbon');
    const snapEvents = scenes[4].events.filter(event => event.sound === 'twig');
    failurePoses = [
      { name: 'ball-hold', scene: 1, ms: 2000, actors: ['mehar', 'boy'] },
      { name: 'bibi-bundle', scene: 2, ms: 4000, actors: ['dadi'] },
      ...attempts.map((event, i) => ({ name: i ? 'sidak-bundle' : 'mehar-bundle', scene: 3, ms: event.ms, actors: [i ? 'boy' : 'mehar'] })),
      { name: 'mehar-release', scene: 3, ms: attempts[0].ms + 720, actors: ['mehar', 'boy'] },
      { name: 'bundle-handover', scene: 3, ms: attempts[0].ms + 900, actors: ['mehar', 'boy'] },
      { name: 'bibi-unties', scene: 4, ms: scenes[4].events[0].ms + 265, actors: ['dadi'] },
      { name: 'intact-sticks', scene: 4, ms: snapEvents[0].ms - 40, actors: ['mehar', 'boy'] },
      { name: 'snapped-sticks', scene: 4, ms: snapEvents[1].ms + 300, actors: ['mehar', 'boy'] },
      { name: 'bibi-lesson', scene: 5, ms: (scenes[5].lines[0].start + scenes[5].lines[0].end) / 2, actors: ['dadi'] }
    ];
    await backdrop;
    assert.deepEqual(report.failedResources, [], 'Every story and native-rig resource loads successfully');
    assert.deepEqual(errors, []);
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
      const palm = new DOMPoint(0, Number(hand.dataset.gripY)).matrixTransform(hand.getCTM());
      return Math.hypot(held.x - palm.x, held.y - palm.y);
    }, { actor, side, target, x, y });
    const lowElbows = id => page.locator('#' + id + ' [data-rig-arm]').evaluateAll(arms => {
      const world = document.getElementById('stage').getScreenCTM().inverse();
      return arms.every(arm => {
        const shoulder = new DOMPoint(0, 48).matrixTransform(arm.getScreenCTM()).matrixTransform(world);
        const elbow = new DOMPoint().matrixTransform(arm.querySelector('[data-rig-elbow]').getScreenCTM()).matrixTransform(world);
        return elbow.y > shoulder.y + 7;
      });
    });
    const bundleTouches = actor => page.evaluate(id => {
      const wood = [...document.querySelectorAll('#bundle [data-wood-curve]')];
      return [...document.querySelectorAll('#' + id + ' [data-action-hand]')].every(hand => {
        const palm = new DOMPoint(0, Number(hand.dataset.gripY)).matrixTransform(hand.getScreenCTM());
        return wood.some(path => path.isPointInStroke(palm.matrixTransform(path.getScreenCTM().inverse())));
      });
    }, actor);
    async function continuousArms(scene, from, to, actors) {
      const result = await page.evaluate(({ scene, from, to, actors }) => {
        function points() {
          const world = document.getElementById('stage').getScreenCTM().inverse();
          const at = (node, x = 0, y = 0) => new DOMPoint(x, y).matrixTransform(node.getScreenCTM()).matrixTransform(world);
          return actors.flatMap(id => {
            const root = document.getElementById(id), origin = at(root);
            return [...root.querySelectorAll('[data-rig-arm]')]
              .sort((a, b) => Number(a.dataset.rigArm) - Number(b.dataset.rigArm)).flatMap(arm => {
                const hand = arm.querySelector('[data-action-hand]');
                return [at(arm.querySelector('[data-rig-elbow]')), at(hand, 0, Number(hand.dataset.gripY))]
                  .map(p => ({ x: p.x - origin.x, y: p.y - origin.y }));
              });
          });
        }
        let previous = null, largestStep = 0, frames = 0;
        for (let ms = from; ms <= to; ms += 32) {
          window.lp011Test.seek(scene, ms);
          const current = points();
          if (previous) for (const [i, p] of current.entries()) {
            const step = Math.hypot(p.x - previous[i].x, p.y - previous[i].y);
            largestStep = Math.max(largestStep, step);
            if (!Number.isFinite(step) || step > 10) return { scene, ms, point: i, step, error: true };
          }
          previous = current;
          frames++;
        }
        return { scene, from, to, frames, largestStep, error: false };
      }, { scene, from, to, actors });
      report.continuity ??= [];
      report.continuity.push(result);
      assert.equal(result.error, false, 'Arms must not flip or jump during a reach or release: ' + JSON.stringify(result));
    }

    for (const [id, preset] of [['mehar', 'kid-meher'], ['boy', 'kid-sidak'], ['dadi', 'elder-bibi-ji']]) {
      assert.equal(await page.locator('#' + id).getAttribute('data-studio-preset'), preset);
      assert.equal(await page.locator('#' + id + ' [data-rig-shoulder]').count(), 2);
      assert.equal(await page.locator('#' + id + ' [data-rig-elbow]').count(), 2);
      assert.equal(await page.locator('#' + id + ' [data-rig-foot]').count(), 2);
    }
    const rearHands = await page.locator('#dadi [data-rig-arm]').last().evaluate(hands =>
      ['mehar-plane', 'boy-plane'].every(id =>
        hands.compareDocumentPosition(document.getElementById(id)) & Node.DOCUMENT_POSITION_FOLLOWING));
    assert.ok(rearHands, 'Bibi Ji’s hand layer must paint behind both children');
    await speak(0, 0, 6);
    await capture('01-courtyard', ['mehar', 'boy']);
    const ballLine = scenes[0].lines[0];
    const reachWord = ballLine.reading.words.indexOf('ਇੱਕੋ');
    await seek(0, ballLine.start + ballLine.reading.timings[reachWord][0] - 430);
    assert.equal(await page.locator('#mehar').getAttribute('data-studio-motion'), 'walk');
    const stride = await page.locator('#mehar [data-leg-surface]').first().getAttribute('d');
    await seek(0, ballLine.start + ballLine.reading.timings[reachWord][0] - 210);
    assert.notEqual(await page.locator('#mehar [data-leg-surface]').first().getAttribute('d'), stride);
    await speak(1, 0, 4);
    await capture('02-turn', ['mehar', 'boy']);
    await speak(1, 1, 4);
    for (let ms = 350; ms < scenes[1].duration - 100; ms += 350) {
      await seek(1, ms);
      const arms = await page.evaluate(renderedArms);
      assertNatural(arms, 'mehar', [1]);
      assertNatural(arms, 'boy', [0], 4);
      assert.ok(await gripDistance('mehar', 'right', 'ball', -25, -3) < 3);
      assert.ok(await gripDistance('boy', 'left', 'ball', 25, -3) < 3);
    }
    await speak(2, 0, 5);
    assert.equal(await parent('bundle'), 'dadi-props');
    assert.ok(await gripDistance('dadi', 'left', 'bundle', -42, 2) < 3);
    assert.ok(await gripDistance('dadi', 'right', 'bundle', 42, 2) < 3);
    assert.ok(await lowElbows('dadi'), 'Bibi Ji supports the bundle with both elbows down');
    assertNatural(await page.evaluate(renderedArms), 'dadi');
    await capture('03-bibi', ['dadi']);
    const setDown = scenes[2].events.at(-1).ms;
    for (const before of [600, 340, 40]) {
      await seek(2, setDown - before);
      assert.ok(await gripDistance('dadi', 'left', 'bundle', -42, 2) < 3);
      assert.ok(await gripDistance('dadi', 'right', 'bundle', 42, 2) < 3);
      assertNatural(await page.evaluate(renderedArms), 'dadi');
    }
    await capture('03b-bibi-set-down', ['dadi']);
    await seek(2, setDown + 175);
    assert.equal(await parent('bundle'), 'stool-props');

    const efforts = scenes[3].events.filter(event => event.sound === 'ribbon');
    assert.equal(efforts.length, 2);
    for (const [i, event] of efforts.entries()) {
      await seek(3, event.ms);
      assert.equal(await stage.getAttribute('data-bundle'), 'tied');
      assert.equal(await stage.getAttribute('data-stick-snaps'), '0');
      const owner = i === 0 ? 'mehar' : 'boy';
      const holdBelowShoulders = await page.evaluate(id => {
        const world = document.getElementById('stage').getScreenCTM().inverse();
        const arms = [...document.querySelectorAll('#' + id + ' [data-rig-arm]')];
        const shoulderY = arms.reduce((sum, arm) => sum + new DOMPoint(0, 48)
          .matrixTransform(arm.getScreenCTM()).matrixTransform(world).y, 0) / arms.length;
        const heldY = new DOMPoint().matrixTransform(document.getElementById('bundle').getScreenCTM())
          .matrixTransform(world).y;
        return heldY - shoulderY;
      }, owner);
      assert.ok(holdBelowShoulders >= 35 && holdBelowShoulders <= 70,
        owner + ' holds the bundle below the chest, within comfortable arm reach');
      assert.equal(await parent('bundle'), owner + '-props');
      assert.ok(await gripDistance(owner, 'left', 'bundle', -48, 10) < 3);
      assert.ok(await gripDistance(owner, 'right', 'bundle', 48, 10) < 3);
      assert.ok(await lowElbows(owner), owner + ' bends the bundle with low elbows');
      assertNatural(await page.evaluate(renderedArms), owner);
      assert.equal(await page.locator('[data-hand="' + owner + '-left"]').getAttribute('data-action-hand'), 'fist');
      await capture('04-' + owner + '-bundle', [owner]);
      for (let ms = event.ms - 350; ms <= event.ms + 580; ms += 80) {
        await seek(3, ms);
        assertNatural(await page.evaluate(renderedArms), owner);
        assert.ok(await bundleTouches(owner), 'Both palms touch the actual wooden bundle through bending and set-down');
      }
      await continuousArms(3, event.ms - 850, event.ms + 1250, [owner]);
    }
    await seek(3, efforts[0].ms + 720);
    await capture('04c-mehar-release', ['mehar', 'boy']);
    await seek(3, efforts[0].ms + 900);
    await capture('04d-bundle-handover', ['mehar', 'boy']);
    const untie = scenes[4].events.find(event => event.sound === 'ribbon').ms;
    await seek(4, untie + 265);
    assert.ok(await gripDistance('dadi', 'right', 'free-cord', 0, 0) < 2);
    await capture('05a-bibi-unties', ['dadi']);
    for (let ms = untie + 80; ms <= untie + 1380; ms += 80) {
      await seek(4, ms);
      assert.ok(await gripDistance('dadi', 'right', 'free-cord', 0, 0) < 2,
        'Bibi keeps the cord in hand until it reaches the stool');
      assertNatural(await page.evaluate(renderedArms), 'dadi', [1], 7, 0);
    }
    await capture('05b-bibi-sets-cord', ['dadi']);
    const snaps = scenes[4].events.filter(event => event.sound === 'twig');
    assert.equal(snaps.length, 2);
    await seek(4, snaps[0].ms - 20);
    assert.equal(await stage.getAttribute('data-bundle'), 'untied');
    assert.equal(await stage.getAttribute('data-stick-snaps'), '0');
    assert.equal(await page.locator('#book').getAttribute('data-layout'), 'cinema');
    assertNatural(await page.evaluate(renderedArms), 'mehar');
    assertNatural(await page.evaluate(renderedArms), 'boy');
    await capture('05c-intact-sticks', ['mehar', 'boy']);
    await seek(4, snaps[0].ms + 140);
    assert.equal(await stage.getAttribute('data-stick-snaps'), '1');
    await seek(4, snaps[1].ms + 190);
    assert.equal(await stage.getAttribute('data-stick-snaps'), '2');
    assert.ok(await coordinate('boy-stick-left', 'e') < -8);
    for (const actor of ['mehar', 'boy']) {
      assert.ok(await gripDistance(actor, 'left', actor + '-stick-left', -38, 1) < 3);
      assert.ok(await gripDistance(actor, 'right', actor + '-stick-right', 38, 1) < 3);
      assertNatural(await page.evaluate(renderedArms), actor);
    }
    await capture('05d-snaps', ['mehar', 'boy']);
    for (let ms = snaps[0].ms - 500; ms <= snaps[1].ms + 600; ms += 64) {
      await seek(4, ms);
      const arms = await page.evaluate(renderedArms);
      for (const actor of ['mehar', 'boy']) {
        assertNatural(arms, actor);
        for (const [side, x] of [['left', -38], ['right', 38]]) {
          assert.ok(await gripDistance(actor, side, actor + '-stick-' + side, x, 1) < 3,
            actor + ' keeps both broken pieces in hand');
        }
      }
    }
    await continuousArms(4, snaps[0].ms - 600, snaps[1].ms + 650, ['mehar', 'boy']);
    await speak(5, 0, 5);
    assertNatural(await page.evaluate(renderedArms), 'dadi', [1]);
    await capture('06a-bibi-lesson', ['dadi']);
    await speak(5, 1, 2);
    assertNatural(await page.evaluate(renderedArms), 'mehar', [1]);
    await capture('06b-mehar-lesson', ['mehar']);
    await speak(5, 2, 4);
    assertNatural(await page.evaluate(renderedArms), 'boy', [0]);
    await capture('06c-sidak-lesson', ['boy']);

    const rolls = scenes[6].events;
    await seek(6, rolls[0].ms + 700);
    assert.ok(await coordinate('ball', 'e') > 550);
    await seek(6, rolls.at(-1).ms + 1180);
    assert.ok(await coordinate('ball', 'e') < 470);
    assert.equal(await stage.getAttribute('data-camera-motion'), 'tracking');
    await capture('07-play');
    await page.locator('#movie').click();
    await page.waitForFunction(() => window.lp011Test.state().audioActive && window.lp011Test.state().position > 440);

    await page.setViewportSize({ width: 390, height: 844 });
    await speak(2, 0, 7);
    assert.ok((await page.locator('#reading').boundingBox()).width < 390);
    await capture('08-phone-bibi', ['dadi']);
    await seek(4, snaps[1].ms + 250);
    assertNatural(await page.evaluate(renderedArms), 'mehar');
    assertNatural(await page.evaluate(renderedArms), 'boy');
    await capture('09-phone-snaps', ['mehar', 'boy']);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seek(6, rolls.at(-1).ms + 600);
    assert.equal(await stage.getAttribute('data-camera-motion'), 'static');
    await seek(3, efforts[1].ms);
    assertNatural(await page.evaluate(renderedArms), 'boy');
    assert.ok(await bundleTouches('boy'));
    await capture('10-reduced-motion', ['boy']);

    await page.goto(url + '?review=1&scene=loose-sticks&test=1');
    await page.waitForFunction(() => window.lp011Test);
    assert.equal(await page.locator('#review-scenes li').count(), 7);
    assert.equal(await page.locator('#review-title').textContent(), 'One stick each');
    assert.match(await page.locator('#review-audio').textContent(), /13\/13 voices · 13 aligned/);
    await page.locator('#approve-scene').click();
    assert.equal(await page.locator('#review-progress').textContent(), '1 of 7 approved');
    assert.deepEqual(errors, []);
    assert.deepEqual(report.failedResources, [], 'Every story and native-rig resource loads successfully');
    report.passed = true;
    console.log('PASS Mission 11: native rigs, outward lowered elbows, continuous reaches, actual ball/bundle/stick/cord contacts, 186 words, 13 aligned clips, mobile, reduced motion, and review.');
  } catch (error) {
    report.passed = false;
    report.failure = error.stack || String(error);
    if (page) {
      await page.screenshot({ path: output + '/99-failure.png', fullPage: true }).catch(() => {});
      report.lastState = await page.evaluate(() => window.lp011Test?.state()).catch(() => null);
      report.lastArms = await page.evaluate(renderedArms).catch(() => null);
      for (const pose of failurePoses) {
        try {
          await page.evaluate(({ scene, ms }) => window.lp011Test.seek(scene, ms), pose);
          await capture('99-diagnostic-' + pose.name, pose.actors);
        } catch (diagnosticError) {
          report.checkpoints.push({ name: pose.name, error: String(diagnosticError) });
        }
      }
    }
    throw error;
  } finally {
    await writeFile(output + '/checkpoints.json', JSON.stringify(report, null, 2));
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
