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
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  const base='http://127.0.0.1:'+server.address().port;
  await page.goto(base+'/missions/empty-carriage.html',{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('body').getAttribute('data-mission'),'empty-carriage');
  await page.waitForFunction(()=>!document.getElementById('start').disabled,null,{timeout:35000});
  assert.equal(await page.locator('#location').textContent(),'North Bridge Station');
  assert(await page.locator('#props [data-target="notice"]').count(),'Arrival board should be clickable');
  assert(await page.locator('#cast #actor-harpreet').count(),'Character rig should render the detective');
  assert(await page.locator('#scenery').evaluate(e=>e.innerHTML.includes('NORTH BRIDGE')),'New artwork did not load');
  await page.locator('#start').click();
  await page.waitForFunction(()=>document.getElementById('opening').hidden&&!document.getElementById('game').classList.contains('busy'),null,{timeout:50000});
  await page.locator('#props [data-target="notice"]').click({force:true});
  await page.waitForFunction(()=>document.getElementById('subtitle').textContent.includes('after-hours board lists three doors'),null,{timeout:25000});
  assert.equal(await page.locator('#error').isHidden(),true,'Game raised an in-page error');
  assert.deepEqual(errors,[],'Uncaught browser errors');
  console.log('PASS Mission 007 browser: page loads, SVG art + character rig render, start works, board clue is interactive');
 } finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
