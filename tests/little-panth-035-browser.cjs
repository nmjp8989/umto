#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { mkdir, writeFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const { chromium } = require('playwright-core');

const url = process.env.LP035_URL || 'http://127.0.0.1:8765/little%20panth/mission-035/';
const output = resolve(process.env.LP035_OUTPUT || 'screenshots/little-panth-035');
const mice = ['mouse-young', 'mouse-elder', 'mouse-friend'];
const speakerActor = { mouse: 'mouse-young', 'elder-mouse': 'mouse-elder', 'friend-mouse': 'mouse-friend' };
const isDefaultFavicon = resource => {
  try {
    const requested = new URL(resource);
    return requested.origin === new URL(url).origin && requested.pathname === '/favicon.ico';
  } catch { return false; }
};

// Measure the actual SVG nodes in story coordinates, removing the cinematic
// viewBox transform. No planned pose value substitutes for a rendered contact.
function renderedPose() {
  const svg = document.getElementById('stage');
  const world = svg.getScreenCTM().inverse();
  const point = (node, x = 0, y = 0) => {
    const p = new DOMPoint(x, y).matrixTransform(node.getScreenCTM()).matrixTransform(world);
    return { x: p.x, y: p.y };
  };
  const bounds = node => {
    const box = node.getBBox();
    const corners = [point(node, box.x, box.y), point(node, box.x + box.width, box.y),
      point(node, box.x, box.y + box.height), point(node, box.x + box.width, box.y + box.height)];
    return { left: Math.min(...corners.map(p => p.x)), right: Math.max(...corners.map(p => p.x)),
      top: Math.min(...corners.map(p => p.y)), bottom: Math.max(...corners.map(p => p.y)) };
  };
  const animals = [...svg.querySelectorAll('[data-animal]')].map(actor => {
    const feet = [...actor.querySelectorAll('[data-mouse-foot], [data-cat-foot]')].map(foot => ({
      id: foot.dataset.mouseFoot || foot.dataset.catFoot, point: point(foot),
      stance: foot.dataset.stance === 'true', support: Number(foot.dataset.supportY),
      bellContact: foot.dataset.bellContact === 'true', transform: foot.getAttribute('transform')
    }));
    const face = actor.querySelector('[data-face]');
    const matrix = actor.getScreenCTM();
    return { id: actor.id, species: actor.dataset.animal, origin: point(actor),
      facing: Math.sign(matrix.a), face: face ? bounds(face) : null, feet };
  });
  const bell = svg.querySelector('#bell');
  const bellPoint = svg.querySelector('#bell [data-contact-bell]');
  const contacts = [...svg.querySelectorAll('[data-bell-contact="true"]')].map(paw => {
    const pawPoint = point(paw.querySelector('[data-contact-paw]'));
    const target = point(bellPoint);
    return { actor: paw.closest('[data-animal]').id, foot: paw.dataset.mouseFoot,
      paw: pawPoint, bell: target, distance: Math.hypot(pawPoint.x - target.x, pawPoint.y - target.y) };
  });
  const current = window.lp035Test.state();
  return { scene: current.scenes[current.scene].id, ms: current.position,
    viewBox: [svg.viewBox.baseVal.x, svg.viewBox.baseVal.y, svg.viewBox.baseVal.width, svg.viewBox.baseVal.height],
    camera: { preset: svg.dataset.cameraPreset, motion: svg.dataset.cameraMotion, angle: svg.dataset.cameraAngle },
    animals, bell: { origin: point(bell), support: point(svg.querySelector('#bell [data-bell-support]')), bounds: bounds(bell),
      parent: bell.parentElement.id, target: point(bellPoint) }, contacts };
}

function assertSupported(pose) {
  for (const animal of pose.animals) {
    const floor = animal.species === 'cat' ? 518 : 626;
    assert.equal(animal.feet.length, 4, animal.id + ' has four independently measured paws');
    const planted = animal.feet.filter(foot => foot.stance);
    assert.ok(planted.length, animal.id + ' keeps a supporting paw at ' + pose.scene + '/' + pose.ms);
    if (animal.species === 'mouse') {
      assert.ok(planted.some(foot => !foot.id.includes('far')), animal.id + ' has a visible near supporting paw');
    }
    for (const foot of animal.feet) {
      assert.ok(Number.isFinite(foot.point.x) && Number.isFinite(foot.point.y));
      assert.equal(foot.support, floor, animal.id + ' declares the drawn floor plane');
      if (foot.stance) assert.ok(Math.abs(foot.point.y - floor) < 0.65,
        animal.id + '/' + foot.id + ' plants its actual sole on the floor: ' + JSON.stringify(foot));
      assert.ok(foot.point.y <= floor + 0.8, animal.id + '/' + foot.id + ' cannot sink below the floor');
    }
  }
  assert.ok(Math.abs(pose.bell.support.y - 626) < 0.65, 'The bell rocks about its actual floor rim');
  assert.ok(pose.bell.bounds.bottom <= 627.2, 'The bell body remains above the floor');
  assert.ok(!['mouse-young', 'mouse-elder', 'mouse-friend', 'cat'].includes(pose.bell.parent), 'The bell is never attached to the cat or suspended from a mouse');
  for (const contact of pose.contacts) assert.ok(contact.distance < 0.9,
    'The visible front paw touches the actual bell contour: ' + JSON.stringify(contact));
  for (let a = 0; a < pose.animals.length; a++) for (let b = a + 1; b < pose.animals.length; b++) {
    const left = pose.animals[a], right = pose.animals[b];
    assert.ok(left.face && right.face, 'Every actor exposes the drawn head including ears');
    const gapX = Math.max(right.face.left - left.face.right, left.face.left - right.face.right);
    const gapY = Math.max(right.face.top - left.face.bottom, left.face.top - right.face.bottom);
    assert.ok(gapX >= 7 || gapY >= 7,
      'Faces and ears have clear negative space: ' + JSON.stringify({ scene: pose.scene, ms: pose.ms, a: left.id, b: right.id, gapX, gapY }));
  }
}

async function run() {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : { channel: 'chrome' }),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=user-gesture-required']
  });
  const report = { passed: false, checkpoints: [], sweep: [], errors: [], failedResources: [], ignoredFavicons: [] };
  let page, scenes = [], failurePoses = [];
  const observe = target => {
    target.on('pageerror', error => report.errors.push(error.message));
    target.on('console', message => {
      if (message.type() !== 'error') return;
      const source = message.location().url || '';
      if (!isDefaultFavicon(source)) report.errors.push(message.text() + (source ? ' [' + source + ']' : ' [no source URL]'));
    });
    target.on('response', response => {
      if (response.status() < 400) return;
      const failure = { url: response.url(), status: response.status() };
      (isDefaultFavicon(failure.url) ? report.ignoredFavicons : report.failedResources).push(failure);
    });
  };
  async function prepare(target, query = '?test=1') {
    observe(target);
    await target.addInitScript({ content: 'window.__lp035Measure = (' + renderedPose.toString() + ');' });
    await target.goto(url + query);
    await target.waitForFunction(() => window.lp035Test, undefined, { timeout: 90000 });
    const initial = await target.evaluate(() => window.lp035Test.state());
    await target.evaluate(() => window.lp035Test.pause());
    return initial;
  }
  const seek = (scene, ms, target = page) => target.evaluate(([index, time]) => window.lp035Test.seek(index, time), [scene, ms]);
  async function capture(name, target = page) {
    await target.screenshot({ path: output + '/' + name + '.png' });
    await target.locator('#movie').screenshot({ path: output + '/' + name + '-art.png' });
    report.checkpoints.push({ name, ...await target.evaluate(renderedPose) });
    await writeFile(output + '/checkpoints.json', JSON.stringify(report, null, 2));
  }

  try {
    page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const initial = await prepare(page);
    scenes = initial.scenes;
    const lines = scenes.flatMap(scene => scene.lines);
    failurePoses = scenes.map((scene, index) => ({ name: scene.id, scene: index,
      ms: (scene.lines[0].start + scene.lines[0].end) / 2 }));
    const bellEvent = scenes[2].events.find(event => event.sound === 'bell');
    if (bellEvent) failurePoses.push({ name: 'bell-touch', scene: 2, ms: bellEvent.ms });
    failurePoses.push({ name: 'final-hold', scene: scenes.length - 1, ms: scenes.at(-1).duration - 40 });
    assert.deepEqual(report.failedResources, [], 'All local story assets and recorded voices load');
    assert.deepEqual(report.errors, []);
    assert.equal(initial.clips, 13);
    assert.equal(initial.voicesReady, true);
    assert.equal(scenes.length, 6);
    assert.equal(lines.length, 13);
    assert.ok(lines.every(line => line.aligned), 'Every line uses alignment for its exact recorded clip');
    assert.equal(lines.reduce((sum, line) => sum + line.reading.words.length, 0), 182);
    assert.equal(new Set(lines.map(line => line.speaker)).size, 4);
    assert.ok(initial.effects.includes('bell'), 'The contact cue has a loaded brass bell sound');
    assert.equal(initial.audioActive, false, 'The clean player waits for a picture tap before audible narration');
    assert.equal(await page.locator('button, header, nav, input, video[controls]').count(), 0, 'The clean story has no playback or replay controls');
    assert.equal(await page.locator('#reading').evaluate(node => node.closest('svg') === null), true, 'Reading text stays outside cinematic camera transforms');

    await page.locator('#movie').click();
    await page.waitForFunction(() => window.lp035Test.state().audioActive && window.lp035Test.state().position > 300);
    await page.evaluate(() => window.lp035Test.pause());
    report.pictureTap = true;

    // The contour itself, rather than an empty marker, reaches each declared sole.
    await seek(1, 0);
    const soleContours = await page.evaluate(() => {
      const svg = document.getElementById('stage'), world = svg.getScreenCTM().inverse();
      return [...svg.querySelectorAll('[data-mouse-foot], [data-cat-foot]')].map(foot => {
        const contour = foot.querySelector('path'), length = contour.getTotalLength();
        const ys = Array.from({ length: 81 }, (_, i) => {
          const p = contour.getPointAtLength(length * i / 80);
          return new DOMPoint(p.x, p.y).matrixTransform(contour.getScreenCTM()).matrixTransform(world).y;
        });
        return { actor: foot.closest('[data-animal]').id, foot: foot.dataset.mouseFoot || foot.dataset.catFoot,
          support: Number(foot.dataset.supportY), bottom: Math.max(...ys) };
      });
    });
    for (const sole of soleContours) assert.ok(Math.abs(sole.bottom - sole.support) < 0.8,
      'The visible paw contour meets its ground contact: ' + JSON.stringify(sole));
    report.soleContours = soleContours;

    const shotKinds = new Set();
    for (let scene = 0; scene < scenes.length; scene++) {
      for (const line of scenes[scene].lines) {
        const index = Math.min(line.reading.words.length - 1, Math.floor(line.reading.words.length / 2));
        const [start, end] = line.reading.timings[index];
        await seek(scene, line.start + (start + end) / 2);
        assert.equal(await page.locator('.word[aria-current="true"]').textContent(), line.reading.words[index], line.id + ' highlights its aligned spoken word');
        const pose = await page.evaluate(renderedPose);
        assertSupported(pose);
        shotKinds.add(pose.camera.preset);
        const actor = speakerActor[line.speaker];
        if (actor) assert.equal(await page.locator('#' + actor).getAttribute('data-speaking'), 'true', line.id + ' uses the correct animal speaking pose');
        await capture('line-' + line.id);
      }
    }
    assert.ok(shotKinds.size >= 4, 'The planned story uses distinct establishing, dialogue, reaction and insert framing');
    report.cameraPresets = [...shotKinds];
    assert.ok(bellEvent, 'The bell sound is scheduled at the visible nudge');

    // Sweep complete scenes in the browser. Camera cuts are excluded from world
    // measurements, so a moving view cannot hide a floating or sliding paw.
    for (let scene = 0; scene < scenes.length; scene++) {
      const sweep = await page.evaluate(({ scene, duration }) => {
        const api = window.lp035Test, samples = [], issues = [];
        let previous = null, maxRootStep = 0, maxSoleStep = 0, maxSlip = 0, contacts = 0;
        let contactStart = null, contactEnd = null;
        for (let ms = 0; ms <= duration; ms = Math.min(ms + 32, duration)) {
          api.seek(scene, ms);
          const pose = window.__lp035Measure();
          samples.push(pose);
          for (const animal of pose.animals) {
            const prior = previous?.animals.find(actor => actor.id === animal.id);
            if (!prior) continue;
            const rootStep = Math.hypot(animal.origin.x - prior.origin.x, animal.origin.y - prior.origin.y);
            maxRootStep = Math.max(maxRootStep, rootStep);
            if (rootStep > 13) issues.push({ type: 'actor-jump', actor: animal.id, ms, distance: rootStep });
            if (animal.facing !== prior.facing) continue;
            for (const foot of animal.feet) {
              const before = prior.feet.find(paw => paw.id === foot.id);
              const step = Math.hypot(foot.point.x - before.point.x, foot.point.y - before.point.y);
              maxSoleStep = Math.max(maxSoleStep, step);
              if (step > 19) issues.push({ type: 'paw-jump', actor: animal.id, foot: foot.id, ms, distance: step });
              if (foot.stance && before.stance) {
                maxSlip = Math.max(maxSlip, step);
                if (step > 0.65) issues.push({ type: 'stance-slip', actor: animal.id, foot: foot.id, ms, distance: step });
              }
            }
          }
          if (pose.contacts.length) {
            contacts += pose.contacts.length;
            contactStart ??= ms;
            contactEnd = ms;
          }
          if (ms % 96 === 0) {
            for (const node of document.querySelectorAll('#stage [d], #stage [transform]')) {
              if (/NaN|Infinity|undefined/.test((node.getAttribute('d') || '') + ' ' + (node.getAttribute('transform') || ''))) {
                issues.push({ type: 'invalid-geometry', node: node.id, ms });
              }
            }
          }
          previous = pose;
          if (ms === duration) break;
        }
        return { samples, issues: issues.slice(0, 12), maxRootStep, maxSoleStep, maxSlip, contacts, contactStart, contactEnd };
      }, { scene, duration: scenes[scene].duration });
      report.sweep.push({ scene: scenes[scene].id, frames: sweep.samples.length, issues: sweep.issues,
        maxRootStep: sweep.maxRootStep, maxSoleStep: sweep.maxSoleStep, maxSlip: sweep.maxSlip,
        contacts: sweep.contacts, contactStart: sweep.contactStart, contactEnd: sweep.contactEnd });
      await writeFile(output + '/checkpoints.json', JSON.stringify(report, null, 2));
      for (const pose of sweep.samples) assertSupported(pose);
      assert.deepEqual(sweep.issues, [], 'Grounded motion remains continuous through every reach, step and stop');
      if (scene === 2) {
        assert.ok(sweep.contacts >= 4, 'The nudge has visible sustained paw-to-bell contact');
        assert.ok(bellEvent.ms >= sweep.contactStart - 32 && bellEvent.ms <= sweep.contactEnd + 32,
          'The brass bell sounds while the visible forepaw is in contact');
        const middle = (sweep.contactStart + sweep.contactEnd) / 2;
        failurePoses.push({ name: 'nudge-midpoint', scene, ms: middle });
        await seek(scene, middle);
        await capture('bell-nudge-contact');
        const attachedContours = await page.evaluate(() => {
          const svg = document.getElementById('stage'), world = svg.getScreenCTM().inverse();
          const point = (node, p = { x: 0, y: 0 }) => new DOMPoint(p.x, p.y).matrixTransform(node.getScreenCTM()).matrixTransform(world);
          return ['[data-bell-contact="true"] [data-contact-paw]', '#bell [data-contact-bell]'].map(selector => {
            const marker = svg.querySelector(selector), target = point(marker);
            const paths = [...marker.parentElement.querySelectorAll('path')];
            let nearest = Infinity;
            for (const path of paths) {
              const length = path.getTotalLength();
              for (let n = 0; n <= 400; n++) {
                const p = point(path, path.getPointAtLength(length * n / 400));
                nearest = Math.min(nearest, Math.hypot(p.x - target.x, p.y - target.y));
              }
            }
            return { selector, nearest };
          });
        });
        for (const contour of attachedContours) assert.ok(contour.nearest < 1.1, 'Contact markers lie on the drawn paw and bell contours: ' + JSON.stringify(contour));
        report.contactContours = attachedContours;
      } else assert.equal(sweep.contacts, 0, 'The bell is only nudged during the proposal');
    }

    await seek(5, scenes[5].duration - 40);
    const finalPose = await page.evaluate(renderedPose);
    await capture('final-hold');
    await page.waitForTimeout(240);
    assert.deepEqual(await page.evaluate(renderedPose), finalPose, 'The finished pose remains stable when playback stops');
    assert.equal(await page.locator('#movie button').count(), 0);

    const phone = await browser.newPage({ viewport: { width: 393, height: 852 } });
    await phone.emulateMedia({ reducedMotion: 'reduce' });
    await prepare(phone);
    for (const [scene, ms, name] of [[0, (scenes[0].lines[1].start + scenes[0].lines[1].end) / 2, 'phone-grounded-retreat'],
      [1, scenes[1].duration / 2, 'phone-council'],
      [2, (report.sweep[2].contactStart + report.sweep[2].contactEnd) / 2, 'phone-bell'],
      [5, (scenes[5].lines[0].start + scenes[5].lines[0].end) / 2, 'phone-safe-return'],
      [5, scenes[5].duration - 40, 'phone-final']]) {
      await seek(scene, ms, phone);
      assertSupported(await phone.evaluate(renderedPose));
      assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Phone layout has no horizontal overflow');
      assert.equal(await phone.locator('#stage').getAttribute('data-camera-angle'), 'eye-level');
      await capture(name, phone);
    }
    await phone.close();

    const review = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await prepare(review, '?test=1&review=1&scene=wise-question');
    assert.equal(await review.locator('#review-scenes li').count(), 6);
    assert.equal(await review.locator('#review-scenes li button').count() >= 6, true);
    assert.match(await review.locator('#review-audio').textContent(), /13/);
    assert.equal((await review.evaluate(() => window.lp035Test.state())).scene, 3);
    await seek(3, scenes[3].lines[0].start + 700, review);
    await capture('review-elder-question', review);
    await review.close();

    // Read the catalogue defaults; never tick an approval or write export history.
    const catalogue = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    observe(catalogue);
    for (const filename of ['index.html', 'all-missions.html']) {
      await catalogue.goto(new URL('../' + filename, url).href);
      await catalogue.waitForFunction(() => document.querySelector('.review-check') && !document.querySelector('.review-check').disabled);
      const row = catalogue.locator('tr:has(.episode-pick[value="035"])');
      assert.equal(await row.count(), 1);
      assert.equal(await row.locator('.episode-pick').isChecked(), false);
      assert.equal(await row.locator('.review-check').isChecked(), false);
      assert.equal(await row.locator('.approve-check').isChecked(), false);
      assert.equal(await row.locator('.episode-pick').isDisabled(), true);
      assert.equal(await row.locator('.approve-check').isDisabled(), true);
      assert.equal(await row.locator('a[href="https://www.read.gov/aesop/003.html"]').count(), 1);
      assert.ok(Number(await row.getAttribute('data-seconds')) > 0);
      assert.equal((await row.locator('.exported-in').textContent()).trim(), '—');
    }
    await catalogue.close();

    const compilation = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await prepare(compilation, '?test=1&compilation=1');
    assert.equal(await compilation.evaluate(() => window.lpCompilation.ready()), true);
    const ready = await compilation.evaluate(() => window.lpCompilation.status());
    assert.equal(ready.started, 0);
    assert.equal(ready.finished, 0);
    assert.equal(ready.error, '');
    assert.equal(ready.total, scenes.reduce((sum, scene) => sum + scene.duration, 0));
    await compilation.locator('#reading').click();
    const started = await compilation.evaluate(() => window.lpCompilation.start());
    assert.ok(Number.isFinite(started) && started > 0);
    await compilation.waitForFunction(() => window.lpCompilation.status().elapsed > 600 && window.lp035Test.state().audioActive);
    const playing = await compilation.evaluate(() => window.lpCompilation.status());
    assert.equal(playing.started, started);
    assert.equal(playing.finished, 0);
    assert.equal(playing.error, '');
    report.compilation = { total: ready.total, selectedEpisode: 'mission-035', ready: true,
      recordedPlaybackStarted: true, elapsedAtCheck: playing.elapsed };
    await compilation.evaluate(() => window.lp035Test.pause());
    await capture('compilation-start', compilation);
    await compilation.close();

    assert.deepEqual(report.failedResources, [], 'No story, audio, font or catalogue request failed');
    assert.deepEqual(report.errors, []);
    report.passed = true;
    console.log('PASS Mission35:13 real Punjabi clips, aligned words, grounded paws, bell contact, clear faces, continuous motion, planned shots, phone/reduced motion and selected-episode playback.');
  } catch (error) {
    report.failure = error.stack || String(error);
    if (page) {
      await page.screenshot({ path: output + '/failure.png' }).catch(() => {});
      for (const pose of failurePoses) {
        try {
          await seek(pose.scene, pose.ms);
          await capture('failure-' + pose.name);
        } catch (captureError) {
          report.checkpoints.push({ name: 'failure-' + pose.name, captureError: captureError.message });
        }
      }
    }
    throw error;
  } finally {
    await writeFile(output + '/checkpoints.json', JSON.stringify(report, null, 2));
    await browser.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
