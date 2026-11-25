(() => {
'use strict';
const picks=[...document.querySelectorAll('.episode-pick')],toggle=document.getElementById('select-all-toggle'),button=document.getElementById('export-video');
if(!picks.length)return;
const key='little-panth-compilation-selection';
try{const saved=new Set(JSON.parse(sessionStorage.getItem(key)||'[]'));for(const p of picks)p.checked=saved.has(p.value);}catch{}
const selected=()=>picks.filter(p=>p.checked);
function refresh(){const chosen=selected(),seconds=chosen.reduce((s,p)=>s+Number(p.closest('tr').dataset.seconds||0),0),label=chosen.length+' episode'+(chosen.length===1?'':'s')+' selected · '+Math.floor(seconds/60)+'m '+String(seconds%60).padStart(2,'0')+'s';document.getElementById('selection-top').textContent=label;document.getElementById('selection-bottom').textContent=label;button.disabled=!chosen.length;toggle.checked=chosen.length===picks.length;toggle.indeterminate=chosen.length>0&&chosen.length<picks.length;try{sessionStorage.setItem(key,JSON.stringify(chosen.map(p=>p.value)));}catch{}}
function set(predicate){for(const p of picks)p.checked=predicate(p);refresh();}
document.getElementById('select-all').onclick=()=>set(()=>true);
document.getElementById('select-aesop').onclick=()=>set(p=>p.closest('tr').dataset.source.startsWith('Aesop'));
document.getElementById('select-none').onclick=()=>set(()=>false);
toggle.onchange=()=>set(()=>toggle.checked);
picks.forEach(p=>p.addEventListener('change',refresh));
button.onclick=()=>{const ids=selected().map(p=>p.value);if(ids.length)location.href='compilation.html?episodes='+encodeURIComponent(ids.join(','));};
refresh();
})();