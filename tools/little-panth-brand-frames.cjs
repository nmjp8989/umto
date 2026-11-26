#!/usr/bin/env node
// Generate deterministic SVG frames for the exact same animation used in the browser.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const [logo,out,countRaw,kind,motion]=process.argv.slice(2);
const count=Number(countRaw);
if(!Number.isInteger(count)||count<2||!['intro','transition'].includes(kind))throw Error('Invalid bumper frame request');
const sandbox={};vm.runInNewContext(fs.readFileSync(motion,'utf8'),sandbox);
const api=sandbox.LPLogoMotion,template=api.build(fs.readFileSync(logo,'utf8'));
fs.mkdirSync(out,{recursive:true});
for(let i=0;i<count;i++)fs.writeFileSync(path.join(out,'frame-'+String(i).padStart(3,'0')+'.svg'),api.frame(template,i/(count-1),kind==='intro'));
