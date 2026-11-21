(() => {
  'use strict';

  const { open, Character } = window.UmtoNativeCharacterPlayer;
  const ns = 'http://www.w3.org/2000/svg';
  const cast = {
    mehar: { preset: 'kid-meher', view: 'right', height: 254, serial: 561 },
    dadi: { preset: 'elder-bibi-ji', view: 'right', height: 295, serial: 562 }
  };
  const point = (x, y) => ({ x, y });
  const phase = (n, a, b) => Math.min(1, Math.max(0, (n - a) / Math.max(1, b - a)));
  const ease = t => t * t * (3 - 2 * t);
  const mix = (a, b, t) => a + (b - a) * t;
  const between = (a, b, t) => point(mix(a.x, b.x, t), mix(a.y, b.y, t));
  const offset = (p, x, y) => point(p.x + x, p.y + y);
  const translate = ({ x, y }) => 'translate(' + x + ' ' + y + ')';
  const transform = (node, value) => node.setAttribute('transform', value);
  const opacity = (node, value) => node.setAttribute('opacity', String(value));
  const mouth = point(650, 467);
  const jarFoot = point(650, 539);
  const inJar = point(650, 503);
  const stuck = point(650, 485);
  const outOfJar = point(647, 445);
  const onJar = point(650, 455);
  const lidRest = point(704, 522);
  const braces = point(688, 498);
  const blue = point(568, 532);
  const green = point(725, 532);
  const meharHome = point(520, 628);
  const meharReaching = point(588, 646);
  const dadiHome = point(800, 621);
  const dadiHolding = point(736, 637);
  const grips = [point(-13, 5), point(-5, 11), point(5, 10), point(11, 0), point(-2, -2)];
  const fallMs = 365;
  let studio;

  const lineFor = (scene, id) => scene.lines.find(line => line.id === id);
  function wordTimes(scene, id, word) {
    const line = lineFor(scene, id);
    return line.reading.words.flatMap((value, i) => value.replace(/\p{P}/gu, '') === word
      ? [line.start + (line.reading.timings[i]?.[0] ?? line.duration / 2)] : []);
  }
  function wordAt(scene, id, word) {
    return wordTimes(scene, id, word)[0] ?? lineFor(scene, id).start + lineFor(scene, id).duration / 2;
  }

  function cuesFor(scene) {
    const at = (id, word) => wordAt(scene, id, word);
    switch (scene.id) {
      case 'afternoon-snack': return { look: at('jar-and-bowls', 'ਵੇਖਿਆ') };
      case 'full-fist': return {
        lid: at('mehar-gets-stuck', 'ਲਾਹਿਆ'), enter: at('mehar-gets-stuck', 'ਪਾਇਆ'), take: at('mehar-gets-stuck', 'ਪੰਜ'),
        pull: at('mehar-gets-stuck', 'ਖਿੱਚਿਆ'), stuck: at('mehar-gets-stuck', 'ਅਟਕ')
      };
      case 'ask-for-help': return { ask: at('mehar-asks-bibi', 'ਫੜੋਗੇ') };
      case 'bibi-helps': return { hold: at('bibi-explains', 'ਫੜਦੀ') };
      case 'three-fall-back': return {
        tap: wordTimes(scene, 'three-drop-two-stay', 'ਟਪ'), lift: at('three-drop-two-stay', 'ਬਾਹਰ')
      };
      case 'two-for-each': return {
        green: wordTimes(scene, 'both-bowls-filled', 'ਪਾਏ')[0],
        again: at('both-bowls-filled', 'ਕੱਢ'),
        blue: wordTimes(scene, 'both-bowls-filled', 'ਪਾਏ')[1]
      };
      case 'ready-to-share': return { close: at('lid-back-on', 'ਲਾ') };
    }
  }

  function eventsFor(scene) {
    const c = cuesFor(scene);
    switch (scene.id) {
      case 'afternoon-snack': return [{ ms: 550, sound: 'chirp' }];
      case 'full-fist': return [{ ms: c.lid + 120, sound: 'twig' }, { ms: c.stuck, sound: 'twig' }];
      case 'ask-for-help': return [];
      case 'bibi-helps': return [{ ms: c.hold, sound: 'twig' }];
      case 'three-fall-back': return c.tap.map(ms => ({ ms: ms + 160, sound: 'twig' }));
      case 'two-for-each': return [c.green, c.blue].map(ms => ({ ms: ms + 100, sound: 'twig' }));
      case 'ready-to-share': return [{ ms: c.close + 115, sound: 'twig' }, { ms: c.close + 820, sound: 'ribbon' }];
    }
  }

  function rotate(p, degrees) {
    const theta = degrees * Math.PI / 180;
    return point(p.x * Math.cos(theta) - p.y * Math.sin(theta), p.x * Math.sin(theta) + p.y * Math.cos(theta));
  }
  function jarPosition(p, angle) {
    const change = rotate(point(p.x - jarFoot.x, p.y - jarFoot.y), angle);
    return offset(jarFoot, change.x, change.y);
  }
  function grip(actor, target, weight = 1, hand = 'fist') {
    actor.grips[1] = { target, weight, hand };
  }
  function walk(actor, from, to, ms, start, end, movement) {
    const progress = phase(ms, start, end);
    Object.assign(actor, between(from, to, movement(progress)));
    if (progress > 0 && progress < 1) actor.walk = (ms - start) / 1000;
  }

  function makeFrame(scene, c, ms, still) {
    const movement = still ? Math.round : ease;
    const motion = (a, b) => movement(phase(ms, a, b));
    const pulse = (a, b, d, e) => motion(a, b) * (1 - motion(d, e));
    const mehar = { ...meharReaching, mirror: false, lean: 0, grips: [] };
    const dadi = { ...dadiHome, mirror: true, lean: 0, grips: [] };
    const frame = { actors: { mehar, dadi }, lid: { position: lidRest }, tilt: 0, mode: 'open', kernels: [] };
    const atHand = i => { frame.kernels[i] = { source: 'hand' }; };
    const intoBowl = (i, bowl, release, slot) => {
      if (ms < release) { atHand(i); return; }
      const progress = phase(ms, release, release + fallMs);
      frame.kernels[i] = { source: progress < 1 ? 'falling' : bowl === green ? 'green-bowl' : 'blue-bowl', progress,
        target: offset(bowl, slot === 0 ? -9 : 8, slot === 0 ? -2 : 1) };
    };
    const now = point(616, 647);
    const serving = point(650, 641);

    switch (scene.id) {
      case 'afternoon-snack': {
        frame.mode = 'closed';
        frame.lid = { position: onJar };
        walk(mehar, meharHome, meharReaching, ms, c.look - 340, c.look + 860, movement);
        break;
      }
      case 'full-fist': {
        const liftLid = motion(c.lid - 110, c.lid + 940);
        if (liftLid < 1) {
          const target = offset(between(onJar, lidRest, liftLid), 0, -29 * Math.sin(Math.PI * liftLid));
          walk(mehar, meharReaching, point(627, 647), ms, c.lid, c.lid + 720, movement);
          grip(mehar, target, motion(c.lid - 490, c.lid - 120));
          frame.lid = { position: liftLid === 0 ? onJar : target, owner: liftLid === 0 ? null : 'mehar',
            settle: motion(c.lid + 720, c.lid + 940) };
        } else {
          walk(mehar, point(627, 647), meharReaching, ms, c.lid + 940, c.enter - 430, movement);
        }
        const enter = motion(c.enter - 390, c.enter + 520);
        const pull = motion(c.pull - 100, c.stuck + 140);
        const reach = motion(c.enter - 710, c.enter - 340);
        const target = between(outOfJar, between(inJar, stuck, pull), enter);
        frame.tilt = still ? 0 : 3.1 * Math.sin(ms / 108) * pulse(c.pull - 140, c.pull + 180, c.stuck + 190, c.stuck + 710);
        if (reach > 0) grip(mehar, jarPosition(target, frame.tilt), reach, ms < c.take ? 'open' : 'fist');
        if (ms >= c.take) [0, 1, 2, 3, 4].forEach(atHand);
        frame.mode = ms < c.pull ? 'open' : 'stuck';
        break;
      }
      case 'ask-for-help':
        frame.tilt = still ? 0 : 1.8 * Math.sin(ms / 145) * pulse(120, 480, c.ask, c.ask + 300);
        grip(mehar, jarPosition(stuck, frame.tilt));
        [0, 1, 2, 3, 4].forEach(atHand);
        frame.mode = 'stuck';
        break;
      case 'bibi-helps':
        walk(dadi, dadiHome, dadiHolding, ms, 60, c.hold - 155, movement);
        grip(dadi, braces, motion(c.hold - 520, c.hold + 70), 'open');
        grip(mehar, stuck);
        [0, 1, 2, 3, 4].forEach(atHand);
        frame.mode = 'steadied';
        break;
      case 'three-fall-back': {
        Object.assign(dadi, dadiHolding);
        grip(dadi, braces, 1, 'open');
        const lift = motion(c.lift - 65, c.lift + 560);
        grip(mehar, between(stuck, outOfJar, lift), 1, ms < c.tap[0] ? 'fist' : 'pinch');
        c.tap.forEach((release, index) => {
          if (ms < release) atHand(index);
          else if (ms < release + fallMs) frame.kernels[index] = { source: 'returned',
            target: offset(mouth, -13 + index * 12, 61), progress: phase(ms, release, release + fallMs) };
        });
        [3, 4].forEach(atHand);
        frame.mode = lift > .95 ? 'free' : 'steadied';
        break;
      }
      case 'two-for-each': {
        Object.assign(dadi, point(789, 635));
        const first = motion(c.green - 1070, c.green - 115);
        const withdrawal = motion(c.green + 440, c.again - 670);
        const drawing = motion(c.again - 100, c.again + 440);
        const second = motion(c.again + 440, c.blue - 125);
        const greenOver = offset(green, -7, -34);
        const blueOver = offset(blue, 4, -37);
        if (ms < c.green + 445) {
          walk(mehar, meharReaching, serving, ms, c.green - 1340, c.green - 170, movement);
          grip(mehar, between(outOfJar, greenOver, first), 1, ms < c.green ? 'pinch' : 'open');
        } else {
          walk(mehar, serving, now, ms, c.green + 450, c.again - 660, movement);
          const reach = between(greenOver, inJar, withdrawal);
          const lifted = between(reach, outOfJar, drawing);
          const goal = between(lifted, blueOver, second);
          mehar.mirror = ms >= c.again + 440;
          grip(mehar, goal, 1, ms < c.again ? 'open' : ms < c.blue ? 'pinch' : 'open');
        }
        intoBowl(3, green, c.green, 0);
        intoBowl(4, green, c.green, 1);
        if (ms >= c.again - 60) {
          intoBowl(5, blue, c.blue, 0);
          intoBowl(6, blue, c.blue, 1);
        }
        break;
      }
      case 'ready-to-share': {
        walk(mehar, now, point(538, 635), ms, 100, c.close - 1020, movement);
        mehar.mirror = ms < c.close - 980;
        Object.assign(dadi, point(731, 642));
        const close = motion(c.close - 580, c.close + 115);
        const goal = offset(between(lidRest, onJar, close), 0, -25 * Math.sin(Math.PI * close));
        const reach = pulse(c.close - 990, c.close - 590, c.close + 115, c.close + 475);
        if (reach > 0) grip(dadi, goal, reach);
        frame.lid = close > 0 && close < 1 ? { position: goal, owner: 'dadi',
          settle: motion(c.close - 100, c.close + 115) } : { position: close === 1 ? onJar : lidRest };
        intoBowl(3, green, -fallMs, 0);
        intoBowl(4, green, -fallMs, 1);
        intoBowl(5, blue, -fallMs, 0);
        intoBowl(6, blue, -fallMs, 1);
        frame.mode = close === 1 ? 'closed' : 'open';
        break;
      }
    }
    return frame;
  }

  class AlmondStage {
    constructor(svg) {
      this.svg = svg;
      this.camera = new window.UmtoCamera.DeliveryCamera(svg);
      this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
      this.parts = Object.fromEntries([...svg.querySelectorAll('[id]')].map(node => [node.id, node]));
      this.puppets = Object.fromEntries(Object.entries(cast).map(([id, spec]) => [
        id, new Character(studio, svg, this.parts[id], this.parts[id + '-props'], spec)
      ]));
      const kernel = () => {
        const node = document.createElementNS(ns, 'use');
        node.setAttribute('href', '#almond-kernel-shape');
        return node;
      };
      this.pile = Array.from({ length: 18 }, (_, index) => {
        const node = kernel();
        const row = Math.floor(index / 6);
        transform(node, translate(point(-30 + 11 * (index % 6) + (row % 2) * 5, 66 - row * 7)) +
          ' rotate(' + (index * 23 % 65 - 32) + ') scale(.79)');
        this.parts['almond-jar-pile'].append(node);
        return node;
      });
      this.kernels = Array.from({ length: 7 }, (_, index) => {
        const node = kernel();
        node.id = 'almond-' + index;
        this.parts['almond-moving'].append(node);
        return node;
      });
    }

    select(scene) {
      this.scene = scene;
      this.cue = cuesFor(scene);
      this.shot = '';
    }

    frameCamera(ms, line) {
      const { id, framing, focus } = this.scene;
      const c = this.cue;
      const shotAt = (preset, x, y, width) => ({ preset, focus: point(x, y), width });
      let shot = { preset: framing, focus };
      if (id === 'afternoon-snack' && line.speaker === 'dadi') {
        shot = shotAt('two-shot', 667, 425, 878);
      } else if (id === 'full-fist') {
        shot = ms < c.enter - 720 ? shotAt('medium', 623, 454, 780) : shotAt('detail', 641, 466, 617);
      } else if (id === 'three-fall-back') {
        shot = ms < c.lift + 670 ? shotAt('detail', 646, 474, 546) : shotAt('two-shot', 646, 437, 835);
      } else if (id === 'two-for-each') {
        shot = line.speaker === 'mehar' ? shotAt('two-shot', 658, 425, 835) : shotAt('detail', 651, 480, 755);
      } else if (id === 'ready-to-share' && line.id === 'lid-back-on') {
        shot = shotAt('detail', 680, 456, 732);
      }
      const key = [shot.preset, shot.focus.x, shot.focus.y, shot.width].join('/');
      if (key !== this.shot) {
        this.camera.cue({ ...shot, cut: true });
        this.shot = key;
      }
    }

    palm(id) {
      const n = this.puppets[id].arms[1].querySelector('[data-action-hand]');
      return new DOMPoint(0, Number(n.dataset.gripY)).matrixTransform(n.getScreenCTM())
        .matrixTransform(this.svg.getScreenCTM().inverse());
    }

    paintProps(state, still) {
      const p = this.parts;
      for (const id of ['almond-jar-back', 'almond-jar-front']) {
        transform(p[id], translate(jarPosition(mouth, state.tilt)) + ' rotate(' + state.tilt + ')');
      }
      const lid = state.lid;
      const lidAt = lid.owner ? between(this.palm(lid.owner), lid.position, lid.settle ?? 0) : lid.position;
      transform(p['almond-lid'], translate(lidAt));
      p['almond-lid'].dataset.owner = lid.owner ?? 'table';
      p['almond-lid'].dataset.state = state.mode === 'closed' ? 'closed' : 'open';
      this.svg.dataset.jar = state.mode;
      const palm = state.kernels.some(kernel => kernel?.source === 'hand' || kernel?.progress < 1) ? this.palm('mehar') : null;
      const inHand = state.kernels.filter(kernel => kernel?.source === 'hand').length;
      this.pile.forEach((node, index) => opacity(node, index >= this.pile.length - inHand ? .22 : .99));
      this.kernels.forEach((node, index) => {
        const kernel = state.kernels[index];
        opacity(node, kernel ? 1 : 0);
        node.dataset.source = kernel?.source ?? 'jar';
        if (!kernel) return;
        const spot = grips[index % grips.length];
        const held = palm && offset(palm, spot.x, spot.y);
        const t = still && kernel.progress != null ? Math.round(kernel.progress) : kernel.progress;
        const at = kernel.source === 'hand' ? held : t < 1
          ? between(held, kernel.target, t ** 1.35) : kernel.target;
        const angle = index * 46 % 91 - 42 + (t == null ? 0 : t * 176);
        transform(node, translate(at) + ' rotate(' + angle + ') scale(.83)');
      });
    }

    draw(ms, line, word) {
      const still = this.reduced.matches;
      const state = makeFrame(this.scene, this.cue, ms, still);
      this.frameCamera(ms, line);
      const voice = word >= 0 ? { text: line.reading.words[word],
        phase: phase(ms - line.start, ...line.reading.timings[word]) } : null;
      for (const [id, actor] of Object.entries(state.actors)) {
        transform(this.parts[id + '-plane'], actor.mirror ? 'translate(' + (2 * actor.x) + ' 0) scale(-1 1)' : '');
        transform(this.parts[id + '-shadow'], translate(point(actor.x, actor.y + 3)));
        this.puppets[id].paint(actor, ms, line.speaker === id ? voice : null, still);
      }
      this.paintProps(state, still);
    }
  }

  async function prepare() {
    studio = await open(document.getElementById('almond-jar-studio'));
  }

  window.LittlePanthStage = { Stage: AlmondStage, eventsFor, prepare };
})();
