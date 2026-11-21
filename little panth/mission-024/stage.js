(() => {
  'use strict';

  const point = (x, y) => ({ x, y });
  const mix = (a, b, t) => a + (b - a) * t;
  const between = (a, b, t) => point(mix(a.x, b.x, t), mix(a.y, b.y, t));
  const phase = (ms, start, end) => Math.max(0, Math.min(1, (ms - start) / Math.max(1, end - start)));
  const ease = t => t * t * (3 - 2 * t);
  const travel = (ms, start, end) => ease(phase(ms, start, end));
  const press = (ms, hit, rise, hold, release) =>
    travel(ms, hit - rise, hit) * (1 - travel(ms, hit + hold, hit + release));
  const place = ({ x, y }) => 'translate(' + x + ' ' + y + ')';
  const transform = (node, value) => node.setAttribute('transform', value);
  const opacity = (node, value) => node.setAttribute('opacity', String(Number(value)));
  const twigPivot = point(893, 303);
  const pawContact = point(760, 554);
  const alert = point(465, 628);
  const retreat = point(398, 628);
  const watchingDrum = point(595, 627);
  const besideDrum = point(631, 627);
  const legs = [
    { id: 'hind-far', hip: point(-62, -72), foot: point(-67, -5), shift: .5, knee: -13 },
    { id: 'front-far', hip: point(45, -77), foot: point(43, -5), shift: 0, knee: 5 },
    { id: 'hind-near', hip: point(-48, -73), foot: point(-49, -5), shift: 0, knee: -12 },
    { id: 'front-near', hip: point(61, -77), foot: point(65, -5), shift: .5, knee: -7 }
  ];

  function wordTimes(scene, id, word) {
    const line = scene.lines.find(item => item.id === id);
    const hits = line.reading.words.flatMap((value, i) =>
      value.replace(/\p{P}/gu, '') === word ? [line.start + (line.reading.timings[i]?.[0] ?? line.duration / 2)] : []);
    if (!hits.length) throw Error('Missing "' + word + '" in ' + id);
    return hits;
  }

  function cuesFor(scene) {
    const at = (id, word) => wordTimes(scene, id, word)[0];
    switch (scene.id) {
      case 'sound-on-the-path': return { drums: wordTimes(scene, 'unexpected-sound', 'ਢਮ') };
      case 'stop-and-listen': return { back: at('listens-to-the-wind', 'ਕਦਮ'), ears: at('listens-to-the-wind', 'ਕੰਨ'),
        wind: at('listens-to-the-wind', 'ਹਵਾ') };
      case 'behind-the-bush': return { walk: at('finds-a-drum', 'ਅੱਗੇ'), reveal: at('finds-a-drum', 'ਢੋਲ') };
      case 'twig-taps-skin': return { wind: at('wind-makes-a-beat', 'ਹਵਾ'), sway: at('wind-makes-a-beat', 'ਹਿੱਲੀ'),
        hit: at('wind-makes-a-beat', 'ਵੱਜਿਆ') };
      case 'may-i-try': return { idea: at('jackal-wants-a-turn', 'ਜ਼ਰਾ') };
      case 'two-little-taps': return { hits: wordTimes(scene, 'jackal-taps-the-drum', 'ਥਾਪ'),
        lift: at('jackal-taps-the-drum', 'ਚੁੱਕਿਆ'), grin: at('jackal-taps-the-drum', 'ਹੱਸ') };
      case 'homeward-path': return { hits: [at('walks-on', 'ਹਿਲਾਇਆ'), at('walks-on', 'ਥਾਪ')], walk: at('walks-on', 'ਰਾਹ') };
    }
  }

  function eventsFor(scene) {
    const c = cuesFor(scene);
    const drum = ms => ({ ms, sound: 'drum' });
    const wind = ms => ({ ms, sound: 'gust' });
    const step = ms => ({ ms, sound: 'step' });
    switch (scene.id) {
      case 'sound-on-the-path': return [step(710), step(1260), ...c.drums.map(drum)];
      case 'stop-and-listen': return [step(c.back + 130), step(c.back + 550), wind(c.wind), drum(c.wind + 750)];
      case 'behind-the-bush': return [step(c.walk + 200), step(c.walk + 750), step(c.walk + 1230)];
      case 'twig-taps-skin': return [wind(c.wind), wind(c.hit - 890), drum(c.hit)];
      case 'two-little-taps': return c.hits.map(drum);
      case 'homeward-path': return [...c.hits.flatMap(hit => [wind(Math.max(0, hit - 540)), drum(hit)]),
        step(c.walk + 220), step(c.walk + 740)];
      default: return [];
    }
  }

  function walk(state, from, to, ms, start, end, still) {
    const t = travel(ms, start, end);
    state.position = between(from, to, t);
    state.walking = !still && t > 0 && t < 1;
    state.distance = (to.x - from.x) * t;
    state.strength = state.walking ? travel(ms, start, start + 250) * (1 - travel(ms, end - 270, end)) : 0;
  }

  function makeFrame(scene, c, ms, still) {
    const state = {
      position: besideDrum, walking: false, distance: 0, strength: 0, surprise: 0,
      ears: 0, angle: 0, wind: 0, branch: 0, paw: null, grin: 0,
      revealed: true, impact: null
    };
    const gust = (start, length) => Math.sin(Math.PI * phase(ms, start, start + length));
    const branchBeat = hit => {
      state.branch = Math.max(state.branch, press(ms, hit, still ? 160 : 610, 58, still ? 150 : 520));
      state.impact = { time: hit, source: 'twig' };
    };

    switch (scene.id) {
      case 'sound-on-the-path': {
        state.revealed = false;
        const first = c.drums[0];
        walk(state, point(207, 633), alert, ms, 180, first - 80, still);
        state.surprise = Math.max(...c.drums.map(hit => press(ms, hit, 25, 60, 400)));
        state.angle = -13 * state.surprise;
        state.ears = .62 * state.surprise;
        break;
      }
      case 'stop-and-listen': {
        state.revealed = false;
        walk(state, alert, retreat, ms, c.back - 220, c.back + 840, still);
        state.ears = travel(ms, c.ears - 80, c.ears + 370);
        state.ears *= 1 - .3 * travel(ms, c.wind + 1050, scene.duration);
        state.angle = -7 * state.ears;
        state.wind = gust(c.wind, 1700);
        break;
      }
      case 'behind-the-bush': {
        state.revealed = ms >= c.reveal - 180;
        walk(state, retreat, watchingDrum, ms, c.walk - 400, c.reveal + 260, still);
        state.angle = 7 * travel(ms, c.walk, c.reveal) * (1 - travel(ms, c.reveal + 300, c.reveal + 1100));
        state.ears = .52;
        break;
      }
      case 'twig-taps-skin':
        state.position = watchingDrum;
        state.wind = Math.max(.52 * gust(c.wind, c.hit - c.wind + 550), gust(c.hit - 910, 1700));
        state.branch = .18 * press(ms, c.sway, 620, 110, 790);
        branchBeat(c.hit);
        state.ears = .61 + .37 * state.branch;
        state.angle = -5 * state.branch;
        state.grin = travel(ms, c.hit + 580, c.hit + 1380);
        break;
      case 'may-i-try':
        walk(state, watchingDrum, besideDrum, ms, c.idea + 540, scene.duration - 65, still);
        state.angle = 4 * travel(ms, c.idea - 180, c.idea + 740);
        state.grin = .74;
        break;
      case 'two-little-taps': {
        const near = legs.at(-1);
        const homePaw = point(state.position.x + near.foot.x, state.position.y + near.foot.y);
        const hit = c.hits.reduce((a, b) => Math.abs(ms - a) <= Math.abs(ms - b) ? a : b);
        const liftStart = hit === c.hits[0] ? c.lift - 120 : hit - 720;
        const lift = travel(ms, liftStart, liftStart + 470);
        const approach = travel(ms, hit - 305, hit);
        const release = travel(ms, hit + 65, hit + 540);
        const hover = point(homePaw.x + 31, homePaw.y - 65);
        if (lift > 0 && release < 1) {
          const lifted = between(homePaw, hover, lift);
          const path = between(between(lifted, pawContact, approach), homePaw, release);
          state.paw = point(path.x - state.position.x, path.y - state.position.y);
        }
        state.impact = { time: hit, source: 'paw' };
        state.angle = 4 - 5 * approach * (1 - release);
        state.grin = travel(ms, c.grin - 100, c.grin + 460);
        break;
      }
      case 'homeward-path': {
        const hit = c.hits.reduce((a, b) => Math.abs(ms - a) <= Math.abs(ms - b) ? a : b);
        state.wind = gust(hit - 420, 1450);
        branchBeat(hit);
        walk(state, besideDrum, point(1440, 646), ms, c.walk - 140, scene.duration - 260, still);
        state.grin = .8;
        break;
      }
    }
    if (still) state.wind = 0;
    return state;
  }

  class DrumStage {
    constructor(svg) {
      this.svg = svg;
      this.camera = new window.UmtoCamera.DeliveryCamera(svg);
      this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
      this.parts = Object.fromEntries([...svg.querySelectorAll('[id]')].map(node => [node.id, node]));
      this.legs = legs.map(spec => {
        const group = this.parts[spec.id];
        return { ...spec, paths: [...group.querySelectorAll('path')], paw: group.querySelector('ellipse') };
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
      const shotAt = (preset, x, y, width, move = false) => ({
        preset, focus: point(x, y), width, motion: move && !still ? 'tracking' : 'static',
        parallax: move && !still
      });
      let shot = { preset: framing, focus };
      if (id === 'sound-on-the-path' && ms >= 960 && ms < c.drums[0] - 125) {
        shot = shotAt('full', state.position.x + 152, 427, 990, state.walking);
      } else if (id === 'sound-on-the-path' && ms >= c.drums[0] - 125) {
        shot = shotAt('medium', 576, 461, 827);
      } else if (id === 'stop-and-listen') {
        shot = shotAt('medium-close', state.position.x + 31, 459, 637);
      } else if (id === 'behind-the-bush') {
        shot = state.revealed ? shotAt('two-shot', 764, 449, 940)
          : shotAt('full', state.position.x + 196, 413, 1000, state.walking);
      } else if (id === 'twig-taps-skin') {
        shot = shotAt('detail', 803, 460, 619);
      } else if (id === 'may-i-try') {
        shot = shotAt('two-shot', 729, 441, 747);
      } else if (id === 'two-little-taps') {
        shot = line.speaker === 'jackal' ? shotAt('medium-close', 721, 467, 645) : shotAt('detail', 756, 490, 629);
      } else if (id === 'homeward-path' && state.walking && state.position.x < 1060) {
        shot = shotAt('full', state.position.x - 55, 424, 1050, true);
      }
      const key = [shot.preset, shot.focus.x, shot.focus.y, shot.width, shot.motion].join('/');
      if (key !== this.shot) {
        this.camera.cue({ ...shot, cut: true });
        this.shot = key;
      }
    }

    paintJackal(state, ms, opening, still) {
      const p = this.parts;
      const { x, y } = state.position;
      transform(p.jackal, place(state.position));
      p['jackal-shadow'].setAttribute('cx', String(x - 9));
      p['jackal-shadow'].setAttribute('cy', String(y + 3));
      transform(p['jackal-head'], 'translate(58 -105) rotate(' + state.angle + ')');
      transform(p['jackal-ear-near'], 'rotate(' + (-11 * state.ears + 10 * state.surprise) + ' -4 -16)');
      transform(p['jackal-ear-far'], 'rotate(' + (-8 * state.ears + 7 * state.surprise) + ' 14 -16)');
      transform(p['jackal-tail'], 'rotate(' + ((still ? 0 : Math.sin(ms / 352) * 4.7) - 9 * state.grin) + ' -75 -84)');
      transform(p['jackal-jaw'], 'rotate(' + (opening * 18 + state.grin * 2) + ' 19 7)');
      const blink = !still && (ms + 920) % 3950 > 3800 && !state.surprise;
      opacity(p['jackal-eye'], !blink);
      opacity(p['eye-shine'], !blink);
      opacity(p['jackal-lid'], blink);
      transform(p['jackal-brow'], 'rotate(' + (state.surprise * 15 - state.grin * 8) + ' 22 -14)');
      p.jackal.dataset.speaking = String(opening > 0);
      for (const limb of this.legs) {
        const step = state.distance / 63 + limb.shift;
        const swing = Math.sin(step * 2 * Math.PI) * state.strength;
        const rise = Math.max(0, Math.cos(step * 2 * Math.PI)) * state.strength;
        const resting = point(limb.foot.x - 19 * swing, limb.foot.y - 12 * rise);
        const foot = limb.id === 'front-near' && state.paw ? state.paw : resting;
        const joint = point(mix(limb.hip.x, foot.x, .43) + limb.knee, mix(limb.hip.y, foot.y, .53));
        const curve = 'M' + limb.hip.x + ' ' + limb.hip.y + ' Q' + joint.x + ' ' + joint.y + ' ' + foot.x + ' ' + foot.y;
        limb.paths.forEach(node => node.setAttribute('d', curve));
        transform(limb.paw, place(foot));
      }
    }

    draw(ms, line, word) {
      const still = this.reduced.matches;
      const state = makeFrame(this.scene, this.cue, ms, still);
      const p = this.parts;
      this.frameCamera(ms, line, state, still);
      const talking = line.speaker === 'jackal' && word >= 0;
      const syllable = talking ? phase(ms - line.start, ...line.reading.timings[word]) : 0;
      const opening = talking && syllable > .025 && syllable < .96 ? .26 + .72 * Math.sin(Math.PI * syllable) : 0;
      this.paintJackal(state, ms, opening, still);
      opacity(p['drum-set'], state.revealed);
      opacity(p['tapping-twig'], state.revealed);
      opacity(p.concealment, !state.revealed);
      const lean = -15 * state.branch - 3.1 * state.wind * (1 - state.branch);
      transform(p['tapping-twig'], 'rotate(' + lean + ' ' + twigPivot.x + ' ' + twigPivot.y + ')');
      transform(p['wind-leaves'], 'rotate(' + (7 * state.wind) + ' 965 247) translate(' + (6 * state.wind) + ' 0)');
      const elapsed = state.impact ? ms - state.impact.time : -1;
      const ringing = elapsed >= 0 && elapsed < 335;
      const resonance = ringing ? 1 - phase(elapsed, 0, 335) : 0;
      opacity(p['drum-vibration'], resonance * .72);
      p['drum-vibration'].setAttribute('rx', String(mix(30, 7, resonance)));
      p['drum-vibration'].setAttribute('ry', String(mix(43, 9, resonance)));
      this.svg.dataset.strike = elapsed >= 0 && elapsed <= 58 ? state.impact.source : 'none';
      this.svg.dataset.drum = state.revealed ? 'revealed' : 'hidden';
    }
  }

  window.LittlePanthStage = { Stage: DrumStage, eventsFor };
})();
