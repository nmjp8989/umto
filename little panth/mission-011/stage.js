(() => {
  'use strict';

  const ns = 'http://www.w3.org/2000/svg';
  const clamp = value => Math.max(0, Math.min(1, value));
  const phase = (ms, start, end) => clamp((ms - start) / Math.max(1, end - start));
  const ease = t => t * t * (3 - 2 * t);
  const mix = (a, b, t) => a + (b - a) * t;
  const transform = (node, value) => node.setAttribute('transform', value);
  const opacity = (node, value) => node.setAttribute('opacity', String(value));
  const point = (x, y, angle = 0) => ({ x, y, angle });
  const parked = point(446, 592);
  const onStool = point(590, 522);
  const styles = {
    mehar: { sleeve: '#e3b36b', seam: '#ad784e', hand: '#e6ab77', shoulder: 158, mouth: 195 },
    boy: { sleeve: '#779e90', seam: '#527c73', hand: '#e2a776', shoulder: 158, mouth: 194 },
    dadi: { sleeve: '#ad859a', seam: '#8d657c', hand: '#d59d77', shoulder: 179, mouth: 218 }
  };

  function shape(tag, attributes, parent) {
    const node = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    parent.append(node);
    return node;
  }

  function wordAt(scene, id, word) {
    const line = scene.lines.find(entry => entry.id === id);
    const index = line.reading.words.findIndex(value => value.replace(/\p{P}/gu, '') === word);
    return line.start + (line.reading.timings[index]?.[0] ?? line.duration * .5);
  }

  function cuesFor(scene) {
    switch (scene.id) {
      case 'courtyard':
        return { reach: wordAt(scene, 'ball-game', 'ਇੱਕੋ') - 180 };
      case 'argument':
        return { answer: scene.lines[1].start };
      case 'bundle':
        return {
          release: wordAt(scene, 'dadi-calls', 'ਇੱਧਰ'),
          approach: wordAt(scene, 'dadi-calls', 'ਗੱਠਾ'),
          place: wordAt(scene, 'bundle-down', 'ਰੱਖ')
        };
      case 'try-bundle':
        return {
          mehar: wordAt(scene, 'try-together', 'ਜ਼ੋਰ'),
          boy: wordAt(scene, 'try-together', 'ਕੋਸ਼ਿਸ਼')
        };
      case 'loose-sticks': {
        const snap = wordAt(scene, 'sticks-snap', 'ਤੋੜ');
        return { untie: wordAt(scene, 'dadi-unties', 'ਖੋਲ੍ਹ'), take: wordAt(scene, 'dadi-unties', 'ਲੱਕੜੀ'),
          left: snap - 100, right: snap + 270 };
      }
      case 'play':
        return { roll: wordAt(scene, 'roll-and-share', 'ਰੋੜ੍ਹੀ'), back: wordAt(scene, 'roll-and-share', 'ਵਾਪਸ') + 140 };
      default:
        return {};
    }
  }

  function eventsFor(scene) {
    const cue = cuesFor(scene);
    switch (scene.id) {
      case 'bundle':
        return [{ ms: cue.release + 550, sound: 'step' }, { ms: cue.place + 210, sound: 'step' }];
      case 'try-bundle':
        return [{ ms: cue.mehar + 290, sound: 'ribbon' }, { ms: cue.boy + 290, sound: 'ribbon' }];
      case 'loose-sticks':
        return [{ ms: cue.untie + 60, sound: 'ribbon' }, { ms: cue.left, sound: 'twig' }, { ms: cue.right, sound: 'twig' }];
      case 'play':
        return [{ ms: cue.roll, sound: 'step' }, { ms: cue.back, sound: 'step' }];
      default:
        return [];
    }
  }

  function grip(actor, side, object, x, y = 0, strength = 1) {
    const angle = object.angle * Math.PI / 180;
    actor.grips[side] = {
      x: object.x + x * Math.cos(angle) - y * Math.sin(angle),
      y: object.y + x * Math.sin(angle) + y * Math.cos(angle),
      strength
    };
  }

  function pair(actor, object, span, strength = 1, spread = 0) {
    grip(actor, 0, object, -span - spread, 4 + spread * .26, strength);
    grip(actor, 1, object, span + spread, 4 + spread * .29, strength);
  }

  function actorsAndObjects(scene, cue, ms, still, speaker) {
    const travel = t => still ? Math.round(t) : ease(t);
    const actor = (x, y) => ({ x, y, turn: 0, step: 0, grips: [] });
    const mehar = actor(430, 621);
    const boy = actor(774, 621);
    const dadi = actor(904, 607);
    let ball = parked;
    let bundle = onStool;
    const wood = Number(!['courtyard', 'argument'].includes(scene.id));
    let cord = Number(!['lesson', 'play'].includes(scene.id));
    let sticks = [];
    const tug = () => { grip(mehar, 1, ball, -24); grip(boy, 0, ball, 24); };

    switch (scene.id) {
      case 'courtyard': {
        const reach = travel(phase(ms, cue.reach - 1080, cue.reach + 480));
        mehar.x = mix(400, 472, reach);
        boy.x = mix(755, 701, reach);
        dadi.x = 1035;
        ball = point(mix(686, 592, reach), 465, -14 * reach);
        grip(boy, 0, ball, 24);
        grip(mehar, 1, ball, -24, 0, reach);
        mehar.turn = 4;
        boy.turn = -4;
        break;
      }
      case 'argument': {
        const pull = mix(-14, 14, travel(phase(ms, cue.answer - 155, cue.answer + 340)));
        mehar.x = 472 + pull * .24;
        boy.x = 701 + pull * .24;
        dadi.x = 1035;
        ball = point(592 + pull, 465 + (still ? 0 : Math.sin(ms / 213) * 3.5), pull);
        mehar.turn = 8;
        boy.turn = -8;
        tug();
        break;
      }
      case 'bundle': {
        const leaveBall = travel(phase(ms, cue.release - 90, cue.release + 900));
        const near = travel(phase(ms, cue.approach - 300, cue.place - 700));
        const set = travel(phase(ms, cue.place - 470, cue.place + 210));
        const returnStep = travel(phase(ms, cue.place + 480, scene.duration - 180));
        mehar.x = mix(476, 430, leaveBall);
        boy.x = mix(705, 774, leaveBall);
        dadi.x = 1035 - 360 * near + 229 * returnStep;
        dadi.step = Math.sin(near * Math.PI) + Math.sin(returnStep * Math.PI);
        dadi.turn = -5 + 8 * Math.sin(set * Math.PI);
        ball = point(mix(604, parked.x, leaveBall), mix(465, parked.y, clamp(leaveBall * 1.7)), -311 * leaveBall);
        grip(boy, 0, ball, 24, 0, 1 - clamp(leaveBall * 3.8));
        grip(mehar, 1, ball, -24, 0, 1 - clamp(leaveBall * 3.8));
        bundle = point(mix(dadi.x - 46, onStool.x, set), mix(454, onStool.y, set), 7 * (1 - set));
        pair(dadi, bundle, 68, 1 - phase(ms, cue.place + 135, cue.place + 525));
        break;
      }
      case 'try-bundle': {
        const effort = start => Math.sin(Math.PI * phase(ms, start - 280, start + 1010));
        const a = effort(cue.mehar);
        const b = effort(cue.boy);
        const strain = a + b;
        mehar.x += 78 * a;
        boy.x -= 97 * b;
        mehar.turn = 9 * a;
        boy.turn = -10 * b;
        bundle = point(onStool.x + 65 * (b - a), onStool.y - 65 * strain, (b - a) * 9 +
          (still ? 0 : Math.sin(ms / 63) * 3 * strain));
        pair(mehar, bundle, 65, clamp(a * 1.75));
        pair(boy, bundle, 65, clamp(b * 1.75));
        break;
      }
      case 'loose-sticks': {
        const near = travel(phase(ms, cue.untie - 1120, cue.untie - 120));
        const leave = travel(phase(ms, cue.untie + 530, cue.take + 1100));
        const untied = travel(phase(ms, cue.untie - 50, cue.untie + 510));
        const picked = travel(phase(ms, cue.take - 130, cue.take + 720));
        dadi.x -= 172 * near * (1 - leave);
        grip(dadi, 0, bundle, -5, -19 - 29 * untied, near * (1 - leave));
        dadi.turn = -9 * near * (1 - leave);
        cord = 1 - untied;
        const actors = [mehar, boy];
        const endings = [point(466, 475, -9), point(746, 474, 8)];
        const times = [cue.left, cue.right];
        sticks = actors.map((current, i) => {
          const crack = travel(phase(ms, times[i], times[i] + 285));
          const target = endings[i];
          const position = point(mix(onStool.x, target.x, picked), mix(onStool.y, target.y, picked), target.angle * picked);
          pair(current, position, 42, picked, crack * 14);
          return { position, crack, split: ms >= times[i], visible: picked, at: times[i] };
        });
        break;
      }
      case 'lesson':
        sticks = [
          { position: point(546, 531, -15), crack: 1, split: true, visible: 1 },
          { position: point(643, 538, 10), crack: 1, split: true, visible: 1 }
        ];
        dadi.x = 858;
        if (speaker === 'dadi') grip(dadi, 0, point(747, 488), 0, 0, .93);
        mehar.turn = 4;
        boy.turn = -4;
        break;
      case 'play': {
        const forward = travel(phase(ms, cue.roll, Math.min(cue.roll + 1270, cue.back - 340)));
        const back = travel(phase(ms, cue.back, cue.back + 1150));
        mehar.x = 393;
        boy.x = 791;
        mehar.step = Math.sin(Math.PI * phase(ms, cue.roll - 210, cue.roll + 350));
        boy.step = -Math.sin(Math.PI * phase(ms, cue.back - 210, cue.back + 350));
        const distance = (forward - back) * 281;
        ball = point(parked.x + distance, parked.y, distance / 28 * 180 / Math.PI);
        sticks = [
          { position: point(546, 531, -15), crack: 1, split: true, visible: 1 },
          { position: point(643, 538, 10), crack: 1, split: true, visible: 1 }
        ];
        break;
      }
    }
    return { mehar, boy, dadi, ball, bundle, wood, cord, sticks };
  }

  class CourtyardStage {
    constructor(svg) {
      this.svg = svg;
      this.camera = new window.UmtoCamera.DeliveryCamera(svg);
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.parts = Object.fromEntries([...svg.querySelectorAll('[id]')].map(node => [node.id, node]));
      this.arms = Object.fromEntries(Object.entries(styles).map(([id, style]) => [id, [-1, 1].map(side => {
        const outline = shape('path', { fill: 'none', stroke: style.seam, 'stroke-width': 35, 'stroke-linecap': 'round' }, this.parts.arms);
        const sleeve = shape('path', { fill: 'none', stroke: style.sleeve, 'stroke-width': 28, 'stroke-linecap': 'round' }, this.parts.arms);
        const hand = shape('g', { 'data-hand': id + (side < 0 ? '-left' : '-right') }, this.parts.hands);
        shape('ellipse', { rx: 12, ry: 14, fill: style.hand, stroke: '#a77457', 'stroke-width': 2.7 }, hand);
        shape('path', { d: 'M-5 3q4-6 11-5m-9 8q5-5 10-4', fill: 'none', stroke: '#bb8966', 'stroke-width': 1.6,
          'stroke-linecap': 'round' }, hand);
        return { side, outline, sleeve, hand };
      })]));
    }

    select(scene) {
      this.scene = scene;
      this.cues = cuesFor(scene);
      this.shot = '';
    }

    frame(ms, line, state) {
      const { id, framing, focus } = this.scene;
      let shot = { preset: framing, focus };
      if ((id === 'bundle' || id === 'lesson') && line.speaker === 'dadi') {
        shot = { preset: 'medium', focus: { x: state.dadi.x - 36, y: 405 }, width: 690 };
      } else if (id === 'argument') {
        shot.width = 780;
      } else if (id === 'bundle') {
        shot = { preset: 'two-shot', focus: { x: 645, y: 431 }, width: 1035 };
      } else if (id === 'loose-sticks' && ms >= this.cues.take + 150) {
        shot = { preset: 'full', focus: { x: 620, y: 421 }, width: 995 };
      } else if (id === 'play' && ms >= this.cues.roll - 300 && !this.reduced.matches) {
        shot = { preset: 'full', focus: { x: mix(590, 637, phase(state.ball.x, 446, 727)), y: 403 },
          width: 1090, motion: 'tracking', parallax: true };
      }
      const signature = [shot.preset, shot.focus.x, shot.focus.y].join('/');
      if (signature !== this.shot) {
        this.camera.cue({ ...shot, cut: true });
        this.shot = signature;
      }
    }

    actor(id, pose, ms, talking, opening) {
      const p = this.parts;
      const style = styles[id];
      const still = this.reduced.matches;
      transform(p[id], 'translate(' + pose.x + ' ' + pose.y + ')');
      p[id + '-shadow'].setAttribute('cx', pose.x);
      transform(p[id + '-head'], 'rotate(' + pose.turn + ' 0 ' + (-style.shoulder - 30) + ')');
      const sway = still ? 0 : pose.step * 13 * (id === 'dadi' ? Math.sin(ms / 92) : 1);
      transform(p[id + '-feet'], 'rotate(' + sway + ' 0 -67)');
      const blink = !still && (ms + style.mouth * 8.8) % 4180 > 4040;
      opacity(p[id + '-eyes'], blink ? 0 : 1);
      opacity(p[id + '-lids'], blink ? 1 : 0);
      const mouthScale = talking ? .21 + .85 * opening : .17;
      transform(p[id + '-mouth'], 'translate(0 ' + (-style.mouth * (1 - mouthScale)) + ') scale(1 ' + mouthScale + ')');
      p[id].dataset.speaking = String(talking);
      for (const [index, arm] of this.arms[id].entries()) {
        const { side, sleeve, outline, hand } = arm;
        const x = pose.x + 41 * side;
        const y = pose.y - style.shoulder;
        const target = pose.grips[index];
        const tx = target ? mix(x + 14 * side, target.x, target.strength) : x + 14 * side;
        const ty = target ? mix(y + 83, target.y, target.strength) : y + 83;
        const ex = mix(x, tx, .56) + 22 * side;
        const ey = Math.max(y + 33, mix(y, ty, .51) + 16);
        const path = 'M' + x + ' ' + y + 'Q' + ex + ' ' + ey + ' ' + tx + ' ' + ty;
        outline.setAttribute('d', path);
        sleeve.setAttribute('d', path);
        transform(hand, 'translate(' + tx + ' ' + ty + ') rotate(' + (tx - x) * -.25 + ')');
      }
    }

    objects(state, ms) {
      const p = this.parts;
      const relocate = (node, point) => transform(node, 'translate(' + point.x + ' ' + point.y + ') rotate(' + point.angle + ')');
      relocate(p.bundle, state.bundle);
      relocate(p.ball, state.ball);
      p['ball-shadow'].setAttribute('cx', state.ball.x);
      opacity(p['ball-shadow'], phase(state.ball.y, 479, 592));
      opacity(p.bundle, state.wood);
      opacity(p['bundle-cord'], state.cord);
      transform(p['bundle-cord'], 'translate(' + (1 - state.cord) * 34 + ' ' + (state.cord - 1) * 21 + ')');
      let snaps = 0;
      let splinter = null;
      for (const [index, id] of ['mehar-stick', 'boy-stick'].entries()) {
        const stick = state.sticks[index];
        opacity(p[id], stick?.visible ?? 0);
        if (!stick) continue;
        relocate(p[id], stick.position);
        relocate(p[id + '-left'], point(-16 * stick.crack, 7 * stick.crack, -13 * stick.crack));
        relocate(p[id + '-right'], point(16 * stick.crack, 7 * stick.crack, 14 * stick.crack));
        if (stick.split) snaps++;
        if (ms >= stick.at && ms < stick.at + 245) splinter = stick;
      }
      opacity(p['snap-fibers'], splinter ? 1 - (ms - splinter.at) / 245 : 0);
      if (splinter) relocate(p['snap-fibers'], splinter.position);
      this.svg.dataset.stickSnaps = String(snaps);
      this.svg.dataset.bundle = !state.wood ? 'offstage' : state.cord >= .98 ? 'tied' : 'untied';
    }

    draw(ms, line, word) {
      const state = actorsAndObjects(this.scene, this.cues, ms, this.reduced.matches, line.speaker);
      this.frame(ms, line, state);
      this.objects(state, ms);
      let opening = 0;
      if (word >= 0 && line.speaker !== 'narrator') {
        const [start, end] = line.reading.timings[word];
        const offset = phase(ms - line.start, start, end);
        opening = .25 + Math.sin(Math.PI * offset) * (/[ਆਓਔਾੌੋ]/u.test(line.reading.words[word]) ? .78 : .58);
      }
      for (const id of ['mehar', 'boy', 'dadi']) this.actor(id, state[id], ms, word >= 0 && line.speaker === id, opening);
    }
  }

  window.LittlePanthStage = { Stage: CourtyardStage, eventsFor };
})();
