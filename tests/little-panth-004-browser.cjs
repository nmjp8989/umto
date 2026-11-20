#!/usr/bin/env node
/* Validate control-free animated book and synchronized Gurmukhi read-along. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const vm=require('node:vm'),{chromium}=require('playwright-core');
const scope={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','little panth','mission-004','story.js'),'utf8'),scope);
const story=scope.window.LP004;
const words=story.beats.reduce((sum,b)=>sum+b.pa.trim().split(/\s+/).length,0);
assert.ok(words>=900&&words<=1250,'Approx. 1,000 Gurmukhi words: '+words);
assert.equal(story.beats.length,25);
const dialogues=JSON.parse(fs.readFileSync(path.join(__dirname,'..','little panth','mission-004','dialogue.json'),'utf8'));
assert.ok(story.beats.every(b=>dialogues.lines[b.id]?.pa===b.pa),'Gemini dialogue and text must match verbatim');
function chrome(){for(const b of ['google-chrome','google-chrome-stable','chromium','chromium-browser']){try{return execFileSync('which',[b],{encoding:'utf8'}).trim()}catch{}}throw Error('No Chrome binary')}
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:chrome(),args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:8765/little%20panth/mission-004/?test=1',{waitUntil:'domcontentloaded'});
  await page.locator('#loading').waitFor({state:'hidden',timeout:40000});
  assert.ok(await page.locator('#character-layer [data-actor="mehar"]').count(),'Use UMTO Mehar rig');
  assert.ok(await page.locator('#character-layer [data-actor="baldev"]').count(),'Use UMTO Baldev rig');
  assert.equal(await page.locator('.story-beat').count(),25);
  assert.equal(await page.locator('button,select,input,nav,.player-controls,.progress-track').count(),0,'No visible or hidden controls');
  const left=await page.locator('.art-page').boundingBox(),right=await page.locator('.reading-page').boundingBox();
  assert.ok(Math.abs(left.width-right.width)<=2,'Exactly equal page widths');
  assert.ok(Math.abs(left.height-right.height)<=2,'Exactly equal page heights');
  assert.equal(await page.locator('.story-beat[aria-current="true"]').count(),1);
  assert.ok((await page.evaluate(()=>window.lp004Test.status())).playing,'Animation should start without play button');
  // Read-along highlight should move with the scene, and the camera artwork should change.
  await page.evaluate(()=>window.lp004Test.jump(12));
  const current=page.locator('.story-beat[aria-current="true"]');
  assert.equal(await current.getAttribute('data-scene'),story.beats[12].id);
  assert.equal(await page.locator('#backdrop-layer [data-background="'+story.beats[12].location+'"]').getAttribute('opacity'),'1');
  const storyBounds=await page.locator('#story-scroll').boundingBox(),currentBounds=await current.boundingBox();
  assert.ok(currentBounds.y>=storyBounds.y-5&&currentBounds.y<storyBounds.y+storyBounds.height,'Highlighted passage must be visible');
  const folder=path.join(process.cwd(),'screenshots','little-panth-004');
  fs.mkdirSync(folder,{recursive:true});
  await page.screenshot({path:path.join(folder,'desktop-two-page-book.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(350);
  const artMobile=await page.locator('.art-page').boundingBox(),readMobile=await page.locator('.reading-page').boundingBox();
  assert.ok(readMobile.y>=artMobile.y+artMobile.height-2,'On mobile reading page follows animation');
  await page.screenshot({path:path.join(folder,'mobile-read-along.png'),fullPage:true});
  assert.equal(errors.length,0,'Browser errors: '+errors.join('\n'));
  console.log('PASS LP004: equal page sizes; no controls; 25 synchronized Gurmukhi scenes; UMTO poses; responsive illustration.');
  await browser.close();
})().catch(err=>{console.error(err);process.exitCode=1});
