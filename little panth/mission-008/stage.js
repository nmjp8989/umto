(() => {
  'use strict';

  const clamp = n => Math.min(1, Math.max(0, n));
  const between = (ms, start, stop) => clamp((ms - start) / Math.max(16, stop - start));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const line = (scene, id) => scene.lines.find(entry => entry.id === id);
  const opacity = (node, value) => node.setAttribute('opacity', String(value));

  function wordAt(scene, id, word) {
    const entry = line(scene, id);
    const index = entry.reading.words.findIndex(value => value.replace(/[\p{P}\p{S}]/gu, '') === word);
    return entry.start + (entry.reading.timings[index]?.[0] ?? entry.duration * 0.5);
  }

  function cuesFor(scene) {
    switch (scene.id) {
      case 'gust':
        return { blows: wordAt(scene, 'gust-leaves', 'ਜ਼ੋਰ'), grip: wordAt(scene, 'gust-leaves', 'ਘੁੱਟ') - 90 };
      case 'wrap':
        return {
          blows: wordAt(scene, 'wrap-shawl', 'ਤੇਜ਼'),
          grip: wordAt(scene, 'wrap-shawl', 'ਲਪੇਟ') - 290,
          rests: line(scene, 'wrap-wind').start
        };
      case 'sunlight':
        return { clear: wordAt(scene, 'sunlight-clouds', 'ਪਾਸੇ'), warms: wordAt(scene, 'sunlight-clouds', 'ਨਿੱਘੀ') };
      case 'fold':
        return {
          remove: wordAt(scene, 'fold-shawl', 'ਲਾਹੀ'),
          fold: wordAt(scene, 'fold-shawl', 'ਤਹਿ'),
          carry: wordAt(scene, 'fold-shawl', 'ਬਾਂਹ')
        };
      case 'lesson':
        return { walk: wordAt(scene, 'lesson-home', 'ਤੁਰ') - 860 };
      default:
        return {};
    }
  }

  function eventsFor(scene) {
    const cues = cuesFor(scene);
    if (scene.id === 'gust' || scene.id === 'wrap') {
      return [{ ms: cues.blows, sound: 'gust' }, { ms: cues.grip + 140, sound: 'ribbon' }];
    }
    if (scene.id === 'fold') return [{ ms: cues.remove, sound: 'ribbon' }];
    if (scene.id === 'lesson') {
      const cuesOnPath = [];
      for (let ms = cues.walk + 380; ms < scene.duration - 550; ms += 630) cuesOnPath.push({ ms, sound: 'step' });
      return cuesOnPath;
    }
    return [];
  }

  function sceneState(scene, cues, ms, still) {
    let light = .23, wind = .04, clutched = 0, takeOff = 0, folding = 0, carry = 0;
    let x = 626, stride = 0, lookingUp = 0, cloudShift = 0;
    switch (scene.id) {
      case 'road': {
        const walk = between(ms, 180, scene.duration - 380);
        x = mix(398, 626, still ? Math.round(walk) : smooth(walk));
        stride = walk > 0 && walk < 1 ? (ms - 180) / 1290 : 0;
        break;
      }
      case 'challenge':
        lookingUp = 1;
        break;
      case 'gust': {
        const rising = smooth(between(ms, cues.blows - 110, cues.blows + 800));
        wind = .06 + rising * (.73 + (still ? .1 : Math.sin(ms / 330) * .13));
        light = mix(.23, .12, rising);
        clutched = .77 * smooth(between(ms, cues.grip - 180, cues.grip + 480));
        break;
      }
      case 'wrap': {
        const gust = smooth(between(ms, cues.blows - 180, cues.blows + 660));
        const rest = smooth(between(ms, cues.rests - 720, cues.rests + 220));
        wind = mix(.77, 1, gust) * (1 - rest);
        light = .12;
        clutched = mix(.77, 1, smooth(between(ms, cues.grip, cues.grip + 520)));
        break;
      }
      case 'sunlight': {
        const clearing = smooth(between(ms, cues.clear - 200, cues.clear + 1720));
        const warming = smooth(between(ms, cues.warms - 450, cues.warms + 1100));
        light = mix(.12, 1, warming);
        wind = 0;
        cloudShift = clearing;
        clutched = mix(1, .23, warming);
        lookingUp = 1 - .6 * warming;
        break;
      }
      case 'fold':
        light = 1;
        cloudShift = 1;
        clutched = .23;
        takeOff = smooth(between(ms, cues.remove - 90, cues.remove + 520));
        folding = smooth(between(ms, cues.fold - 120, cues.fold + 540));
        carry = smooth(between(ms, cues.carry - 200, cues.carry + 480));
        break;
      case 'lesson': {
        light = 1;
        cloudShift = 1;
        takeOff = folding = carry = 1;
        const walk = between(ms, cues.walk, scene.duration - 470);
        x = mix(626, 1380, still ? Math.round(walk) : smooth(walk));
        stride = walk > 0 && walk < 1 ? (ms - cues.walk) / 1260 : 0;
        break;
      }
    }
    return { light, wind, clutched, takeOff, folding, carry, x, stride, lookingUp, cloudShift };
  }

  class WindStage {
    constructor(svg) {
      this.svg = svg;
      this.camera = new window.UmtoCamera.DeliveryCamera(svg);
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.parts = Object.fromEntries([...svg.querySelectorAll('[id]')].map(node => [node.id, node]));
      this.leaves = [...this.parts['blowing-leaves'].children];
    }

    select(scene) {
      this.scene = scene;
      this.cues = cuesFor(scene);
      this.shot = '';
    }

    frame(ms, speech, pose) {
      const id = this.scene.id;
      const afterWarmCue = id === 'sunlight' && ms >= this.cues.clear - 60;
      const face = speech.speaker === 'wind' || speech.speaker === 'sun';
      const focusOnFace = face && ['challenge', 'wrap', 'lesson'].includes(id) || speech.speaker === 'sun' && id === 'sunlight' && !afterWarmCue;
      if (!this.reduced.matches && id === 'road') {
        this.camera.cue({ preset: 'full', width: 1175, focus: { x: mix(581, 679, between(pose.x, 398, 626)), y: 380 },
          motion: 'tracking', parallax: true, cut: true });
        this.shot = 'tracking';
        return;
      }
      const shot = focusOnFace ? {
        preset: 'medium', focus: speech.speaker === 'wind' ? { x: 317, y: 193 } : { x: 1003, y: 183 }, width: 790
      } : {
        preset: this.scene.framing, focus: this.scene.focus, width: id === 'gust' ? 1060 : undefined
      };
      const signature = shot.preset + '/' + shot.focus.x;
      if (signature !== this.shot) {
        this.camera.cue({ ...shot, cut: true });
        this.shot = signature;
      }
    }

    face(name, ms, line, word, pose) {
      const p = this.parts;
      const speaking = line.speaker === name && word >= 0;
      const blink = !this.reduced.matches && (ms + { sun: 1380, wind: 740, traveller: 250 }[name]) % 3900 > 3790;
      opacity(p[name + '-eyes'], blink ? 0 : 1);
      opacity(p[name + '-lids'], blink ? 1 : 0);
      let opening = name === 'wind' && pose.wind > .43 ? .38 : .13;
      if (speaking) {
        const [start, end] = line.reading.timings[word];
        const vowel = /[ਆਓਾੌ]/u.test(line.reading.words[word]);
        const beat = Math.sin(between(ms - line.start, start, end) * Math.PI);
        opening = .23 + beat * (vowel ? .88 : .65);
      }
      const pivot = name === 'sun' ? 18 : name === 'wind' ? 18 : -13;
      p[name + '-mouth'].setAttribute('transform', 'translate(0 ' + pivot * (1 - opening) + ') scale(1 ' + opening + ')');
      p[name].dataset.speaking = String(speaking);
    }

    weather(ms, pose) {
      const p = this.parts;
      const still = this.reduced.matches;
      const time = still ? 0 : ms / 1000;
      const gust = pose.wind;
      opacity(p['clear-sky-layer'], .11 + pose.light * .83);
      opacity(p['sun-on-path'], .13 + pose.light * .85);
      opacity(p['sun-halo'], .27 + pose.light * .72);
      opacity(p['sun-rays'], .47 + pose.light * .48);
      p['sun-rays'].setAttribute('transform', 'rotate(' + time * 2.1 + ')');
      p['shade-clouds'].setAttribute('transform', 'translate(' + pose.cloudShift * 270 + ' ' + (-pose.cloudShift * 34) + ')');
      opacity(p['shade-clouds'], (1 - pose.cloudShift) * .6);
      p.wind.setAttribute('transform', 'translate(' + (257 + Math.sin(time * 2) * gust * 15) + ' ' + (182 + Math.sin(time * 1.8) * 3) + ')');
      p['tree-crown'].setAttribute('transform', 'rotate(' + (Math.sin(time * 6) * gust * 2.9) + ' 128 297)');
      opacity(p['wind-streams'], gust * (still ? .52 : .78));
      p['wind-streams'].setAttribute('transform', 'translate(' + (Math.sin(time * 6.8) * gust * 18) + ' 0)');
      opacity(p['blowing-leaves'], gust * .94);
      for (const [index, leaf] of this.leaves.entries()) {
        const phase = ((time * (1.8 + (index % 3) * .14) + index * .114) % 1 + 1) % 1;
        const x = 288 + phase * 1040;
        const y = 380 + (index % 4) * 46 + Math.sin(phase * 8 + index) * (32 + index * 2);
        const tilt = (index % 2 ? 1 : -1) * (phase * 311 + index * 39);
        leaf.setAttribute('transform', 'translate(' + x + ' ' + y + ') rotate(' + tilt + ')');
        opacity(leaf, Math.min(1, phase * 6, (1 - phase) * 6));
      }
      this.svg.dataset.warmth = pose.light.toFixed(2);
    }

    traveller(ms, pose) {
      const p = this.parts;
      const still = this.reduced.matches;
      const phase = still ? 0 : pose.stride * Math.PI * 2;
      const gait = Math.sin(phase) * 22;
      const lift = (1 - Math.cos(phase * 2)) * 2.1;
      const lean = still ? 0 : Math.sin(ms / 175) * pose.wind + pose.wind * 3.8;
      p.traveller.setAttribute('transform', 'translate(' + pose.x + ' ' + (618 - lift) + ') rotate(' + lean + ')');
      p['traveller-shadow'].setAttribute('cx', pose.x);
      p['leg-far'].setAttribute('transform', 'rotate(' + gait + ' 29 -86)');
      p['leg-near'].setAttribute('transform', 'rotate(' + (-gait) + ' -19 -87)');
      p['traveller-head'].setAttribute('transform', 'translate(5 -200) rotate(' + (-pose.lookingUp * 17 + pose.clutched * 7) + ')');
      const flick = still ? 0 : Math.sin(ms / 120) * pose.wind * (10 - pose.clutched * 5);
      p['shawl-tail'].setAttribute('transform', 'rotate(' + (flick + pose.wind * 43 * (1 - pose.clutched * .51)) + ' -43 -184)');
      opacity(p['shawl-tail'], (1 - pose.takeOff) * (1 - pose.clutched * .35));
      opacity(p['shawl-open'], (1 - pose.clutched) * (1 - pose.takeOff));
      opacity(p['shawl-wrapped'], pose.clutched * (1 - pose.takeOff));
      const size = mix(1.58, 1, pose.folding);
      p['shawl-folded'].setAttribute('transform', 'translate(' + (-26 * (1 - pose.carry)) + ' ' +
        (-60 * (1 - pose.carry)) + ') translate(42 -106) scale(' + size + ') translate(-42 106)');
      opacity(p['shawl-folded'], pose.takeOff);
      const arm = mix(-gait * .34, -27 * (1 - pose.carry), pose.takeOff);
      p['near-arm'].setAttribute('transform', 'rotate(' + arm + ' 46 -168)');
      opacity(p['shawl-grip'], pose.clutched * (1 - pose.takeOff));
      this.svg.dataset.shawl = pose.carry > .98 ? 'folded' : pose.takeOff > .06 ? 'removing' : pose.clutched > .69 ? 'wrapped' : 'worn';
    }

    draw(ms, line, word) {
      const pose = sceneState(this.scene, this.cues, ms, this.reduced.matches);
      this.frame(ms, line, pose);
      this.weather(ms, pose);
      this.traveller(ms, pose);
      for (const name of ['sun', 'wind', 'traveller']) this.face(name, ms, line, word, pose);
    }
  }

  window.LittlePanthStage = { Stage: WindStage, eventsFor };
})();
