(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const {shots, chapters, speakers, activities} = window.KiteStory;
  const stage = $('stage');
  const cinema = new UmtoCamera.DeliveryCamera(stage);
  const art = new KiteArt();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const exportMode = new URLSearchParams(location.search).get('export') === '1';
  const exportState = {started:0, finished:0, error:'', captions:[], phase:''};
  const clock = {index:-1, started:0, paused:null, resolved:null, mode:'', last:null};
  let lines, bank, imagesReady = false, ready = false, pendingCaption;
  let english = true, sectionEnd = shots.length, currentLine;
  let waiting = false;

  class MissionSound {
    constructor() {
      this.voice = new Audio();
      this.voice.preload = 'auto';
      this.recorded = new Set();
      this.audible = true;
      this.cueName = '';
      this.note = 0;
      this.nextNote = 0;
      this.scores = {
        intro: [293.7, 440, 493.9, 440, 392, 349.2, 293.7, 349.2],
        harvest: [293.7, 392, 440, 523.3, 440, 392, 349.2, 293.7],
        storage: [293.7, 349.2, 392, 349.2, 261.6, 293.7, 220, 261.6],
        requests: [261.6, 293.7, 349.2, 392, 349.2, 293.7, 220, 261.6],
        repair: [349.2, 392, 440, 523.3, 440, 392, 349.2, 293.7],
        share: [293.7, 440, 523.3, 587.3, 523.3, 440, 349.2, 293.7]
      };
    }

    unlock() {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.audible ? .84 : 0;
        this.master.connect(this.context.destination);
        const voiceSource = this.context.createMediaElementSource(this.voice);
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = 256;
        this.samples = new Float32Array(this.analyser.fftSize);
        voiceSource.connect(this.analyser).connect(this.master);
      }
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    }

    toggle() {
      this.audible = !this.audible;
      if (this.master) this.master.gain.setTargetAtTime(this.audible ? .84 : 0, this.context.currentTime, .03);
      this.voice.muted = !this.audible;
    }

    stopLine() {
      this.voice.pause();
      this.line = '';
    }

    say(id) {
      this.stopLine();
      if (!this.recorded.has(id)) return;
      this.line = id;
      this.voice.src = 'audio/' + id + '.mp3';
      this.voice.play().catch(() => {});
    }

    resume() {
      this.unlock();
      if (this.line && !this.voice.ended) this.voice.play().catch(() => {});
    }

    tone(hz, length, volume, delay = 0, type = 'triangle') {
      if (this.context?.state !== 'running') return;
      const start = this.context.currentTime + delay;
      const oscillator = this.context.createOscillator();
      const envelope = this.context.createGain();
      oscillator.type = type;
      oscillator.frequency.value = hz;
      envelope.gain.setValueAtTime(.0001, start);
      envelope.gain.exponentialRampToValueAtTime(volume, start + .018);
      envelope.gain.exponentialRampToValueAtTime(.0001, start + length);
      oscillator.connect(envelope).connect(this.master);
      oscillator.start(start);
      oscillator.stop(start + length + .03);
    }

    noise(seconds, volume, frequency, delay = 0) {
      if (this.context?.state !== 'running') return;
      const start = this.context.currentTime + delay;
      const size = Math.floor(this.context.sampleRate * seconds);
      const buffer = this.context.createBuffer(1, size, this.context.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let index = 0; index < size; index++) samples[index] = Math.random() * 2 - 1;
      const source = this.context.createBufferSource();
      const filter = this.context.createBiquadFilter();
      const envelope = this.context.createGain();
      filter.type = 'bandpass';
      filter.frequency.value = frequency;
      filter.Q.value = .8;
      envelope.gain.setValueAtTime(.0001, start);
      envelope.gain.exponentialRampToValueAtTime(volume, start + Math.min(.06, seconds / 3));
      envelope.gain.exponentialRampToValueAtTime(.0001, start + seconds);
      source.buffer = buffer;
      source.connect(filter).connect(envelope).connect(this.master);
      source.start(start);
    }

    effect(name) {
      if (name === 'gust') this.noise(1.2,.17,430,.4);
      if (name === 'rip') {
        this.noise(.34,.22,1350,.55);
        this.tone(142,.23,.055,.46);
      }
      if (name === 'steps') for (let step=0; step<6; step++) this.noise(.14,.075,225,step*.67);
      if (name === 'found') {
        this.tone(493.9,.45,.085);
        this.tone(659.3,.6,.075,.13);
      }
      if (name === 'lift') {
        this.noise(1.7,.13,640,.8);
        this.tone(392,.51,.08,1);
        this.tone(587.3,.82,.068,1.22);
      }
    }

    tick(chapter) {
      if (this.context?.state !== 'running') return;
      if (this.cueName !== chapter) {
        this.cueName = chapter;
        this.note = 0;
        this.nextNote = this.context.currentTime;
      }
      if (this.context.currentTime < this.nextNote) return;
      const melody = this.scores[chapter];
      const frequency = melody[this.note % melody.length];
      const level = this.line && !this.voice.paused ? .042 : .074;
      this.tone(frequency,.51,level);
      if (this.note % 4 === 0) this.tone(frequency / 2,.92,level*.85,0,'sine');
      this.note++;
      this.nextNote = this.context.currentTime + (chapter === 'harvest' ? .5 : .72);
    }

    mouth() {
      if (!this.line || this.voice.paused || this.voice.ended || !this.analyser) return null;
      this.analyser.getFloatTimeDomainData(this.samples);
      let energy = 0;
      for (const sample of this.samples) energy += sample * sample;
      if (Math.sqrt(energy / this.samples.length) < .014) return null;
      return ['talkA','talkEE','talkO'][Math.floor(this.voice.currentTime * 8) % 3];
    }
  }

  const sound = new MissionSound();
  const chapterButtons = chapters.map(({id,title}, index) => {
    const entry = document.createElement('li');
    const button = document.createElement('button');
    button.className = 'chapter';
    button.type = 'button';
    button.disabled = true;
    const number = document.createElement('span');
    number.textContent = String(index+1).padStart(2,'0');
    number.className = 'number';
    number.setAttribute('aria-hidden','true');
    const name = document.createElement('span');
    name.textContent = title;
    button.append(number,name);
    entry.append(button);
    $('chapters').append(entry);
    button.addEventListener('click', () => start('watch', shots.findIndex(shot => shot.chapter === id)));
    return {id,title,button};
  });

  function updateChapters(chapter) {
    for (const {id,button} of chapterButtons) {
      button.disabled = !ready || clock.mode === 'play';
      if (id === chapter) button.setAttribute('aria-current','step');
      else button.removeAttribute('aria-current');
    }
  }

  function note(shot) {
    $('note-technique').textContent = shot.technique;
    $('note-purpose').textContent = shot.purpose;
  }

  function opening() {
    clock.index = -1;
    clock.mode = '';
    clock.paused = null;
    sectionEnd = shots.length;
    sound.stopLine();
    $('opening').hidden = false;
    for (const id of ['ending','transport','reading','activity','hotspots']) $(id).hidden = true;
    art.show({...shots[0],cast:[['mehar',867,661,335,'right','point'],['boy',1080,660,328,'left','happy']]},bank);
    cinema.cue('wide',null,true);
    art.draw(3,null,null,reduced.matches,0);
    note(shots[0]);
    updateChapters('intro');
  }

  function initIfReady() {
    if (ready || !lines || !bank || !imagesReady) return;
    ready = true;
    opening();
    $('watch').disabled = $('play').disabled = false;
    $('loading').textContent = sound.recorded.size === shots.length ? '' :
      `Punjabi audio ready for ${sound.recorded.size} of ${shots.length} lines.`;
    $('loading').hidden = !($('loading').textContent);
  }

  const rig = $('rig');
  function requestRig() {
    rig.contentWindow?.postMessage({type:'anitoons-delivery-request'},location.origin);
  }
  window.addEventListener('message', event => {
    if (event.source !== rig.contentWindow || event.origin !== location.origin) return;
    if (event.data?.type === 'anitoons-delivery-cast-error') {
      fail(Error('UMTO could not load the Mission 03 cast.'));
      return;
    }
    if (event.data?.type !== 'anitoons-delivery-cast' || event.data.version !== 2) return;
    if (!['mehar','boy','dadi'].every(id => event.data.bank?.[id]?.left && event.data.bank[id].right)) return;
    bank = event.data.bank;
    initIfReady();
  });
  rig.addEventListener('load', requestRig);
  requestRig();

  Promise.all([
    fetch('dialogue.json').then(response => {
      if (!response.ok) throw Error('The dialogue could not load.');
      return response.json();
    }),
    fetch('audio/generation-manifest.json').then(response => response.ok ? response.json() : {}).catch(() => ({})),
    Promise.all(['banyan','canopy','courtyard','sunset'].map(file => {
      const image = new Image();
      image.src = 'art/' + file + '.webp';
      return image.decode();
    }))
  ]).then(([dialogue, manifest]) => {
    if (!shots.every(shot => dialogue.lines?.[shot.line])) throw Error('The story is missing dialogue.');
    lines = dialogue.lines;
    sound.recorded = new Set(Object.keys(manifest).filter(id => manifest[id]?.text === lines[id]?.pa));
    imagesReady = true;
    initIfReady();
  }).catch(fail);

  function fail(error) {
    exportState.error = error.message;
    $('loading').hidden = false;
    $('loading').textContent = error.message;
    console.error(error);
  }

  function elapsed(now = performance.now()) {
    return Math.max(0, ((clock.paused ?? now) - clock.started) / 1000);
  }

  function endCaption() {
    if (!pendingCaption) return;
    const end = Date.now() - exportState.started;
    if (end > pendingCaption.start) exportState.captions.push({...pendingCaption,end});
    pendingCaption = null;
  }

  function showLine(shot) {
    currentLine = lines[shot.line];
    $('reading').hidden = false;
    $('speaker').textContent = speakers[currentLine.speaker];
    $('punjabi').textContent = currentLine.pa;
    $('english').textContent = currentLine.en;
    $('english').hidden = !english;
    sound.say(shot.line);
    if (exportMode) pendingCaption = {start:Date.now() - exportState.started,text:currentLine.en};
  }

  function chooseActivity(shot) {
    const spec = activities[shot.activity];
    const choices = $('choices');
    const hotspots = $('hotspots');
    $('prompt').textContent = spec.prompt;
    $('feedback').textContent = '';
    choices.replaceChildren();
    hotspots.replaceChildren();
    $('activity').hidden = false;
    const hitTargets = spec.choices.filter(option => option.x !== undefined);
    hotspots.hidden = !hitTargets.length;
    const respond = (option, button) => {
      if (!waiting || clock.paused !== null) return;
      if (option.id !== spec.answer) {
        $('feedback').textContent = spec.retry;
        button.setAttribute('aria-pressed','true');
        return;
      }
      waiting = false;
      clock.resolved = elapsed();
      $('feedback').textContent = spec.success;
      hotspots.hidden = true;
      for (const answer of choices.children) answer.disabled = true;
      $('next').disabled = false;
      if (shot.activity === 'truth') cinema.cue(shot.camera);
      sound.effect('found');
      showLine(shot);
      $('next').focus({preventScroll:true});
    };
    for (const option of spec.choices) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'control';
      button.textContent = option.text;
      button.addEventListener('click', () => respond(option,button));
      choices.append(button);
      if (option.x === undefined) continue;
      const hotspot = document.createElement('button');
      hotspot.type = 'button';
      hotspot.className = 'hit';
      hotspot.style.left = option.x / 12.8 + '%';
      hotspot.style.top = option.y / 7.2 + '%';
      hotspot.setAttribute('aria-label', option.text);
      hotspot.addEventListener('click', () => respond(option,button));
      hotspots.append(hotspot);
    }
  }

  function enter(index) {
    endCaption();
    sound.stopLine();
    if (index >= sectionEnd) { finish(); return; }
    const shot = shots[index];
    clock.index = index;
    clock.started = performance.now();
    clock.paused = null;
    clock.resolved = null;
    currentLine = null;
    waiting = clock.mode === 'play' && Boolean(shot.activity);
    $('opening').hidden = $('ending').hidden = true;
    $('transport').hidden = false;
    for (const id of ['reading','activity','hotspots']) $(id).hidden = true;
    $('pause').textContent = 'Pause';
    $('next').disabled = waiting;
    $('previous').disabled = index <= 0;
    $('progress').textContent = chapterButtons.find(chapter => chapter.id === shot.chapter).title;
    updateChapters(shot.chapter);
    note(shot);
    exportState.phase = shot.chapter;
    art.show(shot,bank);
    if (waiting) {
      cinema.cue({preset:'wide', angle:shot.camera.angle === 'birds-eye' ? 'birds-eye' : 'eye-level', cut:true});
    } else {
      if (shot.start) cinema.cue(shot.start);
      else if (!shot.camera.cut) cinema.cue('wide',null,true);
      cinema.cue(shot.camera);
    }
    art.draw(0,null,null,reduced.matches,0);
    if (shot.effect) sound.effect(shot.effect);
    if (waiting) chooseActivity(shot);
    else showLine(shot);
    $('next').textContent = index === sectionEnd - 1 ? 'Finish' : 'Next scene';
  }

  function start(mode, index = 0, stop = shots.length) {
    if (!ready) return;
    sound.unlock();
    clock.mode = mode;
    sectionEnd = stop;
    enter(index);
  }

  function finish() {
    sound.stopLine();
    clock.index = shots.length;
    $('reading').hidden = $('activity').hidden = $('transport').hidden = $('hotspots').hidden = true;
    if (exportMode) exportState.finished = Date.now();
    else {
      $('ending').hidden = false;
      $('replay').focus({preventScroll:true});
    }
    clock.mode = '';
    updateChapters('share');
  }

  function pause() {
    if (!shots[clock.index]) return;
    const now = performance.now();
    if (clock.paused === null) {
      clock.paused = now;
      sound.voice.pause();
      $('pause').textContent = 'Resume';
    } else {
      clock.started += now - clock.paused;
      clock.paused = null;
      sound.resume();
      $('pause').textContent = 'Pause';
    }
  }

  function tick(now) {
    const shot = shots[clock.index];
    if (shot && clock.paused === null && !document.hidden) {
      const seconds = elapsed(now);
      const resolved = clock.mode === 'watch' ? Math.max(0,seconds - 1.4) :
        clock.resolved === null ? 0 : Math.max(.001,seconds - clock.resolved);
      const mouth = reduced.matches ? null : sound.mouth();
      art.draw(seconds,currentLine?.speaker,mouth,reduced.matches,resolved);
      cinema.update(now,art.actors.find(actor => actor.id === cinema.track),false);
      sound.tick(shot.chapter);
      const clip = sound.line === shot.line ? sound.voice.duration : 0;
      if (clock.mode === 'watch' && seconds >= Math.max(shot.seconds,Number.isFinite(clip) ? clip + .72 : 0)) {
        enter(clock.index + 1);
      }
    } else if (shot) {
      cinema.update(now,null,true);
    }
    requestAnimationFrame(tick);
  }

  $('watch').onclick = () => start('watch');
  $('play').onclick = () => start('play');
  $('next').onclick = () => { if (!waiting) enter(clock.index + 1); };
  $('previous').onclick = () => { if (clock.index > 0) enter(clock.index - 1); };
  $('restart').onclick = $('replay').onclick = () => {
    endCaption();
    opening();
    $('watch').focus({preventScroll:true});
  };
  $('pause').onclick = pause;
  $('audio-toggle').onclick = () => {
    sound.toggle();
    $('audio-toggle').setAttribute('aria-pressed',String(sound.audible));
    $('audio-label').textContent = sound.audible ? 'Sound on' : 'Sound off';
  };
  $('caption-toggle').onclick = () => {
    english = !english;
    $('caption-toggle').setAttribute('aria-pressed',String(english));
    $('english').hidden = !english;
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !exportMode && clock.paused === null) pause();
  });
  requestAnimationFrame(tick);

  if (exportMode) {
    document.body.classList.add('export');
    window.lpExport = {
      ready:() => ready,
      status:() => ({...exportState}),
      start(chapter) {
        const index = shots.findIndex(shot => shot.chapter === chapter);
        if (!ready || index < 0 || exportState.started) throw Error('Unknown or already started export chapter');
        const next = shots.findIndex((shot,i) => i > index && shot.chapter !== chapter);
        exportState.started = Date.now();
        start('watch',index,next < 0 ? shots.length : next);
        return exportState.started;
      }
    };
  }
})();
