const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const dir = path.join(__dirname,'../little panth/mission-031');
const data=JSON.parse(fs.readFileSync(path.join(dir,'dialogue.json'),'utf8'));
const source=fs.readFileSync(path.join(dir,'stage.js'),'utf8');
const svg=fs.readFileSync(path.join(dir,'art/stage.svg'),'utf8');
const ids=[...svg.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length);
const wordCount=Object.values(data.lines).reduce((n,l)=>n+l.pa.trim().split(/\s+/u).length,0);
assert.ok(wordCount>=170&&wordCount<=200);
const spoken=data.scenes.flatMap(s=>s.lines);
assert.equal(new Set(spoken).size,spoken.length);
assert.deepEqual([...spoken].sort(),Object.keys(data.lines).sort());
const node=()=>({attrs:{},dataset:{},setAttribute(k,v){this.attrs[k]=String(v);}});
const parts=ids.map(id=>Object.assign(node(),{id}));
const goat=parts.find(n=>n.id==='goat');
goat.querySelectorAll=()=>Array.from({length:4},node);
goat.querySelector=()=>node();
let reduced=false;
const fakeSvg={dataset:{},querySelectorAll:()=>parts};
const window={matchMedia:()=>({get matches(){return reduced;}}),UmtoCamera:{DeliveryCamera:class{cue(s){assert.ok(s.focus.x>=0&&s.focus.y>=0)}}}};
vm.runInNewContext(source,{window});
const {Stage,eventsFor}=window.LittlePanthStage;
const stage=new Stage(fakeSvg);
for(const s of data.scenes){
 let start=320;
 const lines=s.lines.map(id=>{const l=data.lines[id],words=l.pa.trim().split(/\s+/u),timings=words.map((_,i)=>[i*455,(i+1)*455]),duration=words.length*455;
 const record={id,...l,start,end:start+duration,duration,reading:{words,timings}};start=record.end+185;return record;});
 const scene={...s,lines,duration:start+1000};
 assert.ok(eventsFor(scene).every(e=>Number.isFinite(e.ms)&&e.ms>=0&&e.ms<=scene.duration));
 for(const mode of [false,true]){
  reduced=mode;stage.select(scene);
  for(let ms=0;ms<=scene.duration;ms+=77){
   const line=lines.findLast(l=>l.start<=ms)||lines[0];
   const word=line.reading.timings.findIndex(([a,b])=>ms-line.start>=a&&ms-line.start<b);
   stage.draw(ms,line,word);
   assert.ok(parts.every(n=>Object.values(n.attrs).every(a=>!a.includes('NaN')&&!a.includes('Infinity'))));
  }
 }
}
console.log('PASS Mission 31: '+wordCount+' words, '+spoken.length+' lines, '+data.scenes.length+' scenes; deterministic stage frames and reduced motion.');
