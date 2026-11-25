#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { mkdir, writeFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const { chromium } = require('playwright-core');

const url = process.env.LP008_URL || 'http://127.0.0.1:8765/little%20panth/mission-008/';
const output = resolve(process.env.LP008_OUTPUT || 'screenshots/little-panth-008');

function pageUrl(parameters) {
  const target = new URL(url);
  for (const [key, value] of Object.entries(parameters)) target.searchParams.set(key, value);
  return target.href;
}

// Measure painted geometry, independently of the animation's requested targets.
function renderedGeometry() {
  const svg = document.getElementById('stage');
  const traveller = document.getElementById('traveller');
  const cloth = document.getElementById('shawl-main');
  const stageMatrix = svg.getScreenCTM(), world = stageMatrix.inverse();
  const inWorld = (node, x = 0, y = 0) => {
    const p = new DOMPoint(x, y).matrixTransform(node.getScreenCTM()).matrixTransform(world);
    return { x: p.x, y: p.y };
  };
  const clothSpace = cloth.getScreenCTM().inverse().multiply(stageMatrix);
  const inCloth = p => cloth.isPointInFill(new DOMPoint(p.x, p.y).matrixTransform(clothSpace));
  const length = cloth.getTotalLength();
  const count = Math.max(120, Math.min(1800, Math.ceil(length / .7)));
  const outline = Array.from({ length: count + 1 }, (_, i) => {
    const p = cloth.getPointAtLength(length * i / count);
    return inWorld(cloth, p.x, p.y);
  });
  const bounds = {
    left: Math.min(...outline.map(p => p.x)), right: Math.max(...outline.map(p => p.x)),
    top: Math.min(...outline.map(p => p.y)), bottom: Math.max(...outline.map(p => p.y))
  };
  const edgeDistance = point => {
    let nearest = Infinity;
    for (let i = 1; i < outline.length; i++) {
      const a = outline[i - 1], b = outline[i], dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1,
        ((point.x - a.x) * dx + (point.y - a.y) * dy) / Math.max(1e-9, dx * dx + dy * dy)));
      nearest = Math.min(nearest, Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy));
    }
    return nearest;
  };
  const arms = [...traveller.querySelectorAll('[data-rig-arm]')]
    .sort((a, b) => Number(a.dataset.rigArm) - Number(b.dataset.rigArm));
  const hands = arms.map((arm, index) => {
    const hand = arm.querySelector('[data-action-hand]');
    const overlay = document.querySelector('[data-shawl-hand="' + index + '"]');
    const y = Number(hand.dataset.gripY), palm = inWorld(hand, 0, y);
    const copy = overlay ? inWorld(overlay, 0, y) : null;
    const sourceSkin = hand.querySelector('[data-arm-skin]');
    const copiedSkin = overlay?.querySelector('[data-arm-skin]');
    const sourceLines = hand.querySelector('[data-hand-lines]');
    const copiedLines = overlay?.querySelector('[data-hand-lines]');
    const elbow = inWorld(arm.querySelector('[data-rig-elbow]'));
    const wrist = inWorld(arm.querySelector('[data-rig-wrist]'));
    const forearmSupport = [.2, .35, .5, .65, .8].map(t => {
      const point = { x: elbow.x + (wrist.x - elbow.x) * t, y: elbow.y + (wrist.y - elbow.y) * t };
      return { ...point, covered: inCloth(point), edgeGap: edgeDistance(point) };
    });
    return {
      index, palm, shoulder: inWorld(arm, 0, 48),
      elbow, wrist, forearmSupport,
      covered: [60, 100, 140].map(y => inCloth(inWorld(arm.querySelector('[data-rig-shoulder]'), 0, y))),
      contact: overlay?.dataset.shawlContact === 'true',
      visible: overlay ? Number(getComputedStyle(overlay).opacity) > .01 && getComputedStyle(overlay).display !== 'none' : false,
      edgeGap: edgeDistance(palm),
      mirrorGap: copy ? Math.hypot(palm.x - copy.x, palm.y - copy.y) : null,
      sharedSkin: Boolean(copiedSkin && copiedSkin.getAttribute('d') === sourceSkin.getAttribute('d') &&
        copiedSkin.getAttribute('fill') === sourceSkin.getAttribute('fill')),
      sharedLines: Boolean(copiedLines && copiedLines.getAttribute('d') === sourceLines.getAttribute('d')),
      clipped: Boolean(overlay?.querySelector('[clip-path]'))
    };
  });
  const knees = [...traveller.querySelectorAll('[data-rig-knee]')].map(node => inWorld(node));
  const kneeY = knees.reduce((total, p) => total + p.y, 0) / knees.length;
  const hemBandY = Math.min(kneeY, bounds.bottom) - 8;
  const hemWidth = Array.from({ length: Math.ceil((bounds.right - bounds.left) / 2) + 1 }, (_, i) =>
    inCloth({ x: bounds.left + 2 * i, y: hemBandY }) ? 2 : 0).reduce((a, b) => a + b, 0);
  return {
    scene: document.getElementById('book').dataset.scene,
    shawl: svg.dataset.shawl, nativeMotion: traveller.dataset.studioMotion,
    bounds, kneeY, hemWidth, hands
  };
}

async function run() {
  await mkdir(output, { recursive: true });
  const report = { url, checkpoints: [], errors: [], consoleErrors: [] };
  const browser = await chromium.launch({
    ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : { channel: 'chrome' }),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
  });
  let page;
  try {
    page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') report.consoleErrors.push(message.text());
    });
    await page.goto(pageUrl({ test: '1' }));
    await page.waitForFunction(() => window.lp008Test, null, { timeout: 40000 });
    const state = await page.evaluate(() => window.lp008Test.state());
    const scenes = state.scenes, lines = scenes.flatMap(scene => scene.lines);
    assert.equal(scenes.length, 7);
    assert.equal(state.clips, 13);
    assert.equal(lines.filter(line => line.aligned).length, 13);
    assert.equal(new Set(lines.map(line => line.speaker)).size, 4);
    assert.equal(await page.locator('button, input, nav, header, footer, audio[controls], video[controls]').count(), 0);
    const left = await page.locator('.art-page').boundingBox(), right = await page.locator('.reading-page').boundingBox();
    assert.equal(left.width, right.width);
    assert.equal(left.height, right.height);
    assert.match(await page.locator('#wind-studio').getAttribute('src'), /missionBridge=native/);
    assert.equal(await page.locator('#traveller').getAttribute('data-studio-preset'), 'adult-harpreet');
    assert.equal(await page.locator('#traveller [data-garment="punjabiVestKurta"]').count(), 1);
    for (const part of ['shoulder', 'elbow', 'wrist', 'foot']) {
      assert.equal(await page.locator('#traveller [data-rig-' + part + ']').count(), 2,
        'The traveller uses both shared native ' + part + ' joints');
    }
    assert.equal(await page.locator('#traveller-sleeve, #traveller-far-sleeve, #shawl-folded').count(), 0,
      'The native rig and one continuous shawl replace the old separate drawings');

    async function seek(index, position) {
      await page.evaluate(([scene, ms]) => window.lp008Test.seek(scene, ms), [index, position]);
    }
    const measure = () => page.evaluate(renderedGeometry);
    async function snapshot(name, pose = false) {
      await page.screenshot({ path: output + '/' + name + '.png' });
      const geometry = await measure();
      report.checkpoints.push({ name, position: await page.evaluate(() => window.lp008Test.state().position), geometry });
      if (pose) {
        const person = await page.locator('#traveller').boundingBox(), cloth = await page.locator('#shawl-main').boundingBox();
        const movie = await page.locator('#movie').boundingBox(), viewport = page.viewportSize();
        const x = Math.max(0, movie.x, Math.min(person.x, cloth.x) - 24);
        const y = Math.max(0, movie.y, Math.min(person.y, cloth.y) - 24);
        const right = Math.min(viewport.width, movie.x + movie.width, Math.max(person.x + person.width, cloth.x + cloth.width) + 24);
        const bottom = Math.min(viewport.height, movie.y + movie.height, Math.max(person.y + person.height, cloth.y + cloth.height) + 24);
        assert.ok(right > x + 20 && bottom > y + 20, 'The traveller pose is visible for review');
        await page.screenshot({ path: output + '/' + name + '-pose.png', clip: { x, y, width: right - x, height: bottom - y } });
      }
      await writeFile(output + '/checkpoints.json', JSON.stringify(report, null, 2));
      return geometry;
    }
    async function speak(index, lineIndex, word = 0) {
      const line = scenes[index].lines[lineIndex], [start, end] = line.reading.timings[word];
      await seek(index, line.start + (start + end) / 2);
      assert.equal(await page.locator('.word[aria-current="true"]').textContent(), line.reading.words[word]);
      for (const name of ['wind', 'sun', 'traveller']) {
        assert.equal(await page.locator('#' + name).getAttribute('data-speaking'), String(name === line.speaker));
      }
    }
    function wordAt(index, id, word) {
      const line = scenes[index].lines.find(line => line.id === id);
      const i = line.reading.words.findIndex(value => value.replace(/[\p{P}\p{S}]/gu, '') === word);
      assert.ok(i >= 0, 'Missing narrated cue ' + word);
      return line.start + line.reading.timings[i][0];
    }
    function assertContacts(geometry, minimum = 1) {
      const contacts = geometry.hands.filter(hand => hand.contact);
      assert.ok(contacts.length >= minimum, geometry.shawl + ' has the required supporting hands');
      for (const hand of contacts) {
        assert.ok(hand.visible, 'A supporting hand is visible');
        assert.ok(hand.sharedSkin && hand.sharedLines && hand.clipped, 'The visible grip uses clipped, current UMTO hand art');
        assert.ok(hand.mirrorGap < .1, 'Visible hand ' + hand.index + ' stays on its native wrist: ' + hand.mirrorGap);
        assert.ok(hand.edgeGap < 4, 'Palm ' + hand.index + ' stays on the actual shawl edge: ' + hand.edgeGap);
      }
    }
    function assertLong(geometry) {
      assert.ok(geometry.bounds.bottom >= geometry.kneeY - 18 && geometry.bounds.bottom <= geometry.kneeY + 30,
        'The worn shawl reaches the knees: hem=' + geometry.bounds.bottom + ', knees=' + geometry.kneeY);
      assert.ok(geometry.hemWidth >= 14, 'A broad cloth end reaches the knee, not only a thin fringe');
    }
    function assertForearmDrape(geometry) {
      const near = geometry.hands[0];
      assert.ok(near.contact, 'The near hand retains the carried cloth edge');
      assert.ok(near.forearmSupport.filter(point => point.covered).length >= 3,
        'The folded cloth rests across the native forearm, beyond a single palm corner: ' +
        JSON.stringify(near.forearmSupport));
    }

    async function gaitWindow(index, from, to) {
      const result = await page.evaluate(({ index, from, to }) => {
        function feet() {
          const svg = document.getElementById('stage'), traveller = document.getElementById('traveller');
          const world = svg.getScreenCTM().inverse();
          const point = (node, x, y) => {
            const p = new DOMPoint(x, y).matrixTransform(node.getScreenCTM()).matrixTransform(world);
            return { x: p.x, y: p.y };
          };
          return {
            actor: point(traveller, 0, 0),
            points: [...traveller.querySelectorAll('[data-rig-leg]')]
              .sort((a, b) => Number(a.dataset.rigLeg) - Number(b.dataset.rigLeg))
              .flatMap(leg => {
                const foot = leg.querySelector('[data-rig-foot]');
                return [[0, 111], [-45, 98], [105, 105]].map(([x, y]) => point(foot, x, y));
              })
          };
        }
        const times = [];
        for (let ms = from; ms < to; ms += 16) times.push(ms);
        times.push(to);
        let previous = null, samples = 0, largestJump = 0, highestRatio = 0;
        for (const ms of times) {
          window.lp008Test.seek(index, ms);
          const current = feet();
          if (previous) {
            const travel = Math.hypot(current.actor.x - previous.actor.x, current.actor.y - previous.actor.y);
            // Normal swing can be faster than the body. A stationary actor
            // still gets a small allowance for a smooth settling step.
            const allowance = .08 + (ms - previous.ms) * .13 + 4 * travel;
            for (const [i, p] of current.points.entries()) {
              const old = previous.points[i], jump = Math.hypot(p.x - old.x, p.y - old.y);
              largestJump = Math.max(largestJump, jump);
              highestRatio = Math.max(highestRatio, jump / allowance);
              if (jump > allowance) return { index, from, to, samples, error: { ms, point: i, jump, allowance, travel } };
            }
          }
          previous = { ...current, ms };
          samples++;
        }
        return { index, from, to, samples, largestJump, highestRatio, error: null, finalFeet: previous.points };
      }, { index, from, to });
      report.gaitWindows ??= [];
      report.gaitWindows.push(result);
      assert.equal(result.error, null, 'The native feet move continuously at walking boundaries: ' + JSON.stringify(result.error));
      return result;
    }

    await speak(0, 0, 5);
    await snapshot('01-road', true);
    await seek(0, scenes[0].duration - 100);
    const worn = await snapshot('02-worn-length', true);
    assertLong(worn);
    assert.equal(worn.nativeMotion, 'stand');
    await seek(0, scenes[0].duration * .35);
    assert.equal(await page.locator('#traveller').getAttribute('data-studio-motion'), 'walk');
    const stride = await page.locator('#traveller [data-leg-surface]').first().getAttribute('d');
    await seek(0, scenes[0].duration * .35 + 230);
    assert.notEqual(await page.locator('#traveller [data-leg-surface]').first().getAttribute('d'), stride);

    await speak(1, 0, 4);
    assert.equal(await page.locator('#stage').getAttribute('data-camera-preset'), 'medium');
    await snapshot('03-wind');
    await speak(1, 1, 3);
    const gustCue = scenes[2].events.find(event => event.sound === 'gust');
    await seek(2, gustCue.ms + 1100);
    assert.equal(await page.locator('#book').getAttribute('data-layout'), 'cinema');
    assert.ok(Number(await page.locator('#wind-streams').getAttribute('opacity')) > .4);
    await speak(2, 1, 2);
    await snapshot('04-cold-traveller', true);

    await seek(3, scenes[3].lines[0].end - 100);
    const wrapped = await snapshot('05-wrapped', true);
    assert.equal(wrapped.shawl, 'wrapped');
    assertLong(wrapped);
    assertContacts(wrapped, 2);
    for (const hand of wrapped.hands) {
      assert.ok(hand.covered.filter(Boolean).length >= 2, 'The shawl covers native upper arm ' + hand.index);
      assert.ok(hand.elbow.y > hand.shoulder.y + 4, 'The wrapped elbow stays below its shoulder');
    }
    await seek(4, scenes[4].duration - 300);
    assert.equal(await page.locator('#book').getAttribute('data-layout'), 'cinema');
    assert.ok(Number(await page.locator('#stage').getAttribute('data-warmth')) > .9);
    await snapshot('06-sunlight', true);

    const remove = wordAt(5, 'fold-shawl', 'ਲਾਹੀ'), fold = wordAt(5, 'fold-shawl', 'ਤਹਿ'), carry = wordAt(5, 'fold-shawl', 'ਬਾਂਹ');
    await speak(5, 0, 3);
    await seek(5, remove + 170);
    const removing = await snapshot('07-removing', true);
    assert.equal(removing.shawl, 'removing');
    assertContacts(removing, 2);
    await seek(5, fold - 160);
    const offShoulders = await snapshot('08-off-shoulders', true);
    assertContacts(offShoulders, 2);
    for (const hand of offShoulders.hands) {
      assert.ok(hand.elbow.y > hand.shoulder.y + 8,
        'Once uncovered, each elbow lowers naturally beside the body');
    }
    await seek(5, fold + 230);
    const folding = await snapshot('09-folding', true);
    assert.equal(folding.shawl, 'folding');
    assertContacts(folding, 2);
    await seek(5, scenes[5].duration - 220);
    const carried = await snapshot('10-carried', true);
    assert.equal(carried.shawl, 'folded');
    assertContacts(carried);
    assertForearmDrape(carried);
    assert.ok(carried.bounds.bottom - carried.bounds.top < worn.bounds.bottom - worn.bounds.top - 20,
      'Folding visibly shortens the long hanging cloth');

    let contactSamples = 0, largestGap = 0;
    for (let ms = remove + 80; ms <= scenes[5].duration - 120; ms += 80) {
      await seek(5, ms);
      const geometry = await measure();
      // Both hands hold the free cloth. The far hand releases as the near
      // hand slides along the upper edge to lay it across the forearm.
      assertContacts(geometry, ms < carry - 200 ? 2 : 1);
      if (ms >= carry - 200) assert.ok(geometry.hands[0].contact, 'The near hand supports the complete carry transfer');
      largestGap = Math.max(largestGap, ...geometry.hands.filter(hand => hand.contact).map(hand => hand.edgeGap));
      contactSamples++;
    }
    report.contactSweep = { frames: contactSamples, largestGap };

    await gaitWindow(0, 0, 1100);
    const roadStop = await gaitWindow(0, scenes[0].duration - 1400, scenes[0].duration);
    const challengeStart = await gaitWindow(1, 0, 0);
    for (const [i, foot] of roadStop.finalFeet.entries()) {
      const next = challengeStart.finalFeet[i];
      assert.ok(Math.hypot(foot.x - next.x, foot.y - next.y) < .5,
        'The stopped feet stay in place when the challenge scene begins');
    }
    const departure = wordAt(6, 'lesson-home', 'ਤੁਰ') - 860;
    await gaitWindow(6, Math.max(0, departure - 120), departure + 1100);
    await gaitWindow(6, scenes[6].duration - 1550, scenes[6].duration);
    await seek(0, 360);
    await snapshot('15-first-step', true);
    await seek(0, scenes[0].duration - 650);
    await snapshot('16-settling-step', true);
    await seek(6, departure + 420);
    const walkingCarry = await snapshot('17-carried-walk', true);
    assertContacts(walkingCarry);
    assertForearmDrape(walkingCarry);

    report.geometrySweep = await page.evaluate(() => {
      const test = window.lp008Test, scenes = test.state().scenes;
      let frames = 0;
      for (const [index, scene] of scenes.entries()) {
        const times = [];
        for (let ms = 0; ms < scene.duration; ms += 250) times.push(ms);
        times.push(scene.duration);
        for (const ms of times) {
          test.seek(index, ms);
          const stage = document.getElementById('stage');
          for (const node of stage.querySelectorAll('[d], [transform], ellipse, circle, rect')) {
            for (const attr of ['d', 'transform', 'x', 'y', 'cx', 'cy', 'rx', 'ry', 'width', 'height', 'opacity']) {
              const value = node.getAttribute(attr);
              if (value && /NaN|Infinity|undefined/.test(value)) {
                return { frames, error: { scene: scene.id, ms, node: node.id || node.tagName, attr, value } };
              }
            }
          }
          for (const node of stage.querySelectorAll('#traveller [data-rig-arm], #traveller [data-rig-foot], #shawl-main, [data-shawl-hand]')) {
            const m = node.getScreenCTM();
            if (!m || ![m.a, m.b, m.c, m.d, m.e, m.f].every(Number.isFinite)) {
              return { frames, error: { scene: scene.id, ms, node: node.id || node.tagName, attr: 'matrix' } };
            }
          }
          frames++;
        }
      }
      return { frames, error: null };
    });
    assert.equal(report.geometrySweep.error, null, JSON.stringify(report.geometrySweep.error));
    assert.ok(report.geometrySweep.frames > 200);

    await seek(0, 0);
    await page.locator('#movie').click();
    await page.waitForFunction(() => window.lp008Test.state().audioActive && window.lp008Test.state().position > 360);
    await page.setViewportSize({ width: 390, height: 844 });
    await speak(6, 0, 4);
    assert.ok((await page.locator('#reading').boundingBox()).width < 390);
    const windFaceVisible = await page.locator('#wind-eyes ellipse').first().evaluate(eye => {
      const center = new DOMPoint(eye.cx.baseVal.value, eye.cy.baseVal.value).matrixTransform(eye.getScreenCTM());
      return Boolean(document.elementFromPoint(center.x, center.y)?.closest('#wind'));
    });
    assert.ok(windFaceVisible, 'The speaking Wind stays visible on a phone');
    await snapshot('11-phone-wind');
    await seek(5, remove + 170);
    assertContacts(await snapshot('12-phone-removing', true), 2);
    await seek(5, scenes[5].duration - 220);
    const phoneCarry = await snapshot('13-phone-carried', true);
    assertContacts(phoneCarry);
    assertForearmDrape(phoneCarry);
    const person = await page.locator('#traveller').boundingBox(), movie = await page.locator('#movie').boundingBox();
    assert.ok(person.y >= movie.y - 2 && person.y + person.height <= movie.y + movie.height + 2,
      'The full native traveller remains inside the phone shot');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seek(0, scenes[0].duration * .6);
    assert.equal(await page.locator('#traveller').getAttribute('data-studio-motion'), 'stand');
    assert.equal(await page.locator('#stage').getAttribute('data-camera-motion'), 'static');
    await seek(5, scenes[5].duration - 220);
    const reducedCarry = await snapshot('14-reduced-motion', true);
    assertContacts(reducedCarry);
    assertForearmDrape(reducedCarry);
    assert.equal(await page.locator('#stage').getAttribute('data-shawl'), 'folded');
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    await page.goto(pageUrl({ review: '1', scene: 'fold', test: '1' }));
    await page.waitForFunction(() => window.lp008Test);
    assert.equal(await page.locator('#review-scenes li').count(), 7);
    assert.equal(await page.locator('#review-title').textContent(), 'Off comes the shawl');
    assert.match(await page.locator('#review-audio').textContent(), /13\/13 voices · 13 aligned/);
    await page.locator('#approve-scene').click();
    assert.equal(await page.locator('#review-progress').textContent(), '1 of 7 approved');

    await page.goto(pageUrl({ compilation: '1', test: '1' }));
    await page.waitForFunction(() => window.lp008Test && window.lpCompilation);
    report.compilation = await page.evaluate(() => ({
      ready: window.lpCompilation.ready(), start: typeof window.lpCompilation.start,
      status: window.lpCompilation.status(), clips: window.lp008Test.state().clips
    }));
    assert.equal(report.compilation.ready, true);
    assert.equal(report.compilation.start, 'function');
    assert.equal(report.compilation.clips, 13);
    assert.ok(!report.compilation.status.error);
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.consoleErrors.filter(text => /<path>|<g>|NaN|Infinity|Error:/.test(text)), []);
    report.passed = true;
    console.log('PASS Mission 08: native UMTO traveller, knee-length shawl, covered upper arms, forearm carry, continuous hands and feet, finite poses, 13 aligned recordings, mobile, reduced motion, review and compilation readiness.');
  } catch (error) {
    report.passed = false;
    report.failure = error.stack || String(error);
    if (page) {
      await page.screenshot({ path: output + '/99-failure.png', fullPage: true }).catch(() => {});
      report.lastState = await page.evaluate(() => window.lp008Test?.state()).catch(() => null);
      report.lastGeometry = await page.evaluate(renderedGeometry).catch(() => null);
      // Keep the original failing frame above, but collect the later poses too
      // so an early assertion cannot hide the remaining visual review evidence.
      report.failurePoses = [];
      const poses = await page.evaluate(() => {
        const scenes = window.lp008Test?.state().scenes;
        const index = scenes?.findIndex(scene => scene.id === 'fold');
        if (index == null || index < 0) return [];
        const scene = scenes[index], line = scene.lines.find(line => line.id === 'fold-shawl');
        const word = line?.reading.words.findIndex(value => value.replace(/[\p{P}\p{S}]/gu, '') === 'ਤਹਿ');
        if (word == null || word < 0) return [];
        const folding = line.start + line.reading.timings[word][0];
        return [
          { name: 'off-shoulders', index, ms: folding - 160 },
          { name: 'folding', index, ms: folding + 230 },
          { name: 'final-carry', index, ms: scene.duration - 220 }
        ];
      }).catch(() => []);
      for (const pose of poses) {
        const diagnostic = { ...pose };
        try {
          await page.evaluate(({ index, ms }) => window.lp008Test.seek(index, ms), pose);
          await page.screenshot({ path: output + '/99-diagnostic-' + pose.name + '.png', fullPage: true });
          diagnostic.geometry = await page.evaluate(renderedGeometry);
          const person = await page.locator('#traveller').boundingBox(), cloth = await page.locator('#shawl-main').boundingBox();
          const movie = await page.locator('#movie').boundingBox(), viewport = page.viewportSize();
          const x = Math.max(0, movie.x, Math.min(person.x, cloth.x) - 24);
          const y = Math.max(0, movie.y, Math.min(person.y, cloth.y) - 24);
          const right = Math.min(viewport.width, movie.x + movie.width, Math.max(person.x + person.width, cloth.x + cloth.width) + 24);
          const bottom = Math.min(viewport.height, movie.y + movie.height, Math.max(person.y + person.height, cloth.y + cloth.height) + 24);
          if (right > x && bottom > y) {
            await page.screenshot({ path: output + '/99-diagnostic-' + pose.name + '-pose.png',
              clip: { x, y, width: right - x, height: bottom - y } });
          }
        } catch (diagnosticError) {
          diagnostic.error = String(diagnosticError);
        }
        report.failurePoses.push(diagnostic);
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
