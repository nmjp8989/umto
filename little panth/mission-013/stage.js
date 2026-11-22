(() => {
  'use strict';

  const clamp = value => Math.max(0, Math.min(1, value));
  const phase = (value, from, to) => clamp((value - from) / Math.max(Number.EPSILON, to - from));
  const ease = t => t * t * (3 - 2 * t);
  const mix = (a, b, t) => a + (b - a) * t;
  const point = (x, y) => ({ x, y });
  const between = (a, b, t) => point(mix(a.x, b.x, t), mix(a.y, b.y, t));
  const transform = (node, value) => node.setAttribute('transform', value);
  const opacity = (node, value) => node.setAttribute('opacity', String(value));

  const { open, Character, voiceFrame } = window.UmtoNativeCharacterPlayer;
  const cast = {
    dadi: { preset: 'elder-bibi-ji', view: 'right', height: 292, serial: 430, hipHinge: true },
    mehar: { preset: 'kid-meher', view: 'right', height: 247, serial: 431, hipHinge: true },
    boy: { preset: 'kid-sidak', view: 'left', height: 252, serial: 432, hipHinge: true }
  };
  const farm = { dadi: point(160, 548), mehar: point(345, 534), boy: point(651, 612) };
  const waitingBoy = point(707, 635);
  const flock = [
    { grass: point(471, 471), waiting: point(853, 571), pen: point(1003, 510), size: .67 },
    { grass: point(557, 524), waiting: point(824, 613), pen: point(1111, 519), size: .71 },
    { grass: point(741, 483), waiting: point(761, 538), pen: point(1201, 551), size: .69 },
    { grass: point(806, 536), waiting: point(751, 588), pen: point(1085, 569), size: .74 }
  ];
  const hinge = point(1050, 618);
  const hiddenWolf = 346;
  const clearWolf = 539;
  let studio;

  const findLine = (scene, id) => scene.lines.find(line => line.id === id);

  function wordAt(scene, id, word) {
    const line = findLine(scene, id);
    const index = line.reading.words.findIndex(value => value.replace(/\p{P}/gu, '') === word);
    return line.start + (line.reading.timings[index]?.[0] ?? line.duration / 2);
  }

  function cuesFor(scene) {
    switch (scene.id) {
      case 'pasture':
        return {};
      case 'first-call':
        return { call: findLine(scene, 'first-shout'), arrive: wordAt(scene, 'mehar-runs', 'ਦੌੜ') };
      case 'second-call':
        return { call: findLine(scene, 'second-shout'), arrive: findLine(scene, 'bibi-arrives').start };
      case 'wolf':
        return { rustle: wordAt(scene, 'rustle', 'ਖੜਕਾ'), emerge: wordAt(scene, 'real-wolf', 'ਬਘਿਆੜ'),
          rush: wordAt(scene, 'real-wolf', 'ਡਰ'), call: findLine(scene, 'real-shout') };
      case 'no-answer':
        return { look: wordAt(scene, 'mehar-hears', 'ਸੁਣੀ'), alone: findLine(scene, 'no-help').start };
      case 'safe-pen': {
        const close = wordAt(scene, 'shut-gate', 'ਬੰਦ');
        return { close, penBy: Math.min(close - 160, wordAt(scene, 'shut-gate', 'ਅੰਦਰ') + 410),
          leave: findLine(scene, 'wolf-leaves').start, sorry: findLine(scene, 'sidak-sorry').start };
      }
      case 'counting':
        return { count: wordAt(scene, 'count-sheep', 'ਗਿਣੀਆਂ'), home: wordAt(scene, 'home', 'ਘਰ') };
    }
  }

  function eventsFor(scene) {
    const cue = cuesFor(scene);
    switch (scene.id) {
      case 'pasture': return [{ ms: 510, sound: 'chirp' }];
      case 'first-call': return [80, 340, 660].map(offset => ({ ms: cue.arrive + offset, sound: 'step' }));
      case 'second-call': return [250, 740].map(offset => ({ ms: cue.arrive + offset, sound: 'step' }));
      case 'wolf': return [{ ms: cue.rustle, sound: 'twig' }, { ms: cue.rush, sound: 'gust' },
        { ms: cue.rush + 220, sound: 'step' }, { ms: cue.rush + 610, sound: 'step' }];
      case 'no-answer': return [];
      case 'safe-pen': return [{ ms: cue.penBy - 410, sound: 'step' },
        { ms: cue.close + 410, sound: 'twig' }, { ms: cue.leave + 730, sound: 'ribbon' }];
      case 'counting': return [{ ms: cue.count + 470, sound: 'chirp' }, { ms: cue.home + 520, sound: 'step' }];
    }
  }

  const actor = position => ({ ...position, visible: true, lean: 0, grips: [], mirror: false });

  function walk(actor, ms, from, to, start, end, move) {
    const progress = move(phase(ms, from, to));
    Object.assign(actor, between(start, end, progress));
    if (progress > 0 && progress < 1) actor.walk = (ms - from) / 1000;
  }

  function reach(actor, arm, target, weight, hand) {
    actor.grips[arm] = { target, weight, hand };
  }

  function callOut(boy, ms, call, still, urgent = false) {
    const firstWord = call.start + call.reading.timings[0][0];
    const lastWord = call.start + call.reading.timings.at(-1)[1];
    const lift = ease(phase(ms, firstWord - (urgent ? 360 : 460), firstWord + 45));
    const lower = ease(phase(ms, lastWord + 60, lastWord + 510));
    const hold = still ? Number(ms >= firstWord && ms <= lastWord) : lift * (1 - lower);
    const accent = still ? 0 : Math.sin(Math.PI * ease(phase(ms, firstWord - 30, firstWord + 380)));
    boy.quietHands = true;
    boy.bend = -(urgent ? 6 + 2 * accent : 3.5 + accent) * hold;
    boy.grips[0] = {
      target: point(boy.x - (urgent ? 47 : 42) - 2 * accent, boy.y - 165 - 2 * accent),
      weight: hold, hand: 'cupped', wrist: -11
    };
  }

  function makeFrame(scene, cue, ms, still) {
    const move = still ? t => Math.round(t) : ease;
    const boy = actor(farm.boy);
    const mehar = actor(farm.mehar);
    const dadi = actor(farm.dadi);
    const state = {
      actors: { boy, mehar, dadi }, dusk: 0, gate: 0, rustle: 0,
      wolf: { x: hiddenWolf, visible: 0, facing: 1 },
      sheep: flock.map(({ grass }) => ({ ...grass, activity: 'grazing', location: 'field' }))
    };

    const waitByGate = () => {
      Object.assign(boy, waitingBoy);
      state.dusk = 1;
      state.wolf = { x: clearWolf, visible: 1, facing: 1 };
      state.sheep.forEach((sheep, index) => Object.assign(sheep, flock[index].waiting, { activity: 'alert' }));
    };

    switch (scene.id) {
      case 'first-call':
        callOut(boy, ms, cue.call, still);
        walk(mehar, ms, cue.arrive - 90, cue.arrive + 1130, farm.mehar, point(463, 612), move);
        break;
      case 'second-call':
        callOut(boy, ms, cue.call, still);
        walk(dadi, ms, cue.arrive - 70, cue.arrive + 2300, farm.dadi, point(432, 611), move);
        walk(mehar, ms, cue.arrive - 150, cue.arrive + 1520, farm.mehar, point(281, 588), move);
        mehar.mirror = ms < cue.arrive + 1520 && ms > cue.arrive - 150;
        break;
      case 'wolf': {
        mehar.visible = dadi.visible = false;
        state.dusk = .78 + .22 * move(phase(ms, 100, 1500));
        state.rustle = still ? 0 : Math.sin(Math.PI * phase(ms, cue.rustle - 130, cue.emerge + 440));
        const steps = phase(ms, cue.emerge - 150, cue.emerge + 1220);
        const emergence = move(steps);
        state.wolf = { x: mix(hiddenWolf, clearWolf, emergence), visible: Number(emergence > 0),
          facing: 1, steps };
        state.sheep.forEach((sheep, index) => {
          const { grass, waiting } = flock[index];
          const dash = phase(ms, cue.rush + index * 130, cue.rush + 1200 + index * 130);
          Object.assign(sheep, between(grass, waiting, move(dash)), {
            activity: dash > 0 && dash < 1 ? 'running' : 'alert'
          });
        });
        walk(boy, ms, cue.rush - 45, cue.rush + 880, farm.boy, waitingBoy, move);
        boy.mirror = boy.walk != null;
        if (ms >= cue.emerge) boy.expression = 'surprise';
        callOut(boy, ms, cue.call, still, true);
        break;
      }
      case 'no-answer': {
        waitByGate();
        const reaction = ease(phase(ms, cue.look - 95, cue.look + 495)) *
          (1 - ease(phase(ms, cue.look + 1280, cue.alone)));
        mehar.bend = (still ? 0 : reaction) * 5;
        mehar.mirror = reaction < .49;
        break;
      }
      case 'safe-pen': {
        waitByGate();
        dadi.visible = false;
        const walkToGate = point(1080, 642);
        walk(boy, ms, 90, cue.close - 145, waitingBoy, walkToGate, move);
        boy.mirror = boy.walk != null;
        const rejoin = cue.leave + 1280;
        walk(mehar, ms, rejoin, cue.sorry + 220, farm.mehar, point(599, 616), move);
        mehar.visible = ms >= rejoin;

        state.sheep.forEach((sheep, index) => {
          const { waiting, pen } = flock[index];
          const entry = phase(ms, 160 + index * 160, cue.penBy - (3 - index) * 130);
          const opening = point(961 + index * 9, 605 + index * 2);
          const crossed = entry >= .56;
          const position = crossed
            ? between(opening, pen, move(phase(entry, .56, 1)))
            : between(waiting, opening, move(phase(entry, 0, .56)));
          Object.assign(sheep, position, { location: crossed ? 'pen' : 'field',
            activity: entry > 0 && entry < 1 ? 'running' : 'alert' });
        });

        state.gate = move(phase(ms, cue.close - 90, cue.close + 410));
        const grip = ease(phase(ms, cue.close - 140, cue.close + 200)) *
          (1 - ease(phase(ms, cue.close + 455, cue.close + 760)));
        const gateScale = mix(-.15, 1, state.gate);
        const gateSlope = mix(.52, .088, state.gate);
        reach(boy, 0, point(hinge.x - 40 * gateScale, hinge.y - 88 - 40 * gateSlope), grip);

        if (ms > cue.close + 780) {
          walk(boy, ms, cue.close + 780, cue.sorry + 220, walkToGate, point(759, 627), move);
          boy.mirror = false;
        }
        if (ms >= cue.leave) {
          const steps = phase(ms, cue.leave + 260, cue.leave + 1380);
          const retreat = move(steps);
          state.wolf = { x: mix(clearWolf, hiddenWolf + 19, retreat),
            visible: 1 - ease(phase(retreat, .64, 1)), facing: -1, steps };
        }
        break;
      }
      case 'counting': {
        state.dusk = .88;
        state.gate = 1;
        walk(dadi, ms, cue.home - 205, scene.duration - 300, point(273, 569), point(134, 553), move);
        walk(boy, ms, cue.home - 50, scene.duration - 280, point(731, 625), point(532, 608), move);
        walk(mehar, ms, cue.home - 195, scene.duration - 320, point(841, 619), point(704, 605), move);
        dadi.mirror = mehar.mirror = ms >= cue.home - 195;
        state.sheep.forEach((sheep, index) => {
          const listen = phase(ms, cue.count - 480 + index * 335, cue.count - 80 + index * 335);
          Object.assign(sheep, flock[index].pen, { location: 'pen', activity: listen > .55 ? 'alert' : 'grazing' });
        });
        const count = ease(phase(ms, cue.count - 710, cue.count - 200)) *
          (1 - ease(phase(ms, cue.count + 560, cue.count + 1050)));
        reach(mehar, 1, point(891, 500 + (still ? 0 : 13 * phase(ms, cue.count, cue.count + 800))), count, 'point');
        break;
      }
    }
    return state;
  }

  function sheepSprite(group, index) {
    group.insertAdjacentHTML('beforeend',
      '<g id="sheep-' + index + '"><ellipse cy="3" rx="72" ry="13" fill="url(#shadow)"/><g data-body>' +
      '<use data-leg href="#sheep-leg"/><use data-leg href="#sheep-leg"/>' +
      '<use data-leg href="#sheep-leg"/><use data-leg href="#sheep-leg"/>' +
      '<use href="#sheep-wool"/><use data-head href="#sheep-face"/></g></g>');
    const root = group.lastElementChild;
    return { root, body: root.querySelector('[data-body]'), head: root.querySelector('[data-head]'),
      legs: [...root.querySelectorAll('[data-leg]')] };
  }

  class PastureStage {
    constructor(svg) {
      this.svg = svg;
      this.camera = new window.UmtoCamera.DeliveryCamera(svg);
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.parts = Object.fromEntries([...svg.querySelectorAll('[id]')].map(node => [node.id, node]));
      this.sheep = flock.map((_, index) => sheepSprite(this.parts.flock, index));
      this.wolfLegs = [...this.parts.wolf.querySelectorAll('[data-stride]')];
      this.puppets = Object.fromEntries(Object.entries(cast).map(([id, spec]) => [
        id, new Character(studio, svg, this.parts[id], this.parts[id + '-props'], spec)
      ]));
    }

    select(scene) {
      this.scene = scene;
      this.cues = cuesFor(scene);
      this.lastShot = '';
    }

    frame(ms, line, still, state) {
      const { id, framing, focus } = this.scene;
      const cue = this.cues;
      const shotAt = (preset, x, y, width, motion = 'static') => ({ preset, focus: point(x, y), width,
        motion, parallax: motion === 'tracking' });
      let shot = { preset: framing, focus };
      if (id === 'pasture' && line.speaker === 'boy') {
        shot = shotAt('medium', 629, 463, 775);
      } else if (id === 'first-call') {
        if (ms < cue.arrive) shot = shotAt('medium', 626, 462, 795);
        else if (!still && ms < cue.arrive + 1130) {
          shot = shotAt('full', Math.round(mix(510, 572, phase(ms, cue.arrive, cue.arrive + 1130))),
            445, 1010, 'tracking');
        } else shot = shotAt('two-shot', 579, 454, 770);
      } else if (id === 'second-call' && line.speaker === 'dadi') {
        shot = shotAt('two-shot', 506, 456, 790);
      } else if (id === 'wolf' && ms >= cue.rustle - 210 && ms < cue.rush - 120) {
        shot = shotAt('detail', 464, 372, 595);
      } else if (id === 'wolf' && ms >= cue.rush - 120 && ms < cue.call.start) {
        const focusX = still ? 700 : Math.round(mix(590, 739, phase(ms, cue.rush, cue.rush + 1440)));
        shot = shotAt('full', focusX, 407, 1090, still ? 'static' : 'tracking');
      } else if (id === 'wolf' && line.speaker === 'boy') {
        shot = shotAt('medium', 710, 461, 844);
      } else if (id === 'no-answer' && ms >= cue.alone) {
        shot = shotAt('full', 708, 449, 1080);
      } else if (id === 'safe-pen') {
        if (line.id === 'wolf-leaves') shot = shotAt('detail', 514, 398, 660);
        else if (line.speaker === 'boy') shot = shotAt('two-shot', 679, 450, 742);
        else if (ms >= cue.close - 155) shot = shotAt('detail', 1015, 493, 690);
        else shot = shotAt('full', Math.round((state.actors.boy.x + 1060) / 2), 459,
          960, still ? 'static' : 'tracking');
      } else if (id === 'counting' && ms < cue.home - 195) {
        shot = shotAt('full', 905, 447, 930);
      }
      const key = [shot.preset, shot.focus.x, shot.focus.y, shot.width, shot.motion].join('/');
      if (key === this.lastShot) return;
      this.camera.cue({ ...shot, cut: true });
      this.lastShot = key;
    }

    paintAnimals(state, ms, still) {
      const { wolf, sheep } = state;
      opacity(this.parts.wolf, wolf.visible);
      transform(this.parts.wolf, 'translate(' + wolf.x + ' 404) scale(' + (.87 * wolf.facing) + ' .87)');
      const progress = still ? 0 : wolf.steps ?? 0;
      const cycle = 6 * Math.PI * progress;
      const effort = Math.sin(Math.PI * progress);
      const stride = Math.sin(cycle) * effort;
      const tail = still ? 0 : 1.5 * Math.sin(ms / 550) - 3.6 * stride;
      transform(this.parts['wolf-tail'], 'rotate(' + tail + ' -55 -70)');
      transform(this.parts['wolf-body'], 'translate(0 ' + (-2.5 * Math.sin(cycle) ** 2 * effort) + ')');
      transform(this.parts['wolf-head'], 'rotate(' + (2.8 * stride) + ' 51 -69)');
      this.wolfLegs.forEach((leg, index) => {
        const step = 16 * stride * (index === 0 || index === 3 ? 1 : -1);
        transform(leg, 'rotate(' + step + ' ' + leg.dataset.stride + ')');
      });
      sheep.forEach((pose, index) => {
        const { root, body, legs, head } = this.sheep[index];
        const fleeing = pose.activity === 'running' && !still;
        const cycle = fleeing ? ms / 58 + index : 0;
        const dip = pose.activity === 'grazing'
          ? still ? .8 : .54 + .41 * Math.sin(ms / 675 + .9 * index)
          : 0;
        const bob = fleeing ? -7 * Math.abs(Math.sin(cycle)) : 0;
        transform(root, 'translate(' + pose.x + ' ' + pose.y + ') scale(' + flock[index].size + ')');
        transform(body, 'translate(0 ' + bob + ')');
        transform(head, 'translate(51 ' + mix(-65, -21, dip) + ') rotate(' + mix(fleeing ? -5 : 0, 33, dip) + ')');
        [-41, 36, -30, 45].forEach((x, leg) => {
          const stride = fleeing ? 31 * Math.sin(cycle + leg * 1.8) : 0;
          transform(legs[leg], 'translate(' + x + ' -31) rotate(' + stride + ')');
          opacity(legs[leg], leg < 2 ? .72 : 1);
        });
        root.dataset.activity = fleeing ? 'running' : pose.activity === 'running' ? 'alert' : pose.activity;
        root.dataset.location = pose.location;
      });
      const ordered = this.sheep.map(({ root }, i) => ({ root, y: sheep[i].y })).sort((a, b) => a.y - b.y);
      if (ordered.some(({ root }, index) => this.parts.flock.children[index] !== root)) {
        this.parts.flock.append(...ordered.map(({ root }) => root));
      }
    }

    draw(ms, line, word) {
      const still = this.reduced.matches;
      const state = makeFrame(this.scene, this.cues, ms, still);
      this.frame(ms, line, still, state);
      this.paintAnimals(state, ms, still);
      opacity(this.parts.dusk, state.dusk);
      opacity(this.parts['rustling-leaves'], state.rustle);
      transform(this.parts['rustling-leaves'], 'translate(0 ' + (-9 * state.rustle) + ')');
      transform(this.parts.gate, 'matrix(' + [mix(-.15, 1, state.gate), mix(.52, .088, state.gate),
        0, 1, hinge.x, hinge.y].join(' ') + ')');
      this.svg.dataset.gate = state.gate === 1 ? 'closed' : state.gate === 0 ? 'open' : 'closing';
      const reading = voiceFrame(line, word, ms);
      for (const [id, puppet] of Object.entries(this.puppets)) {
        const pose = state.actors[id];
        const plane = this.parts[id + '-plane'];
        plane.setAttribute('visibility', pose.visible ? 'visible' : 'hidden');
        transform(plane, pose.mirror ? 'translate(' + (2 * pose.x) + ' 0) scale(-1 1)' : '');
        const shadow = this.parts[id + '-shadow'];
        opacity(shadow, pose.visible ? 1 : 0);
        shadow.setAttribute('cx', pose.x);
        shadow.setAttribute('cy', pose.y + 1);
        if (pose.visible) puppet.paint(pose, ms, line.speaker === id ? reading : null, still);
        else this.parts[id].dataset.speaking = 'false';
      }
    }
  }

  async function prepare() {
    studio = await open(document.getElementById('shepherd-studio'));
  }

  window.LittlePanthStage = { Stage: PastureStage, eventsFor, prepare };
})();
