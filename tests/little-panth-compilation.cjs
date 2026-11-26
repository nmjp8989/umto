const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage(), errors = [];
    context.on('page', child => child.on('pageerror', error => errors.push(error.message)));
    page.on('pageerror', error => errors.push(error.message));
    const base = 'http://127.0.0.1:8765/little%20panth/';
    let db = { schemaVersion: 1, updatedAt: '', reviews: {}, exports: [] };
    await context.route('**/production-db.json', route => route.fulfill({ json: db }));
    const ready = () => page.waitForFunction(() => !document.querySelector('.review-check').disabled);
    const tab = name => page.locator('#tab-' + name).click();
    const row = id => page.locator('tr:has(.episode-pick[value="' + id + '"])');
    const pick = id => row(id).locator('.episode-pick');
    const check = id => row(id).locator('.review-check');
    const approve = id => row(id).locator('.approve-check');

    await page.goto(base + 'all-missions.html');
    await ready();
    assert.ok(await page.locator('.episode-pick').count() >= 34);
    assert.equal(await page.locator('#tab-review').getAttribute('aria-selected'), 'true');
    assert.equal(await row('005').isVisible(), true);
    assert.equal(await pick('005').isDisabled(), true);
    assert.equal(await approve('005').isDisabled(), true);
    assert.equal(await page.locator('#export-video').isDisabled(), true);
    await tab('approved');
    assert.equal(await page.locator('#tab-empty').isVisible(), true);
    await page.locator('#select-aesop').click();
    assert.equal(await page.locator('.episode-pick:checked').count(), 0);

    await tab('review');
    await check('005').check();
    assert.equal(await approve('005').isDisabled(), false);
    assert.equal(await pick('005').isDisabled(), true);
    await approve('005').check();
    assert.equal(await row('005').isVisible(), false);
    await check('034').check();
    await approve('034').check();
    await tab('approved');
    assert.equal(await row('005').isVisible(), true);
    await page.locator('#select-aesop').click();
    assert.equal(await page.locator('.episode-pick:checked').count(), 2);
    await page.locator('#compilation-name').fill('vol1aesops');
    assert.equal(await page.locator('#export-video').isDisabled(), false);
    await approve('005').uncheck();
    assert.equal(await row('005').isVisible(), false);
    assert.equal(await pick('005').isChecked(), false);
    assert.equal(await pick('005').isDisabled(), true);
    await tab('review');
    await approve('005').check();
    await tab('approved');
    await pick('005').check();

    await page.reload();
    await ready();
    assert.equal(await approve('005').isChecked(), true);
    assert.equal(await page.locator('.episode-pick:checked').count(), 2);
    await page.locator('#sync-tracker').click();
    const save = JSON.parse(await page.locator('#sync-request').inputValue());
    assert.equal(save.mode, 'save');
    assert.equal(save.reviews['005'].approved, true);
    assert.equal(save.reviews['034'].checked, true);
    await tab('approved');
    await page.locator('#export-video').click();
    await page.waitForURL(/compilation\.html/);
    await page.waitForFunction(() => document.getElementById('episode-ids').value.length > 20);
    const request = JSON.parse(await page.locator('#episode-ids').inputValue());
    assert.deepEqual(request.episodes, ['005', '034']);
    assert.equal(request.name, 'vol1aesops');
    assert.equal(request.mode, 'export');
    assert.equal(await page.locator('#render-mp4').isDisabled(), false);

    // Exercise the successful-recording callback without capturing a real video.
    await page.evaluate(() => window.LPProduction.addBrowser('vol1aesops', ['005', '034'], 'webm', 207));
    await page.goBack();
    await ready();
    await page.waitForFunction(() => document.querySelector('tr:has(.episode-pick[value="005"]) .exported-in').textContent.includes('vol1aesops.webm'));
    await tab('approved');
    assert.equal(await row('005').isVisible(), false);
    await tab('export');
    assert.equal(await row('005').isVisible(), true);
    assert.equal(await row('034').isVisible(), true);
    assert.equal(await page.locator('#export-video').isDisabled(), true);

    // Chromium automation may evict history entries instead of using bfcache.
    // Keep the catalogue JS alive, complete a recording on another page, then
    // dispatch the real persisted-pageshow event used when returning with Back.
    await tab('review');
    await check('007').check();
    await approve('007').check();
    await tab('approved');
    assert.equal(await row('007').isVisible(), true);
    const recorder = await context.newPage();
    await recorder.goto(base + 'compilation.html?episodes=007&name=back_regression');
    await recorder.waitForFunction(() => document.getElementById('episode-ids').value.length > 20);
    await recorder.evaluate(() => window.LPProduction.addBrowser('back_regression', ['007'], 'webm', 77));
    assert.equal(await row('007').locator('.exported-in').textContent(), '—');
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    await page.waitForFunction(() => document.querySelector('tr:has(.episode-pick[value="007"]) .exported-in').textContent.includes('back_regression.webm'));
    assert.equal(await row('007').isVisible(), false);
    await tab('export');
    assert.equal(await row('007').isVisible(), true);
    await approve('007').uncheck();
    assert.equal(await row('007').isVisible(), true);
    assert.equal(await pick('007').isDisabled(), true);
    assert.match(await row('007').locator('.exported-in').textContent(), /back_regression\.webm/);
    await recorder.close();

    db = { schemaVersion: 1, updatedAt: new Date().toISOString(), reviews: save.reviews, exports: [{
      id: 'github-1234', name: 'vol2aesops', filename: 'vol2aesops.mp4', format: 'mp4', kind: 'github',
      episodes: ['005', '034'], seconds: 207, createdAt: new Date().toISOString(), runId: '1234', artifactId: '5678'
    }] };
    await page.locator('#refresh-tracker').click();
    await page.waitForFunction(() => document.querySelector('tr:has(.episode-pick[value="005"]) .exported-in').textContent.includes('vol2aesops.mp4'));
    assert.match(await row('034').locator('.exported-in').textContent(), /vol2aesops\.mp4/);
    assert.match(await row('005').locator('.exported-in').textContent(), /vol1aesops\.webm/);
    await page.locator('#select-unused').click();
    assert.equal(await page.locator('.episode-pick:checked').count(), 0);

    // A revised drawing is flagged without changing an existing owner approval.
    db.reviews['009'] = { checked: true, approved: true, changedAt: '2020-01-01T00:00:00.000Z' };
    db.updatedAt = new Date().toISOString();
    await page.locator('#refresh-tracker').click();
    await page.waitForFunction(() => document.querySelector('tr:has(.episode-pick[value="009"]) .status-note').dataset.needsReview === 'true');
    await tab('approved');
    assert.equal(await approve('009').isChecked(), true);
    assert.equal(await pick('009').isDisabled(), false);
    await approve('009').uncheck();
    await tab('review');
    await approve('009').check();
    await tab('approved');
    assert.equal(await row('009').locator('.status-note').getAttribute('data-needs-review'), 'false');

    await page.setViewportSize({ width: 393, height: 852 });
    await page.reload();
    await ready();
    await tab('export');
    assert.equal(await row('034').isVisible(), true);
    assert.equal(await approve('034').isChecked(), true);
    assert.equal(await row('007').isVisible(), true);
    assert.equal(await approve('007').isChecked(), false);
    // Regression: the preview must keep the same SVG element and bounds
    // through repeated intro/transition playback (no 84% static-image reset).
    const brandPage=await context.newPage();
    await brandPage.goto(base+'brand-preview.html?v=3');
    await brandPage.waitForFunction(()=>!document.getElementById('intro').disabled&&!!document.querySelector('#stage>svg'));
    for(const viewport of [{width:1440,height:900},{width:393,height:852}]){
      await brandPage.setViewportSize(viewport);
      await brandPage.evaluate(()=>{window.__previewSvg=document.querySelector('#stage>svg');});
      const boxBefore=await brandPage.locator('#stage>svg').boundingBox();
      for(const id of ['intro','transition']){
        await brandPage.locator('#'+id).click();
        await brandPage.waitForFunction(()=>document.getElementById('intro').disabled&&document.querySelector('[data-motion="l0"]').getAttribute('opacity')!=='1');
        await brandPage.waitForFunction(()=>!document.getElementById('intro').disabled&&document.getElementById('status').textContent.startsWith('Preview complete'),null,{timeout:10000});
        assert.equal(await brandPage.evaluate(()=>window.__previewSvg===document.querySelector('#stage>svg')),true);
        assert.equal(await brandPage.locator('[data-motion="all"]').getAttribute('opacity'),'1');
        assert.deepEqual(await brandPage.locator('#stage>svg').boundingBox(),boxBefore);
      }
    }
    await brandPage.close();
    // Verify the real supplied vector watermark, including caption-safe
    // corner placement, without running an entire story to test its overlay.
    const waterPage=await context.newPage({viewport:{width:1920,height:1080}});
    await waterPage.goto(base+'brand-preview.html');
    await waterPage.evaluate(()=>{document.body.innerHTML='<main class="book" data-layout="cinema" data-caption="bottom"></main>';});
    await waterPage.addScriptTag({url:base+'render-watermark.js?v=1'});
    const watermark=await waterPage.evaluate(async()=>{
      const a=await LPWatermark.install(document),b=await LPWatermark.install(document),r=a.getBoundingClientRect();
      const source=new DOMParser().parseFromString(decodeURIComponent(a.src.split(',').slice(1).join(',')),'image/svg+xml');
      const noWhiteCanvas=![...source.documentElement.children].some(n=>n.localName==='rect'&&n.getAttribute('width')==='100%'&&n.getAttribute('height')==='100%');
      const bottomCaptionTop=r.top;
      document.querySelector('.book').dataset.caption='top';
      const bottomRight=a.getBoundingClientRect();
      return {same:a===b,count:document.querySelectorAll('#lp-video-watermark').length,noWhiteCanvas,width:r.width,top:bottomCaptionTop,right:r.right,alternateTop:bottomRight.top,alternateBottom:bottomRight.bottom,clicks:getComputedStyle(a).pointerEvents};
    });
    assert.equal(watermark.same,true);assert.equal(watermark.count,1);assert.equal(watermark.noWhiteCanvas,true);assert.equal(watermark.clicks,'none');
    assert.ok(watermark.width>200&&watermark.width<220);
    assert.ok(watermark.top<30&&watermark.right>1880&&watermark.right<1920);
    assert.ok(watermark.alternateTop>900&&watermark.alternateBottom<1080);
    await waterPage.close();
    assert.deepEqual(errors, []);
    console.log('PASS tabs, review gate, persistent approvals, named requests, Back/recording regression, export priority, revision flags and mobile');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
