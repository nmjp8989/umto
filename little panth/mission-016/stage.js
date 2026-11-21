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
  const sharedFox = point(500, 626);
  let foxArt;

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
        return { plate: lineFor(scene, 'stork-offers-a-plate').end - 110, pour: wordAt(scene, 'pour-into-plate', 'ਪਾ'),
          together: wordAt(scene, 'pour-into-plate', 'ਦੋਵੇਂ') };
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

  function makeFrame(scene, cue, ms, still) {
    const move = still ? Math.round : ease;
    const fox = { ...seats.fox, stride: 0, effort: 0 };
    const bird = { ...seats.stork, stride: 0, reach: 0, goal: null };
    const state = { fox, bird, canal: false, plate: dalPlate, plateVisible: 1, storkPlate: 1,
      food: 1, jug: foxJug, pouring: 0 };
    const reach = (goal, amount) => {
      bird.goal = goal;
      bird.reach = amount;
    };
    const lap = amount => {
      fox.x += 8 * amount;
      fox.angle = amount * (43 + (still ? 0 : Math.sin(ms / 118) * 2.2));
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
        lap(eating);
        state.food = 1 - ease(phase(ms, cue.lap + 420, cue.empty + 380));
        const peck = action(ms, cue.try - 90, cue.try + 480, cue.speak - 420, cue.speak - 30);
        reach(point(743, 545, -46), peck);
        break;
      }
      case 'return-invitation':
        state.food = 0;
        reach(point(743, 544, -48), action(ms, cue.try - 390, cue.try + 330, cue.try + 900, cue.try + 1430));
        break;
      case 'jugs':
        secondDay();
        walk(fox, ms, 250, cue.arrive + 650, point(163, 628), seats.fox, move);
        break;
      case 'narrow-mouth': {
        secondDay();
        reach(point(793, 463, -65), action(ms, cue.sip - 200, cue.sip + 440, cue.try - 410, cue.try + 70));
        const lean = action(ms, cue.try - 180, cue.try + 600, cue.speak - 350, cue.speak + 30);
        fox.angle = -39 * lean;
        fox.effort = ease(phase(ms, cue.try, cue.speak + 280));
        fox.x += 4 * lean;
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
        state.jug = { ...foxJug, angle: 61 * (still ? Math.round(leanJug) : leanJug) };
        state.pouring = action(ms, cue.pour + 180, cue.pour + 370, cue.pour + 1080, cue.pour + 1310);
        if (ms < cue.pour - 760) {
          reach(point(state.plate.x + 57, state.plate.y - 4, -65),
            action(ms, cue.plate + 30, cue.plate + 310, place + 55, place + 470));
        } else {
          const handle = jugPoint(state.jug, 51, -72);
          reach(point(handle.x, handle.y, -39),
            action(ms, cue.pour - 960, cue.pour - 530, cue.pour + 1600, cue.pour + 1990));
        }
        if (ms >= cue.pour + 1910) {
          walk(bird, ms, cue.pour + 1910, Math.max(cue.together + 690, cue.pour + 2720), point(816, 596), seats.stork, move);
          walk(fox, ms, cue.pour + 1740, Math.max(cue.together + 690, cue.pour + 2670), seats.fox, sharedFox, move);
        }
        break;
      }
      case 'shared-meal': {
        secondDay();
        Object.assign(fox, sharedFox);
        state.plate = kheerPlate;
        state.plateVisible = 1;
        const eat = ease(phase(ms, cue.eat - 230, cue.eat + 580));
        const pause = still ? .88 : .88 + Math.sin(ms / 685) * .12;
        lap(eat * pause * .85);
        reach(point(793, 463, -63), eat * pause);
        state.food = 1 - .42 * ease(phase(ms, cue.eat + 300, cue.eat + 6300));
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
      svg.querySelector('defs').append(document.importNode(foxArt.fur, true));
      svg.querySelector('#fox-mount').append(document.importNode(foxArt.fox, true));
      svg.querySelector('#jugs').after(svg.querySelector('#plates'));
      this.parts = Object.fromEntries([...svg.querySelectorAll('[id]')].map(node => [node.id, node]));
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
      transform(p.fox, 'translate(' + pose.x + ' ' + (pose.y - Math.abs(stride) * .13) + ') scale(' + scale + ')');
      p['fox-shadow'].setAttribute('cx', pose.x - 37);
      p['fox-shadow'].setAttribute('cy', pose.y + 2);
      transform(p['fox-rear-far'], 'rotate(' + (-stride * .8) + ' -77 -84)');
      transform(p['fox-rear-near'], 'rotate(' + (stride * .83) + ' -76 -88)');
      transform(p['fox-front-far'], 'rotate(' + stride + ' 29 -104)');
      transform(p['fox-front-near'], 'rotate(' + (-stride) + ' 52 -101)');
      transform(p['fox-tail'], 'rotate(' + (still ? 0 : 4 * Math.sin(ms / 408) + .25 * stride) + ' -83 -89)');
      transform(p['fox-head'], 'translate(42 -124) rotate(' + pose.angle + ')');
      transform(p['fox-brow'], 'rotate(' + (14 * pose.effort) + ' 39 -31)');
      transform(p['fox-ears'], 'rotate(' + (-7 * pose.effort) + ' -6 -44)');
      const blink = !still && (ms + 530) % 4770 > 4630;
      opacity(p['fox-eye'], blink ? 0 : 1);
      opacity(p['fox-lid'], blink ? 1 : 0);
      transform(p['fox-jaw'], 'rotate(' + (speaking ? 14 * opening : 0) + ' 20 8)');
      transform(p['fox-mouth'], 'scale(1 ' + (.22 + opening * .95) + ')');
      opacity(p['fox-mouth'], Number(speaking));
      p.fox.dataset.speaking = String(speaking);
    }

    paintStork(pose, ms, speaking, opening, still) {
      const p = this.parts;
      const stride = still ? 0 : 18 * pose.stride;
      transform(p.stork, 'translate(' + pose.x + ' ' + (pose.y - .16 * Math.abs(stride)) + ')');
      p['stork-shadow'].setAttribute('cx', pose.x + 9);
      p['stork-shadow'].setAttribute('cy', pose.y + 2);
      transform(p['stork-far-leg'], 'rotate(' + stride + ' -5 -176)');
      transform(p['stork-near-leg'], 'rotate(' + (-stride) + ' 25 -172)');
      const angle = mix(-3, pose.goal?.angle ?? -3, pose.reach);
      const head = point(-79, -293 + (still ? 0 : 2.4 * Math.sin(ms / 539)));
      if (pose.goal) {
        const radians = pose.goal.angle * Math.PI / 180;
        const tip = point(pose.goal.x - pose.x + 123 * Math.cos(radians),
          pose.goal.y - pose.y + 123 * Math.sin(radians));
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

  async function prepare() {
    const response = await fetch('../mission-009/art/stage.svg');
    if (!response.ok) throw Error('The Little Panth fox could not be loaded.');
    const art = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
    foxArt = { fox: art.querySelector('#fox'), fur: art.querySelector('#fur') };
    if (!foxArt.fox || !foxArt.fur) throw Error('The Little Panth fox artwork is incomplete.');
  }

  window.LittlePanthStage = { Stage: SupperStage, eventsFor, prepare };
})();
