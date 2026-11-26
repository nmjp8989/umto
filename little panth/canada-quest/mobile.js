'use strict';
(() => {
  const {questions, chapters, regionsById, bearings, regions} = QUEST;
  const {paths, centres, capitals} = QUEST_MAP;
  const screen=document.querySelector('#screen'), scene=document.querySelector('.scene-copy');
  const home=document.querySelector('#home'), voice=document.querySelector('#voice');
  const studio=questStage, key='canada-mobile-expedition-1';
  const badges=['🗺️','🧭','🔤','🏔️','🔍','🎨'];
  const titles=['Map explorer','Compass trails','Spelling bee','Field notes','Canada detective','Picture clues'];
  const drawingQs=[
    ['Which map is easiest to read?','Different land colours, blue water and a star for home','Blue land and blue water','The same star on every region'],
    ['Which direction sentence matches Canada’s map?','Manitoba is west of Ontario.','Nunavut is south of Ontario.','Québec is west of Ontario.'],
    ['Which sketch shows Manitoba’s current flag?','A Union Jack and a bison shield on red','A red maple leaf between red bars','A blue flag with a lighthouse'],
    ['Which flag design tells a story about Manitoba?','Gold wheat for its farms and a bison for its prairie heritage','A tropical palm for its banana farms','A sailboat for its Pacific coast'],
    ['Which picture tells the story of the Klondike Gold Rush?','Prospectors panning stream gravel for gold','Farmers clearing a wheat field','Miners drilling for oil'],
    ['Which sketch correctly compares the tides?','The same rocks are covered at high tide and exposed at low tide.','Water is lower at high tide.','The rocks move uphill at high tide.'],
    ['Which sketch shows a fjord?','Seawater stretching between steep glacier-carved sides','A small pond in a flat field','Sand dunes beside a dry valley'],
    ['Which wildlife poster belongs in the Northwest Territories?','Protect caribou migration routes','Protect wild red pandas','Protect wild kangaroos'],
    ['Which farm picture fits Manitoba?','Wheat, barley and canola beside a combine','Coffee trees beside a lighthouse','Olive trees beside lobster traps'],
    ['Which two sights could you sketch in British Columbia?','Pacific salmon and forested mountains','Peggy’s Cove and the CN Tower','Confederation Bridge and Hopewell Rocks'],
    ['Which icons show three Saskatchewan industries?','Wheat, a mine shaft and a pumpjack','A lighthouse, a lobster and a ferry','A kayak, a maple leaf and a whale'],
    ['Which picture shows cultural diversity?','Neighbours sharing different languages and family traditions','A collection of differently shaped rocks','Three buildings of different heights'],
    ['Which pair shows how transportation helps communities?','Ships carry goods along the St. Lawrence and trucks cross Confederation Bridge.','The bridge carries ocean ships into Québec.','The St. Lawrence links P.E.I. to New Brunswick by road.'],
    ['Which caption correctly explains an industry’s impact?','Visitors to Newfoundland and Labrador support local jobs when they pay for tours.','Overfishing always increases fish populations.','Arctic cold makes every delivery faster.']
  ];
  let workshopIndex=0;
  function misspellings(word) {
    const out=new Set();
    for(let i=1;i<word.length-1 && out.size<3;i++){
      if(!/[a-z]/i.test(word[i])||!/[a-z]/i.test(word[i+1]))continue;
      const alt=word.slice(0,i)+word[i+1]+word[i]+word.slice(i+2);
      if(alt!==word)out.add(alt);
      if(out.size<3)out.add(word.slice(0,i)+word.slice(i+1));
    }
    return [...out];
  }
  const deck=questions.map(q=>{
    if(q.chapter==='workshop'){
      const [prompt,answer,...wrong]=drawingQs[workshopIndex++];
      return {...q,type:'choice',prompt,answer,wrong};
    }
    if(q.type!=='text')return q;
    const prompt=q.prompt.replace(/Type the full name of the highlighted region\./,'Which name matches the highlighted region?').replace(/^Type the capital of (.*)\.$/,'Which spelling names the capital of $1?').replace(/Type its full name\.|Type its name\./,'Choose the correct spelling.').replace(/^Type the /,'Choose the ');
    return {...q,prompt,type:'choice',wrong:q.region?regions.filter(r=>r[0]!==q.region).slice(0,3).map(r=>r[1]):misspellings(q.answer)};
  });
  const lookup=Object.fromEntries(deck.map(q=>[q.id,q]));
  const state=JSON.parse(localStorage.getItem(key)||'{"marks":{},"runs":{},"sound":false}');
  let mode='',run=null,zoom=false;
  const save=()=>localStorage.setItem(key,JSON.stringify(state));
  function shuffle(list){const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const btn=(label,action,value='',cls='')=>`<button type="button" class="${cls}" data-action="${action}" data-id="${esc(value)}">${esc(label)}</button>`;
  function stop(){window.speechSynthesis?.cancel();studio.silence();}
  function speak(text){stop();if(!state.sound||!window.speechSynthesis)return;const u=new SpeechSynthesisUtterance(text);u.lang='en-CA';u.rate=.91;u.onstart=()=>studio.speak(text,text.length/13,'explainLeft');u.onend=()=>studio.silence();speechSynthesis.speak(u);}
  function header(title,sub,active){home.hidden=!active;document.body.classList.toggle('playing',active);scene.innerHTML='<h1>'+esc(title)+'</h1><p>'+esc(sub)+'</p>';studio.cut(active?'two-shot':'wide');}
  function chapter(id){return titles[chapters.findIndex(c=>c[0]===id)] || (id==='exam'?'Mastery test':'Replay misses');}
  function board(){stop();mode='';header('Canada Quest','Travel across Canada with Harpreet and Mehar.',false);
    const stars=Object.values(state.marks).filter(Boolean).length;
    screen.innerHTML=`<div class="topline"><h2>Your expedition</h2><strong>⭐ ${stars} / ${deck.length}</strong></div><div class="grid">${chapters.map(([id],i)=>{const qs=deck.filter(q=>q.chapter===id);return btn(badges[i]+' '+titles[i]+' · '+qs.filter(q=>state.marks[q.id]).length+'/'+qs.length,'start',id,'tile');}).join('')}</div><section class="card check"><h2>Mastery test</h2><p>Try all ${deck.length} challenges. Your place saves after each answer.</p><div class="actions">${btn(state.runs.exam?'Resume test':'Start test','start','exam','primary')}${Object.values(state.marks).includes(false)?btn('Replay misses','start','missed'):''}${state.last!==undefined?'Last score: '+state.last+'/'+deck.length:''}</div></section>`;
  }
  function start(id){mode=id;const pool=id==='exam'?deck:id==='missed'?deck.filter(q=>state.marks[q.id]===false):deck.filter(q=>q.chapter===id);
    run=state.runs[id]||{ids:(id==='exam'?shuffle(pool):pool).map(q=>q.id),i:0,score:0};state.runs[id]=run;save();zoom=false;draw(true);}
  function map(q){
    const view=zoom?'520 267 162 162':'0 0 760 488';
    const pins=q.pins?[...q.pins].sort((a,b)=>capitals[a][0]-capitals[b][0]):[];
    const attrs=v=>`data-action="answer" data-id="${v}" tabindex="0" role="button"`;
    const dots=pins.map((id,i)=>{const [x,y]=capitals[id];return `<g ${attrs(id)} aria-label="Pin ${i+1}" transform="translate(${x} ${y})"><circle r="8" fill="#164c40"/><text y="3.6" text-anchor="middle" font-size="10" fill="white">${i+1}</text></g>`;}).join('');
    const route=q.type==='route'?['ON',q.region].map((id,i)=>{const [x,y]=centres[id];return `<circle cx="${x}" cy="${y}" r="11" fill="#713d24"/><text x="${x}" y="${y+4}" text-anchor="middle" fill="white" font-size="12">${i?'B':'A'}</text>`;}).join(''):'';
    return `<div class="map-wrap"><svg viewBox="${view}" aria-label="Canada map">${Object.entries(paths).map(([id,d],i)=>`<path d="${d}" class="map-region ${q.region===id&&q.type==='choice'?'marked':''} ${run.pick&&q.answer===id?'correct':''}" ${q.type==='map'?attrs(id)+' aria-label="Region '+(i+1)+'"':''}/>`).join('')}${route}${dots}</svg></div><div class="palette">${btn(zoom?'Whole map':'Atlantic zoom','zoom')}${pins.map((id,i)=>btn('Pin '+(i+1),'answer',id)).join('')}</div>`;
  }
  function draw(read=false){const q=lookup[run.ids[run.i]];header(chapter(mode),`Stop ${run.i+1} of ${run.ids.length} · ⭐ ${run.score}`,true);
    const hasMap=['map','city-map','route'].includes(q.type)||q.region;
    const compass=['route','compass'].includes(q.type);
    if(!run.order&&q.wrong){run.order=shuffle([q.answer,...q.wrong]);save();}
    const opts=compass?`<div class="compass">${['NW','N','NE','W','','E','SW','S','SE'].map((v,i)=>v?btn(['↖','↑','↗','←','','→','↙','↓','↘'][i]+(q.type==='route'?' '+v:''),'answer',v):'<kbd>✥</kbd>').join('')}</div>`:q.wrong?`<div class="choices">${run.order.map(v=>btn(v,'answer',v)).join('')}</div>`:'';
    screen.innerHTML=`<article class="card"><div class="game-progress"><div style="width:${100*run.i/run.ids.length}%"></div></div><div class="question-head"><h2>${esc(q.prompt)}</h2></div>${hasMap?map(q):''}${opts}<div id="feedback" aria-live="polite"></div></article>`;
    if(run.pick){const right=run.pick===q.answer;
      for(const el of screen.querySelectorAll('[data-action=answer]')){el.setAttribute('aria-disabled','true');if(el.tagName==='BUTTON')el.disabled=true;if(el.dataset.id===q.answer)el.classList.add('right');}
      const ans=q.type==='map'?regionsById[q.answer][1]:q.type==='city-map'?regionsById[q.answer]?.[2]||'Ottawa':q.answer;
      const f=screen.querySelector('#feedback');f.innerHTML=`<div class="feedback ${right?'':'retry'}"><strong>${right?'⭐ You got it!':'Answer: '+esc(ans)}</strong><p>${esc(q.note)}</p>${btn(run.i+1===run.ids.length?'See score':'Next stop','next','','primary')}</div>`;f.querySelector('button').focus({preventScroll:true});f.scrollIntoView({block:'nearest'});}
    else if(read)speak(q.prompt);
  }
  function act(el){const a=el.dataset.action,v=el.dataset.id;
    if(a==='start'){start(v);return;}if(a==='board'){board();return;}if(!mode)return;
    const q=lookup[run.ids[run.i]];
    if(a==='zoom'){zoom=!zoom;draw();return;}
    if(a==='answer'&&!run.pick){run.pick=v;state.marks[q.id]=v===q.answer;if(state.marks[q.id])run.score++;save();draw();studio.react(v===q.answer);speak(q.note);return;}
    if(a==='next'&&run.pick){stop();run.i++;delete run.order;delete run.pick;zoom=false;
      if(run.i===run.ids.length){if(mode==='exam')state.last=run.score;delete state.runs[mode];save();header('Trail complete',chapter(mode),true);screen.innerHTML=`<section class="card"><h2>⭐ ${run.score} / ${run.ids.length}</h2><p>Your expedition score is saved.</p>${btn('Quest board','board','','primary')}</section>`;mode='';}
      else{save();draw(true);} window.scrollTo(0,0);}
  }
  screen.onclick=e=>{const el=e.target.closest('[data-action]');if(el)act(el);};
  screen.onkeydown=e=>{if(['Enter',' '].includes(e.key)&&e.target.matches('svg [data-action]')){e.preventDefault();act(e.target);}};
  home.onclick=board;
  function voiceLabel(){voice.textContent=state.sound?'🔊 Sound on':'🔈 Sound off';voice.setAttribute('aria-pressed',state.sound);}
  voice.onclick=()=>{state.sound=!state.sound;save();voiceLabel();speak(mode?lookup[run.ids[run.i]].prompt:QUEST.intro);};
  voiceLabel();board();
})();
