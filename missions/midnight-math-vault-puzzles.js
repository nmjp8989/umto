/* UMTO Mission 010: five accessible Grade 4 mini-games driven by mission JSON. */
'use strict';
(function(root){
 const by=id=>document.getElementById(id);
 let activeId=null,locked=false,answer=0,selected=null,mistakes=0;
 const make=(tag,cls='',value)=>{const e=document.createElement(tag);e.className=cls;if(value!==undefined)e.textContent=value;return e;};
 const add=(parent,...kids)=>{kids.forEach(k=>parent.append(k));return parent;};
 const btn=(label,action,cls='')=>{const b=make('button','mq-button '+cls,label);b.type='button';b.onclick=action;return b;};
 const dlg=()=>by('mathGame');
 function clear(){const d=dlg();if(d?.open)d.close();if(d)d.replaceChildren();activeId=null;}
 function dialogue(d,mission,engine){
  clear();
  const puzzle=d.puzzle&&mission.puzzles?.[d.puzzle];
  by('choices').hidden=!!puzzle;
  if(!puzzle)return;
  activeId=d.puzzle;locked=false;mistakes=0;answer=undefined;selected=undefined;
  const container=dlg();
  const top=add(make('header','mq-top'),make('div','mq-eyebrow','UMTO / GRADE 4 MINI-GAME'),btn('× Close',()=>clear(),'mq-close'));
  const heading=add(make('section','mq-heading'),make('h2','',puzzle.title),make('p','',puzzle.instruction));
  const play=make('div','mq-play');
  const feedback=make('p','mq-feedback','Try the puzzle. Wrong answers are safe—you can try again.');
  feedback.setAttribute('role','status');
  let input;
  const selection=(v)=>{answer=v;update()};
  const update=()=>{};
  if(puzzle.type==='rounding'){
   const big=make('div','mq-number',String(puzzle.start));
   const range=make('input','mq-range');range.type='range';range.min=puzzle.start;range.max=puzzle.end;range.step=puzzle.step;range.value=puzzle.start;
   range.setAttribute('aria-label','Move the rounding dial');
   range.oninput=()=>{big.textContent=Number(range.value).toLocaleString('en-CA');selection(Number(range.value));};
   selection(puzzle.start);
   const labels=make('div','mq-range-labels');
   for(let i=puzzle.start;i<=puzzle.end;i+=puzzle.step)labels.append(btn(i.toLocaleString('en-CA'),()=>{range.value=i;range.oninput();},'mq-tick'));
   add(play,make('p','mq-mini-label','MOVE THE DIAL TO A HUNDRED'),big,range,labels);
  }else if(puzzle.type==='pattern'){
   const seq=make('div','mq-sequence');
   [12,18,24,30,'?'].forEach(n=>seq.append(make('span','mq-seq-tile'+(n==='?'?' mq-unknown':''),String(n))));
   const opts=make('div','mq-options');
   for(const n of puzzle.options)opts.append(btn(String(n),()=>{
    selection(n);
    [...opts.children].forEach(b=>b.classList.toggle('mq-chosen',b.textContent===String(n)));
    seq.lastChild.textContent=String(n);
   }));
   add(play,seq,make('p','mq-mini-label','TAP THE NEXT NUMBER'),opts);
  }else if(puzzle.type==='array'){
   const grid=make('div','mq-array');
   grid.style.setProperty('--cols',puzzle.cols);
   for(let i=0;i<puzzle.rows*puzzle.cols;i++)grid.append(make('span','mq-array-tile'));
   input=make('input','mq-input');input.type='number';input.min='0';input.max='999';input.inputMode='numeric';input.placeholder='Your answer';
   input.setAttribute('aria-label','Total number of tiles');
   input.oninput=()=>selection(Number(input.value));
   input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.stopPropagation();check();}});
   add(play,make('p','mq-mini-label',puzzle.rows+' ROWS × '+puzzle.cols+' TILES'),grid,input);
  }else if(puzzle.type==='fraction'){
   const tiles=make('div','mq-lanterns');
   const count=make('p','mq-count','0 of '+puzzle.total+' lanterns lit');
   const selectedSet=new Set();
   for(let i=0;i<puzzle.total;i++){const b=btn('♧',()=>{
    if(selectedSet.has(i)){selectedSet.delete(i);b.classList.remove('mq-lit');b.textContent='♧';b.setAttribute('aria-pressed','false');}
    else {selectedSet.add(i);b.classList.add('mq-lit');b.textContent='✦';b.setAttribute('aria-pressed','true');}
    selection(selectedSet.size);count.textContent=selectedSet.size+' of '+puzzle.total+' lanterns lit';
   },'mq-lantern');
   b.setAttribute('aria-label','Lantern '+(i+1));b.setAttribute('aria-pressed','false');tiles.append(b);}
   selection(0);add(play,make('p','mq-mini-label','LIGHT UP ¾ OF THE LANTERNS'),tiles,count);
  }else if(puzzle.type==='perimeter'){
   const diagram=make('div','mq-perimeter');const horizontal=make('span','mq-top-side',puzzle.length+' m');
   const left=make('span','mq-left-side',puzzle.width+' m');const right=make('span','mq-right-side',puzzle.width+' m');const bottom=make('span','mq-bottom-side',puzzle.length+' m');
   add(diagram,horizontal,left,right,bottom);
   const rows=make('div','mq-perimeter-input');
   const val=make('span','mq-number','0 m');selection(0);
   const down=btn('−',()=>{selection(Math.max(0,(answer||0)-1));val.textContent=answer+' m';},'mq-step');
   const up=btn('+',()=>{selection(Math.min(60,(answer||0)+1));val.textContent=answer+' m';},'mq-step');
   const inputField=make('input','mq-input');inputField.type='number';inputField.min='0';inputField.max='100';inputField.placeholder='Or type';inputField.inputMode='numeric';inputField.setAttribute('aria-label','Perimeter in metres');
   inputField.oninput=()=>{if(inputField.value!==''){selection(Number(inputField.value));val.textContent=answer+' m';}};
   inputField.addEventListener('keydown',e=>{if(e.key==='Enter'){e.stopPropagation();check();}});
   add(rows,down,val,up,inputField);add(play,diagram,rows);
  }
  const checkBtn=btn('CHECK ANSWER ✓',check,'mq-check');
  const footer=add(make('div','mq-footer'),feedback,checkBtn);
  add(container,top,heading,play,footer);
  container.addEventListener('keydown',stopKey,{once:false});
  container.showModal();
  function stopKey(e){e.stopPropagation();}
  function check(){
   if(locked||activeId!==d.puzzle)return;
   if(answer===undefined||!Number.isFinite(answer)){feedback.textContent='Choose or enter an answer first.';return;}
   if(answer!==puzzle.correct){
    mistakes++;
    feedback.textContent=mistakes>1?'Not quite. Hint: '+puzzle.hint:'Not quite—try another answer. You can do it!';
    feedback.classList.add('mq-wrong');checkBtn.textContent='TRY AGAIN ↻';return;
   }
   locked=true;feedback.classList.remove('mq-wrong');feedback.textContent='✓ Correct! The next mechanism is unlocking.';
   feedback.classList.add('mq-correct');checkBtn.textContent='✓ UNLOCKED';checkBtn.disabled=true;
   const action=by('choices')?.querySelector('button');
   // MissionEngine receives only the validated result, not raw free-form answers.
   root.setTimeout(()=>{if(activeId!==d.puzzle)return;container.close();activeId=null;action?.click();},430);
  }
 }
 function progress(mission,engine){
  const names=[['rounded','ROUND'],['patternDone','PATTERN'],['arrayDone','ARRAY'],['fractionsDone','FRACTION'],['perimeterDone','PERIMETER']];
  const n=names.filter(([flag])=>engine.state.flags[flag]).length;
  const el=by('mathProgress');
  if(el){el.textContent='✦ '+n+' / '+names.length+' MATH LOCKS';el.setAttribute('aria-label',n+' of '+names.length+' math locks solved');}
 }
 const game=dlg();game?.addEventListener('cancel',e=>{e.preventDefault();clear();});
 root.MysteryUI={dialogue,clear,progress};
})(window);
