/* A small, non-interactive Little Panth logo for rendered stories only. */
(() => {
'use strict';
const url=new URL('little-panth-logo.svg?v=2',document.currentScript.src);
let source;
function transparentLogo(){
 if(!source)source=fetch(url).then(async response=>{
  if(!response.ok)throw Error('Could not load Little Panth watermark.');
  const svg=new DOMParser().parseFromString(await response.text(),'image/svg+xml');
  if(svg.querySelector('parsererror')||svg.documentElement.localName!=='svg')throw Error('Invalid Little Panth watermark.');
  // Remove only the source logo's full-canvas white background. Preserve all
  // supplied vector paths, gradients, highlights, outlines and characters.
  for(const child of [...svg.documentElement.children]){
   if(child.localName==='rect'&&child.getAttribute('width')==='100%'&&child.getAttribute('height')==='100%'&&/^#ffffff$/i.test(child.getAttribute('fill')||''))child.remove();
  }
  return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg.documentElement));
 }).catch(error=>{source=null;throw error;});
 return source;
}
const css=String.raw`
#lp-video-watermark{position:fixed!important;inset:auto!important;top:2.1vh!important;right:1.6vw!important;width:11vw!important;height:auto!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;background:transparent!important;display:block!important;opacity:.88!important;pointer-events:none!important;user-select:none!important;z-index:2147483000!important;}
body:has(.book[data-layout="cinema"][data-caption="top"]) #lp-video-watermark{top:auto!important;bottom:2.1vh!important;}
`;
async function install(doc=document){
 let img=doc.getElementById('lp-video-watermark');
 if(img){await img.decode();return img;}
 const src=await transparentLogo();
 if(!doc.body)throw Error('Story is not ready for the render watermark.');
 // Check again after the async fetch so duplicate calls cannot mount twice.
 img=doc.getElementById('lp-video-watermark');
 if(!img){
  const style=doc.createElement('style');style.id='lp-video-watermark-style';style.textContent=css;doc.head.append(style);
  img=doc.createElement('img');img.id='lp-video-watermark';img.alt='';img.setAttribute('aria-hidden','true');img.draggable=false;img.src=src;doc.body.append(img);
 }
 await img.decode();return img;
}
window.LPWatermark={install};
})();
