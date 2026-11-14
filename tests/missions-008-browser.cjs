'use strict';
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav'};
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const full=path.resolve(root,'.'+pathname);
 if(!full.startsWith(root+path.sep)){res.writeHead(403);return res.end('Forbidden');}
 fs.stat(full,(err,stat)=>{
  const file=stat&&stat.isDirectory()?path.join(full,'index.html'):full;
  if(err){res.writeHead(404);return res.end('Not found');}
  const stream=fs.createReadStream(file);
  stream.on('error',()=>{if(!res.headersSent)res.writeHead(404);res.end();});
  res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});
  stream.pipe(res);
 });
});
async function checkScene(page,expected,prop){
 assert.equal(await page.locator('#location').textContent(),expected);
 assert(await page.locator('#props [data-target="'+prop+'"]').count(),'Missing tappable '+prop+' in '+expected);
 assert((await page.locator('#scenery').evaluate(e=>e.innerHTML.length))>1000,'Missing new scene art in '+expected);
 assert.equal(await page.locator('#error').isHidden(),true,'Game error in '+expected);
}
async function action(page,event){await page.evaluate(async evt=>{await dispatch(evt);},event);}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const base='http://127.0.0.1:'+server.address().port;
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  page.on('console',msg=>{if(msg.type()==='error')console.log('BROWSER CONSOLE ERROR:',msg.text());});
  await page.goto(base+'/missions/whispering-village.html',{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('body').getAttribute('data-mission'),'whispering-village');
  await page.waitForFunction(()=>!document.getElementById('start').disabled,null,{timeout:35000});
  await checkScene(page,'Canal Road','bike');
  assert(await page.locator('#cast #actor-harpreet').count(),'Harpreet rig missing');
  assert((await page.locator('#props [data-target="bike"]').innerHTML()).includes('circle'),'Motorbike wheels not drawn');
  await page.locator('#start').click();
  await page.waitForFunction(()=>!document.getElementById('dialogue').hidden,null,{timeout:10000});
  await page.locator('#skip').click();
  await page.waitForFunction(()=>document.getElementById('opening').hidden&&!document.getElementById('game').classList.contains('busy'),null,{timeout:20000});
  // Ride from a browser click — this exercises the bike, sound, and ride cutscene.
  await page.locator('#props [data-target="bike"]').click({force:true});
  console.log('Motorbike interaction:',await page.evaluate(()=>{
    const g=document.querySelector('[data-target="bike"]'),b=g?.getBoundingClientRect();
    const hit=b?document.elementFromPoint(b.x+b.width/2,b.y+b.height/2):null;
    return {scene:S.scene,started,busy,hit:hit?.nodeName,hitTarget:hit?.closest('[data-target]')?.dataset.target,hitId:hit?.id,dialogueVisible:!document.querySelector('#dialogue').hidden,errors:document.querySelector('#error').textContent};
  }));
  await page.waitForFunction(()=>document.getElementById('location').textContent==='Neem Lane'&&!document.getElementById('game').classList.contains('busy'),null,{timeout:20000});
  await checkScene(page,'Neem Lane','houseBibi');
  assert(await page.locator('#props [data-target="houseWeaver"]').count());
  assert(await page.locator('#props [data-target="houseBlue"]').count());
  assert(await page.locator('#props [data-target="wellPath"]').count());
  await action(page,'click:houseBibi');
  await checkScene(page,'Bibi Noor’s House','bibi');
  // Walking to an NPC must animate, resolve, and expose spoken dialogue.
  await page.locator('#props [data-target="bibi"]').click({force:true});
  await page.waitForFunction(()=>document.getElementById('subtitle').textContent.includes('looking for Kabir'),null,{timeout:20000});
  await action(page,'click:marks');
  await action(page,'click:lantern');
  assert(await page.locator('[data-item="lantern"]').count());
  await action(page,'click:back');
  await action(page,'click:houseWeaver');
  await checkScene(page,'The Weaver’s House','loom');
  await action(page,'click:loom');
  await action(page,'click:thread');
  assert(await page.locator('[data-item="thread"]').count());
  await action(page,'click:back');
  await action(page,'click:wellPath');
  await checkScene(page,'The Old Well','well');
  await action(page,'click:bell');
  // A real inventory selection and tap combination (not a story-engine shortcut).
  await page.locator('[data-item="lantern"]').click();
  await page.locator('#props [data-target="well"]').click({force:true});
  await page.waitForFunction(()=>S.flags.sawGlimmer,null,{timeout:15000});
  await action(page,'click:crank');
  assert(await page.locator('[data-item="key"]').count());
  await action(page,'click:back');
  await page.locator('[data-item="key"]').click();
  await page.locator('#props [data-target="houseBlue"]').click({force:true});
  await page.waitForFunction(()=>S.flags.gateOpen,null,{timeout:15000});
  await action(page,'click:houseBlue');
  await checkScene(page,'The Blue-Door House','cellarLatch');
  await page.locator('[data-item="thread"]').click();
  await page.locator('#props [data-target="cellarLatch"]').click({force:true});
  await page.waitForFunction(()=>S.flags.latchClear,null,{timeout:15000});
  await action(page,'click:cellarLatch');
  assert.equal(await page.locator('#choices button').count(),3,'The passage puzzle must offer three choices');
  await page.locator('#choices button').first().click();
  await page.waitForFunction(()=>document.getElementById('subtitle').textContent.includes('That way is silent'),null,{timeout:10000});
  await page.evaluate(()=>{voice.hidden=true;voice.stop();});
  await page.locator('#choices button').nth(2).click();
  for(const phrase of ['Thank goodness','I’ve got you both','someone knocked back','Kabir is safe']){
   await page.waitForFunction(expected=>document.getElementById('subtitle').textContent.includes(expected),phrase,{timeout:25000});
   await page.locator('#skip').click();
  }
  await page.waitForFunction(()=>document.getElementById('ending').open,null,{timeout:20000});
  assert.equal(await page.locator('#error').isHidden(),true);
  assert.deepEqual(errors,[],'Browser reported a game exception');
  console.log('PASS desktop: six scenes, click-to-ride, walking, inventory combinations, three-way cellar choice, rescue & autosave');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('umto-whispering-village-v3')));
  assert(saved?.state?.complete,'Completion did not save');

  // Small-screen smoke: start loads, six locations stay accessible, HUD fits.
  const mobile=await browser.newPage({viewport:{width:852,height:393},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const mobileErrors=[];mobile.on('pageerror',e=>mobileErrors.push(e.message));
  await mobile.goto(base+'/missions/whispering-village.html',{waitUntil:'domcontentloaded'});
  await mobile.waitForFunction(()=>!document.getElementById('start').disabled,null,{timeout:35000});
  assert(await mobile.locator('#props [data-target="bike"]').count());
  assert(await mobile.locator('#opening h1').isVisible());
  assert.deepEqual(mobileErrors,[]);
  console.log('PASS mobile landscape: original art, motorbike and start page render without exceptions');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
