const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({channel: 'chrome', args: ['--no-sandbox']});
  try {
    const page = await browser.newPage({viewport: {width: 960, height: 740}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/mission-002/audio/**', route => route.fulfill({status: 404}));
    await page.goto('http://127.0.0.1:8765/little%20panth/mission-002/');
    await page.waitForFunction(() => !document.getElementById('play').disabled);
    await page.clock.install();
    await page.locator('#play').click();
    const prompts = new Set();
    for (let step = 0; step < 130; step++) {
      if (await page.locator('#chapter').textContent() === 'ਮਿਸ਼ਨ ਪੂਰਾ ਹੋਇਆ') break;
      if (await page.locator('#activity').isVisible()) {
        const prompt = await page.locator('#prompt').textContent();
        prompts.add(prompt);
        const choices = page.locator('#choices button');
        if (await choices.count() > 1) {
          await choices.nth(1).click();
          assert.match(await page.locator('#feedback').textContent(), /ਹੋਰ/);
        }
        await choices.first().click();
      } else {
        await page.evaluate(() => document.getElementById('next').click());
        await page.clock.fastForward(800);
      }
      if (await page.locator('#instrument.magic').count()) {
        await page.screenshot({path: 'screenshots/mission-002/sitar.png'});
      }
    }
    assert.equal(prompts.size, 4);
    assert.equal(await page.locator('#chapter').textContent(), 'ਮਿਸ਼ਨ ਪੂਰਾ ਹੋਇਆ');
    await page.locator('#restart').click();
    await page.locator('#watch').click();
    for (let step = 0; step < 150; step++) {
      if (await page.locator('#chapter').textContent() === 'ਮਿਸ਼ਨ ਪੂਰਾ ਹੋਇਆ') break;
      await page.clock.fastForward(30_000);
      assert.equal(await page.locator('#activity').isVisible(), false);
    }
    assert.equal(await page.locator('#chapter').textContent(), 'ਮਿਸ਼ਨ ਪੂਰਾ ਹੋਇਆ');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
