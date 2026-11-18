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
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
