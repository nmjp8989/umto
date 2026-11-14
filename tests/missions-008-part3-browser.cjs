const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
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

(async()=>{
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage']});
try{
for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
const p=await browser.newPage({viewport,hasTouch:viewport.width<500});
const errors=[];
p.on('pageerror',e=>errors.push(e.message));
p.on('response',r=>{if(r.status()>=400&&!/[\/]audio[\/]whispering-village-part3\.json\?|favicon/.test(r.url()))errors.push(r.status()+' '+r.url())});
const url='http://127.0.0.1:'+server.address().port+'/missions/whispering-village-part3.html';
await p.goto(url);
await p.locator('#start:not([disabled])').waitFor();
const rig=async id=>assert(await p.locator('#actor-'+id+' [data-rig-arm]').count(),id+' rig is missing');
await rig('baldev');await rig('kabir');
await p.locator('#start').click();
const skip=async text=>{await p.waitForFunction(t=>document.querySelector('#subtitle').textContent.includes(t), text);await p.locator('#skip').click()};
await skip('clock just sneezed');await skip('Baldev is safe');
await p.waitForFunction(()=>!document.querySelector('#game').classList.contains('busy'));
const act=async id=>{await p.locator('[data-target="'+id+'"]').first().click();await p.waitForFunction(()=>!document.querySelector('#game').classList.contains('busy'));};
await act('baldev');await skip('blue drum');
await act('print');await skip('star pressed');
await act('cross');
await rig('meher');await rig('rohan');await rig('kabir');
await act('cabin');await skip('Meher saw the shadow');
await act('meher');await skip('monster with wings');
await act('rohan');await skip('whipped right into the crack');
await act('cabin');
assert.equal(await p.locator('#location').textContent(),'Village Clock Tower');
await p.reload();
await p.locator('#start:not([disabled])').waitFor();
assert.match(await p.locator('#start').textContent(),/Continue mission/);
await p.locator('#start').click();await skip('pick up');
await act('bell');await skip('Achoo');
await act('reel');await skip('My reel');
await act('crate');await skip('Blue paint');
await act('solve');
await p.getByRole('button',{name:'Inside the dusty bell'}).click();
await p.getByRole('button',{name:'Try again'}).click();
await p.getByRole('button',{name:'Behind the kite reel'}).click();
await p.getByRole('button',{name:'Try again'}).click();
await p.getByRole('button',{name:'Inside the blue drum'}).click();
await p.getByRole('button',{name:'A monster pulled the latch'}).click();
await p.getByRole('button',{name:'Try again'}).click();
await p.getByRole('button',{name:'The wind tugged the kite string'}).click();
await skip('Village register, found');
await skip('wind yanked');
await skip('a tissue');
await skip('very small umbrella');
await p.locator('#ending[open]').waitFor();
assert.match(await p.locator('#tradeStat').textContent(),/Register recovered/);
assert.deepEqual(errors,[]);
console.log('Completed at '+viewport.width+'×'+viewport.height+' with actual scene clicks, both wrong answers, saved progress, and full-body library rigs');
await p.close();
}
}finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
