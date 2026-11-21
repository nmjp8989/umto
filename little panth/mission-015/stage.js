(() => {
  'use strict';

  const phase = (value, from, to) => Math.max(0, Math.min(1, (value - from) / Math.max(Number.EPSILON, to - from)));
  const ease = t => t * t * (3 - 2 * t);
  const mix = (a, b, t) => a + (b - a) * t;
  const point = (x, y) => ({ x, y });
  const transform = (node, value) => node.setAttribute('transform', value);
  const opacity = (node, value) => node.setAttribute('opacity', String(value));

  const { open, Character } = window.UmtoNativeCharacterPlayer;
  const cast = {
    mehar: { preset: 'kid-meher', view: 'right', height: 232, serial: 451 },
    boy: { preset: 'kid-sidak', view: 'left', height: 228, serial: 452 }
  };
  const banks = { mehar: point(119, 510), boy: point(1182, 519) };
  const leftApproach = 293;
  const rightApproach = 994;
  const channiStops = 519;
  const motiStops = 763;
  const channiSteps = 538;
  const turnout = point(1045, 414);
  const leftGrass = point(205, 576);
  const rightGrass = point(1090, 572);
  const colors = {
    channi: { coat: '#c38c62', shade: '#a36e55', hoof: '#79534a', accent: '#e4b88e',
      outline: '#855d49', light: '#ecbc8d', horn: '#d3b992', collar: '#588c8e' },
    moti: { coat: '#eee1bc', shade: '#c5ab90', hoof: '#8e7465', accent: '#f6eacb',
      outline: '#997f68', light: '#fff0cd', horn: '#c5b292', collar: '#ab6379' }
  };
  let studio;

  const lineFor = (scene, id) => scene.lines.find(line => line.id === id);

  function wordAt(scene, id, word) {
    const line = lineFor(scene, id);
    const index = line.reading.words.findIndex(value => value.replace(/\p{P}/gu, '') === word);
    return line.start + (line.reading.timings[index]?.[0] ?? line.duration / 2);
  }

  function cuesFor(scene) {
    switch (scene.id) {
      case 'canal':
        return { go: wordAt(scene, 'near-village', 'ਬੱਕਰੀਆਂ'), warning: lineFor(scene, 'mehar-warns') };
      case 'meet':
        return { climb: wordAt(scene, 'meet-midway', 'ਚੜ੍ਹੀ'), moti: wordAt(scene, 'meet-midway', 'ਮੋਤੀ'),
          stop: wordAt(scene, 'meet-midway', 'ਰੁਕ'), call: lineFor(scene, 'sidak-calls') };
      case 'creak':
        return { foot: wordAt(scene, 'plank-creaks', 'ਰੱਖਿਆ'), creak: wordAt(scene, 'plank-creaks', 'ਚਰਮਰਾਈ'),
          look: wordAt(scene, 'plank-creaks', 'ਹੇਠਾਂ') };
      case 'plan':
        return { plan: lineFor(scene, 'mehar-plan'), back: wordAt(scene, 'moti-backs-up', 'ਪਿੱਛੇ'),
          shore: wordAt(scene, 'moti-backs-up', 'ਕੰਢੇ') };
      case 'first-crossing':
        return { praise: lineFor(scene, 'sidak-praises'), start: lineFor(scene, 'channi-crosses').start,
          shore: wordAt(scene, 'channi-crosses', 'ਗਈ'), clear: wordAt(scene, 'channi-crosses', 'ਛੱਡ') };
      case 'second-crossing':
        return { start: wordAt(scene, 'moti-crosses', 'ਮੋਤੀ'), shore: wordAt(scene, 'moti-crosses', 'ਇੱਕੋ') + 470 };
      case 'grass':
        return { graze: wordAt(scene, 'grass-on-both-banks', 'ਘਾਹ'), smile: lineFor(scene, 'mehar-smiles') };
    }
  }

  function eventsFor(scene) {
    const cue = cuesFor(scene);
    switch (scene.id) {
      case 'canal': return [{ ms: 660, sound: 'chirp' }, { ms: cue.go + 620, sound: 'step' }];
      case 'meet': return [{ ms: cue.climb + 80, sound: 'step' }, { ms: cue.moti + 480, sound: 'step' },
        { ms: cue.stop - 190, sound: 'step' }];
      case 'creak': return [{ ms: cue.foot + 140, sound: 'step' }, { ms: cue.creak, sound: 'twig' },
        { ms: cue.look + 280, sound: 'sip' }];
      case 'plan': return [{ ms: cue.back + 170, sound: 'step' }, { ms: cue.back + 760, sound: 'step' },
        { ms: cue.shore + 430, sound: 'step' }];
      case 'first-crossing': return [{ ms: cue.start + 470, sound: 'step' }, { ms: cue.start + 950, sound: 'step' },
        { ms: cue.shore + 170, sound: 'ribbon' }];
      case 'second-crossing': return [{ ms: cue.start + 1270, sound: 'step' },
        { ms: cue.start + 1940, sound: 'step' }, { ms: cue.shore + 350, sound: 'step' }];
      case 'grass': return [{ ms: cue.graze + 240, sound: 'chirp' }];
    }
  }

  function trailY(x) {
    return mix(495, 457, ease(phase(x, leftApproach, 390))) +
      (500 - 457) * ease(phase(x, 886, rightApproach));
  }

  const trail = x => point(x, trailY(x));
  const goat = (x, facing) => ({ ...trail(x), facing, step: 0, headDip: 0, onTrail: true, walking: 0, distance: 0 });
  const actor = position => ({ ...position, lean: 0, grips: [] });

  function travel(goat, ms, from, to, start, end, move, onTrail = true) {
    const progress = move(phase(ms, from, to));
    goat.x = mix(start.x, end.x, progress);
    goat.y = onTrail ? trailY(goat.x) : mix(start.y, end.y, progress);
    goat.onTrail = onTrail;
    goat.distance = Math.hypot(end.x - start.x, end.y - start.y) * progress * Math.sign(end.x - start.x);
    goat.walking = ease(phase(progress, 0, .12)) * (1 - ease(phase(progress, .88, 1)));
  }

  function signal(actor, ms, line, facing) {
    const lift = ease(phase(ms, line.start - 190, line.start + 240));
    const lower = 1 - ease(phase(ms, line.end - 250, line.end + 220));
    actor.grips[facing > 0 ? 1 : 0] = {
      target: point(actor.x + facing * 51, actor.y - 125), weight: lift * lower * .81, hand: 'relaxed'
    };
  }

  function makeFrame(scene, cue, ms, still) {
    const move = still ? Math.round : ease;
    const channi = goat(leftApproach, 1);
    const moti = goat(rightApproach, -1);
    const mehar = actor(banks.mehar);
    const boy = actor(banks.boy);
    const state = { goats: { channi, moti }, actors: { mehar, boy }, flex: 0 };

    switch (scene.id) {
      case 'canal':
        travel(channi, ms, cue.go - 470, cue.go + 810, point(246, 505), trail(leftApproach), move, false);
        travel(moti, ms, cue.go - 220, cue.go + 1070, point(1072, 498), trail(rightApproach), move, false);
        signal(mehar, ms, cue.warning, 1);
        break;
      case 'meet':
        travel(channi, ms, cue.climb - 380, cue.stop - 120, trail(leftApproach), trail(channiStops), move);
        travel(moti, ms, cue.moti - 110, cue.stop + 50, trail(rightApproach), trail(motiStops), move);
        signal(boy, ms, cue.call, -1);
        break;
      case 'creak': {
        Object.assign(moti, trail(motiStops));
        const footDown = phase(ms, cue.foot - 490, cue.foot + 140);
        Object.assign(channi, trail(mix(channiStops, channiSteps, move(footDown))));
        channi.step = still ? 0 : 22 * Math.sin(Math.PI * footDown);
        const look = move(phase(ms, cue.look - 140, cue.look + 520));
        channi.headDip = 23 * look;
        moti.headDip = 20 * look;
        state.flex = still ? 0 : 2.7 * Math.sin(Math.PI * phase(ms, cue.creak - 35, cue.creak + 485));
        break;
      }
      case 'plan':
        Object.assign(channi, trail(channiSteps));
        channi.headDip = 23 * (1 - move(phase(ms, 80, 600)));
        travel(moti, ms, cue.back - 510, cue.shore - 100, trail(motiStops), trail(977), move);
        if (ms >= cue.shore - 100) {
          travel(moti, ms, cue.shore - 100, cue.shore + 750, trail(977), turnout, move, false);
        }
        moti.headDip = 20 * (1 - move(phase(ms, 50, 590)));
        signal(mehar, ms, cue.plan, 1);
        break;
      case 'first-crossing':
        Object.assign(moti, turnout, { onTrail: false });
        travel(channi, ms, cue.start - 140, cue.shore + 350, trail(channiSteps), trail(980), move);
        if (ms >= cue.shore + 350) {
          travel(channi, ms, cue.shore + 350, cue.clear + 660, trail(980), rightGrass, move, false);
        }
        signal(boy, ms, cue.praise, -1);
        break;
      case 'second-crossing': {
        Object.assign(channi, rightGrass, { onTrail: false });
        const stepOn = cue.start + 1120;
        if (ms < stepOn) {
          travel(moti, ms, cue.start - 260, stepOn, turnout, trail(973), move, false);
        } else if (ms < cue.shore) {
          travel(moti, ms, stepOn, cue.shore, trail(973), trail(328), move);
        } else {
          travel(moti, ms, cue.shore, scene.duration - 105, trail(328), leftGrass, move, false);
        }
        break;
      }
      case 'grass': {
        Object.assign(channi, rightGrass, { onTrail: false });
        Object.assign(moti, leftGrass, { onTrail: false });
        const eat = move(phase(ms, cue.graze - 340, cue.graze + 650));
        channi.headDip = eat * (still ? 61 : 58 + 5 * Math.sin(ms / 350));
        moti.headDip = eat * (still ? 60 : 57 + 5 * Math.sin(ms / 385 + 1));
        signal(mehar, ms, cue.smile, 1);
        break;
      }
    }
    return state;
  }

  function prepareGoat(container, template, name) {
    const artwork = template.cloneNode(true);
    artwork.id = name;
    for (const [property, color] of Object.entries(colors[name])) {
      artwork.style.setProperty('--goat-' + property, color);
    }
    container.append(artwork);
    return {
      root: artwork,
      head: artwork.querySelector('[data-head]'),
      tail: artwork.querySelector('[data-tail]'),
      legs: [...artwork.querySelectorAll('[data-leg]')]
    };
  }

  class BridgeStage {
    constructor(svg) {
      this.svg = svg;
      this.camera = new window.UmtoCamera.DeliveryCamera(svg);
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.parts = Object.fromEntries([...svg.querySelectorAll('[id]')].map(node => [node.id, node]));
      this.goats = Object.fromEntries(Object.keys(colors).map(name =>
        [name, prepareGoat(this.parts.goats, this.parts['goat-art'], name)]));
      this.puppets = Object.fromEntries(Object.entries(cast).map(([id, spec]) =>
        [id, new Character(studio, svg, this.parts[id], this.parts[id + '-props'], spec)]));
      this.glints = Array.from({ length: 17 }, () => {
        const node = document.createElementNS(svg.namespaceURI, 'use');
        node.setAttribute('href', '#sheen');
        this.parts.current.append(node);
        return node;
      });
    }

    select(scene) {
      this.scene = scene;
      this.cue = cuesFor(scene);
      this.lastShot = '';
    }

    frame(ms, line, still, state) {
      const { id, framing, focus } = this.scene;
      const cue = this.cue;
      const moti = state.goats.moti;
      const channi = state.goats.channi;
      const shotAt = (preset, x, y, width, motion = 'static') =>
        ({ preset, focus: point(x, y), width, motion, parallax: motion === 'tracking' });
      let shot = { preset: framing, focus };
      if (id === 'canal' && line.speaker === 'mehar') {
        shot = shotAt('medium', 253, 388, 695);
      } else if (id === 'meet' && line.speaker === 'boy') {
        shot = shotAt('medium', 976, 402, 775);
      } else if (id === 'creak' && ms < cue.look - 150) {
        shot = shotAt('detail', 613, 465, 615);
      } else if (id === 'creak') {
        shot = shotAt('two-shot', 640, 438, 739);
      } else if (id === 'plan' && ms > cue.back - 510) {
        shot = shotAt('full', Math.round(moti.x - 78), 412, 1002, still ? 'static' : 'tracking');
      } else if (id === 'first-crossing' && line.speaker === 'boy') {
        shot = shotAt('two-shot', 1072, 403, 735);
      } else if (id === 'first-crossing') {
        shot = shotAt('full', Math.round(channi.x + 93), 434, 1090, still ? 'static' : 'tracking');
      } else if (id === 'second-crossing') {
        shot = shotAt('full', Math.round(moti.x - 43), 434, 1090, still ? 'static' : 'tracking');
      } else if (id === 'grass' && line.speaker === 'mehar') {
        shot = shotAt('two-shot', 283, 442, 724);
      }
      const key = [shot.preset, shot.focus.x, shot.focus.y, shot.width, shot.motion].join('/');
      if (this.lastShot === key) return;
      this.camera.cue({ ...shot, cut: true });
      this.lastShot = key;
    }

    paintCanal(state, ms, still) {
      transform(this.parts['creaking-board'], 'translate(0 ' + state.flex + ')');
      const episodeTime = this.scene.episodeStart + ms;
      this.glints.forEach((node, index) => {
        const depth = (index * .207 + (still ? 0 : episodeTime / (13100 + index % 4 * 1670))) % 1;
        const x = 643 + ((index % 7) - 3) * mix(12, 99, depth);
        const y = mix(297, 759, depth ** 1.24);
        transform(node, 'translate(' + x + ' ' + y + ') scale(' + mix(.2, 1.37, depth) + ')');
        opacity(node, .52 * Math.sin(Math.PI * depth));
      });
    }

    paintGoats(state, ms, still) {
      const footPins = [[-43, -44], [35, -44], [-32, -44], [50, -44]];
      for (const [name, art] of Object.entries(this.goats)) {
        const { x, y, facing, walking, distance, onTrail, step, headDip } = state.goats[name];
        const scale = name === 'moti' ? mix(.83, .99, phase(y, turnout.y, 493)) : 1;
        const gait = distance / 9.2;
        const bounce = still ? 0 : -2.8 * walking * Math.abs(Math.sin(gait));
        const dipped = name === 'channi' ? state.flex : 0;
        transform(art.root, 'translate(' + x + ' ' + (y + bounce) + ') scale(' + (facing * scale) + ' ' + scale + ')');
        transform(art.head, 'translate(26 -74) rotate(' + (headDip + 3.1 * walking * Math.sin(gait)) + ')');
        transform(art.tail, 'rotate(' + (still ? 0 : 3.3 * Math.sin(ms / 340 + x / 100)) + ' -67 -68)');
        art.legs.forEach((leg, index) => {
          const [pinX, pinY] = footPins[index];
          const trailOffset = onTrail ? (trailY(x + facing * pinX * scale) - y) / scale : 0;
          const stride = still ? 0 : 22 * walking * Math.sin(gait + (index === 0 || index === 3 ? 0 : Math.PI));
          const accent = index === 3 ? step : 0;
          const plank = index === 3 ? dipped : 0;
          transform(leg, 'translate(' + pinX + ' ' + (pinY + trailOffset + plank) + ') rotate(' + (stride - accent) + ')');
        });
        art.root.dataset.location = onTrail && x > 350 && x < 928 ? 'bridge' : x < 640 ? 'left-bank' : 'right-bank';
        art.root.dataset.walking = String(!still && walking > .02);
        art.root.dataset.lookingDown = String(headDip >= 12);
      }
    }

    draw(ms, line, word) {
      const still = this.reduced.matches;
      const state = makeFrame(this.scene, this.cue, ms, still);
      this.frame(ms, line, still, state);
      this.paintCanal(state, ms, still);
      this.paintGoats(state, ms, still);
      const reading = word >= 0 ? {
        text: line.reading.words[word], phase: phase(ms - line.start, ...line.reading.timings[word])
      } : null;
      for (const [id, puppet] of Object.entries(this.puppets)) {
        const pose = state.actors[id];
        const shadow = this.parts[id + '-shadow'];
        shadow.setAttribute('cx', pose.x);
        shadow.setAttribute('cy', pose.y + 1);
        puppet.paint(pose, ms, line.speaker === id ? reading : null, still);
      }
    }
  }

  async function prepare() {
    studio = await open(document.getElementById('two-goats-studio'));
  }

  window.LittlePanthStage = { Stage: BridgeStage, eventsFor, prepare };
})();
