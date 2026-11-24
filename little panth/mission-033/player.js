(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const book = $('book');
  const movie = $('movie');
  const readingLine = $('reading');
  const params = new URLSearchParams(location.search);
  const reviewing = params.get('review') === '1';
  const { makeReading, readingAt } = window.LP004Reading;
  const stageModule = window.LittlePanthStage || window.LP005Stage;
  const Stage = stageModule.Stage || stageModule.CrowStage;
  const { eventsFor } = stageModule;
  const sound = new window.LP005Sound();
  let scenes = [];
  let stage;
  let review;
  let selected = 0;
  let position = 0;
  let playing = false;
  let activated = false;
  let startedAt = 0;
  let lineInFrame = null;
  let phraseKey = '';
  let wordInFrame = -1;
  let wordNodes = [];
  let frameRequest = 0;
  let playRequest = 0;
  let voicesReady = false;
  // Keep an earlier cached 404 from a freshly published story from suppressing recorded voices.
  sound.decode = async url => { const r = await fetch(url, { cache: 'no-cache' }); return r.ok ? sound.context.decodeAudioData(await r.arrayBuffer()) : null; };

  async function read(url, type = 'json') {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw Error('Could not load ' + url);
    return type === 'text' ? response.text() : response.json();
  }

  function compile(data, voiceManifest, timings) {
    let episodeStart = 0;
    return data.scenes.map((entry, sceneIndex) => {
      let start = sceneIndex === 0 ? 320 : 170;
      const lines = entry.lines.map(id => {
        const line = data.lines[id];
        const voice = voiceManifest[id];
        const timing = timings[id];
        const buffer = sound.clips.get(id);
        const aligned = Boolean(buffer && timing?.dialogueHash === voice?.hash &&
          timing.words.length === line.pa.trim().split(/\s+/u).length);
        const duration = buffer ? Math.round(buffer.duration * 1000) : Math.max(1550, line.pa.trim().split(/\s+/u).length * 455);
        const reading = makeReading(line.pa, duration, aligned ? timing.words : null);
        const record = { id, ...line, reading, duration, start, end: start + duration, aligned };
        start = record.end + 185;
        return record;
      });
      const duration = start + (sceneIndex === data.scenes.length - 1 ? 1480 : 450);
      const scene = { ...entry, lines, duration, episodeStart };
      scene.events = eventsFor(scene);
      episodeStart += duration;
      return scene;
    });
  }

  function renderWords(line, offset) {
    const { phrase, word } = readingAt(line.reading, offset);
    const { first, end } = line.reading.phrases[phrase];
    const key = line.id + ':' + phrase;
    if (key !== phraseKey) {
      const elements = document.createDocumentFragment();
      wordNodes = [];
      for (let i = first; i < end; i++) {
        const tag = document.createElement('span');
        tag.className = 'word';
        tag.textContent = line.reading.words[i];
        if (i > first) elements.append(' ');
        elements.append(tag);
        wordNodes.push(tag);
      }
      readingLine.replaceChildren(elements);
      phraseKey = key;
      wordInFrame = -1;
    }
    if (wordInFrame !== word) {
      wordNodes[wordInFrame - first]?.removeAttribute('aria-current');
      wordNodes[word - first]?.setAttribute('aria-current', 'true');
      wordInFrame = word;
    }
    return word;
  }

  function draw(ms) {
    const scene = scenes[selected];
    position = Math.max(0, Math.min(ms, scene.duration));
    lineInFrame = scene.lines.findLast(line => line.start <= position) || scene.lines[0];
    const word = renderWords(lineInFrame, position - lineInFrame.start);
    stage.draw(position, lineInFrame, word);
    review?.update(selected, position, lineInFrame, playing);
  }

  function stop() {
    playRequest++;
    playing = false;
    sound.stop();
    cancelAnimationFrame(frameRequest);
  }

  function select(index) {
    selected = index;
    const scene = scenes[index];
    book.dataset.layout = scene.layout || 'spread';
    book.dataset.caption = scene.caption || 'bottom';
    book.dataset.scene = scene.id;
    stage.select(scene);
    draw(0);
  }

  function loop(now) {
    if (!playing) return;
    const scene = scenes[selected];
    const at = sound.elapsed() ?? (now - startedAt);
    if (at < scene.duration) {
      draw(at);
      frameRequest = requestAnimationFrame(loop);
      return;
    }
    if (!reviewing && selected + 1 < scenes.length) {
      select(selected + 1);
      play();
      return;
    }
    stop();
    draw(scene.duration);
  }

  function play() {
    playing = true;
    if (position >= scenes[selected].duration) draw(0);
    startedAt = performance.now() - position;
    if (activated) sound.playScene(scenes[selected], position);
    cancelAnimationFrame(frameRequest);
    draw(position);
    frameRequest = requestAnimationFrame(loop);
  }

  async function playWithSound(restart = false) {
    if (!scenes.length) return;
    const request = ++playRequest;
    if (restart) select(reviewing ? selected : 0);
    if (!voicesReady) {
      if (!reviewing) { $('loading').hidden = false; $('loading').textContent = 'ਪੰਜਾਬੀ ਆਵਾਜ਼ਾਂ ਲੋਡ ਨਹੀਂ ਹੋਈਆਂ।'; }
      return;
    }
    let unlocked = false;
    try { unlocked = await sound.unlock(); } catch {}
    if (request !== playRequest) return;
    activated = unlocked;
    play();
  }

  async function revisionFor(data, manifest, timings) {
    const edition = document.querySelector('meta[name="mission-revision"]').content;
    if (!window.crypto?.subtle) return edition;
    const input = new TextEncoder().encode(JSON.stringify([edition, data, manifest, timings, sound.generatedScore]));
    const digest = await window.crypto.subtle.digest('SHA-256', input);
    return edition + '-' + [...new Uint8Array(digest).slice(0, 6)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async function start() {
    const [data, drawing, manifest, timings] = await Promise.all([
      read('dialogue.json'),
      read('art/stage.svg?v=meadow2', 'text'),
      read('audio/generation-manifest.json').catch(() => ({})),
      read('audio/word-timings.json').catch(() => ({})),
      document.fonts.load('700 48px "Little Panth Gurmukhi"', book.getAttribute('aria-label')).catch(() => {}),
      stageModule.prepare?.()
    ]);
    const svg = new DOMParser().parseFromString(drawing, 'image/svg+xml').documentElement;
    if (svg.localName !== 'svg') throw Error('The illustration is invalid');
    const stageElement = document.importNode(svg, true);
    movie.prepend(stageElement);
    stage = new Stage(stageElement);

    const voiceIds = Object.keys(data.lines).filter(id => manifest[id]?.text === data.lines[id].pa && /^gemini-/i.test(manifest[id]?.model || ''));
    const originalScore = data.score === 'original' || data.score === 'orchard';
    await sound.load(voiceIds, originalScore ? null : undefined, data.score);
    scenes = compile(data, manifest, timings);
    voicesReady = voiceIds.length === Object.keys(data.lines).length && sound.clips.size === voiceIds.length && scenes.every(s => s.lines.every(l => l.aligned));
    movie.dataset.voiceStatus = voicesReady ? 'ready' : 'incomplete';
    if (reviewing) {
      const revision = await revisionFor(data, manifest, timings);
      review = window.createLP005Review(data, scenes, revision, {
        count: sound.clips.size,
        total: Object.keys(data.lines).length,
        aligned: scenes.flatMap(scene => scene.lines).filter(line => line.aligned).length,
        generatedScore: sound.generatedScore
      }, {
        select(index) { stop(); select(index); },
        seek(ms) { stop(); draw(ms); },
        toggle() {
          if (playing) { stop(); draw(position); }
          else playWithSound();
        },
        restart() { stop(); playWithSound(true); }
      });
    }
    $('loading').hidden = true;
    const initial = reviewing ? scenes.findIndex(scene => scene.id === params.get('scene')) : 0;
    select(Math.max(0, initial));
    if (!reviewing) {
      if (voicesReady) {
        // Match the earlier storybooks: tap the picture to hear the recorded narration.
        play();
        if (navigator.getAutoplayPolicy?.('audiocontext') === 'allowed') playWithSound(true);
      } else {
        $('loading').hidden = false;
        $('loading').textContent = 'ਪੰਜਾਬੀ ਆਵਾਜ਼ਾਂ ਲੋਡ ਨਹੀਂ ਹੋਈਆਂ।';
      }
    }
    if (params.get('test') === '1') {
      const mission = String(data.mission || 5).padStart(3, '0');
      window['lp' + mission + 'Test'] = {
        seek(index, ms) { stop(); select(index); draw(ms); },
        play: () => playWithSound(),
        state: () => ({
          scene: selected, position, playing, audioActive: sound.elapsed() !== null,
          words: lineInFrame?.reading.words, line: lineInFrame?.id,
          word: wordInFrame, clips: sound.clips.size, voicesReady, generatedScore: sound.generatedScore,
          scenes: scenes.map(scene => ({
            id: scene.id, duration: scene.duration, events: scene.events,
            lines: scene.lines.map(({ id, speaker, start, end, reading, aligned }) => ({ id, speaker, start, end, reading, aligned }))
          }))
        })
      };
    }
  }

  function hear() {
    if (reviewing || !scenes.length || (activated && playing)) return;
    if (!voicesReady) { location.reload(); return; }
    playWithSound(true);
  }

  movie.addEventListener('click', hear);
  movie.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      hear();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && playing) {
      stop();
      draw(position);
    } else if (!document.hidden && !reviewing && voicesReady && scenes.length && position < scenes[selected].duration) {
      play();
    }
  });
  window.addEventListener('pagehide', stop);
  start().catch(error => {
    $('loading').textContent = 'ਕਹਾਣੀ ਲੋਡ ਨਹੀਂ ਹੋ ਸਕੀ।';
    console.error(error.message);
  });
})();
