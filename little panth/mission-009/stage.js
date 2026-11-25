(() => {
  'use strict';

  const ground = 604;
  const firstJump = 880;
  const runningJump = 920;
  const clamp = value => Math.max(0, Math.min(1, value));
  const phase = (ms, start, end) => clamp((ms - start) / Math.max(1, end - start));
  const smooth = value => value * value * (3 - 2 * value);
  const mix = (start, end, value) => start + (end - start) * value;
  const opacity = (node, value) => node.setAttribute('opacity', String(value));
  const transform = (node, value) => node.setAttribute('transform', value);

  function wordAt(scene, lineId, word) {
    const line = scene.lines.find(entry => entry.id === lineId);
    const index = line.reading.words.findIndex(text => text.replace(/\p{P}/gu, '') === word);
    return line.start + (line.reading.timings[index]?.[0] ?? line.duration * .5);
  }

  function cuesFor(scene) {
    switch (scene.id) {
      case 'arrival':
        return { walk: 340, stop: wordAt(scene, 'garden-path', 'ਵੇਲ') + 550 };
      case 'notice': {
        const glance = wordAt(scene, 'look-up', 'ਉੱਪਰ');
        return { glance, insert: glance + 220, back: Math.min(glance + 1650, scene.lines[0].end - 240) };
      }
      case 'first-jump':
        return { launch: wordAt(scene, 'jumps-short', 'ਛਾਲ') - 60 };
      case 'run-up': {
        const back = wordAt(scene, 'runs-and-jumps', 'ਪਿੱਛੇ') - 75;
        const run = wordAt(scene, 'runs-and-jumps', 'ਦੌੜ') - 80;
        const launch = Math.max(run + 370, wordAt(scene, 'runs-and-jumps', 'ਛਾਲ') - 70);
        return { back, run, launch, contact: launch + runningJump / 2 };
      }
      case 'sour':
        return { frown: wordAt(scene, 'makes-a-face', 'ਮੂੰਹ') };
      case 'exit': {
        const walk = wordAt(scene, 'walks-away', 'ਅੱਗੇ') - 310;
        return { walk, stop: Math.min(scene.duration - 680, walk + 2450) };
      }
      default:
        return {};
    }
  }

  function steps(events, from, to, gap) {
    for (let beat = from; beat < to; beat += gap) events.push({ ms: beat, sound: 'step' });
  }

  function eventsFor(scene) {
    const cues = cuesFor(scene);
    const events = [];
    switch (scene.id) {
      case 'arrival':
        events.push({ ms: 160, sound: 'chirp' });
        steps(events, cues.walk + 200, cues.stop, 395);
        break;
      case 'first-jump':
        events.push({ ms: cues.launch, sound: 'spring' }, { ms: cues.launch + firstJump, sound: 'step' });
        break;
      case 'run-up':
        steps(events, cues.run + 145, cues.launch - 45, 170);
        events.push({ ms: cues.launch, sound: 'spring' }, { ms: cues.contact, sound: 'ribbon' },
          { ms: cues.launch + runningJump, sound: 'step' });
        break;
      case 'exit':
        steps(events, cues.walk + 180, cues.stop, 390);
        break;
    }
    return events;
  }

  function leap(pose, ms, start, duration, height, distance, still) {
    const flight = phase(ms, start, start + duration);
    const arc = 4 * flight * (1 - flight);
    pose.x += distance * (still ? Math.round(flight * 2) / 2 : flight);
    pose.jump = height * (still ? (arc > .48 ? 1 : 0) : arc);
    pose.reach = smooth(clamp(Math.min(flight * 3, (1 - flight) * 3)));
    pose.squash = Math.max(
      0, 1 - Math.abs(ms - (start - 120)) / 120, 1 - Math.abs(ms - (start + duration + 70)) / 85
    );
  }

  function foxPose(scene, cues, ms, still) {
    const pose = { x: 650, jump: 0, reach: 0, squash: 0, stride: 0, look: 0, frown: 0 };
    const position = value => still ? Math.round(value) : smooth(value);
    switch (scene.id) {
      case 'arrival': {
        const walk = phase(ms, cues.walk, cues.stop);
        pose.x = mix(207, 650, position(walk));
        pose.stride = Math.sin(Math.PI * walk) * Math.sin((ms - cues.walk) / 111) * 23;
        break;
      }
      case 'notice':
        pose.look = smooth(phase(ms, cues.glance - 160, cues.glance + 340));
        break;
      case 'first-jump':
        leap(pose, ms, cues.launch, firstJump, 118, 52, still);
        pose.look = 1;
        break;
      case 'run-up': {
        const back = phase(ms, cues.back, Math.min(cues.back + 1330, cues.run - 120));
        const run = phase(ms, cues.run, cues.launch);
        pose.x = mix(702, 375, position(back)) + 275 * position(run);
        pose.stride = -Math.sin(Math.PI * back) * Math.sin((ms - cues.back) / 115) * 23 +
          Math.sin(Math.PI * run) * Math.sin((ms - cues.run) / 58) * 33;
        pose.look = 1;
        leap(pose, ms, cues.launch, runningJump, 151, 104, still);
        break;
      }
      case 'sour':
        pose.x = 754;
        pose.frown = smooth(phase(ms, cues.frown, cues.frown + 375)) *
          (1 - .68 * smooth(phase(ms, scene.lines[2].start - 160, scene.lines[2].start + 250)));
        break;
      case 'truth':
        pose.x = 754;
        pose.look = smooth(phase(ms, 160, 750)) * .68;
        break;
      case 'exit': {
        const walk = phase(ms, cues.walk, cues.stop);
        pose.x = mix(754, 1136, position(walk));
        pose.stride = Math.sin(Math.PI * walk) * Math.sin((ms - cues.walk) / 104) * 22;
        pose.look = .25 * (1 - walk);
        break;
      }
    }
    if (still) {
      pose.stride = 0;
      pose.squash = 0;
    }
    return pose;
  }

  class OrchardStage {
    constructor(svg) {
      this.svg = svg;
      this.camera = new window.UmtoCamera.DeliveryCamera(svg);
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      window.LittlePanthFox.mount(svg, svg.querySelector('#fox-mount'));
      this.parts = Object.fromEntries([...svg.querySelectorAll('[id]')].map(node => [node.id, node]));
    }

    select(scene) {
      this.scene = scene;
      this.cues = cuesFor(scene);
      this.shot = '';
    }

    frame(ms, speech, pose) {
      const { id, framing, focus } = this.scene;
      let shot = { preset: framing, focus };
      if (id === 'arrival' && ms >= this.cues.walk && !this.reduced.matches) {
        const path = phase(pose.x, 207, 650);
        shot = { preset: 'full', focus: { x: mix(568, 698, path), y: 369 }, width: 1136, motion: 'tracking', parallax: true };
      } else if (id === 'notice' && ms >= this.cues.insert && ms < this.cues.back) {
        shot = { preset: 'detail', focus: { x: 872, y: 215 }, width: 550 };
      } else if (id === 'sour' && speech.speaker === 'sparrow') {
        shot = { preset: 'medium-close', focus: { x: 1023, y: 266 }, width: 490 };
      } else if (speech.speaker === 'fox' && (id === 'notice' || id === 'first-jump')) {
        shot = { preset: 'medium', focus: { x: pose.x + 32, y: 475 }, width: 660 };
      } else if (id === 'first-jump') {
        shot.width = 945;
      }
      const key = [shot.preset, shot.focus.x, shot.focus.y].join('/');
      if (key !== this.shot) {
        this.camera.cue({ ...shot, cut: true });
        this.shot = key;
      }
    }

    actors(ms, speech, word, pose) {
      const p = this.parts;
      const still = this.reduced.matches;
      const groundBounce = still ? 0 : Math.abs(pose.stride) * .21;
      const speaking = word >= 0;
      const foxTalking = speaking && speech.speaker === 'fox';
      const birdTalking = speaking && speech.speaker === 'sparrow';
      let opening = 0;
      if (foxTalking || birdTalking) {
        const [start, end] = speech.reading.timings[word];
        const offset = phase(ms - speech.start, start, end);
        const vowel = /[ਆਓਔਾੌੂੋ]/u.test(speech.reading.words[word]);
        opening = .24 + Math.sin(Math.PI * offset) * (vowel ? .75 : .53);
      }

      transform(p.fox, 'translate(' + pose.x + ' ' + (ground - pose.jump - groundBounce) + ') scale(1 ' + (1 - pose.squash * .062) + ')');
      p['fox-shadow'].setAttribute('cx', pose.x - 31);
      p['fox-shadow'].setAttribute('rx', 160 - pose.jump * .22);
      opacity(p['fox-shadow'], 1 - pose.jump * .0034);
      window.LittlePanthFox.draw(p, {
        walk: pose.stride, reach: pose.reach, reachUp: pose.reach,
        head: -pose.look * 19 + pose.frown * 15, worry: pose.frown
      }, ms, still, foxTalking, opening);

      const birdBlink = !still && (ms + 1300) % 3970 > 3840;
      opacity(p['sparrow-eye'], birdBlink ? 0 : 1);
      opacity(p['sparrow-lid'], birdBlink ? 1 : 0);
      const headTilt = this.scene.id === 'truth' ? -5 : 0;
      transform(p['sparrow-head'], 'rotate(' + (headTilt + (birdTalking && !still ? -opening * 3 : 0)) + ' -24 -43)');
      transform(p['sparrow-beak'], 'rotate(' + (birdTalking ? -opening * 29 : 0) + ' -47 -44)');
      p.sparrow.dataset.speaking = String(birdTalking);
    }

    leaf(ms) {
      const sinceTouch = ms - (this.cues.contact ?? Infinity);
      const still = this.reduced.matches;
      let wobble = still ? 0 : Math.sin(ms / 770) * 2.5;
      if (sinceTouch >= 0) {
        wobble += still ? 9 * (1 - phase(sinceTouch, 250, 980)) :
          -42 * Math.sin(sinceTouch / 76) * Math.exp(-sinceTouch / 605);
      }
      transform(this.parts['reachable-leaf'], 'translate(810 235) rotate(' + wobble + ')');
      this.svg.dataset.leafTouched = String(sinceTouch >= 0);
    }

    draw(ms, speech, word) {
      const pose = foxPose(this.scene, this.cues, ms, this.reduced.matches);
      this.frame(ms, speech, pose);
      this.actors(ms, speech, word, pose);
      this.leaf(ms);
    }
  }

  window.LittlePanthStage = { Stage: OrchardStage, eventsFor, prepare: window.LittlePanthFox.prepare };
})();
