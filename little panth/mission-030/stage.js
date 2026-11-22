(() => {
  'use strict';

  const { open, Character, voiceFrame } = window.UmtoNativeCharacterPlayer;
  const point = (x, y) => ({ x, y });
  const offset = (p, x, y) => point(p.x + x, p.y + y);
  const mix = (a, b, t) => a + (b - a) * t;
  const phase = (ms, from, to) => Math.max(0, Math.min(1, (ms - from) / Math.max(1, to - from)));
  const smooth = t => t * t * (3 - 2 * t);
  const opacity = (node, value) => node.setAttribute('opacity', String(Number(value)));
  const transform = (node, value) => node.setAttribute('transform', value);
  const translate = ({ x, y }) => 'translate(' + x + ' ' + y + ')';
  const mehar = { preset: 'kid-meher', view: 'right', height: 218, serial: 691, hipHinge: true };
  const harpreet = { preset: 'adult-harpreet', view: 'right', height: 293, serial: 692, hipHinge: true };
  const shade = point(418, 627);
  const field = point(752, 626);
  const shelter = point(659, 629);
  const guideShade = point(592, 617);
  const guideField = point(970, 628);
  const pinch = point(-30, 84);
  const anchor = point(pinch.x * .78, pinch.y);
  const fullSpin = 390;
  const wheelSeams = new Map();
  let previousAngle = 14;
  let studio;

  function atWord(scene, id, word) {
    const line = scene.lines.find(entry => entry.id === id);
    const index = line.reading.words.findIndex(text => text.replace(/\p{P}/gu, '') === word);
    if (index < 0) throw Error('Missing "' + word + '" in ' + id);
    return line.start + (line.reading.timings[index]?.[0] ?? line.duration / 2);
  }

  function cuesFor(scene) {
    const at = (id, word) => atWord(scene, id, word);
    switch (scene.id) {
      case 'in-the-wall-shadow': return { arrive: at('mehar-arrives', 'ਆਈ') };
      case 'shake-the-stick': return { shake: at('a-little-shake', 'ਹਿਲਾਈ'), stop: at('a-little-shake', 'ਰੁਕ'),
        point: at('harpreet-notices', 'ਫਾਟਕ'), ribbon: at('harpreet-notices', 'ਫੀਤਾ') };
      case 'follow-the-ribbon': return { walk: at('walk-past-the-wall', 'ਤੁਰ'), flowers: at('walk-past-the-wall', 'ਫੁੱਲ'),
        raise: at('walk-past-the-wall', 'ਉੱਚੀ') };
      case 'wind-turns-the-wheel': return { gust: at('colors-spin', 'ਬੁੱਲਾ'), turn: at('colors-spin', 'ਘੁੰਮੀ'),
        fast: at('colors-spin', 'ਤੇਜ਼') };
      case 'one-step-to-test': return { back: at('test-the-shelter', 'ਪਿੱਛੇ'), forward: at('test-the-shelter', 'ਅੱਗੇ') };
      default: return {};
    }
  }

  // Integral of the easing curve. The rotor keeps its angle and only changes speed.
  function rampTravel(ms, start, end) {
    const t = phase(ms, start, end);
    return ((end - start) * (t ** 3 - .5 * t ** 4) + Math.max(0, ms - end)) / 1000;
  }

  function rotorMotion(scene, cues, ms) {
    const ramp = (a, b) => smooth(phase(ms, a, b));
    const travel = (a, b) => rampTravel(ms, a, b);
    const c = cues;
    switch (scene.id) {
      case 'shake-the-stick': {
        const bump = [c.shake - 30, c.shake + 270];
        const slow = [c.stop - 1150, c.stop + 110];
        return { angle: 90 * (travel(...bump) - travel(...slow)), speed: 90 * (ramp(...bump) - ramp(...slow)) };
      }
      case 'wind-turns-the-wheel': {
        const start = c.gust - 150;
        const slow = c.turn + 80;
        const fast = c.fast - 220;
        const full = c.fast + 720;
        return { angle: 105 * travel(start, slow) + (fullSpin - 105) * travel(fast, full),
          speed: 105 * ramp(start, slow) + (fullSpin - 105) * ramp(fast, full) };
      }
      case 'one-step-to-test': {
        const back = [c.back - 360, c.back + 850];
        const next = [c.forward - 260, c.forward + 790];
        return { angle: fullSpin * ms / 1000 - 372 * travel(...back) + 372 * travel(...next),
          speed: fullSpin - 372 * ramp(...back) + 372 * ramp(...next) };
      }
      case 'wind-found': return { angle: fullSpin * ms / 1000, speed: fullSpin };
      default: return { angle: 0, speed: 0 };
    }
  }

  function eventsFor(scene) {
    const c = cuesFor(scene);
    const cue = (ms, sound) => ({ ms: Math.max(0, ms), sound });
    wheelSeams.set(scene.id, previousAngle);
    previousAngle = (previousAngle + rotorMotion(scene, c, scene.duration).angle) % 360;
    switch (scene.id) {
      case 'in-the-wall-shadow': return [cue(c.arrive - 1270, 'step'), cue(c.arrive - 780, 'step'), cue(c.arrive - 310, 'step')];
      case 'shake-the-stick': return [cue(c.shake + 60, 'ribbon'), cue(c.ribbon, 'gust')];
      case 'follow-the-ribbon': return [cue(c.walk - 430, 'step'), cue(c.walk + 110, 'step'), cue(c.flowers - 340, 'gust')];
      case 'wind-turns-the-wheel': return [cue(c.gust - 130, 'gust'), cue(c.fast + 50, 'gust')];
      case 'one-step-to-test': return [cue(c.back + 330, 'step'), cue(c.forward + 290, 'step'), cue(c.forward + 570, 'gust')];
      default: return [];
    }
  }

  function walk(actor, from, to, ms, start, end) {
    const t = smooth(phase(ms, start, end));
    actor.x = mix(from.x, to.x, t);
    actor.y = mix(from.y, to.y, t);
    if (t > 0 && t < 1) actor.walk = (ms - start) / 1000 * Math.sign(to.x - from.x);
  }

  function frameFor(scene, c, ms, still) {
    const move = (from, to) => smooth(phase(ms, from, to));
    const pulse = (a, b, d, e) => move(a, b) * (1 - move(d, e));
    const child = { ...shade, lean: 0, bend: 0, quietHands: true, grips: [] };
    const guide = { ...guideShade, lean: 0, bend: 0, gazeX: -95, gazeY: 48, quietHands: true, grips: [] };
    const frame = { child, guide, tilt: 9, breeze: .68 };
    let raised = 0;
    let sway = 0;
    switch (scene.id) {
      case 'in-the-wall-shadow':
        walk(child, point(178, 618), shade, ms, c.arrive - 2240, c.arrive + 210);
        raised = .15 * move(c.arrive, c.arrive + 930);
        child.gazeY = 12;
        break;
      case 'shake-the-stick': {
        const shake = pulse(c.shake - 220, c.shake + 60, c.shake + 470, c.shake + 760);
        sway = still ? 0 : Math.sin((ms - c.shake) / 83) * shake;
        frame.tilt += sway * 13;
        child.bend = 8 * shake;
        const gesture = pulse(c.point - 470, c.point + 170, c.ribbon + 610, c.ribbon + 1340);
        guide.gazeX = mix(-95, 12, gesture);
        guide.gazeY = mix(48, -31, gesture);
        guide.grips[1] = { target: point(653, 444), weight: gesture, hand: 'point', anchor: point(-47 * .78, 146) };
        break;
      }
      case 'follow-the-ribbon':
        walk(guide, guideShade, guideField, ms, c.walk - 980, c.flowers + 650);
        walk(child, shade, field, ms, c.walk - 450, c.raise - 190);
        raised = move(c.raise - 540, c.raise + 430);
        guide.gazeX = 5;
        guide.gazeY = 0;
        break;
      case 'wind-turns-the-wheel':
        Object.assign(child, field);
        Object.assign(guide, guideField);
        raised = 1;
        frame.breeze = .68 + .32 * move(c.fast, c.fast + 460);
        break;
      case 'one-step-to-test':
        if (ms < c.forward - 320) walk(child, field, shelter, ms, c.back - 425, c.back + 620);
        else walk(child, shelter, field, ms, c.forward - 320, c.forward + 690);
        Object.assign(guide, guideField);
        raised = 1;
        frame.breeze = 1;
        break;
      case 'wind-found':
        Object.assign(child, field);
        Object.assign(guide, guideField);
        raised = 1 - .25 * move(scene.duration - 1900, scene.duration - 400);
        frame.breeze = .94;
        break;
    }
    child.gazeY ??= mix(-8, -57, raised);
    const hand = offset(child, 55 + 2.8 * sway + 5 * raised, -102 - 21 * raised - 1.9 * sway);
    child.grips[1] = { target: hand, weight: 1, hand: 'pinch', anchor,
      wrist: 6 + 9 * sway - 11 * raised };
    frame.tilt += 4 * raised;
    return frame;
  }

  class PinwheelStage {
    constructor(svg) {
      this.svg = svg;
      this.camera = new window.UmtoCamera.DeliveryCamera(svg);
      this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
      this.parts = Object.fromEntries([...svg.querySelectorAll('[id]')].map(node => [node.id, node]));
      this.flowers = [...svg.querySelectorAll('[data-sway]')];
      this.child = new Character(studio, svg, this.parts.mehar, this.parts['mehar-props'], mehar);
      this.guide = new Character(studio, svg, this.parts.harpreet, this.parts['harpreet-props'], harpreet);
    }

    select(scene) {
      this.scene = scene;
      this.cues = cuesFor(scene);
      this.shot = '';
    }

    cameraAt(ms, line, state, still) {
      const { id, framing, focus } = this.scene;
      const shotAt = (preset, x, y, width, tracking = false) => ({
        preset, focus: point(x, y), width, motion: tracking && !still ? 'tracking' : 'static',
        parallax: tracking && !still
      });
      let shot = { preset: framing, focus };
      if (id === 'in-the-wall-shadow' && line.speaker === 'mehar') shot = shotAt('two-shot', 502, 475, 733);
      if (id === 'shake-the-stick') {
        shot = line.speaker === 'harpreet' && ms >= this.cues.point - 360
          ? shotAt('wide', 642, 471, 913) : shotAt('medium', 489, 478, 656);
      }
      if (id === 'follow-the-ribbon') {
        shot = shotAt('follow', still ? 682 : Math.round(mix(514, 821, phase(state.child.x, shade.x, field.x))), 423, 958, true);
      }
      if (id === 'wind-turns-the-wheel') {
        shot = line.speaker === 'mehar' ? shotAt('two-shot', 861, 481, 746) : shotAt('detail', 824, 465, 517);
      }
      if (id === 'one-step-to-test') shot = shotAt('wide', 787, 438, 938);
      const key = [shot.preset, shot.focus.x, shot.focus.y, shot.width, shot.motion].join('/');
      if (this.shot !== key) {
        this.camera.cue({ ...shot, cut: true });
        this.shot = key;
      }
    }

    draw(ms, line, word) {
      const still = this.reduced.matches;
      const state = frameFor(this.scene, this.cues, ms, still);
      const spin = rotorMotion(this.scene, this.cues, ms);
      const p = this.parts;
      this.cameraAt(ms, line, state, still);
      const mouth = voiceFrame(line, word, ms);
      this.child.paint(state.child, ms, line.speaker === 'mehar' ? mouth : null, still);
      this.guide.paint(state.guide, ms, line.speaker === 'harpreet' ? mouth : null, still);
      transform(p['mehar-shadow'], translate(state.child));
      transform(p['harpreet-shadow'], translate(state.guide));

      const grip = p.mehar.querySelector('[data-hand="mehar-right"]');
      const hand = new DOMPoint(pinch.x, pinch.y).matrixTransform(grip.getScreenCTM())
        .matrixTransform(this.svg.getScreenCTM().inverse());
      transform(p.pinwheel, translate(hand) + ' rotate(' + state.tilt + ')');
      const bearing = wheelSeams.get(this.scene.id);
      transform(p['wheel-rotor'], 'rotate(' + ((bearing + (still ? 0 : spin.angle)) % 360) + ')');
      p.pinwheel.dataset.speed = String(Math.round(spin.speed));
      opacity(p['wheel-blur'], still ? 0 : phase(spin.speed, 230, fullSpin) * .24);

      const t = (this.scene.episodeStart + ms) / 1000;
      const ripple = still ? 0 : state.breeze * 9.5 * Math.sin(t * 8.2);
      const tip = 378 + ripple;
      p['gate-ribbon'].setAttribute('d', 'M846 359Q871 ' + (351 + ripple * .46) + ' 904 ' + tip +
        'l-9 2 9 6Q879 ' + (385 + ripple * .46) + ' 846 367Z');
      for (const [i, stem] of this.flowers.entries()) {
        const angle = still ? 0 : state.breeze * (3.8 + 5.2 * Math.sin(t * 3.1 + i * .58));
        transform(stem, 'rotate(' + angle + ')');
      }
    }
  }

  async function prepare() {
    previousAngle = 14;
    wheelSeams.clear();
    studio = await open(document.getElementById('pinwheel-studio'));
  }

  window.LittlePanthStage = { Stage: PinwheelStage, eventsFor, prepare };
})();
