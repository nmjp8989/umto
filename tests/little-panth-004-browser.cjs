#!/usr/bin/env node
/* Mission 04: real Chromium read-along and real UMTO pose-bank smoke test. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright-core');
const source=fs.readFileSync(path.join(__dirname,'..','little panth','mission-004','story.js'),'utf8');
const storyWindow={};
require('node:vm').runInNewContext(source,{window:storyWindow});
const story=storyWindow.LP004;
const words=story.beats.reduce((sum,b)=>sum+b.pa.trim().split(/\s+/).length,0);
assert.ok(words>=900&&words<=1250,'Story should be approximately 1,000 Gurmukhi words: '+words);
assert.ok(story.beats.length>=20&&story.chapters.length===5);
assert.ok(story.beats.every(b=>b.pa&&b.en&&b.speaker&&b.action));
function chrome(){
  for(const bin of ['google-chrome','google-chrome-stable','chromium','chromium-browser']){
    try{return execFileSync('which',[bin],{encoding:'utf8'}).trim()}catch{}
  }
  throw Error('Chrome not installed');
}
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:chrome(),args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:8765/little%20panth/mission-004/',{waitUntil:'domcontentloaded'});
  await page.locator('#start:not([disabled])').waitFor({timeout:40000});
  assert.ok(await page.locator('#character-layer [data-actor="mehar"]').count(),'Mehar must use the UMTO rig');
  assert.ok(await page.locator('#character-layer [data-actor="baldev"]').count(),'Baldev must use the UMTO rig');
  assert.equal(await page.locator('.story-beat').count(),story.beats.length);
  await page.locator('#start').click();
  assert.equal(await page.locator('#cover').isVisible(),false);
  assert.equal(await page.locator('.story-beat[aria-current="true"]').count(),1);
  await page.locator('#forward').click();
  assert.match(await page.locator('#scene-count').innerText(),/SCENE 02/);
  await page.locator('#translation').click();
  assert.equal(await page.locator('.story-beat .english-note').first().isVisible(),true);
  await page.locator('#chapter-nav button').nth(2).click();
  assert.match(await page.locator('#chapter-heading').innerText(),/ਭਾਗ 3/);
  const active=page.locator('.story-beat[aria-current="true"]');
  const scroller=await page.locator('#story-scroll').boundingBox();
  const activeBox=await active.boundingBox();
  assert.ok(activeBox.y>=scroller.y-5&&activeBox.y<scroller.y+scroller.height-20,'The active Gurmukhi paragraph must be visible after jumping chapters');
  const home=await page.locator('#backdrop-layer [data-background="gurdwara"]').getAttribute('opacity');
  assert.equal(home,'1','Gurdwara should be the visible painting in Chapter 3');
  const folder=path.join(process.cwd(),'screenshots','little-panth-004');
  fs.mkdirSync(folder,{recursive:true});
  await page.screenshot({path:path.join(folder,'desktop-two-page-book.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(300);
  const stage=await page.locator('#stage').boundingBox();
  const storyBox=await page.locator('.story-page').boundingBox();
  assert.ok(stage.width>250&&storyBox.y>=stage.y+stage.height,'Mobile player must stack above the Gurmukhi page');
  await page.screenshot({path:path.join(folder,'mobile-read-along.png'),fullPage:true});
  assert.equal(errors.length,0,'Browser errors: '+errors.join('\n'));
  console.log('PASS Mission 04: '+story.beats.length+' scenes, '+words+' Gurmukhi words, UMTO rigs, camera, chapter navigation and responsive book.');
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
