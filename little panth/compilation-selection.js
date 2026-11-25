(() => {
'use strict';
const $=id=>document.getElementById(id),store=window.LPProduction,picks=[...document.querySelectorAll('.episode-pick')],toggle=$('select-all-toggle'),button=$('export-video'),name=$('compilation-name');
if(!picks.length)return;
const key='little-panth-compilation-selection',nameKey=key+'-name';
let loaded=false,storageOK=true;
try{const saved=new Set(JSON.parse(sessionStorage.getItem(key)||'[]'));for(const p of picks)p.checked=saved.has(p.value);name.value=sessionStorage.getItem(nameKey)||'';}catch{}
const row=p=>p.closest('tr'),selected=()=>picks.filter(p=>p.checked&&!p.disabled),approved=()=>picks.filter(p=>store.review(p.value).approved);
function duration(seconds){return Math.floor(seconds/60)+'m '+String(seconds%60).padStart(2,'0')+'s';}
function historyLink(e){const node=document.createElement(e.kind==='github'&&/^\d+$/.test(String(e.runId))?'a':'span');node.textContent=e.filename;if(node.tagName==='A'){node.href='https://github.com/nmjp8989/umto/actions/runs/'+e.runId;node.target='_blank';node.rel='noopener';}return node;}
function paintHistory(){for(const p of picks){const cell=row(p).querySelector('.exported-in'),records=store.exportedIn(p.value);cell.replaceChildren();if(!records.length){cell.textContent='—';continue;}for(const e of records){cell.append(historyLink(e));const note=document.createElement('small');note.textContent=e.kind==='github'?'MP4 render':'Browser recording';cell.append(note);}}
const records=store.exports();$('history-count').textContent='('+records.length+')';$('history-list').replaceChildren(...records.map(e=>{const li=document.createElement('li');li.append(historyLink(e),document.createTextNode(' · '+e.episodes.length+' stories · '+duration(e.seconds||0)+' · '+String(e.createdAt).slice(0,10)));return li;}));if(!records.length){const li=document.createElement('li');li.textContent='No official compilations yet.';$('history-list').append(li);}}
function refresh(){
 for(const p of picks){const v=store.review(p.value),r=row(p),check=r.querySelector('.review-check'),approval=r.querySelector('.approve-check');check.checked=v.checked;check.disabled=!loaded;approval.checked=v.approved;approval.disabled=!loaded||!v.checked;p.disabled=!loaded||!v.approved;if(p.disabled)p.checked=false;r.querySelector('.status-note').textContent=v.approved?'Approved':v.checked?'Awaiting approval':'To review';}
 const chosen=selected(),eligible=approved(),seconds=chosen.reduce((s,p)=>s+Number(row(p).dataset.seconds||0),0),label=chosen.length+' episode'+(chosen.length===1?'':'s')+' selected · '+duration(seconds),clean=store.normalize(name.value),duplicate=clean&&store.usedName(clean);
 name.setCustomValidity(name.value&&!store.validName(clean)?'Use letters, numbers, hyphens or underscores.':duplicate?'This filename is already in the history.':'');
 $('selection-top').textContent=label;$('selection-bottom').textContent=label;button.disabled=!loaded||!chosen.length||!store.validName(clean)||duplicate;toggle.disabled=!eligible.length;toggle.checked=eligible.length>0&&chosen.length===eligible.length;toggle.indeterminate=chosen.length>0&&chosen.length<eligible.length;
 const checked=picks.filter(p=>store.review(p.value).checked).length,unused=eligible.filter(p=>!store.exportedIn(p.value).length);
 $('review-totals').textContent=checked+' checked · '+eligible.length+' approved · '+unused.length+' approved and unused · '+(picks.length-checked)+' to review';
 $('tracker-state').textContent=(store.online()?'Repository history loaded. ':'Using saved local history. ')+(store.pending()?store.pending()+' unsynced change(s) saved in this browser. Save to GitHub for shared persistence.':'No unsynced changes.')+(!storageOK?' Local storage unavailable: save before leaving.':'');
 $('sync-tracker').disabled=!loaded||!store.pending();
 try{sessionStorage.setItem(key,JSON.stringify(chosen.map(p=>p.value)));sessionStorage.setItem(nameKey,name.value);}catch{}
 paintHistory();
}
function set(predicate){for(const p of picks)p.checked=!p.disabled&&predicate(p);refresh();}
for(const p of picks){const r=row(p);r.querySelector('.review-check').onchange=e=>{const old=store.review(p.value);storageOK=store.setReview(p.value,e.target.checked,e.target.checked&&old.approved);refresh();};r.querySelector('.approve-check').onchange=e=>{if(!store.review(p.value).checked)return;storageOK=store.setReview(p.value,true,e.target.checked);refresh();};p.addEventListener('change',refresh);}
$('select-all').onclick=()=>set(()=>true);$('select-aesop').onclick=()=>set(p=>row(p).dataset.source.startsWith('Aesop'));$('select-unused').onclick=()=>set(p=>row(p).dataset.source.startsWith('Aesop')&&!store.exportedIn(p.value).length);$('select-none').onclick=()=>set(()=>false);toggle.onchange=()=>set(()=>toggle.checked);name.oninput=refresh;
button.onclick=()=>{const ids=selected().map(p=>p.value),clean=store.normalize(name.value);if(ids.length&&!button.disabled)location.href='compilation.html?episodes='+encodeURIComponent(ids.join(','))+'&name='+encodeURIComponent(clean);};
$('sync-tracker').onclick=()=>{$('sync-request').value=JSON.stringify(store.request('save'));$('sync-panel').hidden=false;$('sync-request').focus();$('sync-request').select();};
$('copy-tracker').onclick=async()=>{$('sync-request').value=JSON.stringify(store.request('save'));$('sync-request').focus();$('sync-request').select();try{await navigator.clipboard.writeText($('sync-request').value);$('tracker-state').textContent='Save request copied. Paste it into the GitHub workflow request field.';}catch{$('tracker-state').textContent='Copy the selected request manually.';}};
$('refresh-tracker').onclick=async()=>{await store.load();refresh();};window.addEventListener('pageshow',async e=>{if(e.persisted){await store.load();refresh();}});
(async()=>{await store.load();loaded=true;refresh();})();
})();