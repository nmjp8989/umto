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
 async function ready(){await page.waitForFunction(()=>document.querySelector('#stage').dataset.busy==='false')}
 async function load(){await ready();const sack=page.locator('#looseSacks image').first();await sack.waitFor({timeout:10000});await sack.press('Enter');await page.waitForTimeout(120)}
 await page.locator('#voiceToggle').click();await page.locator('#start').click();
 await page.locator('#introChicken').waitFor();assert.match(await page.locator('#background').getAttribute('href'),/wheat%20field\.svg/);await shot('00-musical-field-opening');
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
 assert.equal(await page.locator('#stageWrap #objectiveBar').count(),0,'Game prompts must be outside artwork');await shot('01-opening');
 // Two storyteller lines precede the three courtyard lines; inspection now starts automatically.
 await advance(2);await page.locator('#english').filter({hasText:'Mehar! Come quick!'}).waitFor();
 await advance(3);assert.equal(await page.locator('#narratorFigure.visible').count(),0,'Narrator must wait for Mehar to inspect the sacks');await page.locator('#english').filter({hasText:'there are already three sacks here'}).waitFor();assert.equal(await page.locator('#narratorFigure.visible').count(),0,'Mehar speaks first');await advance(1);await page.locator('#narratorFigure.visible').waitFor();await shot('01b-narrator-after-inspection');await advance(1);await advance(2);await action();await advance(2);await ready();await shot('02-harvest');
 for(let p=0;p<6;p++)for(let i=0;i<3;i++)await page.locator('[data-patch="'+p+'"]').press('Enter');
 await advance(1);await ready();for(let j=0;j<6;j++)await page.locator('[data-harvest="collect"]:not([data-done])').first().press('Enter');
 await advance(1);await ready();await page.locator('[data-pack-sack]').first().waitFor();
 for(let j=0;j<3;j++){
  await page.locator('[data-harvest="pack"]:not([data-done])').first().press('Enter');
  assert.equal(await page.locator('[data-pack-sack]').count(),3,'Only three sack sprites may exist during packing');
  assert.equal(await page.locator('[data-pack-sack][data-filled="true"]').count(),j+1);
  assert.equal(await page.locator('[data-harvest="pack"]').count(),2-j,'Used wheat bundle should disappear');
  if(j<2)assert.equal(await page.locator('#worldProps image[href*="wheat-sack.svg"]').count(),3,'No sack artwork may be duplicated');
 }

 await advance(1);await page.locator('#cartHost[data-arrival="rolling"]').waitFor({timeout:10000});
 await page.locator('#cartHost[data-arrival="arrived"]').waitFor({timeout:12000});
 await page.locator('#english').filter({hasText:"Here's my cart!"}).waitFor();
 await shot('03-cart-arrival');await advance(1);await shot('03-cart-load');
 for(let i=0;i<3;i++)await load();
 await advance(2);await action();
 assert.match(await page.locator('#background').getAttribute('href'),/village%20storage%20courtyard\.svg/);
 await page.locator('[data-harvest="unload"]').waitFor();await shot('04-storage');
 for(let i=0;i<3;i++){
  const sack=page.locator('[data-harvest="unload"]');
  await sack.waitFor();assert.equal(await sack.getAttribute('aria-label'),'Unload sack '+(i+1)+' of 3');
  await sack.press('Enter');
 }
 await page.locator('#objective').filter({hasText:'First delivery complete'}).waitFor();await ready();
 assert.equal(await page.locator('#worldProps > image[href*="wheat-sack.svg"]').count(),3);
 await action();await page.locator('#stage[data-light="sunset"]').waitFor();
 assert.match(await page.locator('#background').getAttribute('href'),/wheat%20field\.svg/);
 await page.locator('#english').filter({hasText:'the sun’s going down'}).waitFor();
 await advance(1);await page.locator('#english').filter({hasText:'sell more wheat at the market'}).waitFor();
 await advance(1);await ready();
 assert.equal(await page.locator('#sack-pos-1').getAttribute('opacity'),'0','The returning cart must be empty');
 for(let i=0;i<5;i++)await load();
 await page.locator('#stage[data-light="dusk"]').waitFor();
 await advance(1);
 for(let i=0;i<2;i++)await load();
 await advance(2);await page.locator('#stage[data-light="night"]').waitFor();await shot('05-overloaded');
 await load();await page.locator('#fx .sack-flight').waitFor();await advance(1);
 await load();await page.locator('#english').filter({hasText:"I've done it!"}).waitFor();assert.equal(await page.locator('#cartHost.cart-crash').count(),0,'Cart must not break before Baldev speaks');await advance(1);await page.locator('#cartHost.cart-crash').waitFor();assert.equal(await page.locator('#fallenWheel').count(),1,'A detached wheel must remain visible');assert.equal(await page.locator('#right-wheel').getAttribute('visibility'),'hidden');await shot('05b-field-crash');await advance(5);await action();
 await advance(5);await action();await advance(1);
 await page.locator('#verse:not([hidden])').waitFor();await shot('06-gurbani');
 await page.locator('#english').filter({hasText:"Even gathering all the world's riches"}).waitFor({timeout:10000});
 await advance(5);await action();await page.locator('#english').filter({hasText:'Three for home'}).waitFor();assert.equal(await page.locator('#sharingSacks image').count(),8,'All sacks must be visible during explanation');await advance(1);await ready();await shot('07-sharing');
 assert.equal(await page.locator('#actor-baldev').getAttribute('transform'),'translate(96 665)');
 assert.equal(await page.locator('#actor-mehar').getAttribute('transform'),'translate(1180 665)');
 for(const [key,count] of [['home',3],['seeds',2],['sharing',3]]){
  for(let i=0;i<count;i++){
   await page.locator('#sharingSacks image').first().click({force:true});
   await page.locator('#shareTargets [data-target="'+key+'"]').click({force:true});
  }
 }
 await advance(5);
 for(let i=0;i<3;i++){
  await page.locator('#quiz:not([hidden])').waitFor({timeout:15000});
  await page.locator('#quizChoices button').nth(i===2?2:1).click();
  await page.waitForTimeout(1300);
 }
 await page.locator('#speech:not([hidden])').waitFor();await page.locator('#actor-mehar').evaluate(el=>el.dataset.facing==='left').then(v=>assert.ok(v,'Mehar should face Baldev in finale'));
 await page.waitForTimeout(1000);assert.ok(Number((await page.locator('#stage').getAttribute('viewBox')).split(' ')[2])<1280,'Dialogue camera should push in');
 assert.equal(await page.locator('#worldProps #fallenWheel').count(),1,'Finale wheel must be behind the characters');
 await advance(3);await page.locator('#finish:not([hidden])').waitFor({timeout:15000});
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
