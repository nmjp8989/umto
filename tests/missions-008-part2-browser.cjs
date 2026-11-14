'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const mime={'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.mp3':'audio/mpeg','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 const route=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const abs=path.resolve(root,'.'+route);
 if(!abs.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 const st=fs.existsSync(abs)?fs.statSync(abs):null;
 const file=st?.isDirectory()?path.join(abs,'index.html'):abs;
 if(!fs.existsSync(file)){res.writeHead(404);return res.end('not found');}
 res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
 fs.createReadStream(file).pipe(res);
});
async function action(page,event){return page.evaluate(async e=>dispatch(e),event);}
async function scene(page,title,obj){
 assert.equal(await page.locator('#location').textContent(),title);
 assert(await page.locator('#props [data-target="'+obj+'"]').count(),'Missing prop '+obj);
 assert(await page.locator('#actor-kabir .actor-sprite svg').count(),'Kabir full-body rig missing in '+title);
 const bbox=await page.locator('#actor-kabir .actor-sprite').boundingBox();
 assert(bbox&&bbox.width>35&&bbox.height>90,'Kabir body incomplete in '+title+': '+JSON.stringify(bbox));
}
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())});
  await page.goto('http://127.0.0.1:'+server.address().port+'/missions/whispering-village-part2.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!document.querySelector('#start').disabled,null,{timeout:35000});
  await scene(page,'Neem Lane · 12:17 AM','kabir');
  await page.locator('#start').click();
  await page.waitForFunction(()=>!document.querySelector('#dialogue').hidden,{},{timeout:10000});
  await page.locator('#skip').click();
  await page.waitForFunction(()=>!document.querySelector('#game').classList.contains('busy'),null,{timeout:17000});
  const before=await page.evaluate(()=>actors.kabir.x);
  await page.locator('#props [data-target="kabir"]').click({force:true});
  await page.waitForFunction(()=>document.querySelector('#subtitle').textContent.includes('I heard three knocks'),null,{timeout:17000});
  const after=await page.evaluate(()=>actors.kabir.x);
  assert(Math.abs(before-after)>12,'Full-body Kabir did not follow Harpreet walking');
  assert(await page.locator('#actor-kabir [data-scene-layer="torso"]').count(),'No animated Kabir torso');
  await action(page,'click:shutter');
  await action(page,'click:cross');await scene(page,'The Empty House','panel');
  await action(page,'click:diagram');
  await action(page,'click:back');await scene(page,'Neem Lane · 12:17 AM','kabir');
  await action(page,'click:yardGate');await scene(page,'Rear Courtyard','tracks');
  await action(page,'click:tracks');await action(page,'click:wire');
  assert(await page.locator('#inventory [data-item="wire"]').count());
  await action(page,'click:back');await action(page,'click:shedPath');
  await scene(page,'The Grain Shed','ledger');
  await action(page,'click:ledger');await action(page,'click:battery');
  assert(await page.locator('#inventory [data-item="battery"]').count());
  await action(page,'click:back');await action(page,'click:cross');
  await page.locator('#inventory [data-item="battery"]').click();
  await page.locator('#props [data-target="panel"]').click({force:true});
  await page.waitForFunction(()=>S.flags.powered,null,{timeout:10000});
  await page.locator('#inventory [data-item="wire"]').click();
  await page.locator('#props [data-target="panel"]').click({force:true});
  await page.waitForFunction(()=>S.flags.wired,null,{timeout:10000});
  await action(page,'click:hatch');await scene(page,'Underfloor Signal Room','switch');
  await action(page,'click:switch');
  assert.equal(await page.locator('#choices button').count(),3);
  await page.locator('#choices button').first().click();
  await page.waitForFunction(()=>document.querySelector('#subtitle').textContent.includes('doesn\'t match'),null,{timeout:10000});
  await page.evaluate(()=>{voice.hidden=true;voice.stop()});
  await page.locator('#choices button').nth(1).click();
  for(const fragment of ["there's someone behind the door","It was the caretaker","We followed footprints","So it wasn't a ghost","One mystery solved"]){
   await page.waitForFunction(part=>document.querySelector('#subtitle').textContent.includes(part),fragment,{timeout:25000});
   await page.locator('#skip').click();
  }
  await page.waitForFunction(()=>document.querySelector('#ending').open,null,{timeout:12000});
  assert(await page.evaluate(()=>S.complete),'Game state did not complete');
  assert(await page.evaluate(()=>!!JSON.parse(localStorage.getItem('umto-whispering-village-part2-v3'))?.state?.complete),'Completion did not persist');
  assert.deepEqual(errors,[],'Browser errors');
  console.log('PASS Part 2 desktop: Kabir full-body walk+talk, five scenes, real inventory clicks, choices, rescue, autosave');
  const mobile=await browser.newPage({viewport:{width:852,height:393},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const e=[];mobile.on('pageerror',err=>e.push(err.message));
  await mobile.goto('http://127.0.0.1:'+server.address().port+'/missions/whispering-village-part2.html',{waitUntil:'domcontentloaded'});
  await mobile.waitForFunction(()=>!document.querySelector('#start').disabled,null,{timeout:35000});
  assert(await mobile.locator('#actor-kabir .actor-sprite svg').count(),'Kabir not visible on mobile');
  assert(await mobile.locator('#opening h1').isVisible());
  assert.deepEqual(e,[]);
  console.log('PASS Part 2 mobile landscape: Kabir rig, opening and scene loaded');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());
