// Stream a single MP4 from the GitHub artifact ZIP, without buffering the video.
// Range requests read only the ZIP metadata and the selected entry. Supports
// stored and raw-deflate entries, including ZIP64 size and offset fields.
const EOCD=0x06054b50, LOCATOR=0x07064b50, ZIP64=0x06064b50, CENTRAL=0x02014b50, LOCAL=0x04034b50;
const MAX32=0xffffffff, MAX16=0xffff, MAX_DIRECTORY=4*1024*1024;
const decoder=new TextDecoder('utf-8',{fatal:true});
const view=bytes=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
const u16=(d,p)=>d.getUint16(p,true);
const u32=(d,p)=>d.getUint32(p,true);
function u64(d,p){const n=d.getBigUint64(p,true);if(n>BigInt(Number.MAX_SAFE_INTEGER))throw Error('ZIP64 size exceeds supported range');return Number(n);}
function requireSafe(n){if(!Number.isSafeInteger(n)||n<0)throw Error('Invalid ZIP offset');return n;}
async function rejectBody(r){try{await r.body?.cancel();}catch{}}
async function rangeResponse(fetcher,range){
 const r=await fetcher(range);
 const match=(r.headers.get('Content-Range')||'').match(/^bytes (\d+)-(\d+)\/(\d+)$/);
 if(r.status!==206||!match||!r.body){await rejectBody(r);throw Error('Artifact storage did not supply byte ranges');}
 const [first,last,total]=match.slice(1).map(Number);
 if(![first,last,total].every(Number.isSafeInteger)||first<0||last<first||last>=total){await rejectBody(r);throw Error('Invalid artifact byte range');}
 return {response:r,first,last,total};
}
async function readRange(fetcher,start,end,total){
 requireSafe(start);requireSafe(end);
 if(end<start||end-start+1>MAX_DIRECTORY||end>=total)throw Error('ZIP metadata range is invalid');
 const r=await rangeResponse(fetcher,'bytes='+start+'-'+end);
 if(r.first!==start||r.last!==end||r.total!==total){await rejectBody(r.response);throw Error('Artifact range mismatch');}
 const bytes=new Uint8Array(await r.response.arrayBuffer());
 if(bytes.length!==end-start+1)throw Error('Incomplete ZIP metadata');
 return bytes;
}
function zip64Extra(d,start,length,fields){
 let p=start;const end=start+length;
 while(p+4<=end){
  const tag=u16(d,p),n=u16(d,p+2);p+=4;
  if(p+n>end)throw Error('Invalid ZIP extra field');
  if(tag===1){
   let i=p;for(const key of ['size','compressed','offset'])if(fields[key]===MAX32){if(i+8>p+n)throw Error('Missing ZIP64 field');fields[key]=u64(d,i);i+=8;}
   return fields;
  }
  p+=n;
 }
 if(Object.values(fields).includes(MAX32))throw Error('Missing ZIP64 metadata');
 return fields;
}
export async function openVideo(fetcher,filename){
 if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}\.mp4$/.test(filename))throw Error('Invalid video filename');
 const tail=await rangeResponse(fetcher,'bytes=-65557');
 if(tail.last!==tail.total-1||tail.last-tail.first+1>65557){await rejectBody(tail.response);throw Error('Invalid ZIP tail');}
 const bytes=new Uint8Array(await tail.response.arrayBuffer()),d=view(bytes);
 if(bytes.length!==tail.last-tail.first+1)throw Error('Incomplete ZIP tail');
 let e=-1;
 for(let p=bytes.length-22;p>=0;p--)if(u32(d,p)===EOCD&&p+22+u16(d,p+20)===bytes.length){e=p;break;}
 if(e<0)throw Error('ZIP directory not found');
 if(u16(d,e+4)!==0||u16(d,e+6)!==0)throw Error('Multi-disk ZIP is not supported');
 let count=u16(d,e+10),size=u32(d,e+12),offset=u32(d,e+16);
 const eocdOffset=tail.first+e;
 if(count===MAX16||size===MAX32||offset===MAX32){
  const locator=view(await readRange(fetcher,eocdOffset-20,eocdOffset-1,tail.total));
  if(u32(locator,0)!==LOCATOR||u32(locator,4)!==0||u32(locator,16)!==1)throw Error('Invalid ZIP64 locator');
  const z=u64(locator,8);
  const record=view(await readRange(fetcher,z,z+55,tail.total));
  if(u32(record,0)!==ZIP64||u32(record,16)!==0||u32(record,20)!==0)throw Error('Invalid ZIP64 directory');
  count=u64(record,32);size=u64(record,40);offset=u64(record,48);
 }
 if(count<1||count>10000||size<46||size>MAX_DIRECTORY||offset+size>eocdOffset)throw Error('Unexpected ZIP directory size');
 const dir=await readRange(fetcher,offset,offset+size-1,tail.total),cd=view(dir);
 let found=null,p=0;
 for(let i=0;i<count;i++){
  if(p+46>dir.length||u32(cd,p)!==CENTRAL)throw Error('Invalid ZIP central directory');
  const flags=u16(cd,p+8),method=u16(cd,p+10);
  const nameLength=u16(cd,p+28),extraLength=u16(cd,p+30),commentLength=u16(cd,p+32),end=p+46+nameLength+extraLength+commentLength;
  if(end>dir.length)throw Error('Incomplete ZIP entry');
  const nameBytes=dir.subarray(p+46,p+46+nameLength);
  // Only the exact root-level video filename is allowed, never an arbitrary ZIP path.
  if(nameBytes.length===filename.length&&nameBytes.every((v,j)=>v===filename.charCodeAt(j))){
   if(found||flags&1||![0,8].includes(method))throw Error('Unsupported or duplicate video ZIP entry');
   if(u16(cd,p+34)!==0)throw Error('Multi-disk video is not supported');
   const fields=zip64Extra(cd,p+46+nameLength,extraLength,{size:u32(cd,p+24),compressed:u32(cd,p+20),offset:u32(cd,p+42)});
   found={...fields,method};
  }
  p=end;
 }
 if(!found||found.size<1||found.compressed<1||found.offset+30>offset)throw Error('Video not found in artifact');
 if(found.method===0&&found.compressed!==found.size)throw Error('Stored ZIP size mismatch');
 const local=view(await readRange(fetcher,found.offset,found.offset+29,tail.total));
 if(u32(local,0)!==LOCAL||u16(local,6)&1||u16(local,8)!==found.method)throw Error('Invalid video local header');
 const n=u16(local,26),extra=u16(local,28),start=found.offset+30+n+extra,end=start+found.compressed-1;
 if(n<1||n>1024||end>=offset)throw Error('Video ZIP range is invalid');
 const localName=decoder.decode(await readRange(fetcher,found.offset+30,found.offset+30+n-1,tail.total));
 if(localName!==filename)throw Error('Video ZIP name mismatch');
 const data=await rangeResponse(fetcher,'bytes='+start+'-'+end);
 if(data.first!==start||data.last!==end||data.total!==tail.total){await rejectBody(data.response);throw Error('Video data range mismatch');}
 let body=data.response.body;
 if(found.method===8)body=body.pipeThrough(new DecompressionStream('deflate-raw'));
 return {body,size:found.size};
}
