(() => {
  'use strict';

  const clamp = value => Math.max(0, Math.min(1, value));
  const phase = (time, start, end) => clamp((time - start) / Math.max(1, end - start));
  const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;
  const xy = (x, y) => x.toFixed(3) + ' ' + y.toFixed(3);
  const tx = (node, value) => node.setAttribute('transform', value);
  const path = (node, value) => node.setAttribute('d', value);
  const opacity = (node, value) => node.setAttribute('opacity', String(value));
  const floorY = 626, courtyardY = 518;
  const mice = [
    { id: 'friend', speaker: 'friend-mouse', x: 285, scale: .63, facing: 1 },
    { id: 'young', speaker: 'mouse', x: 500, scale: .66, facing: 1 },
    { id: 'elder', speaker: 'elder-mouse', x: 750, scale: .70, facing: -1 }
  ];
  const mouseFeet = [
    { id: 'back', hip: { x: -31, y: -24 }, home: -32, phase: 0, width: 7.5 },
    { id: 'front', hip: { x: 32, y: -25 }, home: 35, phase: .5, width: 6 },
    { id: 'back-far', hip: { x: -17, y: -21 }, home: -20, phase: .5, width: 5 },
    { id: 'front-far', hip: { x: 36, y: -24 }, home: 27, phase: 0, width: 4.5 }
  ];
  const catFeet = [
    { id: 'back', home: -55, phase: 0 },
    { id: 'front', home: 43, phase: .5 },
    { id: 'back-far', home: -36, phase: .5 },
    { id: 'front-far', home: 28, phase: 0 }
  ];

  function line(scene, id) {
    const result = scene.lines.find(item => item.id === id);
    if (!result) throw Error('Missing Belling the Cat line: ' + id);
    return result;
  }

  function wordAt(scene, id, word) {
    const spoken = line(scene, id);
    const index = spoken.reading.words.findIndex(value => value.replace(/\p{P}/gu, '') === word);
    if (index < 0) throw Error('Missing Belling the Cat cue: ' + id + '/' + word);
    return spoken.start + (spoken.reading.timings[index]?.[0] ?? spoken.duration * index / spoken.reading.words.length);
  }

  // Every action window follows a recorded line or its aligned spoken words.
  function cues(scene) {
    switch (scene.id) {
      case 'quiet-store': {
        const spoken = line(scene, 'quiet-paws');
        const end = spoken.end + (scene.duration - spoken.end) * .25;
        return { catStart: spoken.start, catEnd: end,
          notice: wordAt(scene, 'quiet-paws', 'ਵੇਖਦੇ'),
          retreatStart: wordAt(scene, 'quiet-paws', 'ਦੌੜ'), retreatEnd: end };
      }
      case 'bright-idea': {
        const idea = line(scene, 'young-idea'), explain = line(scene, 'bell-explained');
        const touch = wordAt(scene, 'bell-explained', 'ਵੱਜੇਗੀ');
        return { ideaStart: wordAt(scene, 'young-idea', 'ਤਰਕੀਬ'),
          ideaUp: Math.min(idea.end, wordAt(scene, 'young-idea', 'ਤਰਕੀਬ') + idea.duration * .2),
          nudgeStart: wordAt(scene, 'bell-explained', 'ਘੰਟੀ'), touch,
          release: mix(touch, explain.end, .38), handDown: mix(touch, explain.end, .62) };
      }
      case 'wise-question': return {
        question: wordAt(scene, 'elder-question', 'ਕੌਣ'), silence: wordAt(scene, 'silence', 'ਚੁੱਪ')
      };
      case 'no-volunteer': return {
        lowerStart: wordAt(scene, 'young-hesitates', 'ਸੋਚਿਆ'),
        lowerEnd: wordAt(scene, 'young-hesitates', 'ਰਾਹ')
      };
      case 'safe-and-thoughtful': {
        const spoken = line(scene, 'cat-passes');
        const notice = wordAt(scene, 'cat-passes', 'ਚੂਹੇ');
        const bellLine = wordAt(scene, 'cat-passes', 'ਘੰਟੀ');
        const retreatStart = Math.min(notice, spoken.start + 550);
        return { catStart: spoken.start, catEnd: bellLine,
          retreatStart, retreatEnd: Math.max(retreatStart + 1, Math.min(bellLine, retreatStart + 1400)) };
      }
      default: return {};
    }
  }

  function inverseEase(value) {
    let low = 0, high = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (low + high) / 2;
      if (ease(mid) < value) low = mid; else high = mid;
    }
    return (low + high) / 2;
  }

  function eventsFor(scene) {
    const c = cues(scene);
    if (scene.id === 'bright-idea') return [{ ms: c.touch, sound: 'bell' }];
    if (scene.id === 'quiet-store') return [.25, .5, .75].map(progress => ({
      ms: mix(c.retreatStart, c.retreatEnd, inverseEase(progress)), sound: 'step'
    }));
    return [];
  }

  function travel(actor, time, from, to, start, end) {
    const total = Math.abs(to - from), direction = Math.sign(to - from) || actor.facing;
    const progress = ease(phase(time, start, end));
    const distance = progress * total;
    actor.x = from + direction * distance;
    actor.motion = { origin: from, total, direction, distance, progress, start, end,
      moving: total > 0 && time > start && time < end };
  }

  function rest(actor) {
    actor.motion = { origin: actor.x, total: 0, direction: actor.facing, distance: 0,
      progress: 0, start: 0, end: 0, moving: false };
    return actor;
  }

  const shot = (x, y, width, preset = 'medium', motion = 'static') => ({
    preset, focus: { x, y }, width, motion
  });
  const council = () => shot(490, 565, 840, 'medium');
  function gestureDuring(time, spoken, strength) {
    return strength * ease(phase(time, spoken.start, spoken.start + spoken.duration * .18)) *
      (1 - ease(phase(time, spoken.end - spoken.duration * .18, spoken.end)));
  }

  function bellPoint(angle, x, y) {
    const radians = angle * Math.PI / 180, dx = x - 15;
    return { x: 558 + 15 + dx * Math.cos(radians) - y * Math.sin(radians),
      y: floorY + dx * Math.sin(radians) + y * Math.cos(radians) };
  }

  function sceneState(scene, time, reduced = false) {
    const ms = Math.max(0, Math.min(time, scene.duration)), c = cues(scene);
    const spoken = scene.lines.findLast(item => item.start <= ms) || scene.lines[0];
    const animals = mice.map(def => rest({ ...def, y: floorY, head: 0, gesture: 0, worry: 0 }));
    const [friend, young, elder] = animals;
    const cat = rest({ id: 'cat', x: 1030, y: courtyardY, scale: 1.25, facing: -1, head: 0 });
    const bell = { x: 558, y: floorY, angle: 0, contact: false, reach: 0, state: 'resting' };
    let framing = council(), held = false;
    switch (scene.id) {
      case 'quiet-store': {
        framing = shot(640, 360, 1280, 'establishing');
        travel(cat, ms, 1150, 1030, c.catStart, c.catEnd);
        // These first-day routes leave the bell undisturbed. The later council
        // is introduced as a new day and uses its own facing/composition.
        const starts = [300, 485, 805];
        for (const [index, mouse] of animals.entries()) {
          mouse.facing = -1;
          travel(mouse, ms, starts[index], starts[index] - 82, c.retreatStart, c.retreatEnd);
          mouse.head = ms >= c.notice && ms < c.retreatStart ? -5 : 0;
        }
        if (ms >= c.catStart && ms < c.retreatStart) {
          framing = reduced ? shot(960, 465, 760, 'full') :
            shot(cat.x - 150, 465, 650, 'full', 'tracking');
        }
        break;
      }
      case 'mice-meet':
        young.head = -3; elder.head = 2;
        if (spoken.id === 'mouse-worry') {
          friend.head = 5; friend.worry = 1;
          friend.gesture = gestureDuring(ms, spoken, .46);
          framing = shot(300, 586, 250, 'medium-close');
        }
        break;
      case 'bright-idea': {
        young.head = -9;
        young.gesture = .75 * ease(phase(ms, c.ideaStart, c.ideaUp));
        friend.head = -3;
        if (spoken.id === 'young-idea') framing = shot(500, 585, 300, 'medium-close');
        if (spoken.id === 'bell-explained') framing = shot(542, 595, 250, 'close-up');
        if (spoken.id === 'cheer') friend.gesture = gestureDuring(ms, spoken, .65);
        bell.reach = ease(phase(ms, c.nudgeStart, c.touch)) *
          (1 - ease(phase(ms, c.release, c.handDown)));
        bell.contact = ms >= c.touch && ms <= c.release;
        const rocking = phase(ms, c.touch, c.release);
        bell.angle = reduced ? 0 : 8 * Math.pow(Math.sin(Math.PI * rocking), 2);
        bell.state = bell.contact ? 'nudged' : bell.reach > 0 ? 'reaching' : 'resting';
        break;
      }
      case 'wise-question':
        young.gesture = mix(.75, .5, ease(phase(ms, c.question, c.silence)));
        young.head = 2; friend.worry = .65;
        if (spoken.id === 'elder-question') {
          elder.head = -4; elder.gesture = gestureDuring(ms, spoken, .45);
          framing = shot(740, 585, 300, 'medium-close');
        } else {
          // A quiet group reaction; no bouncing, flying or simultaneous raised paws.
          young.head = 3; friend.head = -2; elder.head = 2;
        }
        break;
      case 'no-volunteer':
        framing = shot(625, 585, 500, 'two-shot');
        young.gesture = .5 * (1 - ease(phase(ms, c.lowerStart, c.lowerEnd)));
        young.head = 2; young.worry = .7;
        if (spoken.id === 'elder-reminds') {
          elder.head = -3; elder.gesture = gestureDuring(ms, spoken, .3);
        }
        break;
      case 'safe-and-thoughtful': {
        // Billi approaches from the right. All three mice share the actual
        // doorway at (161,595), rather than stopping on the open floor.
        cat.facing = -1;
        travel(cat, ms, 1260, 925, c.catStart, c.catEnd);
        const window = c.retreatEnd - c.retreatStart;
        animals.forEach((mouse, index) => {
          const from = index === 1 ? 483 : mouse.x;
          // Almost simultaneous alarm, with arrival times proportional to distance.
          const start = c.retreatStart + window * [0, .012, .024][index];
          const end = c.retreatStart + window * [.40, .66, 1][index];
          mouse.facing = ms >= start ? -1 : mice[index].facing;
          travel(mouse, ms, from, 161, start, end);
          const approach = ease((245 - mouse.x) / 84);
          mouse.y = mix(floorY, 595, approach);
          mouse.scale = mix(mice[index].scale, .45, approach);
          mouse.gaitScale = mice[index].scale;
          mouse.head = ms < start ? -5 : 0;
          // Darken only while entering the shadow of the doorway.
          mouse.visibility = 1 - ease((186 - mouse.x) / 25);
          mouse.insideHole = ms >= end;
          if (mouse.insideHole) mouse.visibility = 0;
          mouse.running = mouse.motion.moving;
        });
        framing = shot(640, 360, 1280, 'wide');
        if (spoken.id === 'moral') framing = shot(420, 545, 900, 'medium');
        held = ms >= c.retreatEnd;
        break;
      }
    }
    bell.point = bellPoint(bell.angle, -12, -7);
    return { scene: scene.id, time: ms, cues: c, mice: animals, cat, bell, shot: framing, held };
  }

  // Feet live in world space throughout stance. Opposite pairs overlap their
  // support phases, so every walk always has visible paws on the floor.
  function pawTargets(actor, feet, strideLength, sole, lift) {
    const movement = actor.motion;
    const steps = Math.max(1, Math.ceil(movement.total / (strideLength * (actor.gaitScale ?? actor.scale))));
    const stride = movement.total / steps;
    const progress = movement.total ? Math.min(steps, movement.distance / stride) : 0;
    const root = { x: actor.x, y: actor.y - sole * actor.scale };
    return feet.map(foot => {
      const cycle = Math.floor(progress + foot.phase + 1e-9);
      const u = clamp(progress + foot.phase - cycle);
      const swing = u > .68 ? (u - .68) / .32 : 0;
      const placement = (cycle + ease(swing)) * stride;
      const world = { x: movement.origin + movement.direction * placement + actor.facing * foot.home * actor.scale,
        y: actor.y - Math.sin(swing * Math.PI) * lift };
      return { ...foot, world, stance: swing === 0,
        local: { x: (world.x - root.x) / (actor.facing * actor.scale), y: (world.y - root.y) / actor.scale } };
    });
  }

  function mouseLeg(foot) {
    const ankle = { x: foot.local.x, y: foot.local.y - 4 }, hip = foot.hip;
    const knee = { x: mix(hip.x, ankle.x, .5) + (foot.id.startsWith('back') ? -3 : 2),
      y: mix(hip.y, ankle.y, .55) }, w = foot.width;
    return 'M' + xy(hip.x - w, hip.y) + 'Q' + xy(hip.x, hip.y - 5) + ' ' + xy(hip.x + w, hip.y) +
      'C' + xy(knee.x + w, knee.y - 3) + ' ' + xy(ankle.x + 4, ankle.y - 5) + ' ' + xy(ankle.x + 4, ankle.y) +
      'Q' + xy(ankle.x, ankle.y + 3) + ' ' + xy(ankle.x - 4, ankle.y) +
      'C' + xy(ankle.x - 4, ankle.y - 5) + ' ' + xy(knee.x - w, knee.y) + ' ' + xy(hip.x - w, hip.y) + 'Z';
  }

  function drawMouse(p, mouse, state, talking, opening, reduced) {
    const root = p['mouse-' + mouse.id], scale = mouse.scale;
    tx(root, 'translate(' + xy(mouse.x, mouse.y - 8 * scale) + ') scale(' + xy(mouse.facing * scale, scale) + ')');
    opacity(root, mouse.visibility ?? 1);
    opacity(p[mouse.id + '-shadow'], mouse.visibility ?? 1);
    // Explicitly hide every body part and shadow after entry; reset on seek.
    root.setAttribute('visibility', mouse.insideHole ? 'hidden' : 'visible');
    p[mouse.id + '-shadow'].setAttribute('visibility', mouse.insideHole ? 'hidden' : 'visible');
    const feet = pawTargets(mouse, mouseFeet, mouse.running ? 48 : 40, 8, mouse.running ? 9 : 4.6);
    for (const foot of feet) {
      if (foot.id === 'front' && mouse.gesture > 0) {
        foot.local.x = mix(foot.local.x, 40, mouse.gesture);
        foot.local.y = mix(foot.local.y, -12, mouse.gesture);
        foot.stance = false;
      }
      if (foot.id === 'front' && mouse.id === 'young' && state.bell.reach > 0) {
        const target = { x: (state.bell.point.x - mouse.x) / (mouse.facing * scale) - 17,
          y: (state.bell.point.y - (mouse.y - 8 * scale)) / scale + 1 };
        foot.local.x = mix(foot.local.x, target.x, state.bell.reach);
        foot.local.y = mix(foot.local.y, target.y, state.bell.reach);
        foot.stance = false;
      }
      foot.world = { x: mouse.x + mouse.facing * scale * foot.local.x,
        y: mouse.y - 8 * scale + scale * foot.local.y };
      const node = p[mouse.id + '-' + foot.id + '-foot'];
      tx(node, 'translate(' + xy(foot.local.x, foot.local.y) + ')');
      node.dataset.stance = String(foot.stance);
      node.dataset.bellContact = String(mouse.id === 'young' && foot.id === 'front' && state.bell.contact);
      path(p[mouse.id + '-' + foot.id + '-leg'], mouseLeg(foot));
    }
    const tailMotion = reduced || state.held ? 0 : mouse.motion.moving ? Math.sin(mouse.motion.distance / 17) * 2.3 : 0;
    tx(p[mouse.id + '-tail'], 'rotate(' + tailMotion + ' -40 -19)');
    const nod = talking && !reduced ? Math.sin(state.time / 320) * 1.1 : 0;
    tx(p[mouse.id + '-head'], 'rotate(' + (mouse.head + nod) + ' 24 -41)');
    const blink = !reduced && !state.held && (state.time + mouse.x * 9) % 4700 > 4550;
    opacity(p[mouse.id + '-eye'], blink ? 0 : 1);
    opacity(p[mouse.id + '-lid'], blink ? 1 : 0);
    path(p[mouse.id + '-mouth'], talking ? 'M61-28q8 ' + (6 + opening * 10).toFixed(2) + ' 16-3' : 'M61-28q8 6 16-3');
    Object.assign(root.dataset, { speaking: String(talking), facing: String(mouse.facing),
      moving: String(mouse.motion.moving), x: String(mouse.x), y: String(mouse.y),
      mouseSurface: mouse.visibility === 0 ? 'inside-hole' : 'ground', mouseDistance: mouse.motion.distance.toFixed(3) });
    p[mouse.id + '-shadow'].setAttribute('cx', String(mouse.x));
    p[mouse.id + '-shadow'].setAttribute('cy', String(mouse.y + 2));
    p[mouse.id + '-shadow'].setAttribute('rx', String(52 * scale));
    return feet.map(foot => ({ id: foot.id, ...foot.world, supportY: mouse.y, stance: foot.stance }));
  }

  function limb(paw, startX, startY, front) {
    const w = 11, x = paw.x, y = paw.y, knee = front ? startX - 2 : startX - 8;
    return 'M' + xy(startX - w * 1.6, startY) + 'C' + xy(startX - w * 2, startY + 18) + ' ' + xy(knee - w, y - 35) + ' ' + xy(x - w * .7, y - 13) +
      'Q' + xy(x - w, y - 3) + ' ' + xy(x - w * .65, y) + 'L' + xy(x + w, y) +
      'Q' + xy(x + w * 1.5, y - 4) + ' ' + xy(x + w * .65, y - 11) +
      'C' + xy(x + w * .15, y - 30) + ' ' + xy(startX + w * 1.5, startY + 18) + ' ' + xy(startX + w * 1.45, startY) + 'Z';
  }
  function boot(paw, width, height) {
    return 'M' + xy(paw.x - width * 1.7, paw.y - height) + 'Q' + xy(paw.x, paw.y - height * .52) + ' ' + xy(paw.x + width * 1.7, paw.y - height) +
      'L' + xy(paw.x + width * 2, paw.y + 3) + 'H' + (paw.x - width * 2).toFixed(3) + 'Z';
  }
  function bendHead(angle, px, py, x, y) {
    const radians = angle * Math.PI / 180;
    return { x: px + x * Math.cos(radians) - y * Math.sin(radians), y: py + x * Math.sin(radians) + y * Math.cos(radians) };
  }

  function drawCat(p, cat, state, reduced) {
    tx(p.cat, 'translate(' + xy(cat.x, cat.y) + ') scale(' + xy(cat.facing * cat.scale, cat.scale) + ')');
    const feet = pawTargets(cat, catFeet, 48, 0, 7);
    const paws = Object.fromEntries(feet.map(foot => [foot.id, foot.local]));
    const fn = paws.front, rn = paws.back, ff = paws['front-far'], rf = paws['back-far'];
    const h = bendHead(cat.head, 34, -106, -19, 13), m = bendHead(cat.head, 34, -106, 20, 18);
    const d = 'M-78-75C-82-99-61-115-34-111Q-12-106 7-109C' + xy(h.x - 12, h.y - 5) + ' ' + xy(h.x - 9, h.y - 21) + ' ' + xy(h.x + 3, h.y - 22) +
      'Q' + xy(m.x + 2, m.y - 18) + ' ' + xy(m.x, m.y + 1) + 'C' + xy(m.x + 10, m.y + 20) + ' ' + xy(fn.x + 6, fn.y - 33) + ' ' + xy(fn.x + 7, fn.y - 10) +
      'Q' + xy(fn.x + 17, fn.y - 5) + ' ' + xy(fn.x + 11, fn.y) + 'L' + xy(fn.x - 8, fn.y) +
      'Q' + xy(fn.x - 12, fn.y - 3) + ' ' + xy(fn.x - 10, fn.y - 12) + 'C' + xy(fn.x - 10, fn.y - 29) + ' 24-40 20-49Q-6-39-32-52C-31-34 ' + xy(rn.x - 2, rn.y - 29) + ' ' + xy(rn.x - 6, rn.y - 12) +
      'Q' + xy(rn.x + 9, rn.y - 5) + ' ' + xy(rn.x + 9, rn.y) + 'L' + xy(rn.x - 10, rn.y) +
      'Q' + xy(rn.x - 16, rn.y - 4) + ' ' + xy(rn.x - 14, rn.y - 13) + 'C' + xy(rn.x - 14, rn.y - 32) + ' -65-44-64-56Q-77-61-78-75Z';
    path(p['cat-body'], d); path(p['cat-clip-shape'], d);
    path(p['cat-rear-far'], limb(rf, -45, -66, false));
    path(p['cat-front-far'], limb(ff, 25, -81, true));
    path(p['cat-paws'], boot(fn, 9, 12) + boot(rn, 10, 12));
    for (const foot of feet) {
      const node = p['cat-' + foot.id + '-foot'];
      tx(node, 'translate(' + xy(foot.local.x, foot.local.y) + ')');
      node.dataset.stance = String(foot.stance);
    }
    const sway = reduced || !cat.motion.moving ? 0 : Math.sin(cat.motion.distance / 31) * 7;
    path(p['cat-tail'], 'M-71-83C-111-67-141-88-138-124C-136-145 ' + xy(-118 + sway, -158) + ' ' + xy(-107 + sway, -147));
    path(p['cat-tail-tip'], 'M' + xy(-118 + sway * .6, -150) + 'Q' + xy(-111 + sway, -155) + ' ' + xy(-107 + sway, -147));
    tx(p['cat-head'], 'translate(34 -106) rotate(' + cat.head + ')');
    tx(p['cat-pupils'], 'translate(0 1)');
    const blink = !reduced && !state.held && (state.time + 1100) % 4150 > 4000;
    opacity(p['cat-eye'], blink ? 0 : 1); opacity(p['cat-lids'], blink ? 1 : 0);
    opacity(p['cat-mouth'], 0);
    Object.assign(p.cat.dataset, { speaking: 'false', facing: String(cat.facing), moving: String(cat.motion.moving),
      x: String(cat.x), y: String(cat.y), location: 'courtyard' });
    p['cat-shadow'].setAttribute('cx', String(cat.x));
    return feet.map(foot => ({ id: foot.id, ...foot.world, supportY: cat.y, stance: foot.stance }));
  }

  class Stage {
    constructor(svg) {
      this.svg = svg;
      this.p = Object.fromEntries([...svg.querySelectorAll('[id]')].map(node => [node.id, node]));
      this.camera = new window.UmtoCamera.DeliveryCamera(svg);
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.shotKey = '';
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', '#young-front-foot');
      this.p['nudge-paw-overlay'].append(use);
    }
    select(scene) { this.scene = scene; this.shotKey = ''; }
    draw(ms, speech, word) {
      const state = sceneState(this.scene, ms, this.reduced.matches), p = this.p;
      const timing = speech?.reading?.timings?.[word];
      const speaking = word >= 0 && ms >= speech.start && ms < speech.end;
      const opening = timing ? .22 + .7 * Math.sin(Math.PI * phase(ms - speech.start, timing[0], timing[1])) : 0;
      state.mice.forEach(mouse => {
        mouse.contacts = drawMouse(p, mouse, state, speaking && speech.speaker === mouse.speaker, opening, this.reduced.matches);
      });
      state.cat.contacts = drawCat(p, state.cat, state, this.reduced.matches);
      tx(p['bell-rock'], 'rotate(' + state.bell.angle.toFixed(5) + ' 15 0)');
      p.bell.dataset.contact = String(state.bell.contact);
      p.bell.dataset.state = state.bell.state;
      tx(p['nudge-paw-overlay'], p['mouse-young'].getAttribute('transform'));
      opacity(p['nudge-paw-overlay'], state.bell.reach > 0 ? 1 : 0);
      const key = JSON.stringify(state.shot);
      if (key !== this.shotKey) {
        // Sample the shared camera at this story time so seeking and export
        // produce the same tracking shot as uninterrupted playback.
        this.camera.cue({ ...state.shot, cut: true });
        this.shotKey = key;
      }
      Object.assign(this.svg.dataset, { scene: state.scene, bellContact: String(state.bell.contact),
        finalHold: String(state.held), animalRig: 'planted-paws' });
      this.last = state;
    }
    state() { return this.last; }
  }

  window.LittlePanthStage = { Stage, eventsFor, cues, sceneState };
})();
