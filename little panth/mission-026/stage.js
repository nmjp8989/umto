(() => {
  'use strict';

  const { open, Character } = window.UmtoNativeCharacterPlayer;
  const point = (x, y) => ({ x, y });
  const mix = (a, b, t) => a + (b - a) * t;
  const offset = (p, x, y) => point(p.x + x, p.y + y);
  const between = (a, b, t) => point(mix(a.x, b.x, t), mix(a.y, b.y, t));
  const phase = (ms, start, end) => Math.max(0, Math.min(1, (ms - start) / Math.max(1, end - start)));
  const ease = t => t * t * (3 - 2 * t);
  const move = (ms, a, b) => ease(phase(ms, a, b));
  const coords = p => p.x + ' ' + p.y;
  const translate = p => 'translate(' + coords(p) + ')';
  const transform = (node, value) => node.setAttribute('transform', value);
  const opacity = (node, value) => node.setAttribute('opacity', String(Number(value)));
  const visibility = (node, value) => node.setAttribute('visibility', value ? 'visible' : 'hidden');
  const at = (ms, time, lead, hold, fade) => move(ms, time - lead, time) * (1 - move(ms, time + hold, time + fade));
  const turtleScale = .78;
  const turtleBite = point(149, -49);
  const gooseBill = point(42, 0);
  const ground = { first: point(459, 552), second: point(925, 560) };
  const overFields = { first: point(462, 271), second: point(916, 284) };
  const overPond = { first: point(482, 320), second: point(922, 333) };
  const splashSite = point(713, 588);
  const landed = [point(330, 594), point(845, 602)];
  const bank = [point(201, 616), point(1154, 635)];
  const children = {
    mehar: { preset: 'kid-meher', view: 'right', height: 225, serial: 584 },
    friend: { preset: 'kid-amir', view: 'right', height: 232, serial: 585 }
  };
  let studio;
  let turtleAsset;

  function rotated(p, degrees) {
    const radians = degrees * Math.PI / 180;
    return point(p.x * Math.cos(radians) - p.y * Math.sin(radians), p.x * Math.sin(radians) + p.y * Math.cos(radians));
  }

  function turtleBase(angle, size) {
    return rotated(point(-turtleBite.x * size, -turtleBite.y * size), angle);
  }

  function onLand(x, y, size = turtleScale) {
    return { mouth: point(x + turtleBite.x * size, y + turtleBite.y * size), angle: 0, size,
      mode: 'ashore', clip: 760, steps: 0 };
  }

  function freeBird(x, y, mirror = 1) {
    return { x, y, mirror, size: .94, wing: 0, rest: 0, bill: null };
  }

  function withBill(bird, bill, amount) {
    const natural = offset(bird, (86 + gooseBill.x) * bird.size * bird.mirror, -119 * bird.size);
    bird.bill = between(natural, bill, amount);
    bird.grip = amount > .998;
    return bird;
  }

  function stickMix(a, b, t) {
    return { first: between(a.first, b.first, t), second: between(a.second, b.second, t) };
  }

  function waveRod(rod, ms, still, drift = 0) {
    const float = still ? 0 : Math.sin(ms / 345) * 5.5;
    const turn = still ? 0 : Math.sin(ms / 559) * 4;
    return { first: offset(rod.first, drift, float - turn), second: offset(rod.second, drift, float + turn) };
  }

  function carry(frame, rod, strength, size = 1) {
    const [first, second] = [rod.first, rod.second];
    frame.stick = rod;
    frame.goose = withBill({ ...freeBird(first.x - 118 * size, first.y + 108 * size),
      size: .87 * size, wing: strength }, first, 1);
    frame.other = withBill({ ...freeBird(second.x + 122 * size, second.y + 113 * size, -1),
      size: .91 * size, wing: strength }, second, 1);
    frame.turtle = { mouth: between(first, second, .5), angle: -56, size: turtleScale * size,
      mode: 'holding', clip: 760, steps: 0 };
  }

  function wordAt(scene, id, word) {
    const line = scene.lines.find(item => item.id === id);
    const index = line.reading.words.findIndex(value => value.replace(/\p{P}/gu, '') === word);
    if (index < 0) throw Error('Missing "' + word + '" in ' + id);
    return line.start + (line.reading.timings[index]?.[0] ?? line.duration / 2);
  }

  function cuesFor(scene) {
    const word = (id, text) => wordAt(scene, id, text);
    switch (scene.id) {
      case 'dry-pond': return { shore: word('pond-is-drying', 'ਕੰਢੇ'), arrive: word('pond-is-drying', 'ਆਏ') };
      case 'hold-the-stick': return { bite: word('three-friends-take-off', 'ਫੜੇ'),
        middle: word('three-friends-take-off', 'ਫੜਿਆ'), lift: word('three-friends-take-off', 'ਉੱਪਰ') };
      case 'children-look-up': return { look: word('two-children-wave', 'ਉੱਪਰ'), wave: word('two-children-wave', 'ਹਿਲਾਏ') };
      case 'splash': return { pond: word('mouth-opens-stick-slips', 'ਤਲਾਬ'),
        open: word('mouth-opens-stick-slips', 'ਖੋਲ੍ਹਿਆ'), release: word('mouth-opens-stick-slips', 'ਛੁੱਟ'),
        hit: word('mouth-opens-stick-slips', 'ਛਪਾਕ') };
      case 'safe-at-the-bank': return { down: word('tortoise-swims-to-shore', 'ਹੇਠਾਂ'),
        head: word('tortoise-swims-to-shore', 'ਸਿਰ'), swim: word('tortoise-swims-to-shore', 'ਤੈਰ'),
        shore: word('tortoise-swims-to-shore', 'ਕੰਢੇ') };
      case 'in-the-shade': return { sit: word('friends-in-the-shade', 'ਬੈਠ') };
      default: return {};
    }
  }

  function eventsFor(scene) {
    const c = cuesFor(scene);
    const effect = (ms, sound) => ({ ms, sound });
    switch (scene.id) {
      case 'dry-pond': return [effect(580, 'chirp'), effect(c.arrive - 970, 'wings'), effect(c.arrive - 335, 'wings')];
      case 'hold-the-stick': return [effect(c.bite, 'twig'), effect(c.lift - 170, 'wings'), effect(c.lift + 530, 'wings')];
      case 'over-the-fields': return [effect(230, 'gust'), effect(800, 'wings'), effect(1920, 'wings')];
      case 'splash': return [effect(c.release, 'twig'), effect(c.hit, 'plop'), effect(c.hit + 200, 'sip')];
      case 'safe-at-the-bank': return [effect(c.down, 'wings'), effect(c.head, 'sip'), effect(c.swim + 420, 'sip')];
      case 'in-the-shade': return [effect(610, 'chirp'), effect(c.sit + 370, 'chirp')];
      default: return [];
    }
  }

  function makeFrame(scene, c, ms, still) {
    const frame = { goose: freeBird(landed[0].x, landed[0].y), other: freeBird(landed[1].x, landed[1].y, -1),
      turtle: onLand(541, 598), stick: null, field: false, dried: true, children: false, shade: 0,
      splash: null, wake: 0, scroll: 0, mouth: 0 };
    switch (scene.id) {
      case 'dry-pond': {
        const crossing = move(ms, c.shore - 840, c.shore + 380);
        frame.turtle = onLand(mix(495, 541, crossing), 598);
        frame.turtle.steps = crossing > 0 && crossing < 1 ? ms / 107 : 0;
        const left = move(ms, c.arrive - 2260, c.arrive - 160);
        const right = move(ms, c.arrive - 2060, c.arrive + 20);
        frame.goose = freeBird(mix(109, landed[0].x, left), mix(300, landed[0].y, left));
        frame.other = freeBird(mix(1283, landed[1].x, right), mix(329, landed[1].y, right), -1);
        frame.goose.wing = 1 - move(ms, c.arrive - 470, c.arrive + 30);
        frame.other.wing = 1 - move(ms, c.arrive - 290, c.arrive + 210);
        break;
      }
      case 'hold-the-stick': {
        const bite = move(ms, c.bite - 660, c.bite);
        const turtle = move(ms, c.middle - 525, c.middle);
        const lift = move(ms, c.lift - 215, c.lift + 1680);
        const rod = stickMix(ground, overFields, lift);
        carry(frame, rod, Math.max(lift, .58 * move(ms, c.lift - 410, c.lift + 260)));
        const runway = 1 - lift;
        frame.goose.y += (landed[0].y - ground.first.y - 108) * runway;
        frame.other.y += (landed[1].y - ground.second.y - 113) * runway;
        frame.other.x += (landed[1].x - ground.second.x - 122) * (1 - bite) * runway;
        withBill(frame.goose, rod.first, bite);
        withBill(frame.other, rod.second, bite);
        frame.turtle.mouth = between(onLand(544, 598).mouth, between(rod.first, rod.second, .5), turtle);
        frame.turtle.angle = -56 * lift;
        frame.turtle.mode = turtle > .998 ? 'holding' : 'ashore';
        break;
      }
      case 'over-the-fields': {
        frame.field = true;
        frame.scroll = still ? 0 : -154 * phase(ms, 0, scene.duration);
        carry(frame, waveRod(overFields, ms, still, -24 + 42 * phase(ms, 0, scene.duration)), 1);
        break;
      }
      case 'children-look-up': {
        frame.field = frame.children = true;
        const fly = move(ms, c.look - 300, scene.duration - 160);
        const x = mix(665, 897, fly);
        const rod = waveRod({ first: point(x - 91, 185), second: point(x + 84, 193) }, ms, still);
        carry(frame, rod, 1, .37);
        break;
      }
      case 'splash': {
        frame.dried = false;
        const float = waveRod(stickMix(overFields, overPond, move(ms, c.pond - 550, c.pond + 1410)),
          Math.min(ms, c.release), still);
        const leave = move(ms, c.hit - 70, c.hit + 2020);
        const rod = { first: offset(float.first, 17 * leave, -36 * leave),
          second: offset(float.second, 25 * leave, -34 * leave) };
        carry(frame, rod, 1);
        frame.mouth = move(ms, c.open, c.release) * (1 - move(ms, c.release + 135, c.release + 645));
        if (ms < c.release) break;
        const origin = between(float.first, float.second, .5);
        const hitAngle = -12;
        const base = turtleBase(hitAngle, turtleScale);
        const impactMouth = point(splashSite.x - base.x, splashSite.y - base.y);
        const fall = phase(ms, c.release, c.hit);
        const sink = move(ms, c.hit, c.hit + 570);
        frame.turtle = { mouth: offset(between(origin, impactMouth, fall ** 1.75), sink * 16, sink * 216),
          angle: mix(-56, hitAngle, fall) + sink * 5, mode: fall < 1 ? 'falling' : 'submerged',
          size: turtleScale, clip: fall < 1 ? 760 : splashSite.y, steps: 0 };
        if (ms >= c.hit) frame.splash = phase(ms, c.hit, c.hit + 1420);
        break;
      }
      case 'safe-at-the-bank': {
        frame.dried = false;
        const settle = move(ms, c.down - 1410, c.down + 540);
        frame.goose = freeBird(mix(440, bank[0].x, settle), mix(250, bank[0].y, settle));
        frame.other = freeBird(mix(1060, bank[1].x, settle), mix(279, bank[1].y, settle), -1);
        frame.goose.wing = frame.other.wing = 1 - move(ms, c.down + 170, c.down + 680);
        const rise = move(ms, c.head - 540, c.head + 660);
        const swim = move(ms, c.swim - 175, c.shore + 1320);
        const above = move(ms, c.shore + 220, c.shore + 1240);
        const finish = onLand(881, 668);
        const visible = point(811, mix(712, 565, rise));
        frame.turtle = { ...finish, mouth: between(visible, finish.mouth, swim), angle: -6 * (1 - above),
          clip: mix(splashSite.y, 760, above), mode: above > .997 ? 'ashore' : rise > .42 ? 'swimming' : 'submerged',
          steps: swim > 0 && above < .99 ? ms / 120 : 0 };
        frame.wake = rise * (1 - above);
        break;
      }
      case 'in-the-shade': {
        frame.dried = false;
        frame.shade = 1;
        const settle = move(ms, c.sit - 210, c.sit + 770);
        frame.goose = freeBird(405, 625 + 24 * settle);
        frame.other = freeBird(862, 643 + 28 * settle, -1);
        frame.goose.rest = frame.other.rest = settle;
        frame.turtle = onLand(580, 672 + settle * 3);
        break;
      }
    }
    return frame;
  }

  class GeeseStage {
    constructor(svg) {
      this.svg = svg;
      this.camera = new window.UmtoCamera.DeliveryCamera(svg);
      this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
      const defs = svg.querySelector('defs');
      for (const gradient of turtleAsset.gradients) defs.append(document.importNode(gradient, true));
      svg.querySelector('#tortoise-slot').append(document.importNode(turtleAsset.art, true));
      this.parts = Object.fromEntries([...svg.querySelectorAll('[id]')].map(node => [node.id, node]));
      this.kids = Object.fromEntries(Object.entries(children).map(([id, spec]) =>
        [id, new Character(studio, svg, this.parts[id], this.parts[id + '-props'], spec)]));
      this.birds = Object.fromEntries(['goose', 'second-goose'].map(id => {
        const root = this.parts[id];
        root.append(...this.parts['goose-pattern'].cloneNode(true).children);
        const choose = (attribute, value) => root.querySelector('[data-' + attribute + '="' + value + '"]');
        return [id, { root, head: choose('head', 'head'), bill: choose('beak', 'contact'), jaw: choose('jaw', 'jaw'),
          eye: choose('eye', 'eye'), glint: choose('glint', 'glint'), lid: choose('lid', 'lid'),
          neck: [choose('neck', 'edge'), choose('neck', 'fill')],
          wings: [choose('wing', 'far'), choose('wing', 'near')], feet: choose('feet', 'legs') }];
      }));
      this.droplets = Array.from({ length: 10 }, (_, i) => {
        const drop = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        drop.setAttribute('rx', String(2 + i % 3 * .58));
        drop.setAttribute('ry', String(2.8 + i % 4 * .54));
        this.parts['splash-droplets'].append(drop);
        return drop;
      });
    }

    select(scene) {
      this.scene = scene;
      this.cues = cuesFor(scene);
      this.shot = '';
    }

    frameCamera(ms, line, state, still) {
      const { id, framing, focus } = this.scene;
      const c = this.cues;
      const shotAt = (preset, x, y, width, track = false) => ({
        preset, focus: point(x, y), width, motion: track && !still ? 'tracking' : 'static', parallax: track && !still
      });
      let shot = { preset: framing, focus };
      if (id === 'dry-pond' && line.speaker === 'tortoise') {
        shot = shotAt('two-shot', 648, 445, 1020);
      } else if (id === 'hold-the-stick') {
        shot = ms >= c.lift - 215 ? shotAt('full', 646, Math.round(state.turtle.mouth.y + 4), 1060, true)
          : shotAt('two-shot', 650, 462, 1080);
      } else if (id === 'over-the-fields') {
        shot = shotAt('full', Math.round(state.turtle.mouth.x), 388, 1170, true);
      } else if (id === 'children-look-up') {
        shot = ms < c.look ? shotAt('medium', 594, 486, 730) : shotAt('full', 661, 389, 1120);
      } else if (id === 'splash') {
        shot = ms < c.release ? shotAt('two-shot', 633, 384, 1060)
          : ms < c.hit ? shotAt('full', 682, Math.round(state.turtle.mouth.y + 61), 1020, true)
            : shotAt('detail', 725, 500, 948);
      } else if (id === 'safe-at-the-bank') {
        shot = line.speaker === 'narrator' ? shotAt('full', Math.round(state.turtle.mouth.x - 144), 453, 1130, ms >= c.swim)
          : shotAt('two-shot', 1019, 457, 755);
      }
      const key = [shot.preset, shot.focus.x, shot.focus.y, shot.width, shot.motion].join('/');
      if (this.shot !== key) {
        this.camera.cue({ ...shot, cut: true });
        this.shot = key;
      }
    }

    paintBird(id, pose, ms, still, mouth) {
      const p = this.birds[id];
      const local = pose.bill ? point((pose.bill.x - pose.x) / (pose.mirror * pose.size) - gooseBill.x,
        (pose.bill.y - pose.y) / pose.size) : point(86, -119 + pose.rest * 6);
      transform(p.root, translate(pose) + ' scale(' + (pose.mirror * pose.size) + ' ' + pose.size + ')');
      transform(p.head, translate(local));
      const curved = 'M37 -72C68 -69 ' + coords(offset(local, -31, 46)) + ' ' + coords(offset(local, -8, 10));
      p.neck.forEach(node => node.setAttribute('d', curved));
      const flutter = still ? 20 : 23 + Math.sin(ms / 154 + (id === 'goose' ? 0 : .58)) * 47;
      transform(p.wings[0], 'rotate(' + ((flutter + 12) * pose.wing) + ' 22 -80)');
      transform(p.wings[1], 'rotate(' + (flutter * pose.wing) + ' 24 -76)');
      transform(p.feet, 'translate(' + (-16 * pose.wing) + ' ' + (-18 * pose.rest) +
        ') rotate(' + (-56 * pose.wing) + ' -7 -28)');
      opacity(p.feet, 1 - Math.max(.66 * pose.wing, .52 * pose.rest));
      transform(p.jaw, 'rotate(' + (mouth * 18) + ' 17 2)');
      const blink = !still && (ms + (id === 'goose' ? 1110 : 2010)) % 4020 > 3860;
      opacity(p.eye, !blink);
      opacity(p.glint, !blink);
      opacity(p.lid, blink);
      p.root.dataset.speaking = String(mouth > 0);
      p.root.dataset.holding = String(Boolean(pose.grip));
      const shadow = this.parts[id === 'goose' ? 'goose-shadow' : 'other-goose-shadow'];
      transform(shadow, translate(offset(pose, 0, 5)));
      opacity(shadow, 1 - pose.wing);
    }

    paintTortoise(state, ms, opening, still) {
      const p = this.parts;
      const turtle = state.turtle;
      const base = turtleBase(turtle.angle, turtle.size);
      const torso = offset(turtle.mouth, base.x, base.y);
      transform(p.tortoise, translate(turtle.mouth) + ' rotate(' + turtle.angle + ') scale(' + turtle.size +
        ') translate(' + (-turtleBite.x) + ' ' + (-turtleBite.y) + ')');
      p['pond-waterline'].setAttribute('height', String(turtle.clip + 130));
      transform(p['tortoise-shadow'], translate(offset(torso, 0, 4)));
      opacity(p['tortoise-shadow'], turtle.mode === 'ashore' ? .9 : 0);
      const attitude = still ? 0 : Math.sin(ms / 430) * 2.3;
      const stride = still ? 0 : turtle.mode === 'holding' ? attitude * 4 : Math.sin(turtle.steps) * 11;
      transform(p['tortoise-front-near'], 'rotate(' + stride + ' 43 -28)');
      transform(p['tortoise-front-far'], 'rotate(' + (-stride * .71) + ' 54 -28)');
      transform(p['tortoise-rear-near'], 'rotate(' + (-stride * .85) + ' -49 -28)');
      transform(p['tortoise-rear-far'], 'rotate(' + (stride * .59) + ' -55 -28)');
      const amount = Math.max(opening, state.mouth);
      transform(p['tortoise-mouth'], 'translate(64 -3) scale(1 ' + (.07 + 1.32 * amount) + ') translate(-64 3)');
      opacity(p['tortoise-mouth'], .1 + amount * .87);
      const blink = !still && (ms + 2410) % 4330 > 4170;
      opacity(p['tortoise-eye'], !blink);
      opacity(p['tortoise-lid'], blink);
      p.tortoise.dataset.speaking = String(opening > 0);
      p.tortoise.dataset.state = turtle.mode;
      p.tortoise.dataset.mouthOpen = String(amount > .1);
      return torso;
    }

    paintStick(stick, holding) {
      const p = this.parts;
      opacity(p['carried-stick'], Boolean(stick));
      p['carried-stick'].dataset.holding = String(holding);
      if (!stick) return;
      const middle = between(stick.first, stick.second, .5);
      const path = 'M' + coords(stick.first) + 'L' + coords(middle) + 'L' + coords(stick.second);
      p['stick-edge'].setAttribute('d', path);
      p['stick-lit'].setAttribute('d', path);
      transform(p['stick-first'], translate(stick.first));
      transform(p['stick-middle'], translate(middle));
      transform(p['stick-second'], translate(stick.second));
    }

    paintKids(ms, line, word, still, show) {
      visibility(this.parts.children, show);
      if (!show) return;
      const c = this.cues;
      const amount = at(ms, c.wave, 580, 1340, 2240);
      const swing = still ? 0 : Math.sin(ms / 112) * 8;
      const voice = line.speaker === 'mehar' && word >= 0 ? {
        text: line.reading.words[word], phase: phase(ms - line.start, ...line.reading.timings[word])
      } : null;
      const mehar = { x: 665, y: 618, lean: -3.5 * move(ms, c.look - 280, c.look + 230), grips: [] };
      const friend = { x: 495, y: 623, lean: -3 * move(ms, c.look - 310, c.look + 260), grips: [] };
      if (amount > 0) {
        mehar.grips[1] = { target: point(735 + swing, 476), weight: amount, hand: 'open' };
        friend.grips[1] = { target: point(552 - swing, 474), weight: amount, hand: 'open' };
      }
      this.kids.mehar.paint(mehar, ms, voice, still);
      this.kids.friend.paint(friend, ms, null, still);
    }

    paintWater(state, torso, still) {
      const p = this.parts;
      const t = state.splash;
      opacity(p['pond-impact'], t == null ? 0 : (1 - t) ** 1.35);
      transform(p['pond-impact'], translate(splashSite));
      if (t != null) {
        transform(p['splash-ring'], 'scale(' + mix(.21, 2.5, t) + ' ' + mix(.25, 1.63, t) + ')');
        opacity(p['splash-crown'], 1 - phase(t, .17, .62));
        transform(p['splash-crown'], 'scale(' + mix(.47, 1.69, t) + ')');
        this.droplets.forEach((drop, i) => {
          const x = (i - 4.5) * 21 * t;
          const y = (still ? -22 : -Math.sin(Math.PI * Math.min(1, t * 1.42)) * (48 + i % 4 * 12)) + i % 3 * 4;
          transform(drop, translate(point(x, y)));
        });
      }
      opacity(p['tortoise-wake'], state.wake * .78);
      transform(p['tortoise-wake'], translate(point(torso.x + 22, splashSite.y)));
    }

    draw(ms, line, word) {
      const still = this.reduced.matches;
      const state = makeFrame(this.scene, this.cues, ms, still);
      const p = this.parts;
      this.frameCamera(ms, line, state, still);
      visibility(p['field-landscape'], state.field);
      visibility(p['pond-landscape'], !state.field);
      visibility(p['small-pool'], state.dried);
      visibility(p['new-pond'], !state.dried);
      opacity(p['pond-shade'], state.shade);
      transform(p['field-scroll'], translate(point(state.scroll, 0)));
      transform(p['pond-clouds'], translate(point(still ? 0 : -28 * phase(ms, 0, this.scene.duration), 0)));
      this.paintKids(ms, line, word, still, state.children);
      const timing = word >= 0 ? phase(ms - line.start, ...line.reading.timings[word]) : 0;
      const mouth = timing > .05 && timing < .96 ? .29 + .7 * Math.sin(timing * Math.PI) : 0;
      this.paintBird('goose', state.goose, ms, still, line.speaker === 'goose' ? mouth : 0);
      this.paintBird('second-goose', state.other, ms, still, line.speaker === 'second-goose' ? mouth : 0);
      const torso = this.paintTortoise(state, ms, line.speaker === 'tortoise' ? mouth : 0, still);
      this.paintStick(state.stick, state.turtle.mode === 'holding');
      this.paintWater(state, torso, still);
    }
  }

  async function prepare() {
    [studio, turtleAsset] = await Promise.all([
      open(document.getElementById('tortoise-geese-studio')),
      fetch('../mission-007/art/stage.svg').then(async response => {
        if (!response.ok) throw Error('The tortoise illustration could not be loaded');
        const svg = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
        const art = svg.getElementById('tortoise');
        const gradients = ['tortoise-green', 'shell-color'].map(id => svg.getElementById(id));
        if (!art || gradients.some(node => !node)) throw Error('The tortoise illustration is incomplete');
        const bite = svg.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bite.setAttribute('id', 'tortoise-bite');
        bite.setAttribute('cx', String(turtleBite.x));
        bite.setAttribute('cy', String(turtleBite.y));
        bite.setAttribute('r', '1');
        bite.setAttribute('visibility', 'hidden');
        art.append(bite);
        return { art, gradients };
      })
    ]);
  }

  window.LittlePanthStage = { Stage: GeeseStage, eventsFor, prepare };
})();
