(() => {
  'use strict';

  const { open, Character } = window.UmtoNativeCharacterPlayer;
  const point = (x, y) => ({ x, y });
  const offset = (p, x, y) => point(p.x + x, p.y + y);
  const mix = (a, b, t) => a + (b - a) * t;
  const between = (a, b, t) => point(mix(a.x, b.x, t), mix(a.y, b.y, t));
  const phase = (ms, start, end) => Math.max(0, Math.min(1, (ms - start) / Math.max(1, end - start)));
  const ease = t => t * t * (3 - 2 * t);
  const move = (ms, start, end) => ease(phase(ms, start, end));
  const translate = ({ x, y }) => 'translate(' + x + ' ' + y + ')';
  const transform = (node, value) => node.setAttribute('transform', value);
  const opacity = (node, value) => node.setAttribute('opacity', String(Number(value)));
  const coords = p => p.x + ' ' + p.y;
  const scale = 1.16;
  const tailor = { preset: 'adult-harpreet', view: 'right', height: 299, serial: 571 };
  const tableSide = point(459, 619);
  const washSide = point(516, 642);
  const tubHandle = point(104, -25);
  const lineSide = point(532, 621);
  const visitor = point(994, 611);
  const washing = point(975, 614);
  const awayFromLine = point(1027, 614);
  const tubCorner = point(862, 574);
  const tubSite = point(654, 559);
  const pailSite = point(827, 584);
  const tableCloth = { left: point(493, 500), right: point(571, 502), depth: 13 };
  const tubCloth = { left: point(596, 552), right: point(707, 549), depth: 18 };
  const lineCloth = { left: point(582, 416), right: point(704, 416), depth: 111 };
  const handUnderLine = offset(lineCloth.left, 0, 8);
  let studio;

  function lineFor(scene, id) {
    return scene.lines.find(line => line.id === id);
  }

  function wordAt(scene, id, word, last = false) {
    const line = lineFor(scene, id);
    const words = line.reading.words.map(value => value.replace(/\p{P}/gu, ''));
    const index = last ? words.lastIndexOf(word) : words.indexOf(word);
    if (index < 0) throw Error('Missing "' + word + '" in ' + id);
    return line.start + (line.reading.timings[index]?.[0] ?? line.duration / 2);
  }

  function cuesFor(scene) {
    const at = (id, word, last) => wordAt(scene, id, word, last);
    switch (scene.id) {
      case 'outside-the-shop': return { arrival: at('the-blue-cloth', 'ਆਇਆ'), notice: at('the-blue-cloth', 'ਕੱਪੜਾ') };
      case 'tub-from-the-corner': return { approach: at('elephant-offers-help', 'ਆਉਂਦਾ'),
        grip: at('elephant-carries-the-tub', 'ਫੜਿਆ'), lift: at('elephant-carries-the-tub', 'ਚੁੱਕ'),
        land: at('elephant-carries-the-tub', 'ਰੱਖਿਆ') };
      case 'cloth-into-water': return { pickup: at('cloth-into-the-tub', 'ਕੱਪੜਾ'), release: at('cloth-into-the-tub', 'ਪਾਇਆ') + 100,
        splash: at('cloth-into-the-tub', 'ਛਪਾਕ'), stir: at('cloth-into-the-tub', 'ਹਿਲਾਇਆ') };
      case 'spray-and-rinse': return { bucket: at('trunk-sprays-water', 'ਖਿੱਚਿਆ'),
        spray: at('trunk-sprays-water', 'ਛੱਡੀ'), clear: at('trunk-sprays-water', 'ਲਹਿ') };
      case 'hang-it-together': return { ready: at('each-takes-a-corner', 'ਫੜ'), both: at('each-takes-a-corner', 'ਫੜ', true),
        lift: at('cloth-on-the-line', 'ਚੁੱਕਿਆ'), hang: at('cloth-on-the-line', 'ਟੰਗ'),
        drip: at('cloth-on-the-line', 'ਟਪਕੀਆਂ') };
      default: return {};
    }
  }

  function eventsFor(scene) {
    const c = cuesFor(scene);
    const cue = (ms, sound) => ({ ms, sound });
    switch (scene.id) {
      case 'outside-the-shop': return [cue(c.arrival - 1250, 'step'), cue(c.arrival - 490, 'step')];
      case 'tub-from-the-corner': return [cue(c.grip, 'twig'), cue(c.lift + 280, 'step'), cue(c.lift + 780, 'step'),
        cue(c.land, 'plop')];
      case 'cloth-into-water': return [cue(c.splash, 'plop'), cue(c.splash + 180, 'sip'), cue(c.stir - 20, 'sip')];
      case 'spray-and-rinse': return [cue(c.bucket, 'sip'), cue(c.spray, 'sip'), cue(c.spray + 390, 'sip'),
        cue(c.spray + 820, 'sip'), cue(c.clear - 140, 'sip')];
      case 'hang-it-together': return [cue(c.hang, 'twig'), cue(c.drip, 'sip')];
      case 'dry-in-the-sun': return [cue(680, 'chirp')];
    }
  }

  function walk(actor, from, to, ms, start, end) {
    const t = move(ms, start, end);
    Object.assign(actor, between(from, to, t));
    if (t > 0 && t < 1) actor.walk = (ms - start) / 1000;
    return t;
  }

  function grip(actor, target, weight = 1, hand = 'fist') {
    actor.grips[1] = { target, weight, hand };
  }

  function clothBetween(a, b, t) {
    return { left: between(a.left, b.left, t), right: between(a.right, b.right, t), depth: mix(a.depth, b.depth, t) };
  }

  function trunkRest(elephant) {
    return offset(elephant, -165, -81);
  }

  function makeFrame(scene, c, ms, still) {
    const travel = (a, b) => move(ms, a, b);
    const pulse = (a, b, d, e) => travel(a, b) * (1 - travel(d, e));
    const actor = { ...tableSide, mirror: false, lean: 0, grips: [] };
    const elephant = { ...washing };
    const frame = { actor, elephant, tub: tubSite, tip: null, cloth: tableCloth, dust: 1,
      clothState: 'table', handleGrip: false, handGrip: false, trunkGrip: false,
      suck: 0, spray: 0, splash: 0, drips: 0, ripples: 0, pegs: 0 };
    switch (scene.id) {
      case 'outside-the-shop': {
        walk(elephant, point(1310, 622), visitor, ms, c.arrival - 3200, c.arrival + 260);
        frame.tub = tubCorner;
        const notice = pulse(c.notice - 200, c.notice + 170, c.notice + 1250, c.notice + 1800);
        if (notice > 0) grip(actor, point(516, 470), notice * .88, 'point');
        break;
      }
      case 'tub-from-the-corner': {
        const turn = point(1101, 609);
        walk(elephant, visitor, turn, ms, c.approach - 300, c.grip - 510);
        const carry = travel(c.lift - 80, c.land);
        if (ms > c.lift - 80) walk(elephant, turn, washing, ms, c.lift - 80, c.land + 80);
        const raise = pulse(c.lift - 100, c.lift + 455, c.land - 640, c.land);
        frame.tub = offset(between(tubCorner, tubSite, carry), 0, -47 * raise);
        const contact = pulse(c.grip - 600, c.grip - 15, c.land + 145, c.land + 600);
        frame.tip = between(trunkRest(elephant), offset(frame.tub, tubHandle.x, tubHandle.y), contact);
        frame.handleGrip = contact > .995;
        frame.ripples = .42 * raise;
        break;
      }
      case 'cloth-into-water': {
        const carry = travel(c.pickup + 100, c.release - 105);
        if (ms > c.pickup + 100) walk(actor, tableSide, washSide, ms, c.pickup + 100, c.release - 105);
        const reach = pulse(c.pickup - 390, c.pickup - 30, c.release, c.release + 340);
        const held = { left: point(596, 505), right: point(675, 527), depth: 32 };
        const goal = between(tableCloth.left, held.left, carry);
        if (reach > 0) grip(actor, goal, reach, 'pinch');
        const fall = phase(ms, c.release, c.splash);
        if (ms >= c.pickup && ms < c.release) {
          frame.cloth = clothBetween(tableCloth, held, carry);
          frame.clothState = 'carried';
          frame.handGrip = true;
        } else if (ms >= c.release) {
          frame.cloth = clothBetween(held, tubCloth, fall ** 1.46);
          frame.clothState = fall < 1 ? 'falling' : 'in-tub';
        }
        const stir = pulse(c.stir - 610, c.stir - 150, c.stir + 235, c.stir + 615);
        if (stir > 0) {
          const sway = still ? 0 : Math.sin(ms / 106) * 7 * stir;
          actor.lean = 23 * stir;
          const left = offset(tubCloth.left, sway, -7 * stir);
          grip(actor, left, stir, 'pinch');
          frame.cloth = { ...tubCloth, left, right: offset(tubCloth.right, sway, 0) };
          frame.handGrip = stir > .95;
        }
        if (ms >= c.splash) frame.splash = 1 - phase(ms, c.splash, c.splash + 820);
        frame.ripples = Math.max(frame.splash * .89, stir * .78);
        break;
      }
      case 'spray-and-rinse': {
        Object.assign(actor, washSide);
        frame.cloth = tubCloth;
        frame.clothState = 'in-tub';
        const towardPail = pulse(c.bucket - 1020, c.bucket - 110, c.bucket + 510, c.bucket + 1250);
        const towardCloth = pulse(c.spray - 960, c.spray - 280, c.clear + 190, c.clear + 1080);
        const source = offset(pailSite, 1, 2);
        const stream = point(767, 470);
        frame.tip = between(between(trunkRest(elephant), source, towardPail), stream, towardCloth);
        frame.suck = towardPail > .99 && ms >= c.bucket - 100 ? 1 : 0;
        frame.spray = pulse(c.spray - 10, c.spray + 210, c.clear - 120, c.clear + 250);
        frame.dust = 1 - travel(c.spray + 230, c.clear + 230);
        frame.ripples = frame.spray * .87;
        break;
      }
      case 'hang-it-together': {
        frame.dust = 0;
        const leftGrip = pulse(c.both - 530, c.both - 17, c.hang + 305, c.hang + 600);
        const trunkGrip = pulse(c.ready - 420, c.ready + 65, c.hang + 315, c.hang + 795);
        const lift = travel(c.lift - 575, c.hang + 200);
        walk(actor, washSide, lineSide, ms, c.lift - 550, c.hang);
        actor.lean = 20 * leftGrip * (1 - lift);
        frame.cloth = clothBetween(tubCloth, lineCloth, lift);
        frame.cloth.depth -= lift * (1 - lift) * 31;
        frame.pegs = travel(c.hang + 160, c.hang + 233);
        frame.handGrip = leftGrip > .995;
        frame.trunkGrip = trunkGrip > .998;
        frame.clothState = ms >= c.hang + 200 ? 'hung' : lift > 0 ? 'lifting' : 'in-tub';
        if (leftGrip > 0) {
          const gripPoint = between(frame.cloth.left, handUnderLine, lift ** 4 * (1 - frame.handGrip));
          grip(actor, gripPoint, leftGrip, 'pinch');
        }
        frame.tip = between(trunkRest(elephant), frame.cloth.right, trunkGrip);
        frame.drips = pulse(c.hang + 440, c.hang + 980, c.drip + 310, c.drip + 940);
        break;
      }
      case 'dry-in-the-sun':
        Object.assign(actor, point(517, 624));
        walk(elephant, washing, awayFromLine, ms, 160, 1710);
        frame.cloth = lineCloth;
        frame.clothState = 'hung';
        frame.pegs = 1;
        frame.dust = 0;
        break;
    }
    if (!frame.tip) frame.tip = trunkRest(elephant);
    frame.breeze = frame.clothState === 'hung' && !still ? 5 * Math.sin(ms / 278) : 0;
    return frame;
  }

  class TailorStage {
    constructor(svg) {
      this.svg = svg;
      this.camera = new window.UmtoCamera.DeliveryCamera(svg);
      this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
      this.parts = Object.fromEntries([...svg.querySelectorAll('[id]')].map(node => [node.id, node]));
      this.harpreet = new Character(studio, svg, this.parts.harpreet, this.parts['harpreet-props'], tailor);
      this.splash = this.makeDrops('wash-splash', 10);
      this.drips = this.makeDrops('wash-drips', 6);
    }

    makeDrops(group, total) {
      return Array.from({ length: total }, (_, index) => {
        const node = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        node.setAttribute('rx', String(2.2 + index % 3 * .47));
        node.setAttribute('ry', String(3.4 + index % 3 * .63));
        this.parts[group].append(node);
        return node;
      });
    }

    select(scene) {
      this.scene = scene;
      this.cue = cuesFor(scene);
      this.shot = '';
    }

    frameCamera(ms, line, state, still) {
      const { id, framing, focus } = this.scene;
      const c = this.cue;
      const shotAt = (preset, x, y, width, tracking = false) => ({
        preset, focus: point(x, y), width, motion: tracking && !still ? 'tracking' : 'static',
        parallax: tracking && !still
      });
      let shot = { preset: framing, focus };
      if (id === 'outside-the-shop' && line.speaker === 'harpreet') {
        shot = shotAt('two-shot', 700, 400, 1040);
      } else if (id === 'tub-from-the-corner' && ms >= c.grip - 720) {
        shot = shotAt('full', Math.round((state.tub.x + state.elephant.x) / 2 - 1), 447, 942, ms < c.land + 120);
      } else if (id === 'cloth-into-water') {
        shot = ms < c.release - 130 ? shotAt('detail', 574, 474, 663) : shotAt('detail', 641, 503, 648);
      } else if (id === 'spray-and-rinse') {
        shot = line.speaker === 'harpreet' ? shotAt('two-shot', 710, 435, 1050)
          : shotAt('detail', ms < c.bucket + 960 ? 789 : 731, 487, 778);
      } else if (id === 'hang-it-together') {
        shot = ms >= c.lift - 400 && ms <= c.hang + 820 ? shotAt('detail', 680, 450, 855)
          : shotAt('two-shot', 712, 433, 1040);
      }
      const key = [shot.preset, shot.focus.x, shot.focus.y, shot.width, shot.motion].join('/');
      if (this.shot !== key) {
        this.camera.cue({ ...shot, cut: true });
        this.shot = key;
      }
    }

    palm() {
      const hand = this.harpreet.arms[1].querySelector('[data-action-hand]');
      return new DOMPoint(0, Number(hand.dataset.gripY)).matrixTransform(hand.getScreenCTM())
        .matrixTransform(this.svg.getScreenCTM().inverse());
    }

    paintElephant(state, ms, mouth, still) {
      const p = this.parts;
      const pose = state.elephant;
      transform(p.elephant, translate(pose) + ' scale(' + scale + ')');
      transform(p['elephant-shadow'], translate(offset(pose, 34, 2)));
      const stride = pose.walk == null || still ? 0 : Math.sin(pose.walk * 6.15);
      for (const [leg, x, y, speed] of [
        ['hind-far', 123, -117, -1], ['front-far', -18, -126, 1],
        ['hind-near', 157, -144, 1], ['front-near', 13, -150, -1]
      ]) {
        transform(p['elephant-' + leg], 'rotate(' + (stride * speed * 6.4) + ' ' + x + ' ' + y + ')');
      }
      const swing = still ? 0 : Math.sin(ms / 332) * 5.7 + 2 * stride;
      transform(p['elephant-tail'], 'rotate(' + swing + ' 166 -198)');
      transform(p['elephant-ear-pivot'], 'rotate(' + (swing * .38 + mouth * 1.8) + ' -51 -188)');
      transform(p['elephant-jaw'], 'rotate(' + (mouth * 15) + ' -63 -112)');
      opacity(p['elephant-mouth'], .32 + mouth * .62);
      const blink = !still && (ms + 1920) % 4525 > 4325;
      opacity(p['elephant-lid'], blink);
      opacity(p['elephant-eye'], !blink);
      opacity(p['elephant-highlight'], !blink);
      p.elephant.dataset.speaking = String(mouth > 0);
    }

    paintTrunk(state) {
      const p = this.parts;
      const tip = state.tip;
      const base = offset(state.elephant, -103 * scale, -145 * scale);
      const a = offset(base, -15, 30);
      const b = point(tip.x + Math.max(18, (base.x - tip.x) * .46), tip.y + 22);
      const steps = 18;
      const upper = [];
      const lower = [];
      const highlight = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const q0 = between(base, a, t);
        const q1 = between(a, b, t);
        const q2 = between(b, tip, t);
        const left = between(q0, q1, t);
        const right = between(q1, q2, t);
        const center = between(left, right, t);
        const length = Math.hypot(right.x - left.x, right.y - left.y);
        const nx = (left.y - right.y) / Math.max(1, length);
        const ny = (right.x - left.x) / Math.max(1, length);
        const radius = mix(19.5, 6.2, t);
        upper.push(coords(offset(center, nx * radius, ny * radius)));
        lower.push(coords(offset(center, -nx * radius, -ny * radius)));
        highlight.push(coords(offset(center, nx * (radius - 4.5), ny * (radius - 4.5))));
      }
      const outline = 'M' + upper.join('L') + 'L' + lower.reverse().join('L') + 'Z';
      p['trunk-outline'].setAttribute('d', outline);
      p['trunk-light'].setAttribute('d', 'M' + highlight.slice(1, -2).join('L'));
      transform(p['trunk-tip'], translate(tip) + ' rotate(-30)');
      p['elephant-trunk'].dataset.grip = state.handleGrip ? 'tub' : state.trunkGrip ? 'cloth' : state.suck ? 'pail' : 'none';
    }

    paintFabric(state) {
      const p = this.parts;
      const { cloth, breeze: wave } = state;
      const { right, depth } = cloth;
      const left = state.handGrip && state.clothState !== 'hung' ? this.palm() : cloth.left;
      const lowLeft = offset(left, wave * .56, depth);
      const lowRight = offset(right, 3 + wave, depth - (state.clothState === 'hung' ? 5 : 1));
      const middle = between(lowLeft, lowRight, .5);
      const bend = state.clothState === 'hung' ? 12 : 4;
      const shape = 'M' + coords(left) + 'Q' + coords(offset(between(left, right, .54), 1, 4)) + ' ' + coords(right) +
        'Q' + coords(offset(between(right, lowRight, .54), 8, 0)) + ' ' + coords(lowRight) +
        'Q' + coords(offset(middle, 0, bend)) + ' ' + coords(lowLeft) + 'Q' +
        coords(offset(between(left, lowLeft, .53), -5, 0)) + ' ' + coords(left) + 'Z';
      p['cloth-body'].setAttribute('d', shape);
      p['cloth-stitch'].setAttribute('d', 'M' + coords(offset(lowLeft, 5, -4)) + 'Q' +
        coords(offset(middle, 0, bend - 5)) + ' ' + coords(offset(lowRight, -6, -4)));
      transform(p['cloth-left'], translate(left));
      transform(p['cloth-right'], translate(right));
      transform(p['cloth-dust'], translate(offset(between(left, right, .48), 0, depth * .45)));
      opacity(p['cloth-dust'], state.dust * .72);
      opacity(p['line-pegs'], state.pegs);
      p['cloth-shape'].dataset.state = state.clothState;
      return between(between(left, right, .54), middle, .35);
    }

    paintWater(state, target, ms, still) {
      const p = this.parts;
      transform(p['tailor-pail'], translate(pailSite));
      transform(p['tailor-tub'], translate(state.tub));
      transform(p['tub-front-rim'], translate(state.tub));
      opacity(p['tub-ripple'], state.ripples * .79);
      const breath = still ? 0 : Math.sin(ms / 104) * .08;
      transform(p['tub-ripple'], 'scale(' + (1 + breath) + ')');
      const tip = state.tip;
      const height = still ? 30 : 34 + 5 * Math.sin(ms / 69);
      const stream = 'M' + coords(tip) + 'Q' + coords(point(mix(tip.x, target.x, .6), tip.y - height)) + ' ' + coords(target);
      p['rinse-stream'].setAttribute('d', stream);
      p['rinse-glint'].setAttribute('d', stream);
      p['rinse-glint'].setAttribute('stroke-dasharray', '11 17');
      p['rinse-glint'].setAttribute('stroke-dashoffset', String(still ? 0 : -ms / 24));
      transform(p['rinse-hit'], translate(target));
      opacity(p['rinse-spray'], state.spray);
      opacity(p['wash-splash'], state.splash * (still ? .39 : 1));
      this.splash.forEach((drop, i) => {
        const flight = 1 - state.splash;
        const distance = 22 + i * 6.2;
        const rise = -Math.sin(Math.PI * flight) * (38 + i % 4 * 10);
        transform(drop, translate(offset(state.tub, (i % 2 ? -1 : 1) * distance * flight, rise - 5)) +
          ' rotate(' + (i * 23 % 70 - 35) + ')');
      });
      opacity(p['wash-drips'], state.drips * .78);
      this.drips.forEach((drop, i) => transform(drop, translate(point(597 + i * 18,
        526 + (still ? i * 6 : (ms / 9 + i * 15) % 69)))));
    }

    draw(ms, line, word) {
      const still = this.reduced.matches;
      const state = makeFrame(this.scene, this.cue, ms, still);
      const p = this.parts;
      this.frameCamera(ms, line, state, still);
      const timing = word >= 0 ? { text: line.reading.words[word],
        phase: phase(ms - line.start, ...line.reading.timings[word]) } : null;
      this.harpreet.paint(state.actor, ms, line.speaker === 'harpreet' ? timing : null, still);
      transform(p['tailor-shadow-on-ground'], translate(offset(state.actor, 0, 4)));
      const talking = line.speaker === 'elephant' && timing && timing.phase > .065 && timing.phase < .94;
      const mouth = talking ? .24 + .75 * Math.sin(Math.PI * timing.phase) : 0;
      this.paintElephant(state, ms, mouth, still);
      this.paintTrunk(state);
      const hit = this.paintFabric(state);
      this.paintWater(state, hit, ms, still);
    }
  }

  async function prepare() {
    studio = await open(document.getElementById('elephant-tailor-studio'));
  }

  window.LittlePanthStage = { Stage: TailorStage, eventsFor, prepare };
})();
