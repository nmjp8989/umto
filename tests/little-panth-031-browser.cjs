#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {mkdir}=require('node:fs/promises');
const {chromium}=require('playwright-core');
const url=process.env.LP031_URL||'http://127.0.0.1:8765/little%20panth/mission-031/';
async function run(){
 const browser=await chromium.launch({...(process.env.LP031_CHROMIUM?{executablePath:process.env.LP031_CHROMIUM}:{channel:'chrome'}),headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=user-gesture-required']});
 const output='screenshots/little-panth-031';
 await mkdir(output,{recursive:true});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'?test=1');
  await page.waitForFunction(()=>window.lp031Test,undefined,{timeout:45000});
  const state=()=>page.evaluate(()=>window.lp031Test.state());
  const initial=await state();
  assert.equal(initial.clips,15);assert.equal(initial.voicesReady,true);
  assert.ok(initial.scenes.flatMap(s=>s.lines).every(l=>l.aligned));
  assert.equal(initial.playing,true);assert.equal(initial.audioActive,false);
  assert.equal(await page.locator('#movie button').count(),0);
  await page.locator('#movie').click();
  await page.waitForFunction(()=>window.lp031Test.state().audioActive&&window.lp031Test.state().position>450);
  assert.equal(await page.locator('#movie button').count(),0);
  for(const name of ['fox','goat']){
    assert.equal(await page.locator('#'+name).getAttribute('data-rig'),'continuous-curves');
    assert.ok((await page.locator('#'+name+'-body').getAttribute('d')).endsWith('Z'));
  }
  const scenes=initial.scenes;
  const seek=(i,ms)=>page.evaluate(([i,ms])=>window.lp031Test.seek(i,ms),[i,ms]);
  const attr=(id,key)=>page.locator('#'+id).getAttribute('data-'+key);
  const at=(s,id,word)=>{
    const l=scenes[s].lines.find(x=>x.id===id),i=l.reading.words.findIndex(x=>x.replace(/\p{P}/gu,'')===word);
    assert.ok(i>=0,'Missing cue '+word);return l.start+l.reading.timings[i][0];
  };
  for(const key of ['Enter','Space']){
    await seek(1,500);
    await page.locator('#movie').press(key);
    await page.waitForFunction(()=>{const s=window.lp031Test.state();return s.scene===0&&s.playing&&s.audioActive&&s.position>100;});
  }
  await seek(0,100);assert.equal(await attr('stage','view'),'exterior');await page.screenshot({path:output+'/01-exterior.png'});
  await seek(0,scenes[0].duration-80);assert.equal(await attr('stage','view'),'cutaway');
  await seek(1,1400);await page.screenshot({path:output+'/02-fox-in-well.png'});
  await seek(2,at(2,'goat-asks','ਖੂਹ')+70);assert.equal(await attr('goat','speaking'),'true');assert.equal(await attr('stage','view'),'exterior');await page.screenshot({path:output+'/07-goat-speaking.png'});
  await seek(2,at(2,'fox-invites','ਮਿੱਠਾ')+70);assert.equal(await attr('fox','speaking'),'true');assert.equal(await attr('stage','view'),'cutaway');
  await seek(3,at(3,'goat-jumps','ਪੀਤਾ')+350);assert.equal(await attr('goat','location'),'well');await page.screenshot({path:output+'/03-both-in-well.png'});
  await seek(3,at(3,'goat-worries','ਕਿਵੇਂ')+60);assert.equal(await attr('goat','speaking'),'true');await page.screenshot({path:output+'/08-goat-worried.png'});
  await seek(4,at(4,'fox-escapes','ਪਿੱਠ')+530);assert.equal(await attr('stage','view'),'cutaway');await page.screenshot({path:output+'/09-goat-bracing.png'});
  await seek(4,scenes[4].duration-70);assert.equal(await attr('fox','location'),'bank');assert.equal(await attr('stage','view'),'exterior');
  await seek(5,scenes[5].duration-70);assert.equal(await attr('stage','farmer'),'true');assert.equal(await attr('stage','ramp'),'true');
  assert.equal(await page.locator('#farmer[data-studio-preset]').count(),1);await page.screenshot({path:output+'/04-rescue.png'});
  await seek(6,scenes[6].duration-70);assert.equal(await attr('goat','location'),'bank');assert.equal(await attr('stage','view'),'exterior');await page.screenshot({path:output+'/05-finale.png'});
  await page.evaluate(()=>window.lp031Test.play());
  await page.waitForFunction(()=>!window.lp031Test.state().playing);
  const finished=await state();
  assert.equal(finished.scene,6);assert.equal(finished.position,scenes[6].duration);assert.equal(finished.audioActive,false);
  assert.equal(await page.locator('#movie button').count(),0);
  assert.equal(await page.locator('#loading').isVisible(),false);
  await page.locator('#movie').click();
  await page.waitForFunction(()=>{const s=window.lp031Test.state();return s.scene===0&&s.playing&&s.audioActive;});
  await page.setViewportSize({width:393,height:852});await page.emulateMedia({reducedMotion:'reduce'});
  await seek(5,scenes[5].duration-70);assert.equal(await attr('stage','camera-motion'),'static');
  const movie=await page.locator('#movie').boundingBox();assert.ok(movie.width<=394&&movie.height>140);
  await page.screenshot({path:output+'/06-mobile.png'});
  await seek(3,at(3,'goat-worries','ਕਿਵੇਂ')+60);await page.screenshot({path:output+'/10-mobile-goat.png'});
  await page.goto(url+'?review=1&test=1');
  await page.waitForFunction(()=>window.lp031Test,undefined,{timeout:45000});
  assert.equal((await state()).voicesReady,true);
  assert.match(await page.locator('#review-audio').textContent(),/15\/15 voices · 15 aligned/);
  assert.deepEqual(errors,[]);
  console.log('PASS: 15 decoded Gemini recordings, 15 word alignments, picture/keyboard playback, clean ending and picture replay, exterior/cutaway, rescue rig, mobile, reduced motion.');
 }finally{await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
