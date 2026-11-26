/* Little Panth: shared, deterministic SVG animation for web and MP4 rendering. */
(() => {
'use strict';
const NS='http://www.w3.org/2000/svg';
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const back=x=>{x=clamp(x)-1;return 1+2.25*x*x*x+1.25*x*x;};
const num=x=>Math.abs(x)<.00005?'0':Number(x.toFixed(4)).toString();
const group=(key,body)=>`<g data-motion="${key}">${body}</g>`;
const use=(id,attrs='')=>`<use href="#${id}" xlink:href="#${id}" ${attrs}/>`;
const shapes=s=>s.match(/<(?:path|circle)\b[^>]*\/>/g)||[];
const capture=(s,re,label)=>{const m=s.match(re);if(!m)throw Error('Little Panth logo: missing '+label);return m[1];};
const definition=(s,id)=>capture(s,new RegExp('<g id="'+id+'">([\\s\\S]*?)<\\/g>'),id);
const centres=[107,166,216,280,345,403,492,578,671,744,822];
function build(svg){
 const defs=capture(svg,/<defs>([\s\S]*?)<\/defs>/,'definitions');
 const little=shapes(definition(defs,'word-little')),panth=shapes(definition(defs,'word-panth')),rays=shapes(definition(defs,'sparkle-rays'));
 const gloss=shapes(capture(svg,/<g fill="none" stroke="#FFFFFF" stroke-width="4\.5"[^>]*>([\s\S]*?)<\/g>/,'letter highlights'));
 const glints=shapes(capture(svg,/<g fill="none" stroke="#FFF4B8"[^>]*>([\s\S]*?)<\/g>/,'ray highlights'));
 if(little.length!==7||panth.length!==5||rays.length!==3||gloss.length!==9||glints.length!==3)throw Error('Unexpected logo path counts; update animation mapping.');
 const letters=[little[0],little[1]+little[2],...little.slice(3),...panth];
 const kids=[216,280].map(x=>{
  const tr='translate\\('+x+', 145\\) scale\\(0\\.55\\)';
  const part=(where,attrs,label)=>capture(where,new RegExp('(<g transform="'+tr+'" '+attrs+'[^>]*>[\\s\\S]*?<\\/g>)'),label);
  return {outline:part(defs,'stroke-width="32"','kid silhouette'),face:part(svg,'stroke="#24171A"','kid artwork')};
 });
 const letterDefs=letters.map((s,i)=>`<g id="lp-letter-${i}">${s}</g>`).join('');
 const rayDefs=rays.map((s,i)=>`<g id="lp-ray-${i}">${s}</g>`).join('');
 const letterLayer=attrs=>letters.map((_,i)=>group('l'+i,use('lp-letter-'+i,typeof attrs==='function'?attrs(i):attrs))).join('');
 const rayLayer=attrs=>rays.map((_,i)=>group('r'+i,use('lp-ray-'+i,attrs))).join('');
 const kidLayer=part=>kids.map((k,i)=>group('l'+(i+2),group('k'+i,k[part]))).join('');
 const outline=`<g filter="url(#stickerShadow)"><g fill="#FFFFFF" stroke="#FFFFFF" stroke-width="18" stroke-linejoin="round" stroke-linecap="round">${kidLayer('outline')}${letterLayer('')}${group('s',use('swoosh-shape','stroke-width="12"'))}${rayLayer('stroke-width="12"')}</g></g>`;
 const ink=letterLayer(i=>`fill="url(#${i<6?'orangeGrad':'blueGrad'})"`);
 const highlightIndices=[0,1,4,5,6,7,8,9,10];
 const highlights=`<g fill="none" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round" opacity="0.85">${gloss.map((s,i)=>group('l'+highlightIndices[i],s)).join('')}</g>`;
 const gold=group('s',use('swoosh-shape','fill="url(#goldGrad)"'))+rayLayer('fill="url(#goldGrad)"')+`<g fill="none" stroke="#FFF4B8" stroke-width="2.5" stroke-linecap="round" opacity="0.85">${glints.map((s,i)=>group('r'+i,s)).join('')}</g>`;
 // Keep the exact source path data, gradients, outlines, highlights and layer order.
 // The 928 x 360 supplied artwork is centred in a white 16:9 video scene.
 return `<svg xmlns="${NS}" xmlns:xlink="http://www.w3.org/1999/xlink" width="1920" height="1080" viewBox="0 0 928 522" role="img" aria-label="Little Panth"><defs>${defs}${letterDefs}${rayDefs}</defs><rect width="928" height="522" fill="white"/><g transform="translate(0 81)">${group('all',outline+ink+highlights+gold+kidLayer('face'))}</g></svg>`;
}
function transform(x,y,dx=0,dy=0,sx=1,sy=sx,angle=0){
 if(dx===0&&dy===0&&sx===1&&sy===1&&angle===0)return '';
 return `translate(${num(dx)} ${num(dy)}) translate(${x} ${y}) rotate(${num(angle)}) scale(${num(sx)} ${num(sy)}) translate(${-x} ${-y})`;
}
// Clock time is separate from pose progress: animate, hold, then fade.
function timing(intro){return intro?{duration:4.5,animation:2.15,fade:.5,voiceAt:1.35}:{duration:3,animation:1.25,fade:.4,voiceAt:.82};}
function progressAt(seconds,intro){
 const t=timing(intro),s=Math.max(0,seconds),fadeStart=intro?.86:.80;
 if(s<t.animation)return .78*s/t.animation;
 if(s<=t.duration-t.fade)return .78;
 return fadeStart+(1-fadeStart)*clamp((s-(t.duration-t.fade))/t.fade);
}
function poses(progress,intro,hold=false){
 const p=clamp(progress),out={};
 // Finish all individual movement before the final hold. Only actual video
 // bumpers fade out; the standalone preview stays at the fully settled pose.
 const fadeStart=intro ? .86 : .80;
 out.all={transform:'',opacity:hold?1:1-smooth((p-fadeStart)/(1-fadeStart))};
 centres.forEach((x,i)=>{
  const u=clamp((p-(.015+i*(intro?.027:.021)))/(intro?.205:.235)),v=back(u),s=.57+.43*v;
  out['l'+i]={transform:transform(x,267,(i%2?-1:1)*8*(1-v),58*(1-v),s,s,(i%2?-6:6)*(1-v)),opacity:smooth(u/.24)};
 });
 [216,280].forEach((x,i)=>{
  const u=clamp((p-(intro?.20+i*.06:.19+i*.045))/(intro?.25:.23)),v=back(u),s=.45+.55*v;
  const g=clamp((p-.50)/.23),nod=intro&&g>0&&g<1?Math.sin(2*Math.PI*g)*Math.sin(Math.PI*g)*(i?5:-5):0;
  out['k'+i]={transform:transform(x,161,0,-36*(1-v)-Math.abs(nod)*.6,s,s,(i?10:-10)*(1-v)+nod),opacity:smooth(u/.26)};
 });
 const s=smooth((p-(intro?.33:.31))/(intro?.24:.25));
 out.s={transform:transform(168,312,0,0,.05+.95*s,.7+.3*s),opacity:smooth(s/.25)};
 [[789,112],[811,111],[829,124]].forEach(([x,y],i)=>{
  const u=clamp((p-(intro?.46+i*.035:.40+i*.045))/(intro?.18:.19)),v=back(u);
  out['r'+i]={transform:transform(x,y,0,-10*(1-v),.25+.75*v,.25+.75*v,(i-1)*9*(1-v)),opacity:smooth(u/.26)};
 });
 return out;
}
function frame(template,progress,intro,hold=false){
 const pose=poses(progress,intro,hold);
 return template.replace(/data-motion="([a-z0-9]+)"/g,(_,id)=>`transform="${pose[id].transform}" opacity="${num(pose[id].opacity)}"`);
}
function mount(parent,template){
 parent.innerHTML=template;
 const svg=parent.querySelector('svg');svg.style.cssText='display:block;width:100%;height:100%';
 const elements=[...svg.querySelectorAll('[data-motion]')].map(node=>[node,node.getAttribute('data-motion')]);
 return (progress,intro,hold=false)=>{const state=poses(progress,intro,hold);for(const [node,key] of elements){const v=state[key];node.setAttribute('transform',v.transform);node.setAttribute('opacity',num(v.opacity));}};
}
globalThis.LPLogoMotion={build,poses,frame,mount,timing,progressAt};
})();
