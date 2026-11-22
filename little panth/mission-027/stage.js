(() => {
  'use strict';

  const { open, Character, voiceFrame } = window.UmtoNativeCharacterPlayer;
  const point = (x, y) => ({ x, y });
  const mix = (a, b, t) => a + (b - a) * t;
  const phase = (ms, from, to) => Math.max(0, Math.min(1, (ms - from) / Math.max(1, to - from)));
  const smooth = t => t * t * (3 - 2 * t);
  const transform = (node, value) => node.setAttribute('transform', value);
  const opacity = (node, value) => node.setAttribute('opacity', String(Number(value)));
  const mehar = { preset: 'kid-meher', view: 'right', height: 218, serial: 631, hipHinge: true };
  const harpreet = { preset: 'adult-harpreet', view: 'left', height: 296, serial: 632, hipHinge: true };
  const bowlSide = point(484, 618);
  const doorwaySide = point(461, 617);
  const friendSide = point(821, 616);
  const touch = point(557, 544);
  const moon = { x: 663, y: 549, rx: 39, ry: 19 };
  // The end of Studio's extended index finger, after its side-view hand scaling.
  const fingertip = point(-47 * .78, 146);
  let studio;

  function wordAt(scene, id, word, last = false) {
    const line = scene.lines.find(line => line.id === id);
    const words = line.reading.words.map(text => text.replace(/\p{P}/gu, ''));
    const index = last ? words.lastIndexOf(word) : words.indexOf(word);
    if (index < 0) throw Error('Missing "' + word + '" in ' + id);
    return line.start + (line.reading.timings[index]?.[0] ?? line.duration / 2);
  }

  function cuesFor(scene) {
    const at = (id, word, last) => wordAt(scene, id, word, last);
    switch (scene.id) {
      case 'night-in-the-courtyard': return { arrive: at('night-and-rainwater', 'ਆਈ') };
      case 'moon-in-the-bowl': return { bend: at('mehar-finds-the-moon', 'ਝੁਕ') };
      case 'touch-the-water': return { touch: at('one-little-touch', 'ਛੁਹਾਈ'), ripples: at('one-little-touch', 'ਲਹਿਰਾਂ') };
      case 'look-up': return { arrive: at('harpreet-points-up', 'ਆਇਆ'), point: at('harpreet-points-up', 'ਇਸ਼ਾਰਾ'),
        look: at('harpreet-points-up', 'ਚੁੱਕਿਆ'), explain: at('harpreet-explains', 'ਪਾਣੀ') };
      case 'water-grows-still': return { settle: at('they-wait-together', 'ਰੁਕ'), still: at('they-wait-together', 'ਸ਼ਾਂਤ') };
      case 'one-moon': return { down: at('one-moon-two-places', 'ਪਾਣੀ'), up: at('one-moon-two-places', 'ਅਸਮਾਨ') };
      default: return {};
    }
  }

  function eventsFor(scene) {
    const c = cuesFor(scene);
    const cue = (ms, sound) => ({ ms: Math.max(0, ms), sound });
    switch (scene.id) {
      case 'night-in-the-courtyard': return [cue(c.arrive - 1250, 'step'), cue(c.arrive - 790, 'step'), cue(c.arrive - 310, 'step')];
      case 'touch-the-water': return [cue(c.touch, 'plop'), cue(c.ripples, 'sip')];
      case 'look-up': return [cue(c.arrive - 640, 'step'), cue(c.arrive - 160, 'step')];
      default: return [];
    }
  }

  function walk(actor, from, to, fromTime, toTime, ms) {
    const t = smooth(phase(ms, fromTime, toTime));
    actor.x = mix(from.x, to.x, t);
    actor.y = mix(from.y, to.y, t);
    if (t > 0 && t < 1) actor.walk = (ms - fromTime) / 1000;
  }

  function frameFor(scene, c, ms) {
    const travel = (from, to) => smooth(phase(ms, from, to));
    const pulse = (a, b, d, e) => travel(a, b) * (1 - travel(d, e));
    const child = { ...bowlSide, bend: 0, lean: 0, grips: [] };
    const adult = { ...friendSide, bend: 0, lean: 0, grips: [], quietHands: true };
    const frame = { child, adult, hasAdult: false, waves: 0, waterTime: ms + 260, touching: false };
    switch (scene.id) {
      case 'night-in-the-courtyard':
        walk(child, point(287, 563), doorwaySide, c.arrive - 2240, c.arrive + 280, ms);
        break;
      case 'moon-in-the-bowl':
        walk(child, doorwaySide, bowlSide, Math.max(0, c.bend - 1100), c.bend - 250, ms);
        child.bend = 17 * travel(c.bend - 225, c.bend + 430);
        child.gazeY = child.bend * 4.4;
        break;
      case 'touch-the-water': {
        const reach = pulse(c.touch - 945, c.touch - 15, c.touch + 190, c.touch + 835);
        child.bend = 17 + 5 * reach;
        child.gazeY = 75 + 25 * reach;
        child.grips[1] = { target: touch, weight: reach, hand: 'point', anchor: fingertip };
        frame.touching = ms >= c.touch && ms <= c.touch + 190;
        frame.waterTime = Math.max(0, ms - c.touch);
        if (ms >= c.touch) frame.waves = mix(.27, 1, travel(c.touch, c.ripples + 290)) *
          mix(1, .39, travel(c.ripples + 700, scene.duration - 70));
        break;
      }
      case 'look-up': {
        frame.hasAdult = true;
        walk(adult, point(989, 609), friendSide, Math.max(0, c.arrive - 1260), c.arrive + 160, ms);
        const look = travel(c.look - 510, c.look + 330);
        const listen = travel(c.explain - 920, c.explain - 300);
        child.bend = mix(17, -6, look) * (1 - listen);
        child.gazeY = mix(75, -95, look) * (1 - listen);
        const pointUp = pulse(c.point - 640, c.point + 180, c.look + 595, c.look + 1225);
        const showWater = pulse(c.explain - 110, c.explain + 510, c.explain + 2100, c.explain + 2690);
        if (pointUp > 0) {
          adult.grips[1] = { target: point(901, 344), weight: pointUp, hand: 'point', anchor: fingertip };
          adult.gazeX = 100 * pointUp;
          adult.gazeY = -90 * pointUp;
        } else if (showWater > 0) {
          adult.bend = 15 * showWater;
          adult.gazeY = 65 * showWater;
          adult.grips[0] = { target: point(751, 519), weight: showWater * .91, hand: 'palmUp' };
        }
        frame.waves = .39 - .13 * travel(360, c.look + 380);
        break;
      }
      case 'water-grows-still':
        frame.hasAdult = true;
        child.bend = 14 * pulse(0, 640, c.still + 460, c.still + 1250);
        adult.bend = 10 * pulse(0, 680, c.still, c.still + 1050);
        child.gazeY = child.bend * 5;
        adult.gazeY = adult.bend * 6.5;
        frame.waves = .26 * (1 - travel(c.settle - 600, c.still + 120));
        break;
      case 'one-moon': {
        frame.hasAdult = true;
        const glanceDown = pulse(c.down - 640, c.down + 190, c.up - 635, c.up - 80);
        const glanceUp = pulse(c.up - 80, c.up + 420, c.up + 1800, c.up + 2390);
        child.bend = 13 * glanceDown - 5 * glanceUp;
        child.gazeY = 75 * glanceDown - 95 * glanceUp;
        break;
      }
    }
    return frame;
  }

  class MoonStage {
    constructor(svg) {
      this.svg = svg;
      this.camera = new window.UmtoCamera.DeliveryCamera(svg);
      this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
      this.parts = Object.fromEntries([...svg.querySelectorAll('[id]')].map(node => [node.id, node]));
      this.rings = [...this.parts['surface-rings'].children];
      this.child = new Character(studio, svg, this.parts.mehar, this.parts['mehar-props'], mehar);
      this.adult = new Character(studio, svg, this.parts.harpreet, this.parts['harpreet-props'], harpreet);
    }

    select(scene) {
      this.scene = scene;
      this.cue = cuesFor(scene);
      this.shot = '';
    }

    frameCamera(ms, line, frame, still) {
      const { id, framing, focus } = this.scene;
      const shotAt = (preset, x, y, width, track = false) => ({
        preset, focus: point(x, y), width, motion: track && !still ? 'tracking' : 'static',
        parallax: track && !still
      });
      let shot = { preset: framing, focus };
      if (id === 'night-in-the-courtyard') {
        shot = shotAt('wide', Math.round(585 + (frame.child.x - 287) * .21), 383, 1130, true);
      } else if (id === 'moon-in-the-bowl') {
        shot = shotAt('medium', 567, 487, 635);
      } else if (id === 'touch-the-water') {
        shot = line.speaker === 'mehar' ? shotAt('medium', 566, 477, 628) : shotAt('detail', 616, 510, 540);
      } else if (id === 'look-up') {
        if (line.speaker === 'harpreet') shot = shotAt('two-shot', 668, 475, 756);
        else if (ms > this.cue.look - 275) shot = shotAt('wide', 735, 364, 1180);
        else shot = shotAt('two-shot', 708, 473, 898);
      } else if (id === 'water-grows-still') {
        shot = shotAt('two-shot', 664, 471, 815);
      }
      const key = [shot.preset, shot.focus.x, shot.focus.y, shot.width, shot.motion].join('/');
      if (this.shot !== key) {
        this.camera.cue({ ...shot, cut: true });
        this.shot = key;
      }
      this.svg.dataset.shot = id === 'look-up' && shot.preset === 'wide' ? 'revealed-moon' : shot.preset;
    }

    paintWater(frame, still) {
      const p = this.parts;
      const strength = frame.waves;
      const time = still ? 760 : frame.waterTime;
      const center = p['water-contact'];
      center.setAttribute('cx', String(touch.x));
      center.setAttribute('cy', String(touch.y));
      center.dataset.touching = String(frame.touching);
      opacity(p['moon-round'], 1 - strength);
      opacity(p['moon-broken'], strength);
      if (strength > 0) {
        const rows = [];
        for (let row = 0; row < 9; row++) {
          const level = (row + .5) / 9 * 2 - 1;
          const width = Math.sqrt(1 - level ** 2) * moon.rx;
          const x = moon.x + strength * 28 * Math.sin(row * 1.04 - time / 198);
          const y = moon.y + level * moon.ry;
          const height = moon.ry / 9 * (1 - strength * .6);
          rows.push('M' + (x - width) + ' ' + (y - height) + 'Q' + x + ' ' + (y - height * 2) + ' ' +
            (x + width) + ' ' + (y - height) + 'L' + (x + width - strength * 6) + ' ' + (y + height) + 'Q' +
            x + ' ' + (y + height * .46) + ' ' + (x - width + strength * 3) + ' ' + (y + height) + 'Z');
        }
        p['moon-broken'].setAttribute('d', rows.join(''));
      }
      opacity(p['surface-rings'], strength);
      for (const [i, ring] of this.rings.entries()) {
        const cycle = Math.max(0, time - i * 250) % 2050 / 2050;
        const radius = 4 + cycle * 202;
        ring.setAttribute('cx', String(touch.x));
        ring.setAttribute('cy', String(touch.y));
        ring.setAttribute('rx', String(radius));
        ring.setAttribute('ry', String(radius * .293));
        opacity(ring, Math.sin(Math.PI * cycle) * (.91 - i * .19));
      }
    }

    draw(ms, line, word) {
      const still = this.reduced.matches;
      const frame = frameFor(this.scene, this.cue, ms);
      this.frameCamera(ms, line, frame, still);
      const mouth = voiceFrame(line, word, ms);
      this.child.paint(frame.child, ms, line.speaker === 'mehar' ? mouth : null, still);
      transform(this.parts['mehar-shadow'], 'translate(' + frame.child.x + ' ' + frame.child.y + ')');
      opacity(this.parts.harpreet, frame.hasAdult);
      opacity(this.parts['harpreet-shadow'], frame.hasAdult);
      if (frame.hasAdult) {
        this.adult.paint(frame.adult, ms, line.speaker === 'harpreet' ? mouth : null, still);
        transform(this.parts['harpreet-shadow'], 'translate(' + frame.adult.x + ' ' + frame.adult.y + ')');
      }
      this.paintWater(frame, still);
    }
  }

  async function prepare() {
    studio = await open(document.getElementById('moon-reflection-studio'));
  }

  window.LittlePanthStage = { Stage: MoonStage, eventsFor, prepare };
})();
