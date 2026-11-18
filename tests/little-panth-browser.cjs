#!/usr/bin/env node
/* Smoke-test the complete playable Little Panth story with real Chromium. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {chromium}=require('playwright-core');
function findChrome(){for(const cmd of ['google-chrome','google-chrome-stable','chromium','chromium-browser']){try{return execFileSync('which',[cmd],{encoding:'utf8'}).trim()}catch{}}throw Error('Chrome executable unavailable')}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:findChrome(),args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1380,height:880}});
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 // Use the mission's own character fallback to isolate gameplay from the large Studio iframe.
 await page.route(/index\.html\?missionBridge=delivery/,r=>r.abort());
 await page.goto('http://127.0.0.1:8765/little%20panth/mission-001/',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>localStorage.clear());await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#start:not([disabled])').waitFor({timeout:12000});
 const shots=path.join(process.cwd(),'screenshots','little-panth');fs.mkdirSync(shots,{recursive:true});
 async function shot(name){await page.screenshot({path:path.join(shots,name+'.png')});console.log('Screenshot:',name)}
 async function advance(count){for(let i=0;i<count;i++){await page.locator('#speech:not([hidden])').waitFor({timeout:15000});await page.locator('#nextLine').click();}}
 async function action(){await page.locator('#sceneAction:not([hidden])').click({timeout:10000});}
 async function load(){await page.locator('#looseSacks image').first().click({timeout:10000,force:true})}
 await page.locator('#voiceToggle').click();await page.locator('#start').click();
 await page.locator('#speech:not([hidden])').waitFor();
 for(const width of [1380,390]){
  await page.setViewportSize({width,height:880});
  const stage=await page.locator('#stageWrap').boundingBox(), speech=await page.locator('#speech').boundingBox();
  assert.ok(speech.y>=stage.y+stage.height,'Dialogue must stay below the artwork');
 }
 await page.setViewportSize({width:1380,height:880});
 assert.equal(await page.locator('#spoken').isVisible(),false);
 await page.locator('#captionToggle').click();
 assert.equal(await page.locator('#spoken').isVisible(),true);
 assert.equal(await page.locator('#roman').isVisible(),true);
 await page.locator('#captionToggle').click();
 assert.equal(await page.locator('#english').isVisible(),true,'Muted lines remain readable with CC off');
 await page.locator('#captionToggle').click();
 await shot('01-opening');
 await advance(6);await action();await advance(1);await shot('02-harvest');
 for(let p=0;p<3;p++)for(let i=0;i<5;i++)await page.locator('[data-patch="'+p+'"]').click({force:true});
 await advance(2);await shot('03-cart-load');
 for(let i=0;i<3;i++)await load();
 await advance(2);await action();await advance(1);await shot('04-storage');
 for(let i=0;i<2;i++)await load();
 await advance(1);
 for(let i=0;i<2;i++)await load();
 await advance(2);await shot('05-overloaded');
 await load();await advance(1);
 await load();await advance(4);await action();
 await advance(5);await action();await advance(1);
 await page.locator('#verse:not([hidden])').waitFor();await shot('06-gurbani');
 await advance(5);await action();await advance(1);await shot('07-sharing');
 for(const [key,count] of [['home',3],['seeds',2],['sharing',3]]){
  for(let i=0;i<count;i++){
   await page.locator('#sharingSacks image').first().click({force:true});
   await page.locator('#shareTargets [data-target="'+key+'"]').click({force:true});
  }
 }
 await advance(4);
 for(let i=0;i<3;i++){
  await page.locator('#quiz:not([hidden])').waitFor({timeout:15000});
  await page.locator('#quizChoices button').nth(i===2?2:1).click();
  await page.waitForTimeout(1300);
 }
 await advance(2);await page.locator('#finish:not([hidden])').waitFor({timeout:15000});
 await shot('08-complete');
 assert.equal(errors.length,0,'Browser errors: '+errors.join('\n'));
 console.log('PASS: Complete LP-001 game from intro → harvesting → cart → crash → lesson → sharing → quiz → completion.');
 // Also confirm the mission can use the real UMTO Studio character rig.
 const rigPage=await browser.newPage({viewport:{width:1380,height:880}});
 const rigErrors=[];rigPage.on('pageerror',e=>rigErrors.push(String(e)));
 await rigPage.goto('http://127.0.0.1:8765/little%20panth/mission-001/',{waitUntil:'domcontentloaded'});
 await rigPage.locator('#start:not([disabled])').waitFor({timeout:12000});
 await rigPage.locator('#voiceToggle').click();await rigPage.locator('#start').click();
 await rigPage.waitForFunction(()=>!!document.querySelector('#actor-baldev [data-scene-layer]')&&!!document.querySelector('#actor-mehar [data-scene-layer]'),{timeout:30000});
 await rigPage.waitForTimeout(1000);
 await rigPage.screenshot({path:path.join(shots,'09-umto-studio-characters.png')});
 assert.equal(rigErrors.length,0,'Studio rig browser errors: '+rigErrors.join('\\n'));
 console.log('PASS: UMTO Studio rig rendered Baldev and Mehar with actual SVG character layers.');
 await rigPage.close();
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
