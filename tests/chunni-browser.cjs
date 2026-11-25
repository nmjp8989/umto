#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { mkdir, writeFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const { chromium } = require('playwright-core');

const url = process.env.CHUNNI_URL || 'http://127.0.0.1:8765/chunni-review.html';
const output = resolve(process.env.CHUNNI_OUTPUT || 'screenshots/chunni');

function finiteSummary(value, path = 'summary') {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), path + ' must be finite');
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) finiteSummary(child, path + '.' + key);
  }
}

function inspectPose(svg) {
  let attributes = 0;
  for (const node of [svg, ...svg.querySelectorAll('*')]) {
    for (const name of ['d', 'transform', 'viewBox', 'x', 'y', 'cx', 'cy', 'rx', 'ry', 'width', 'height', 'opacity']) {
      const value = node.getAttribute(name);
      if (value && /NaN|Infinity|undefined/.test(value)) throw Error('Invalid SVG ' + name + ' on ' + (node.id || node.tagName));
      if (value) attributes++;
    }
  }
  const panels = [...svg.querySelectorAll('[data-chunni-head],[data-chunni-back],[data-chunni-shoulders]')];
  if (panels.length < 3) throw Error('The displayed pose is missing a shared chunni panel');
  for (const panel of panels) {
    const matrix = panel.getScreenCTM(), box = panel.getBBox();
    if (!matrix || !['a', 'b', 'c', 'd', 'e', 'f'].every(key => Number.isFinite(matrix[key])) ||
        !['x', 'y', 'width', 'height'].every(key => Number.isFinite(box[key]))) {
      throw Error('Non-finite displayed chunni geometry');
    }
  }
  return { viewBox: svg.getAttribute('viewBox'), panels: panels.length, checkedAttributes: attributes };
}

function inspectLegacySeams(actor) {
  const edges = Object.fromEntries(['head', 'near', 'far'].map(side => {
    const paths = actor.querySelectorAll('[data-chunni-edge="' + side + '"]');
    if (paths.length !== 1) throw Error('Expected one rendered Dadi ' + side + ' trim path');
    const path = paths[0];
    for (let node = path; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
        throw Error('Dadi ' + side + ' trim is hidden');
      }
    }
    return [side, path];
  }));
  const inverse = actor.getScreenCTM().inverse();
  const stage = document.getElementById('stage').getBoundingClientRect();
  const point = (path, end) => {
    const screen = path.getPointAtLength(end ? path.getTotalLength() : 0).matrixTransform(path.getScreenCTM());
    const local = screen.matrixTransform(inverse);
    if (![screen.x, screen.y, local.x, local.y].every(Number.isFinite)) throw Error('Non-finite legacy scarf seam');
    if (screen.x < stage.left || screen.x > stage.right || screen.y < stage.top || screen.y > stage.bottom) {
      throw Error('Legacy scarf seam is outside the visible stage');
    }
    return { actor: { x: local.x, y: local.y }, screen: { x: screen.x, y: screen.y } };
  };
  return ['near', 'far'].map((side, index) => {
    const head = point(edges.head, index === 1), shoulder = point(edges[side], false);
    return { side, head, shoulder,
      actorGap: Math.hypot(head.actor.x - shoulder.actor.x, head.actor.y - shoulder.actor.y),
      screenGap: Math.hypot(head.screen.x - shoulder.screen.x, head.screen.y - shoulder.screen.y) };
  });
}

async function run() {
  await mkdir(output, { recursive: true });
  const report = { url, passed: false, poses: [], errors: [], consoleErrors: [], failedRequests: [] };
  let browser, page, legacyPage;
  try {
    browser = await chromium.launch({
      ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : { channel: 'chrome' }),
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
    });
    page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && !/\/favicon\.ico(?:\?|$)/.test(message.location().url || '')) {
        report.consoleErrors.push(message.text());
      }
    });
    page.on('response', response => {
      if (response.status() >= 400 && !/\/favicon\.ico(?:\?|$)/.test(response.url())) {
        report.failedRequests.push({ url: response.url(), status: response.status() });
      }
    });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => /^(PASS|FAIL)\b|failed to load/i.test(document.getElementById('status')?.textContent || ''),
      null, { timeout: 180000 });
    report.status = await page.locator('#status').textContent();
    report.resultsText = await page.locator('#results').textContent();
    assert.match(report.status, /^PASS\b/, report.resultsText || report.status);
    report.summary = JSON.parse(report.resultsText);
    finiteSummary(report.summary);
    assert.equal(report.summary.cases, 16, 'Both Bibi presets retain the existing colour, view and head-size cases');
    assert.ok(report.summary.poses >= report.summary.cases * 31, 'The full nod motion is checked');
    assert.ok(report.summary.facePoints > 0 && report.summary.minimumOverlap >= 6,
      'The review checks face clearance and filled shoulder overlap');
    assert.ok(report.summary.seamPoints > 0 && Number.isFinite(report.summary.maximumSeamGap) &&
      report.summary.maximumSeamGap >= 0, 'The review includes the visible trim seam regression');
    await page.locator('#pose').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#pose').isEnabled(), true);

    // Use the review page's existing controls and screenshot its actual SVGs.
    // Each preset appears in all three views; neck crops expose the joining trim.
    const poses = [
      { name: '01-bibi-ji-front-nod-full', preset: 'elder-bibi-ji', view: 'front', action: 'nod', time: .942, full: true },
      { name: '02-bibi-ji-left-nod-neck', preset: 'elder-bibi-ji', view: 'left', action: 'nod', time: .942, full: false },
      { name: '03-bibi-ji-right-walk-full', preset: 'elder-bibi-ji', view: 'right', action: 'walk', time: .36, full: true },
      { name: '04-bibi-front-nod-neck', preset: 'elder-bibi', view: 'front', action: 'nod', time: 1.571, full: false },
      { name: '05-bibi-left-walk-full', preset: 'elder-bibi', view: 'left', action: 'walk', time: .84, full: true },
      { name: '06-bibi-right-explain-full', preset: 'elder-bibi', view: 'right', action: 'explain', time: 1.3, full: true }
    ];
    for (const pose of poses) {
      await page.locator('#time').fill(String(pose.time));
      await page.locator('#action').selectOption(pose.action);
      await page.locator('#full').setChecked(pose.full);
      await page.locator('#pose').click();
      assert.equal(await page.locator('#cards article').count(), 6);
      const index = ['elder-bibi-ji', 'elder-bibi'].indexOf(pose.preset) * 3 + ['front', 'left', 'right'].indexOf(pose.view);
      const card = page.locator('#cards article').nth(index);
      assert.equal(await card.locator('h2').textContent(), pose.preset + ' · ' + pose.view);
      const svg = card.locator('svg');
      const geometry = await svg.evaluate(inspectPose);
      await svg.screenshot({ path: output + '/' + pose.name + '.png' });
      report.poses.push({ ...pose, ...geometry, image: pose.name + '.png' });
    }

    // Exercise the legacy frame bank through its public export entry point.
    // The first music shot includes Dadi without waiting through the story.
    report.legacyExport = {
      url: new URL('little%20panth/mission-002/?export=1', url).href, errors: [], samples: []
    };
    legacyPage = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
    legacyPage.on('pageerror', error => report.legacyExport.errors.push(error.message));
    await legacyPage.goto(report.legacyExport.url, { waitUntil: 'domcontentloaded' });
    await legacyPage.waitForFunction(() => window.lpExport?.ready(), null, { timeout: 90000 });
    await legacyPage.evaluate(() => window.lpExport.start('music'));
    const dadi = legacyPage.locator('#actors svg[aria-label="dadi"]');
    await dadi.waitFor({ state: 'visible' });
    for (let sample = 0; sample < 3; sample++) {
      // Allow the real animation loop to apply each captured frame.
      await legacyPage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const seams = await dadi.evaluate(inspectLegacySeams);
      report.legacyExport.samples.push(seams);
      finiteSummary(seams, 'legacyExport.seams');
      for (const seam of seams) assert.ok(seam.actorGap <= .08 && seam.screenGap <= .25,
        'Legacy Dadi ' + seam.side + ' border must meet the shoulder: ' + seam.actorGap + ' rig units');
    }
    await legacyPage.locator('#stage').screenshot({ path: output + '/07-legacy-mission-002-music.png' });
    const dadiBox = await dadi.boundingBox();
    assert.ok(dadiBox && dadiBox.width > 0 && dadiBox.height > 0, 'Legacy Dadi has visible rendered bounds');
    await legacyPage.screenshot({ path: output + '/07-legacy-mission-002-dadi.png', clip: dadiBox });
    report.legacyExport.status = await legacyPage.evaluate(() => window.lpExport.status());
    assert.equal(report.legacyExport.status.phase, 'music');
    assert.equal(report.legacyExport.status.error, '', 'Legacy music export has no renderer error');
    assert.deepEqual(report.legacyExport.errors, [], 'Legacy music page and Studio iframe have no JavaScript errors');
    await legacyPage.close();
    legacyPage = undefined;

    assert.deepEqual(report.errors, [], 'The page and Studio iframe have no JavaScript errors');
    assert.deepEqual(report.failedRequests, [], 'All review and renderer resources load');
    assert.deepEqual(report.consoleErrors, [], 'The displayed SVGs have no browser errors');
    report.passed = true;
    console.log('PASS Chunni: ' + report.summary.cases + ' cases, ' + report.summary.poses +
      ' nod poses, visible trim seams, face clearance, finite geometry, six displayed poses and Mission 002 export.');
  } catch (error) {
    report.failure = error.stack || String(error);
    if (legacyPage) {
      report.legacyExport.status = await legacyPage.evaluate(() => window.lpExport?.status()).catch(() => null);
      await legacyPage.screenshot({ path: output + '/99-failure-legacy.png', fullPage: true }).catch(() => {});
    }
    if (page) {
      report.status = await page.locator('#status').textContent({ timeout: 1000 }).catch(() => null);
      report.resultsText = await page.locator('#results').textContent({ timeout: 1000 }).catch(() => null);
      await page.screenshot({ path: output + '/99-failure.png', fullPage: true }).catch(() => {});
      const visible = page.locator('#cards article svg');
      const count = await visible.count().catch(() => 0);
      for (let i = 0; i < Math.min(6, count); i++) {
        await visible.nth(i).screenshot({ path: output + '/99-failure-pose-' + (i + 1) + '.png', timeout: 5000 }).catch(() => {});
      }
    }
    throw error;
  } finally {
    await writeFile(output + '/report.json', JSON.stringify(report, null, 2));
    await browser?.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
