(() => {
  'use strict';

  const clamp = n => Math.min(1, Math.max(0, n));
  const between = (ms, start, stop) => clamp((ms - start) / Math.max(16, stop - start));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const point = (x, y) => ({ x, y });
  const along = (from, to, t) => point(mix(from.x, to.x, t), mix(from.y, to.y, t));
  const line = (scene, id) => scene.lines.find(entry => entry.id === id);
  const opacity = (node, value) => node.setAttribute('opacity', String(value));
  const windHome = { x: 461, y: 137 };

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
    let x = 626, stride = 0, walking = 0, grasp = 0, lookingUp = 0, cloudShift = 0;
    switch (scene.id) {
      case 'road': {
        const walk = between(ms, 180, scene.duration - 380);
        x = mix(398, 626, still ? Math.round(walk) : smooth(walk));
        stride = (x - 398) / 88;
        walking = smooth(Math.min(1, walk / .08, (1 - walk) / .08));
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
        grasp = smooth(between(ms, cues.remove - 680, cues.remove - 130));
        takeOff = smooth(between(ms, cues.remove - 90, cues.remove + 640));
        folding = smooth(between(ms, cues.fold - 120, cues.fold + 540));
        carry = smooth(between(ms, cues.carry - 200, cues.carry + 480));
        break;
      case 'lesson': {
        light = 1;
        cloudShift = 1;
        takeOff = folding = carry = 1;
        const walk = between(ms, cues.walk, scene.duration - 470);
        x = mix(626, 1380, still ? Math.round(walk) : smooth(walk));
        stride = (x - 626) / 88;
        walking = smooth(Math.min(1, walk / .035, (1 - walk) / .06));
        break;
      }
    }
    return { light, wind, clutched, grasp, takeOff, folding, carry, x, stride, walking, lookingUp, cloudShift };
  }

  // The two elbows remain on the outside of the body. Both hands follow
  // the same cloth corners used below, so the shawl never floats between poses.
  function shawlArm(shoulder, target, side) {
    const upper = 42, lower = 41;
    const dx = target.x - shoulder.x, dy = target.y - shoulder.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const reach = Math.max(15, Math.min(upper + lower - .5, distance));
    const x = dx / distance, y = dy / distance;
    const alongArm = (upper ** 2 - lower ** 2 + reach ** 2) / (2 * reach);
    const bend = Math.sqrt(Math.max(0, upper ** 2 - alongArm ** 2));
    const elbow = point(shoulder.x + x * alongArm + side * y * bend,
      shoulder.y + y * alongArm - side * x * bend);
    const hand = point(shoulder.x + x * reach, shoulder.y + y * reach);
    const wrist = along(hand, elbow, .18);
    const before = along(elbow, shoulder, .2), after = along(elbow, wrist, .25);
    const sleeve = `M${shoulder.x} ${shoulder.y}L${before.x} ${before.y}Q${elbow.x} ${elbow.y} ${after.x} ${after.y}L${wrist.x} ${wrist.y}`;
    const angle = Math.atan2(hand.y - elbow.y, hand.x - elbow.x);
    const cuff = `M${wrist.x - Math.sin(angle) * 9} ${wrist.y + Math.cos(angle) * 9}L${wrist.x + Math.sin(angle) * 9} ${wrist.y - Math.cos(angle) * 9}`;
    return { sleeve, cuff, hand, angle: angle * 180 / Math.PI };
  }

  const wornCloth = [
    [-53,-190],[-49,-202],[-38,-207],[-29,-199],[-17,-185],[-9,-178],[-3,-177],
    [14,-179],[32,-188],[43,-198],[57,-196],[66,-187],[65,-175],
    [65,-147],[55,-130],[35,-117],[19,-112],[11,-119],[1,-121],
    [-11,-114],[-28,-119],[-45,-134],[-54,-149],[-60,-173],[-53,-190]
  ].map(([x,y]) => point(x,y));
  const clothOutline = [[0,0],[.12,-.03],[.25,.02],[.33,.02],[.45,.04],[.55,.04],[.67,.02],
    [.8,0],[.9,-.03],[1,0],[1.02,.2],[.98,.42],[.99,.55],
    [1.01,.78],[.97,.98],[.88,1],[.65,1.06],[.4,1.02],[.25,1],
    [.14,1.04],[.03,.98],[.02,.8],[-.02,.55],[.01,.2],[0,0]];
  function drape(left, right, depth) {
    return clothOutline.map(([x,y]) => point(mix(left.x,right.x,x), mix(left.y,right.y,x) + y * depth));
  }
  const blendCloth = (a,b,t) => a.map((p,i) => along(p,b[i],t));
  function clothPath(points) {
    return points.map((p,i) => `${i === 0 ? 'M' : (i - 1) % 3 === 0 ? 'C' : ''}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') + 'Z';
  }

  function trouserLeg(hip, cycle, walking, lift) {
    const u = ((cycle % 1) + 1) % 1;
    const swing = u > .6 ? (u - .6) / .4 : 0;
    const step = u < .6 ? mix(23,-23,u/.6) : mix(-23,23,smooth(swing));
    const foot = point(hip.x + step * walking, lift - Math.sin(swing * Math.PI) * 13 * walking);
    const ankle = point(foot.x, foot.y - 10);
    const dx = ankle.x - hip.x, dy = ankle.y - hip.y;
    const distance = Math.hypot(dx,dy), upper = 40, lower = 37;
    const a = (upper * upper - lower * lower + distance * distance) / (2 * distance);
    const h = Math.sqrt(Math.max(0,upper * upper - a * a));
    const knee = point(hip.x + dx / distance * a + dy / distance * h,
      hip.y + dy / distance * a - dx / distance * h);
    const path = `M${hip.x-14} ${hip.y}Q${hip.x} ${hip.y-5} ${hip.x+14} ${hip.y}` +
      `Q${knee.x+14} ${knee.y-9} ${knee.x+12} ${knee.y+3}L${ankle.x+11} ${ankle.y}` +
      `Q${ankle.x} ${ankle.y+5} ${ankle.x-11} ${ankle.y}L${knee.x-12} ${knee.y+2}Q${knee.x-13} ${knee.y-6} ${hip.x-14} ${hip.y}Z`;
    return {path,foot,pitch:-8*Math.sin(swing*Math.PI)*walking};
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
        preset: 'medium',
        focus: speech.speaker === 'wind' ? { x: windHome.x + 25, y: windHome.y + 16 } : { x: 1035, y: 162 },
        width: 590
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
      p.wind.setAttribute('transform', 'translate(' + (windHome.x + Math.sin(time * 2) * gust * 15) + ' ' +
        (windHome.y + Math.sin(time * 1.8) * 3) + ')');
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
      const walking = still ? 0 : pose.walking;
      const gait = Math.sin(pose.stride * Math.PI * 2) * walking;
      const lift = (1 - Math.cos(pose.stride * Math.PI * 4)) * .65 * walking;
      const lean = still ? 0 : Math.sin(ms / 480) * pose.wind * .7 + pose.wind * 2.4;
      p.traveller.setAttribute('transform', `translate(${pose.x} ${618-lift}) rotate(${lean})`);
      p['traveller-shadow'].setAttribute('cx', pose.x);
      for (const [name,hip,offset] of [['near',point(-19,-87),0],['far',point(24,-87),.5]]) {
        const leg = trouserLeg(hip, pose.stride + offset, walking, lift);
        p['leg-'+name+'-cloth'].setAttribute('d',leg.path);
        p['leg-'+name+'-shoe'].setAttribute('transform', `translate(${leg.foot.x-hip.x} ${leg.foot.y}) rotate(${leg.pitch} ${hip.x} 0)`);
      }
      p['traveller-head'].setAttribute('transform', `translate(5 -200) rotate(${-pose.lookingUp*10+pose.clutched*4-pose.takeOff*2})`);
      const flick = still ? 0 : Math.sin(ms / 260) * pose.wind * (6-pose.clutched*4);
      p['shawl-tail'].setAttribute('transform', `rotate(${flick+pose.wind*28*(1-pose.clutched*.65)} -43 -184)`);
      opacity(p['shawl-tail'], (1-pose.takeOff)*(1-pose.clutched*.45));

      const farRest = point(-42-gait*8,-110), nearRest = point(57+gait*9,-105);
      const farWrapped = along(farRest,point(-17,-146),pose.clutched);
      const nearWrapped = along(nearRest,point(12,-143),pose.clutched);
      const liftedFar = point(-27,-158), liftedNear = point(59,-158);
      let farHand = along(farWrapped,point(-31,-183),pose.grasp);
      let nearHand = along(nearWrapped,point(48,-180),pose.grasp);
      farHand = along(farHand,along(liftedFar,point(4,-145),pose.folding),pose.takeOff);
      nearHand = along(nearHand,along(liftedNear,point(57,-145),pose.folding),pose.takeOff);
      farHand = along(farHand,farRest,pose.carry);
      nearHand = along(nearHand,point(16,-125),pose.carry);
      const farArm = shawlArm(point(-38,-179),farHand,-1);
      const nearArm = shawlArm(point(42,-177),nearHand,1);
      for (const [prefix,arm] of [['traveller-far',farArm],['traveller',nearArm]]) {
        p[prefix+'-sleeve-edge'].setAttribute('d',arm.sleeve);
        p[prefix+'-sleeve'].setAttribute('d',arm.sleeve);
        p[prefix+'-hand'].setAttribute('transform',`translate(${arm.hand.x} ${arm.hand.y}) rotate(${arm.angle})`);
      }
      p['traveller-cuff'].setAttribute('d',nearArm.cuff);

      const wrappedCloth = wornCloth.map((v,i) => point(v.x*(1-pose.clutched*.08),v.y + (i>12?pose.clutched*7:0)));
      let held = blendCloth(drape(liftedFar,liftedNear,55),drape(point(4,-145),point(57,-145),35),pose.folding);
      held = blendCloth(held,drape(point(14,-126),point(63,-138),40),pose.carry);
      const cloth = blendCloth(wrappedCloth,held,pose.takeOff);
      p['shawl-main'].setAttribute('d',clothPath(cloth));
      const q = index => `${cloth[index].x} ${cloth[index].y}`;
      p['shawl-fold-line'].setAttribute('d', `M${q(1)}Q${q(6)} ${q(9)}M${q(22)}Q${q(18)} ${q(13)}`);
      p['shawl-hem'].setAttribute('d',`M${q(21)}Q${q(18)} ${q(15)}`);
      p['shawl-fringe'].setAttribute('d', [0,.2,.4,.6,.8,1].map(t => {
        const a=along(cloth[21],cloth[15],t);return `M${a.x} ${a.y}l${2-pose.clutched*2} ${4*(1-pose.takeOff)+3}`;
      }).join(' '));
      this.svg.dataset.shawl = pose.carry>.98?'folded':pose.folding>.05?'folding':pose.takeOff>.06?'removing':pose.clutched>.69?'wrapped':'worn';
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
