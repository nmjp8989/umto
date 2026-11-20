const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { chromium } = require('playwright-core');
const url = (process.env.MISSION_TEST_ORIGIN || 'http://127.0.0.1:8765') + '/little%20panth/mission-003/';

async function setup(browser, viewport, options = {}) {
  const page = await browser.newPage({viewport,...options});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.waitForFunction(() => !document.getElementById('watch').disabled, null,{timeout:60_000});
  return {page,errors};
}

(async () => {
  await mkdir('screenshots/mission-003',{recursive:true});
  const browser = await chromium.launch({channel:'chrome',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
  try {
    const {page,errors} = await setup(browser,{width:1420,height:900});
    assert.equal(await page.locator('#loading').isVisible(),false);
    await page.screenshot({path:'screenshots/mission-003/opening.png'});
    await page.locator('#play').click();
    let completed = 0;
    let chapters = new Set();
    for (let i = 0; i < 25; i++) {
      chapters.add(await page.locator('#progress').textContent());
      const activity = page.locator('#activity');
      if (await activity.isVisible()) {
        const choices = page.locator('#choices button');
        const count = await choices.count();
        assert.equal(await page.locator('#next').isDisabled(),true);
        if (count > 1) {
          await choices.first().click();
          assert.equal(await page.locator('#next').isDisabled(),true);
          assert.ok(await page.locator('#feedback').textContent());
        }
        const correct = await activity.locator('h2').textContent() === 'Where did the blue scrap land?' ? choices.nth(1) : choices.last();
        await correct.click();
        assert.equal(await page.locator('#next').isEnabled(),true);
        completed++;
      }
      if ([1,6,16,22].includes(i)) await page.screenshot({path:'screenshots/mission-003/scene-'+i+'.png'});
      await page.locator('#next').click();
    }
    assert.equal(completed,5);
    assert.equal(chapters.size,6);
    await page.locator('#ending').waitFor();
    await page.locator('#replay').click();
    await page.locator('#watch').click();
    await page.locator('#pause').click();
    assert.equal(await page.locator('#pause').textContent(),'Resume');
    const before = await page.locator('#stage').getAttribute('viewBox');
    await page.waitForTimeout(230);
    assert.equal(await page.locator('#stage').getAttribute('viewBox'),before);
    await page.locator('#pause').click();
    await page.locator('#caption-toggle').click();
    assert.equal(await page.locator('#english').isVisible(),false);
    await page.locator('#caption-toggle').click();
    await page.locator('#audio-toggle').click();
    assert.match(await page.locator('#audio-toggle').textContent(),/Sound off/);
    await page.clock.install();
    for (let i=0; i<52 && !(await page.locator('#ending').isVisible()); i++) {
      await page.clock.fastForward(30_000);
      assert.equal(await page.locator('#activity').isVisible(),false);
    }
    assert.equal(await page.locator('#ending').isVisible(),true);
    assert.deepEqual(errors,[]);
    console.log('PASS 25 story beats, all five puzzle steps plus retry, 6 chapters, pause/mute/captions, complete auto Watch');

    const mobile = await setup(browser,{width:390,height:844},{hasTouch:true,reducedMotion:'reduce'});
    await mobile.page.screenshot({path:'screenshots/mission-003/mobile.png',fullPage:true});
    await mobile.page.locator('#play').click();
    for(let i=0;i<8;i++) await mobile.page.locator('#next').click();
    await mobile.page.locator('.hit').nth(1).tap();
    assert.equal(await mobile.page.locator('#next').isEnabled(),true);
    assert.equal(await mobile.page.evaluate(() => document.documentElement.scrollWidth),390);
    assert.deepEqual(mobile.errors,[]);
    console.log('PASS mobile, reduced-motion, true in-scene tap target, no horizontal overflow');

    const exp = await browser.newPage({viewport:{width:1920,height:1080}});
    await exp.goto(url+'?export=1');
    await exp.waitForFunction(() => window.lpExport?.ready());
    await exp.clock.install();
    await exp.evaluate(() => window.lpExport.start('repair'));
    for(let i=0;i<5;i++) await exp.clock.fastForward(30_000);
    const exportStatus = await exp.evaluate(() => window.lpExport.status());
    assert.equal(exportStatus.phase,'repair');
    assert.ok(exportStatus.finished);
    assert.equal(exportStatus.captions.length,4);
    assert.ok(exportStatus.captions.every(c=>c.end>c.start));
    console.log('PASS export chapter using the same overhead shots and all timed English captions');
  } finally {
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
