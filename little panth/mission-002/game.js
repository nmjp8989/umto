(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const svg = (tag, attributes) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    return node;
  };
  const art = file => 'art/' + file + '.svg';
  const backgrounds = {
    forest: art('forest'), home: art('interior'),
    langar: '../anchor set/langar area.svg', courtyard: '../anchor set/village courtyard.svg'
  };
  const names = {
    boy: 'ਛੋਟਾ ਭਰਾ', friend: 'ਦੋਸਤ', mehar: 'ਮੇਹਰ', dadi: 'ਦਾਦੀ ਜੀ',
    girl: 'ਜਮਾਤਣ', teacher: 'ਅਧਿਆਪਕਾ', narrator: 'ਕਹਾਣੀਕਾਰ'
  };
  const activities = {
    uncover: ['ਪੱਤਿਆਂ ਹੇਠਾਂ ਕੀ ਹੈ?', 'ਪੱਤੇ ਹਟਾਓ', 'ਤਾਰ ਛੇੜੋ'],
    clues: ['ਘੰਟੀ ਤੋਂ ਬਾਅਦ ਕਿੱਥੇ ਵੇਖੀਏ?', 'ਸਕੂਲ ਦੇ ਫਾਟਕ ਕੋਲ', 'ਜੰਗਲ ਵਿੱਚ', 'ਜਮਾਤ ਵਿੱਚ'],
    kindness: ['ਤੂੰ ਮੇਹਰ ਦੀ ਥਾਂ ਕੀ ਕਹੇਂਗਾ?', 'ਆਪਾਂ ਇਕੱਲਿਆਂ ਗੱਲ ਕਰੀਏ?', 'ਮੈਂ ਹੁਣੇ ਸਾਰਿਆਂ ਨੂੰ ਦੱਸਦੀ ਹਾਂ!', 'ਮੈਂ ਤੇਰੀ ਗੱਲ ਨਹੀਂ ਸੁਣਨੀ।'],
    string: ['ਹੁਣ ਸੁਨਹਿਰੀ ਤਾਰ ਨੂੰ ਛੇੜ ਕੇ ਦੇਖੋ।', 'ਤਾਰ ਛੇੜੋ']
  };
  const exportMode = new URLSearchParams(location.search).get('export') === '1';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const exportState = {started: 0, finished: 0, error: '', captions: [], phase: ''};
  const time = ms => new Promise(resolve => setTimeout(resolve, ms));
  let bank, story, recorded = new Set(), sung = false, mode, currentAudio, context, actors = [];
  let activeSpeaker = '', activePose = 'idle', generation = 0, advance;
  let english = false;
  const cinema = new UmtoCamera.DeliveryCamera($('stage'));
  cinema.reduceMotion = reduce;
  const rig = $('rig');

  function requestRig() {
    rig.contentWindow.postMessage({type: 'anitoons-delivery-request'}, location.origin);
  }

  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== rig.contentWindow) return;
    if (event.data?.type === 'anitoons-delivery-cast-error') {
      $('status').textContent = 'ਤਸਵੀਰਾਂ ਲੋਡ ਨਹੀਂ ਹੋਈਆਂ। ਸਫ਼ਾ ਮੁੜ ਖੋਲ੍ਹੋ।';
      exportState.error = 'Could not load UMTO character rig';
    }
    if (event.data?.type !== 'anitoons-delivery-cast' || event.data.version !== 2) return;
    bank = event.data.bank;
    ready();
  });
  rig.addEventListener('load', requestRig);
  requestRig();
  setTimeout(requestRig, 2000);

  function image(path, x, y, width, height, className = '') {
    return svg('image', {href: path, x, y, width, height, class: className});
  }

  function ready() {
    if (!story || !bank) return;
    $('watch').disabled = false;
    $('play').disabled = false;
    $('status').textContent = recorded.size === Object.keys(story.lines).length
      ? '' : 'ਪੰਜਾਬੀ ਲਿਖਤ ਉਪਲਬਧ ਹੈ। ਕੁਝ ਆਵਾਜ਼ਾਂ ਹਾਲੇ ਤਿਆਰ ਨਹੀਂ।';
  }

  Promise.all([
    fetch('dialogue.json').then(r => {
      if (!r.ok) throw Error('Could not load dialogue');
      return r.json();
    }),
    fetch('audio/generation-manifest.json').then(r => r.ok ? r.json() : {}).catch(() => ({})),
    fetch('audio/shabad-sung.mp3', {method: 'HEAD'}).then(r => r.ok && !r.headers.get('content-type')?.includes('text/html')).catch(() => false)
  ]).then(([data, manifest, singing]) => {
    story = data;
    recorded = new Set(Object.keys(manifest));
    sung = singing;
    if (sung) recorded.add('shabad');
    $('background').setAttribute('href', backgrounds.forest);
    ready();
  }).catch(error => {
    $('status').textContent = 'ਕਹਾਣੀ ਨਹੀਂ ਖੁੱਲ੍ਹੀ। ਸਫ਼ਾ ਮੁੜ ਖੋਲ੍ਹੋ।';
    exportState.error = error.message;
  });

  function makeActor([id, x, y, height, view = 'right', covered = false, seated = false]) {
    const artSlot = bank[id]?.[view];
    if (!artSlot) throw Error('Missing UMTO pose bank for ' + id);
    const container = svg('g', {transform: 'translate(' + x + ' ' + y + ')'});
    container.append(svg('ellipse', {class: 'actor-shadow', rx: height * .18, ry: height * .03}));
    const artTop = height * (seated ? -.74 : -.92);
    const clip = svg('svg', {x: -height * .32, y: artTop, width: height * .64, height, overflow: 'visible'});
    clip.innerHTML = artSlot.base;
    if (seated) {
      const upper = svg('svg', {x: -height * .4, y: artTop, width: height * .8, height: height * .61, overflow: 'hidden'});
      clip.setAttribute('x', height * .08);
      clip.setAttribute('y', 0);
      upper.append(clip);
      const legs = svg('g', {transform: 'scale(' + height / 345 + ')'});
      const fabric = {mehar: '#dda96d', girl: '#70577d', boy: '#454a62', mother: '#936c71', father: '#e8e1cd'}[id] || '#626b7b';
      legs.innerHTML = '<path d="M-27-68H27q36 23 60 47 14 19-19 21H-64q-35-2-22-20 21-25 59-48Z" fill="' + fabric + '" stroke="#524137" stroke-width="4"/><path d="M-59-21q40 9 61-29m58 29q-41 11-63-8" fill="none" stroke="#553d38" stroke-opacity=".5" stroke-width="3"/>';
      container.append(legs, upper);
    } else {
      container.append(clip);
    }
    $('actors').append(container);
    const layers = Object.fromEntries([...clip.querySelectorAll('[data-scene-layer]')].map(node => [node.dataset.sceneLayer, node]));
    if (covered && artSlot.headScarf) {
      layers.hairBack?.replaceChildren();
      layers.frontHair?.replaceChildren();
      if (layers.headwearFront) layers.headwearFront.innerHTML = artSlot.headScarf;
    }
    return {id, x, y, height, container, slot: artSlot, layers, frame: '', parts: {}, covered};
  }

  function drawActors(now) {
    cinema.update(now, actors.find(a => a.id === cinema.track), document.hidden);
    for (const actor of actors) {
      const talking = actor.id === activeSpeaker;
      const speaking = talking && currentAudio && !currentAudio.paused;
      const moving = actor.walkUntil > now && !reduce;
      const stride = moving ? now / 63 : undefined;
      const pose = moving ? 'walk' + Math.floor(stride) % 12 : talking ? activePose : 'idle';
      const blink = !reduce && (now + actor.x * 9) % 4900 < 140;
      const mouth = !reduce && speaking ? ['talkA', 'talkEE', 'talkO', 'idle'][Math.floor(currentAudio.currentTime * 9) % 4] : 'idle';
      const key = [pose, mouth, blink].join('/');
      if (actor.frame !== key) {
        actor.frame = key;
        const frame = actor.slot.frames[pose] || actor.slot.frames.idle;
        for (const [part, original] of Object.entries(frame.parts)) {
          if (!actor.layers[part] || (actor.covered && actor.slot.headScarf && ['hairBack', 'frontHair', 'headwearFront'].includes(part))) continue;
          let markup = original;
          if (blink && part === 'eyeGroup') markup = actor.slot.frames.blink.parts[part];
          if (mouth !== 'idle' && ['mouthGroup', 'beardGroup'].includes(part)) markup = actor.slot.frames[mouth].parts[part] ?? markup;
          if (markup !== actor.parts[part]) actor.layers[part].innerHTML = actor.parts[part] = markup;
        }
        for (const layer of actor.slot.headLayers) actor.layers[layer]?.setAttribute('transform', frame.head || '');
      }
      $('rig').contentWindow.UmtoDeliveryArms?.(actor.layers.torso, actor.slot, pose, now / 1000, {
        stride, still: reduce, live: true
      });
    }
    requestAnimationFrame(drawActors);
  }
  requestAnimationFrame(drawActors);

  function sitar(x, y, w, rotation) {
    const instrument = svg('g', {id: 'instrument', transform: 'translate(' + x + ' ' + y + ') rotate(' + rotation + ') scale(' + w / 670 + ')'});
    instrument.append(image(art('sitar'), 0, 0, 670, 200));
    instrument.append(svg('path', {class: 'string-light', d: 'M125 104H619', stroke: '#fff3ba', 'stroke-width': 6}));
    return instrument;
  }

  function dress(kind) {
    const props = $('props'), behind = $('behind');
    if (['table', 'snatch', 'meal'].includes(kind)) {
      const table = svg('g', {});
      table.innerHTML = '<path d="M475 603h22v82h-22zm271 0h22v82h-22z" fill="#72503b"/><path d="m446 575 324-4 54 45H400z" fill="#a97950" stroke="#694834" stroke-width="5"/><path d="M401 616h423v15H401z" fill="#634537"/>';
      props.append(table);
      const parcels = image(art('parcels'), 490, 521, 227, 108, kind === 'snatch' ? 'parcel' : '');
      if (kind === 'meal') {
        parcels.setAttribute('opacity', '.54');
        props.append(svg('ellipse', {cx: 654, cy: 590, rx: 58, ry: 19, fill: '#eee4c2', stroke: '#8d7460', 'stroke-width': 5}));
        props.append(svg('path', {d: 'M620 590q33-29 64-3-9 20-64 3z', fill: '#d3a766', stroke: '#a87537', 'stroke-width': 4}));
      }
      props.append(parcels);
      if (kind === 'snatch') {
        const bag = svg('g', {transform: 'translate(688 558)'});
        bag.innerHTML = '<path d="M29 33q0-45 37-45t38 45" fill="none" stroke="#352840" stroke-width="14"/><rect x="10" y="22" width="117" height="103" rx="24" fill="#67467b" stroke="#392843" stroke-width="6"/><rect x="26" y="62" width="85" height="43" rx="12" fill="#795990" stroke="#4c365c" stroke-width="4"/>';
        props.append(bag);
        const hand = svg('g', {class: 'parcel-hand'});
        hand.innerHTML = '<path d="M947 530 830 542 733 557 728 582 846 583 958 559Z" fill="#b45f55" stroke="#7a403b" stroke-width="5"/><path d="M739 555q-36-11-53 7l-19 15q-8 13 8 15l19-6q19 18 45-4Z" fill="#bd845e" stroke="#79513b" stroke-width="4"/>';
        props.append(hand);
      }
      return;
    }
    if (kind === 'leaves' || kind === 'closeSitar' || kind === 'sitar') {
      const position = kind === 'leaves' ? [820, 522, 335, -12] : kind === 'closeSitar' ? [353, 400, 570, -10] : [472, 567, 369, -8];
      props.append(sitar(...position));
      if (kind === 'leaves') {
        const leaves = svg('g', {class: 'leaves', id: 'leaves'});
        leaves.innerHTML = '<g stroke="#693f2a" stroke-width="3"><path d="M813 608q46-90 148-43-62 58-148 43Z" fill="#a26b36"/><path d="M877 604q53-69 133-34-48 70-133 34Z" fill="#bb8b48"/><path d="M912 607q70-89 165-47-60 64-165 47Z" fill="#78874e"/><path d="M988 581q40-49 109-29-37 40-109 29Z" fill="#aa733e"/></g><path d="m826 605 106-30m-30 28 80-27m-29 20 92-30" stroke="#dfad61" stroke-width="2"/>';
        props.append(leaves);
      }
    }
    if (kind === 'noticePaper') {
      props.append(svg('path', {id: 'paper', d: 'M571 502l70-17 23 63-72 17z', fill: '#f7e3b2', stroke: '#977750', 'stroke-width': 3}));
    }
    if (kind === 'music') {
      behind.append(svg('path', {d: 'M415 618h303l55 57H355Z', fill: '#884e47', stroke: '#dfad63', 'stroke-width': 6}));
    }
    if (kind === 'work') {
      const orders = svg('g', {});
      orders.innerHTML = '<path d="M786 585h181l37 44H751z" fill="#916343" stroke="#593c2a" stroke-width="6"/><path d="M784 630v61m183-61v61" stroke="#654632" stroke-width="15"/><rect x="817" y="581" width="96" height="18" rx="3" fill="#7f7664"/><rect x="822" y="565" width="93" height="17" rx="4" fill="#ae6854"/><rect x="828" y="551" width="88" height="14" rx="4" fill="#d7ae73"/><path d="M395 611h82v55h-82z" fill="#44534f" stroke="#303b39" stroke-width="5"/><path d="M417 612v-15h38v15" fill="none" stroke="#303b39" stroke-width="6"/>';
      props.append(orders);
    }
  }

  function shotView(shot) {
    $('background').setAttribute('href', backgrounds[shot.background]);
    for (const layer of ['actors', 'behind', 'props']) $(layer).replaceChildren();
    actors = shot.cast.map(makeActor);
    dress(shot.props);
    cinema.to('wide', null, true);
    if (reduce) return;
    if (mode === 'watch') {
      const center = actors.length ? actors.reduce((sum,a)=>sum+a.x,0)/actors.length : 640;
      cinema.cue(shot.camera || {preset:'wide',width:1210,motion:'dolly-in',duration:5500}, {x:center,y:360});
    }
    if (shot.props === 'leaves' || shot.props === 'work') {
      for (const actor of actors.filter(item => ['mehar', 'father'].includes(item.id))) {
        actor.walkUntil = performance.now() + 1450;
        actor.container.firstElementChild.animate([{translate: '-90px 0'}, {translate: '0 0'}], {duration: 1450});
        actor.container.lastElementChild.animate([{translate: '-90px 0'}, {translate: '0 0'}], {duration: 1450});
      }
    }
  }

  function unlockSound() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    context ||= new AudioContext();
    context.resume().catch(() => {});
  }

  function tone(hz, seconds, volume, offset = 0) {
    if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + offset;
    oscillator.type = 'triangle';
    oscillator.frequency.value = hz;
    gain.gain.setValueAtTime(.001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + .018);
    gain.gain.exponentialRampToValueAtTime(.001, start + seconds);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + seconds + .02);
  }

  function effect(name) {
    if (name === 'bell') [698, 886, 1050].forEach((hz, index) => tone(hz, .65, .047, index * .085));
    if (name === 'glow') $('instrument')?.classList.add('magic');
    if (['note', 'glow'].includes(name)) {
      [220, 440, 660, 880].forEach((hz, index) => tone(hz, 2 - index * .23, .17 / (index + 1), index * .016));
    }
  }

  function hold(ms, skip = true) {
    if (!skip || mode === 'watch' || exportMode) return time(ms);
    return new Promise(resolve => {
      const timer = setTimeout(finish, ms);
      function finish() {
        clearTimeout(timer);
        if (advance === finish) advance = undefined;
        resolve();
      }
      advance = finish;
    });
  }

  function playClip(id, fallbackMs) {
    if (!recorded.has(id)) {
      if (exportMode) throw Error('Missing Punjabi audio: ' + id);
      return hold(fallbackMs);
    }
    return new Promise((resolve, reject) => {
      const file = sung && id === 'shabad' ? 'shabad-sung' : id;
      const audio = new Audio('audio/' + file + '.mp3');
      currentAudio = audio;
      const timer = setTimeout(failed, 45000);
      function finish() {
        clearTimeout(timer);
        audio.onended = audio.onerror = null;
        audio.pause();
        if (currentAudio === audio) currentAudio = undefined;
        if (advance === finish) advance = undefined;
        resolve();
      }
      function failed() {
        if (exportMode) reject(Error('Could not play Punjabi audio: ' + id));
        finish();
      }
      advance = finish;
      audio.onended = finish;
      audio.onerror = failed;
      audio.play().catch(failed);
    });
  }

  async function speak(id) {
    const line = story.lines[id];
    $('reading').hidden = exportMode;
    $('speaker').textContent = names[line.speaker];
    $('punjabi').textContent = line.pa;
    $('english').textContent = line.en;
    activeSpeaker = line.speaker;
    activePose = line.pose;
    if (mode === 'watch' && line.camera) {
      const actor = actors.find(a=>a.id===line.speaker);
      cinema.cue(line.camera,actor?{x:actor.x,y:actor.y-actor.height*.55}:undefined);
    }
    if (id === 'squirrel') {
      const squirrel = svg('g', {class: 'squirrel'});
      squirrel.innerHTML = '<g stroke="#503c2f" stroke-width="4" stroke-linejoin="round"><path d="M1048 410q-38 1-40-33-1-37 31-31 21 5 6 27-10 16 13 21z" fill="#9a614b"/><path d="M1042 411q5-28 31-26l9-18 10 17q20 7 15 24-14 17-43 20z" fill="#ba8055"/><path d="m1053 425-10 11h26m19-19 12-9" fill="none" /><circle cx="1092" cy="393" r="2.7" fill="#342825"/></g>';
      $('props').append(squirrel);
    }
    if (id === 'fold' && !reduce) $('paper')?.animate([{opacity: 1}, {opacity: 0, transform: 'translate(-24px, 31px) scale(.8)'}], {duration: 1200, fill: 'forwards'});
    const start = Date.now() - exportState.started;
    await playClip(id, Math.max(2200, line.pa.split(/\s+/).length * 420));
    if (exportMode) exportState.captions.push({start, end: Date.now() - exportState.started, text: line.en});
    activeSpeaker = '';
  }

  function activity(id) {
    cinema.to('wide',null,true);
    const [prompt, ...answers] = activities[id];
    const sweep = () => $('leaves')?.classList.add('swept');
    if (mode === 'watch') {
      if (id === 'uncover') sweep();
      return time(id === 'string' ? 1200 : 600);
    }
    $('activity').hidden = false;
    $('next').disabled = true;
    $('prompt').textContent = prompt;
    $('feedback').textContent = '';
    return new Promise(resolve => {
      advance = resolve;
      function present(choices, done, correct = 0) {
        $('choices').replaceChildren();
        choices.forEach((label, index) => {
          const button = document.createElement('button');
          button.textContent = label;
          button.onclick = () => {
            if (index !== correct) {
              $('feedback').textContent = 'ਇੱਕ ਵਾਰ ਹੋਰ ਸੋਚੋ।';
              return;
            }
            done();
          };
          $('choices').append(button);
        });
        $('choices').firstElementChild.focus({preventScroll: true});
      }
      function finish() {
        $('activity').hidden = true;
        $('next').disabled = false;
        advance = undefined;
        resolve();
      }
      if (id === 'uncover') {
        present([answers[0]], () => {
          sweep();
          present([answers[1]], finish);
        });
      } else {
        const shuffled = id === 'clues' || id === 'kindness';
        const choices = shuffled ? [answers[1], answers[0], answers[2]] : answers;
        present(choices, () => {
          if (id === 'string') effect('note');
          finish();
        }, shuffled ? 1 : 0);
      }
    });
  }

  async function run(selection, section) {
    unlockSound();
    mode = selection;
    const token = ++generation;
    $('opening').hidden = true;
    $('transport').hidden = exportMode;
    $('next').hidden = selection === 'watch';
    const scenes = section ? story.scenes.filter(scene => scene.id === section) : story.scenes;
    for (const scene of scenes) {
      exportState.phase = scene.id;
      $('chapter').hidden = !scene.title || exportMode;
      $('chapter').textContent = scene.title;
      for (const shot of scene.shots) {
        if (token !== generation) return;
        shotView(shot);
        for (const beat of shot.beats) {
          if (token !== generation) return;
          if (typeof beat === 'string') {
            await speak(beat);
          } else {
            $('reading').hidden = true;
            if (beat.activity) await activity(beat.activity);
            else {
              effect(beat.effect);
              await hold(beat.ms);
            }
          }
        }
      }
      if (scene.id === 'hook') {
        $('opening').hidden = false;
        $('opening').classList.add('title-card');
        $('opening').querySelector('.actions').hidden = true;
        $('status').hidden = true;
        await hold(2200, false);
        if (token !== generation) return;
        $('opening').hidden = true;
      }
    }
    if (token !== generation) return;
    $('activity').hidden = true;
    $('next').hidden = true;
    $('chapter').hidden = false;
    $('chapter').textContent = 'ਮਿਸ਼ਨ ਪੂਰਾ ਹੋਇਆ';
    exportState.finished = Date.now();
  }

  function start(selection) {
    run(selection).catch(error => {
      $('chapter').hidden = false;
      $('chapter').textContent = 'ਕਹਾਣੀ ਰੁਕ ਗਈ। ਮੁੜ ਸ਼ੁਰੂ ਕਰੋ।';
      console.error(error);
    });
  }

  $('watch').onclick = () => start('watch');
  $('play').onclick = () => start('play');
  $('restart').onclick = () => {
    generation++;
    advance?.();
    advance = undefined;
    $('activity').hidden = $('reading').hidden = $('transport').hidden = $('chapter').hidden = true;
    $('next').disabled = false;
    $('opening').classList.remove('title-card');
    $('opening').querySelector('.actions').hidden = false;
    $('status').hidden = false;
    $('opening').hidden = false;
    $('background').setAttribute('href', backgrounds.forest);
    actors = [];
    for (const layer of ['actors', 'behind', 'props']) $(layer).replaceChildren();
  };
  $('next').onclick = () => advance?.();
  $('captions').onclick = () => {
    english = !english;
    $('english').hidden = !english;
    $('captions').setAttribute('aria-pressed', String(english));
  };

  if (exportMode) {
    document.body.classList.add('export');
    window.lpExport = {
      ready: () => Boolean(story && bank),
      status: () => ({...exportState}),
      start(section) {
        if (!story.scenes.some(scene => scene.id === section) || exportState.started) throw Error('Unknown or already started section');
        exportState.started = Date.now();
        run('watch', section).catch(error => { exportState.error = error.message; });
        return exportState.started;
      }
    };
  }
})();
