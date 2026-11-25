(() => {
  'use strict';

  const phase = (value, from, to) => Math.max(0, Math.min(1, (value - from) / Math.max(Number.EPSILON, to - from)));
  const ease = t => t * t * (3 - 2 * t);
  const mix = (a, b, t) => a + (b - a) * t;
  const point = (x, y, angle = 0) => ({ x, y, angle });
  const between = (a, b, t) => point(mix(a.x, b.x, t), mix(a.y, b.y, t), mix(a.angle, b.angle, t));
  const transform = (node, value) => node.setAttribute('transform', value);
  const opacity = (node, value) => node.setAttribute('opacity', String(value));
  const scale = .93;
  const seats = { fox: point(418, 608), stork: point(945, 612) };
  const dalPlate = point(524, 542);
  const sparePlate = point(605, 581);
  const kheerPlate = point(648, 550);
  const foxJug = point(541, 535);
  const emptyJug = point(448, 603);
  const storkJug = point(793, 537);
  const storkPlate = point(743, 545);
  const storkPlateTap = point(storkPlate.x + 34, storkPlate.y - 1, -57);
  // The steep beak angle carries the tip through the centre of the rim.
  const storkJugSip = point(storkJug.x - 3, storkJug.y - 83, -82);
  const foxHeadPivot = point(42, -124);
  const tongueTip = point(78, 25);
  const noseTip = point(96, -7);
  const beakLength = 124;
  const sharedFox = point(500, 626);

  function lineFor(scene, id) {
    return scene.lines.find(line => line.id === id);
  }

  function wordAt(scene, id, word) {
    const line = lineFor(scene, id);
    const index = line.reading.words.findIndex(value => value.replace(/\p{P}/gu, '') === word);
    return line.start + (line.reading.timings[index]?.[0] ?? line.duration / 2);
  }

  function cuesFor(scene) {
    switch (scene.id) {
      case 'invitation':
        return { arrive: wordAt(scene, 'the-garden', 'ਸਾਰਸ'), speak: lineFor(scene, 'fox-invites').start };
      case 'plates':
        return { lap: wordAt(scene, 'shallow-plates', 'ਛੇਤੀ'), empty: wordAt(scene, 'shallow-plates', 'ਚੱਟ'),
          try: wordAt(scene, 'shallow-plates', 'ਚੁੰਝ'), speak: lineFor(scene, 'stork-struggles').start };
      case 'return-invitation':
        return { try: wordAt(scene, 'one-more-try', 'ਕੋਸ਼ਿਸ਼'), speak: lineFor(scene, 'stork-invites').start };
      case 'jugs':
        return { arrive: wordAt(scene, 'narrow-jugs', 'ਗਈ'), jugs: wordAt(scene, 'narrow-jugs', 'ਸੁਰਾਹੀਆਂ') };
      case 'narrow-mouth':
        return { sip: wordAt(scene, 'fox-cant-reach', 'ਚੁੰਝ'), try: wordAt(scene, 'fox-cant-reach', 'ਮੂੰਹ'),
          speak: lineFor(scene, 'fox-understands').start };
      case 'new-plate':
        return { plate: lineFor(scene, 'stork-offers-a-plate').end - 110, pour: wordAt(scene, 'pour-into-plate', 'ਪਾ') };
      case 'shared-meal':
        return { eat: wordAt(scene, 'end-together', 'ਇਕੱਠੇ') };
    }
  }

  function eventsFor(scene) {
    const cue = cuesFor(scene);
    switch (scene.id) {
      case 'invitation': return [{ ms: 600, sound: 'chirp' }, { ms: cue.arrive + 720, sound: 'step' }];
      case 'plates': return [{ ms: cue.lap + 500, sound: 'sip' }, { ms: cue.try + 450, sound: 'ribbon' }];
      case 'return-invitation': return [{ ms: cue.try + 400, sound: 'ribbon' }];
      case 'jugs': return [{ ms: 580, sound: 'chirp' }, { ms: cue.arrive - 360, sound: 'step' },
        { ms: cue.jugs + 390, sound: 'ribbon' }];
      case 'narrow-mouth': return [{ ms: cue.sip + 510, sound: 'sip' }, { ms: cue.try + 570, sound: 'ribbon' }];
      case 'new-plate': return [{ ms: cue.plate + 1020, sound: 'ribbon' },
        { ms: cue.pour + 120, sound: 'sip' }, { ms: cue.pour + 430, sound: 'plop' }];
      case 'shared-meal': return [{ ms: cue.eat + 440, sound: 'chirp' }];
    }
  }

  function walk(actor, ms, from, to, a, b, move) {
    const progress = move(phase(ms, from, to));
    Object.assign(actor, between(a, b, progress));
    actor.stride = Math.sin((b.x - a.x) * progress / 13.5) *
      ease(phase(progress, 0, .07)) * (1 - ease(phase(progress, .93, 1)));
  }

  function action(ms, begin, settled, release, end) {
    return ease(phase(ms, begin, settled)) * (1 - ease(phase(ms, release, end)));
  }

  function jugPoint(pose, x, y) {
    const angle = pose.angle * Math.PI / 180;
    const pivot = 29;
    return point(pose.x + pivot + (x - pivot) * Math.cos(angle) - y * Math.sin(angle),
      pose.y + (x - pivot) * Math.sin(angle) + y * Math.cos(angle));
  }

  function aimFox(fox, feature, target, amount) {
    // Keep her feet planted and rotate the head until the muzzle reaches the dish.
    const radius = Math.hypot(feature.x, feature.y);
    const down = (target.y - fox.y) / scale - foxHeadPivot.y;
    const dip = Math.asin(Math.max(-1, Math.min(1, down / radius)));
    const angle = (dip - Math.atan2(feature.y, feature.x)) * 180 / Math.PI;
    const x = target.x - scale * (foxHeadPivot.x + radius * Math.cos(dip));
    fox.x = mix(fox.x, x, amount);
    fox.angle = angle * amount;
  }

  function makeFrame(scene, cue, ms, still) {
    const move = still ? Math.round : ease;
    const fox = { ...seats.fox, stride: 0, effort: 0, lapping: 0 };
    const bird = { ...seats.stork, stride: 0, reach: 0, goal: null };
    const state = { fox, bird, canal: false, plate: dalPlate, plateVisible: 1, storkPlate: 1,
      food: 1, jug: foxJug, jugCleared: false, pouring: 0 };
    const reach = (goal, amount) => {
      bird.goal = goal;
      bird.reach = amount;
    };
    const lap = amount => {
      const spot = point(state.plate.x - 20 * Math.sqrt(state.food), state.plate.y - 1);
      aimFox(fox, tongueTip, spot, amount);
      fox.lapping = amount;
    };
    const secondDay = () => {
      state.canal = true;
      state.plateVisible = 0;
      state.storkPlate = 0;
      state.food = 0;
    };

    switch (scene.id) {
      case 'invitation':
        walk(bird, ms, cue.arrive - 380, cue.speak - 210, point(1141, 621), seats.stork, move);
        break;
      case 'plates': {
        const eating = action(ms, cue.lap - 190, cue.lap + 290, cue.empty + 410, cue.empty + 1040);
        state.food = 1 - ease(phase(ms, cue.lap + 420, cue.empty + 380));
        lap(eating);
        const peck = action(ms, cue.try - 90, cue.try + 480, cue.speak - 420, cue.speak - 30);
        reach(storkPlateTap, peck);
        break;
      }
      case 'return-invitation':
        state.food = 0;
        reach(storkPlateTap, action(ms, cue.try - 390, cue.try + 330, cue.try + 900, cue.try + 1430));
        break;
      case 'jugs':
        secondDay();
        walk(fox, ms, 250, cue.arrive + 650, point(163, 628), seats.fox, move);
        break;
      case 'narrow-mouth': {
        secondDay();
        reach(storkJugSip, action(ms, cue.sip - 200, cue.sip + 440, cue.try - 410, cue.try + 70));
        const lean = action(ms, cue.try - 180, cue.try + 600, cue.speak - 350, cue.speak + 30);
        aimFox(fox, noseTip, jugPoint(state.jug, -19, -104), lean);
        fox.effort = ease(phase(ms, cue.try, cue.speak + 280));
        break;
      }
      case 'new-plate': {
        secondDay();
        state.plateVisible = 1;
        const place = cue.plate + 1170;
        walk(bird, ms, cue.plate - 970, cue.plate + 110, seats.stork, point(816, 596), move);
        const carry = move(phase(ms, cue.plate + 320, place));
        state.plate = between(sparePlate, kheerPlate, carry);
        state.plate.y -= (still ? 0 : Math.sin(Math.PI * carry) * 30);
        state.food = move(phase(ms, cue.pour + 240, cue.pour + 1280));
        const leanJug = action(ms, cue.pour - 540, cue.pour + 260, cue.pour + 1110, cue.pour + 1730);
        const clearStart = cue.pour + 1660;
        const clearEnd = Math.min(cue.pour + 2610, scene.duration - 520);
        const clear = move(phase(ms, clearStart, clearEnd));
        state.jug = between(foxJug, emptyJug, clear);
        state.jug.y -= (still ? 0 : 26 * Math.sin(Math.PI * clear));
        state.jug.angle = 61 * (still ? Math.round(leanJug) : leanJug);
        state.jugCleared = clear === 1;
        state.pouring = action(ms, cue.pour + 180, cue.pour + 370, cue.pour + 1080, cue.pour + 1310);
        if (ms < cue.pour - 760) {
          reach(point(state.plate.x + 57, state.plate.y - 4, -65),
            action(ms, cue.plate + 30, cue.plate + 310, place + 55, place + 470));
        } else {
          const handle = jugPoint(state.jug, 55, -70);
          reach(point(handle.x, handle.y, -39),
            action(ms, cue.pour - 960, cue.pour - 530, clearEnd + 20, clearEnd + 420));
        }
        if (ms >= clearEnd + 120) {
          walk(bird, ms, clearEnd + 120, scene.duration - 80, point(764, 603), seats.stork, move);
        } else if (ms >= clearStart) {
          walk(bird, ms, clearStart, clearEnd - 70, point(816, 596), point(764, 603), move);
        }
        walk(fox, ms, clearStart + 460, scene.duration - 100, seats.fox, sharedFox, move);
        break;
      }
      case 'shared-meal': {
        secondDay();
        Object.assign(fox, sharedFox);
        state.plate = kheerPlate;
        state.plateVisible = 1;
        state.jug = emptyJug;
        state.jugCleared = true;
        const eat = ease(phase(ms, cue.eat - 230, cue.eat + 580));
        state.food = 1 - .42 * ease(phase(ms, cue.eat + 300, cue.eat + 6300));
        const sip = still ? 1 : action(Math.max(0, ms - cue.eat + 300) % 3050, 0, 500, 1860, 2790);
        lap(eat * (.35 + .65 * sip));
        reach(storkJugSip, sip * eat);
        break;
      }
    }
    return state;
  }

  class SupperStage {
    constructor(svg) {
      this.svg = svg;
      this.camera = new window.UmtoCamera.DeliveryCamera(svg);
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      window.LittlePanthFox.mount(svg, svg.querySelector('#fox-mount'));
      this.parts = Object.fromEntries([...svg.querySelectorAll('[id]')].map(node => [node.id, node]));
      const p = this.parts;
      p['fox-head'].append(p['fox-tongue']);
      p['fox-face-plane'].append(p['fox-head']);
      p['stork-face-plane'].append(p['stork-head']);
      transform(p['stork-jug'], 'translate(' + storkJug.x + ' ' + storkJug.y + ')');
      transform(p['stork-plate'], 'translate(' + storkPlate.x + ' ' + storkPlate.y + ')');
    }

    select(scene) {
      this.scene = scene;
      this.cue = cuesFor(scene);
      this.lastShot = '';
    }

    frame(ms, line, state, still) {
      const { id, framing, focus } = this.scene;
      const cue = this.cue;
      const shotAt = (preset, x, y, width, motion = 'static') =>
        ({ preset, focus: point(x, y), width, motion, parallax: motion === 'tracking' });
      let shot = { preset: framing, focus };
      if (id === 'invitation' && line.speaker === 'fox') {
        shot = shotAt('two-shot', 616, 441, 1004);
      } else if (id === 'plates' && ms >= cue.lap - 360 && ms < cue.try - 260) {
        shot = shotAt('detail', 491, 484, 687);
      } else if (id === 'plates' && ms >= cue.try - 260) {
        shot = shotAt('medium', 776, 440, 761);
      } else if (id === 'return-invitation') {
        shot = shotAt('two-shot', 673, 447, line.speaker === 'stork' ? 981 : 849);
      } else if (id === 'jugs' && ms < cue.arrive + 580 && !still) {
        shot = shotAt('full', Math.round((state.fox.x + 940) / 2), 443, 1110, 'tracking');
      } else if (id === 'jugs' && ms >= cue.jugs - 250) {
        shot = shotAt('two-shot', 664, 430, 956);
      } else if (id === 'narrow-mouth') {
        shot = ms < cue.try - 280
          ? shotAt('detail', 788, 434, 745)
          : shotAt('medium', 505, 442, line.speaker === 'fox' ? 648 : 698);
      } else if (id === 'new-plate') {
        shot = ms >= cue.pour - 840 && ms < cue.pour + 1370
          ? shotAt('detail', 652, 454, 705)
          : shotAt('two-shot', 679, 442, 972);
      } else if (id === 'shared-meal' && line.speaker === 'fox') {
        shot = shotAt('two-shot', 676, 450, 997);
      } else if (id === 'shared-meal' && ms >= cue.eat - 370 && ms < this.scene.duration - 2200) {
        shot = shotAt('two-shot', 677, 454, 925);
      }
      const key = [shot.preset, shot.focus.x, shot.focus.y, shot.width, shot.motion].join('/');
      if (key !== this.lastShot) {
        this.camera.cue({ ...shot, cut: true });
        this.lastShot = key;
      }
    }

    paintFox(pose, ms, speaking, opening, still) {
      const p = this.parts;
      const stride = still ? 0 : 23 * pose.stride;
      const body = 'translate(' + pose.x + ' ' + (pose.y - Math.abs(stride) * .13) + ') scale(' + scale + ')';
      transform(p.fox, body);
      transform(p['fox-face-plane'], body);
      p['fox-shadow'].setAttribute('cx', pose.x - 37);
      p['fox-shadow'].setAttribute('cy', pose.y + 2);
      window.LittlePanthFox.draw(p, {
        walk: stride, head: pose.angle, worry: pose.effort, headMotion: false
      }, ms, still, speaking, opening);
      const chewing = still ? 0 : pose.lapping * (2.6 + 2.6 * Math.sin(ms / 85));
      transform(p['fox-jaw'], 'rotate(' + (speaking ? 6 * opening : chewing) + ' 33 12)');
      opacity(p['fox-tongue'], speaking ? 0 : ease(phase(pose.lapping, .62, .95)));
      p.fox.dataset.speaking = String(speaking);
    }

    paintStork(pose, ms, speaking, opening, still) {
      const p = this.parts;
      const stride = still ? 0 : 18 * pose.stride;
      const y = pose.y - .16 * Math.abs(stride);
      const body = 'translate(' + pose.x + ' ' + y + ')';
      const face = p['stork-face-plane'];
      const layer = p[this.scene.id === 'new-plate' ? 'faces-over-jugs' : 'faces-over-plates'];
      if (face.parentElement !== layer) layer.append(face);
      transform(p.stork, body);
      transform(face, body);
      p['stork-shadow'].setAttribute('cx', pose.x + 9);
      p['stork-shadow'].setAttribute('cy', pose.y + 2);
      transform(p['stork-far-leg'], 'rotate(' + stride + ' -5 -176)');
      transform(p['stork-near-leg'], 'rotate(' + (-stride) + ' 25 -172)');
      const angle = mix(-3, pose.goal?.angle ?? -3, pose.reach);
      const head = point(-79, -293 + (still ? 0 : 2.4 * Math.sin(ms / 539)));
      if (pose.goal) {
        const radians = pose.goal.angle * Math.PI / 180;
        const tip = point(pose.goal.x - pose.x + beakLength * Math.cos(radians),
          pose.goal.y - y + beakLength * Math.sin(radians));
        Object.assign(head, between(head, tip, pose.reach));
      }
      const curve = 'M-57-175 C-106-193 ' + (head.x + 19) + ' ' + (head.y + 47) +
        ' ' + (head.x + 6) + ' ' + (head.y + 13);
      for (const id of ['neck-guide', 'neck-feathers', 'neck-light']) p[id].setAttribute('d', curve);
      transform(p['stork-head'], 'translate(' + head.x + ' ' + head.y + ') rotate(' + angle + ')');
      transform(p['stork-lower-beak'], 'rotate(' + (speaking ? -12 * opening : 0) + ' -26 1)');
      const blink = !still && (ms + 1200) % 4310 > 4180;
      opacity(p['stork-eye'], blink ? 0 : 1);
      opacity(p['stork-eye-glint'], blink ? 0 : 1);
      opacity(p['stork-lid'], blink ? 1 : 0);
      p.stork.dataset.speaking = String(speaking);
      p.stork.dataset.reaching = String(pose.reach > .65);
    }

    paintMeal(state, ms, still) {
      const p = this.parts;
      opacity(p['canal-scene'], Number(state.canal));
      transform(p['canal-ripples'], 'translate(' + (still ? 0 : 11 * Math.sin((this.scene.episodeStart + ms) / 2800)) + ' 0)');
      opacity(p['stork-plate'], state.storkPlate);
      opacity(p['fox-plate'], state.plateVisible);
      transform(p['fox-plate'], 'translate(' + state.plate.x + ' ' + state.plate.y + ')');
      opacity(p['fox-food'], state.food > .03 ? 1 : 0);
      transform(p['fox-food'], 'scale(' + Math.max(.01, Math.sqrt(state.food)) + ' ' + Math.max(.01, state.food) + ')');
      p['fox-food-fill'].setAttribute('fill', state.canal ? 'url(#kheer)' : 'url(#dal)');
      opacity(p.jugs, Number(state.canal));
      const jugLayer = state.jugCleared ? p['cleared-jug'] : p.jugs;
      if (p['fox-jug'].parentElement !== jugLayer) jugLayer.append(p['fox-jug']);
      transform(p['fox-jug'], 'translate(' + state.jug.x + ' ' + state.jug.y + ') rotate(' + state.jug.angle + ' 29 0)');
      opacity(p['pour-stream'], state.pouring);
      if (state.pouring > 0) {
        const lip = jugPoint(state.jug, 17, -105);
        const stream = 'M' + lip.x + ' ' + lip.y + ' Q' + (lip.x + 18) + ' ' + (lip.y + 32) +
          ' ' + state.plate.x + ' ' + state.plate.y;
        p['kheer-stream'].setAttribute('d', stream);
        p['kheer-glint'].setAttribute('d', stream);
      }
      this.svg.dataset.foxFood = state.food <= .03 ? 'empty' : state.food >= .99 ? 'full' : 'partial';
      this.svg.dataset.meal = state.storkPlate ? 'plates' : state.plateVisible ? 'shared' : 'jugs';
    }

    draw(ms, line, word) {
      const still = this.reduced.matches;
      const state = makeFrame(this.scene, this.cue, ms, still);
      this.frame(ms, line, state, still);
      const speech = word >= 0 && ['fox', 'stork'].includes(line.speaker);
      const beat = speech ? phase(ms - line.start, ...line.reading.timings[word]) : 0;
      const voiced = speech && beat > .06 && beat < .95;
      const vowel = speech && /[ਆਓਔਾੌੂੋ]/u.test(line.reading.words[word]);
      const opening = voiced ? .18 + Math.sin(Math.PI * beat) * (vowel ? .77 : .55) : 0;
      this.paintFox(state.fox, ms, voiced && line.speaker === 'fox', opening, still);
      this.paintStork(state.bird, ms, voiced && line.speaker === 'stork', opening, still);
      this.paintMeal(state, ms, still);
    }
  }


  window.LittlePanthStage = { Stage: SupperStage, eventsFor, prepare: window.LittlePanthFox.prepare };
})();
