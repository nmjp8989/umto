(() => {
  'use strict';

  const clamp = value => Math.max(0, Math.min(1, value));
  const phase = (ms, start, end) => clamp((ms - start) / Math.max(1, end - start));
  const ease = t => t * t * (3 - 2 * t);
  const mix = (a, b, t) => a + (b - a) * t;
  const point = (x, y, angle = 0) => ({ x, y, angle });
  const transform = (node, value) => node.setAttribute('transform', value);
  const opacity = (node, value) => node.setAttribute('opacity', String(value));
  const parked = point(351, 592);
  const onStool = point(589, 474, -4);
  const { open, Character } = window.UmtoNativeCharacterPlayer;
  const cast = {
    dadi: { preset: 'elder-bibi-ji', view: 'left', height: 315, serial: 410 },
    mehar: { preset: 'kid-meher', view: 'right', height: 290, serial: 411 },
    boy: { preset: 'kid-sidak', view: 'left', height: 287, serial: 412 }
  };
  let studio;

  function wordAt(scene, id, word) {
    const line = scene.lines.find(entry => entry.id === id);
    const index = line.reading.words.findIndex(value => value.replace(/\p{P}/gu, '') === word);
    return line.start + (line.reading.timings[index]?.[0] ?? line.duration * .5);
  }

  function cuesFor(scene) {
    switch (scene.id) {
      case 'courtyard':
        return { reach: wordAt(scene, 'ball-game', 'ਇੱਕੋ') - 220 };
      case 'argument':
        return { answer: scene.lines[1].start, pull: wordAt(scene, 'hold-the-ball', 'ਖਿੱਚਣ') - 70,
          settle: wordAt(scene, 'hold-the-ball', 'ਰੁਕ') - 80 };
      case 'bundle':
        return { aside: wordAt(scene, 'bundle-down', 'ਪਾਸੇ') - 380, place: wordAt(scene, 'bundle-down', 'ਰੱਖ') + 220 };
      case 'try-bundle': {
        const squeezeLeft = wordAt(scene, 'try-together', 'ਜ਼ੋਰ');
        const takeLeft = Math.min(wordAt(scene, 'try-together', 'ਫੜਿਆ') - 280, squeezeLeft - 500);
        const takeRight = Math.max(squeezeLeft + 1030, wordAt(scene, 'try-together', 'ਸਿਦਕ') - 280);
        const squeezeRight = Math.max(takeRight + 500, wordAt(scene, 'try-together', 'ਕੋਸ਼ਿਸ਼'));
        return { attempts: [{ take: takeLeft, squeeze: squeezeLeft }, { take: takeRight, squeeze: squeezeRight }] };
      }
      case 'loose-sticks': {
        const snap = wordAt(scene, 'sticks-snap', 'ਟੁੱਟ');
        return { untie: wordAt(scene, 'dadi-unties', 'ਖੋਲ੍ਹ'),
          leftTake: wordAt(scene, 'sticks-snap', 'ਫੜੀ') - 530,
          rightTake: wordAt(scene, 'sticks-snap', 'ਦੂਜੀ') - 530, leftSnap: snap - 85, rightSnap: snap + 315 };
      }
      case 'play':
        return { roll: wordAt(scene, 'roll-and-share', 'ਰੋੜ੍ਹੀ'),
          catch: wordAt(scene, 'roll-and-share', 'ਰੋਕਿਆ'),
          back: wordAt(scene, 'roll-and-share', 'ਵਾਪਸ') + 140 };
      default:
        return {};
    }
  }

  function eventsFor(scene) {
    const cue = cuesFor(scene);
    switch (scene.id) {
      case 'bundle':
        return [{ ms: cue.aside + 895, sound: 'step' }, { ms: cue.place, sound: 'step' }];
      case 'try-bundle':
        return cue.attempts.map(attempt => ({ ms: attempt.squeeze + 270, sound: 'ribbon' }));
      case 'loose-sticks':
        return [{ ms: cue.untie + 100, sound: 'ribbon' }, { ms: cue.leftSnap, sound: 'twig' }, { ms: cue.rightSnap, sound: 'twig' }];
      case 'play':
        return [{ ms: cue.roll, sound: 'step' }, { ms: cue.catch, sound: 'step' }, { ms: cue.back, sound: 'step' }];
      default:
        return [];
    }
  }

  function offsetAt(object, x, y) {
    const angle = object.angle * Math.PI / 180;
    return point(object.x + x * Math.cos(angle) - y * Math.sin(angle),
      object.y + x * Math.sin(angle) + y * Math.cos(angle), object.angle);
  }

  function grip(actor, index, target, weight = 1, hand) {
    actor.grips[index] = { target, weight, hand };
  }

  function couple(actor, object, span, weight = 1, bend = 0) {
    const y = 2 - bend * (1 - (span / 67) ** 2);
    grip(actor, 0, offsetAt(object, -span, y), weight);
    grip(actor, 1, offsetAt(object, span, y), weight);
  }

  function stageStick(position, ms, take, snap, move) {
    const picked = move(phase(ms, take, take + 540));
    const flex = ease(phase(ms, snap - 375, snap));
    const separated = move(phase(ms, snap, snap + 255));
    const split = ms >= snap;
    return {
      position, snap, split, picked, visible: clamp(phase(ms, take - 170, take)),
      halves: [
        point(-16 * separated, 8 * separated, 9 * flex - 22 * separated),
        point(16 * separated, 8 * separated, -9 * flex + 23 * separated)
      ]
    };
  }

  function holdStick(actor, stick, weight) {
    for (const [i, half] of stick.halves.entries()) {
      const local = offsetAt(half, i === 0 ? -38 : 38, 1);
      grip(actor, i, offsetAt(stick.position, local.x, local.y), weight);
    }
  }

  function attempt(actor, bundle, timing, layout, ms, move, still) {
    const { take, squeeze } = timing;
    const setDown = squeeze + 875;
    const step = move(phase(ms, take - 600, take - 40)) * (1 - move(phase(ms, setDown + 110, setDown + 590)));
    const lift = move(phase(ms, take + 100, squeeze - 80)) * (1 - move(phase(ms, squeeze + 425, setDown)));
    const hold = ease(phase(ms, take - 90, take + 110)) * (1 - ease(phase(ms, setDown + 15, setDown + 240)));
    const press = Math.sin(Math.PI * phase(ms, squeeze - 120, squeeze + 530));
    const weight = lift * step;
    actor.x = mix(actor.x, layout.near, step) + (layout.lifted - layout.near) * weight;
    actor.lean = layout.lean * (step - .55 * weight);
    if (ms > take - 600 && ms < take - 40) actor.walk = (ms - take + 600) / 1000;
    if (ms > setDown + 110 && ms < setDown + 590) actor.walk = (ms - setDown - 110) / 1000;
    bundle.position = point(mix(onStool.x, layout.center, weight), mix(onStool.y, 458, weight),
      mix(onStool.angle, layout.lean * .6, weight) + (still ? 0 : Math.sin(ms / 72) * 2.2 * press));
    bundle.owner = lift > .02 ? layout.id : 'stool';
    bundle.flex = 7.6 * press * lift;
    couple(actor, bundle.position, 41, hold, bundle.flex);
    return Math.max(lift, hold);
  }

  function sceneState(scene, cue, ms, still, speaker) {
    const move = t => still ? Math.round(t) : ease(t);
    const actor = (x, y) => ({ x, y, lean: 0, grips: [] });
    const mehar = actor(408, 622);
    const boy = actor(786, 623);
    const dadi = actor(594, 611);
    const bundle = { position: onStool, owner: 'stool', visible: !['courtyard', 'argument'].includes(scene.id),
      cord: 1, flex: 0 };
    let ball = { position: parked, owner: 'floor' };
    let freeCord = null;
    let sticks = [];
    let focusChild = '';
    switch (scene.id) {
      case 'courtyard': {
        const reach = move(phase(ms, cue.reach - 1320, cue.reach + 440));
        mehar.x = mix(415, 513, reach);
        boy.x = mix(714, 662, reach);
        if (reach > 0 && reach < 1) {
          mehar.walk = (ms - cue.reach + 1320) / 1000;
          if (reach < .84) boy.walk = mehar.walk;
        }
        dadi.x = 1010;
        dadi.y = 610;
        ball = { position: point(mix(663, 589, reach), 465, -10 * reach), owner: 'mehar' };
        grip(boy, 0, offsetAt(ball.position, 25, -3));
        grip(mehar, 1, offsetAt(ball.position, -25, -3), reach);
        break;
      }
      case 'argument': {
        const answer = move(phase(ms, cue.answer - 140, cue.answer + 325));
        const pause = move(phase(ms, cue.settle, cue.settle + 325));
        const pull = still ? 0 : Math.sin(Math.PI * phase(ms, cue.pull - 335, cue.pull + 620));
        const tug = mix(-11, 11, answer) * (1 - pause) - 23 * pull;
        mehar.x = 513 + tug * .4;
        boy.x = 662 + tug * .4;
        dadi.x = 1010;
        dadi.y = 610;
        mehar.lean = -1.5 * (1 - pause);
        boy.lean = 1.5 * (1 - pause);
        ball = { position: point(589 + tug, 465, tug * .6), owner: 'mehar' };
        grip(mehar, 1, offsetAt(ball.position, -25, -3));
        grip(boy, 0, offsetAt(ball.position, 25, -3));
        break;
      }
      case 'bundle': {
        const aside = move(phase(ms, cue.aside, cue.aside + 850));
        const park = move(phase(ms, cue.aside + 830, cue.aside + 1450));
        const place = move(phase(ms, cue.place - 730, cue.place));
        const finish = ease(phase(ms, cue.place + 90, cue.place + 610));
        mehar.x = mix(318, 408, aside);
        boy.x = mix(870, 786, aside);
        dadi.y = mix(611, 605, finish);
        dadi.lean = -Math.sin(place * Math.PI) * 3;
        if (aside > .15 && aside < 1) {
          mehar.walk = (ms - cue.aside) / 1000;
          boy.walk = mehar.walk;
        }
        ball = { position: point(mix(366, 435, aside) + (parked.x - 435) * park,
          mix(470, parked.y, aside ** 1.7), -135 * aside - 170 * park), owner: aside < .83 ? 'mehar' : 'floor' };
        grip(mehar, 1, offsetAt(ball.position, -19, -9), 1 - phase(aside, .27, .49));
        bundle.position = point(589, mix(455, onStool.y, place), mix(3, onStool.angle, place));
        bundle.owner = place >= 1 ? 'stool' : 'dadi';
        couple(dadi, bundle.position, 42, 1 - finish);
        break;
      }
      case 'try-bundle': {
        const stepAside = move(phase(ms, 80, 1080));
        dadi.x = mix(594, 894, stepAside);
        if (stepAside > 0 && stepAside < 1) dadi.walk = (ms - 80) / 1000;
        const first = cue.attempts[0];
        const second = cue.attempts[1];
        if (ms < second.take - 480) {
          if (attempt(mehar, bundle, first, { id: 'mehar', near: 567, lifted: 555, center: 559, lean: 3.5 }, ms, move, still) > .12) {
            focusChild = 'mehar';
          }
        } else {
          if (attempt(boy, bundle, second, { id: 'boy', near: 609, lifted: 622, center: 620, lean: -3.5 }, ms, move, still) > .12) {
            focusChild = 'boy';
          }
        }
        break;
      }
      case 'loose-sticks': {
        const ready = ease(phase(ms, cue.untie - 550, cue.untie - 60));
        const pull = move(phase(ms, cue.untie, cue.untie + 630));
        const coil = move(phase(ms, cue.untie + 890, cue.untie + 1480));
        const knot = offsetAt(onStool, 1, -24);
        const cordEnd = offsetAt(onStool, 74, 15);
        const heldEnd = point(mix(knot.x, knot.x + 51, pull), mix(knot.y, knot.y - 19, pull));
        bundle.cord = 1 - clamp(pull * 1.4);
        grip(dadi, 0, offsetAt(onStool, -39, -14), ready * (1 - pull));
        grip(dadi, 1, heldEnd, ready * (1 - coil), 'pinch');
        freeCord = { position: point(mix(heldEnd.x, cordEnd.x, coil), mix(heldEnd.y, cordEnd.y, coil)), visible: clamp(pull * 2),
          owner: coil > .97 ? 'stool' : 'dadi' };
        const setups = [
          { actor: mehar, take: cue.leftTake, snap: cue.leftSnap, start: point(535, 468, -7), end: point(452, 486, -6) },
          { actor: boy, take: cue.rightTake, snap: cue.rightSnap, start: point(636, 465, 1), end: point(743, 485, 6) }
        ];
        sticks = setups.map(({ actor, take, snap, start, end }) => {
          const pickup = move(phase(ms, take, take + 540));
          const step = move(phase(ms, take - 680, take - 60));
          actor.x = mix(actor.x, mix(start.x, end.x, pickup), step);
          if ((step > 0 && step < 1) || (pickup > 0 && pickup < 1)) actor.walk = (ms - take + 680) / 1000;
          const position = point(mix(start.x, end.x, pickup), mix(start.y, end.y, pickup), mix(start.angle, end.angle, pickup));
          const stick = stageStick(position, ms, take, snap, move);
          holdStick(actor, stick, ease(phase(ms, take - 120, take + 270)));
          return stick;
        });
        break;
      }
      case 'lesson':
      case 'play': {
        bundle.cord = 0;
        freeCord = { position: offsetAt(onStool, 74, 15), visible: 1, owner: 'stool' };
        sticks = [point(550, 474, -16), point(642, 483, 10)].map(position =>
          ({ position, split: true, visible: 1, picked: 0, halves: [point(-12, 2, -12), point(12, 3, 11)] }));
        if (scene.id === 'lesson') {
          if (speaker === 'dadi') grip(dadi, 1, offsetAt(onStool, 52, -20), .76);
          if (speaker === 'mehar') grip(mehar, 1, point(472, 475), .68);
          if (speaker === 'boy') grip(boy, 0, point(725, 479), .65);
        } else {
          const throwTime = Math.min(cue.roll + 1260, cue.catch);
          const forward = move(phase(ms, cue.roll, throwTime));
          const back = move(phase(ms, cue.back, cue.back + 1150));
          const distance = (forward - back) * 373;
          mehar.x = 299;
          boy.x = 783;
          mehar.lean = Math.sin(Math.PI * phase(ms, cue.roll - 230, cue.roll + 450)) * 6;
          boy.lean = -Math.sin(Math.PI * phase(ms, cue.back - 205, cue.back + 410)) * 6;
          ball = { position: point(parked.x + distance, parked.y, distance / 28 * 180 / Math.PI), owner: 'floor' };
        }
        break;
      }
    }
    return { mehar, boy, dadi, bundle, ball, sticks, freeCord, focusChild };
  }

  class CourtyardStage {
    constructor(svg) {
      this.svg = svg;
      this.camera = new window.UmtoCamera.DeliveryCamera(svg);
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.parts = Object.fromEntries([...svg.querySelectorAll('[id]')].map(node => [node.id, node]));
      this.wood = [...this.parts.bundle.querySelectorAll('[data-wood-curve]')];
      this.puppets = Object.fromEntries(Object.entries(cast).map(([id, spec]) => [
        id, new Character(studio, svg, this.parts[id], this.parts[id + '-props'], spec)
      ]));
    }

    select(scene) {
      this.scene = scene;
      this.cues = cuesFor(scene);
      this.shot = '';
    }

    frame(ms, line, state) {
      const { id, framing, focus } = this.scene;
      let shot = { preset: framing, focus };
      if (id === 'argument') {
        shot.width = 775;
      } else if (id === 'bundle') {
        shot = line.speaker === 'dadi'
          ? { preset: 'medium', focus: { x: 600, y: 396 }, width: 390 }
          : { preset: 'two-shot', focus: { x: 591, y: 443 }, width: 935 };
      } else if (id === 'try-bundle' && state.focusChild && !this.reduced.matches) {
        shot = { preset: 'medium', focus: { x: state.focusChild === 'mehar' ? 514 : 672, y: 440 }, width: 743 };
      } else if (id === 'lesson' && line.speaker === 'dadi') {
        shot = { preset: 'medium', focus: { x: 588, y: 407 }, width: 615 };
      } else if (id === 'loose-sticks') {
        const begun = ms >= this.cues.leftTake - 100;
        shot = { preset: begun ? 'full' : 'medium', focus: { x: 594, y: 443 }, width: begun ? 986 : 690 };
      } else if (id === 'play' && ms >= this.cues.roll - 300 && !this.reduced.matches) {
        shot = { preset: 'full', focus: { x: mix(527, 634, phase(state.ball.position.x, parked.x, 724)), y: 402 },
          width: 1050, motion: 'tracking', parallax: true };
      }
      const signature = [shot.preset, shot.focus.x, shot.focus.y].join('/');
      if (signature !== this.shot) {
        this.camera.cue({ ...shot, cut: true });
        this.shot = signature;
      }
    }

    attach(node, owner) {
      const parent = this.parts[owner + '-props'];
      if (node.parentElement !== parent) parent.append(node);
    }

    objects(state, ms) {
      const p = this.parts;
      const place = (node, pos) => transform(node, 'translate(' + pos.x + ' ' + pos.y + ') rotate(' + pos.angle + ')');
      const { bundle, ball, freeCord } = state;
      this.attach(p.bundle, bundle.owner);
      place(p.bundle, bundle.position);
      opacity(p.bundle, bundle.visible ? 1 : 0);
      opacity(p['bundle-cord'], bundle.cord);
      transform(p['bundle-cord'], 'translate(0 ' + -bundle.flex + ')');
      for (const grain of this.wood) {
        const y = Number(grain.dataset.woodCurve);
        grain.setAttribute('d', 'M-67 ' + y + 'Q0 ' + (y - bundle.flex * 2) + ' 67 ' + y);
      }
      if (freeCord) {
        this.attach(p['free-cord'], freeCord.owner);
        place(p['free-cord'], freeCord.position);
      }
      opacity(p['free-cord'], freeCord?.visible ?? 0);
      this.attach(p.ball, ball.owner);
      place(p.ball, ball.position);
      p['ball-shadow'].setAttribute('cx', ball.position.x);
      opacity(p['ball-shadow'], phase(ball.position.y, 479, 592));
      let snaps = 0;
      let splinter = null;
      for (const [i, [actor, id]] of [['mehar', 'mehar-stick'], ['boy', 'boy-stick']].entries()) {
        const stick = state.sticks[i];
        opacity(p[id], stick?.visible ?? 0);
        if (!stick) continue;
        this.attach(p[id], stick.picked > .04 ? actor : 'stool');
        place(p[id], stick.position);
        place(p[id + '-left'], stick.halves[0]);
        place(p[id + '-right'], stick.halves[1]);
        if (stick.split) snaps++;
        if (ms >= stick.snap && ms < stick.snap + 245) splinter = stick;
      }
      opacity(p['snap-fibers'], splinter ? 1 - (ms - splinter.snap) / 245 : 0);
      if (splinter) place(p['snap-fibers'], splinter.position);
      this.svg.dataset.stickSnaps = String(snaps);
      this.svg.dataset.bundle = !bundle.visible ? 'offstage' : bundle.cord >= .98 ? 'tied' : 'untied';
    }

    draw(ms, line, word) {
      const state = sceneState(this.scene, this.cues, ms, this.reduced.matches, line.speaker);
      this.frame(ms, line, state);
      this.objects(state, ms);
      const still = this.reduced.matches;
      const reading = word >= 0 ? {
        text: line.reading.words[word],
        phase: phase(ms - line.start, ...line.reading.timings[word])
      } : null;
      for (const [id, performer] of Object.entries(this.puppets)) {
        const pose = state[id];
        const shadow = this.parts[id + '-shadow'];
        shadow.setAttribute('cx', pose.x);
        shadow.setAttribute('cy', pose.y + 1);
        performer.paint(pose, ms, line.speaker === id ? reading : null, still);
      }
    }
  }

  async function prepare() {
    studio = await open(document.getElementById('bundle-studio'));
  }

  window.LittlePanthStage = { Stage: CourtyardStage, eventsFor, prepare };
})();
