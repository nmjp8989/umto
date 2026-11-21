(() => {
  'use strict';

  const clamp = n => Math.min(1, Math.max(0, n));
  const between = (ms, start, end) => clamp((ms - start) / Math.max(1, end - start));
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);
  const transform = (node, value) => node.setAttribute('transform', value);
  const opacity = (node, value) => node.setAttribute('opacity', String(value));
  const glints = [[0, 593], [130, 633], [230, 583], [353, 608], [454, 518], [550, 592],
    [694, 565], [788, 609], [923, 497], [1065, 466]];
  const shore = { ant: { x: 1038, y: 575 }, leaf: { x: 974, y: 549 }, dove: { x: 1168, y: 570 } };

  function wordAt(scene, id, word) {
    const line = scene.lines.find(entry => entry.id === id);
    const index = line.reading.words.findIndex(value => value.replace(/\p{P}/gu, '') === word);
    return line.start + (line.reading.timings[index]?.[0] ?? line.duration * .5);
  }

  function cuesFor(scene) {
    switch (scene.id) {
      case 'river':
        return { walk: 285, edge: wordAt(scene, 'ant-at-bank', 'ਕੰਢੇ') + 350 };
      case 'slip':
        return { slip: wordAt(scene, 'ant-slips', 'ਤਿਲਕਿਆ') - 70, splash: wordAt(scene, 'ant-slips', 'ਡਿੱਗ') + 40 };
      case 'rescue': {
        const release = wordAt(scene, 'leaf-drops', 'ਸੁੱਟ');
        return { pluck: wordAt(scene, 'leaf-drops', 'ਤੋੜਿਆ'), release, water: release + 710 };
      }
      case 'raft':
        return { board: wordAt(scene, 'leaf-floats', 'ਚੜ੍ਹ'), shore: wordAt(scene, 'leaf-floats', 'ਕੰਢੇ') + 180 };
      case 'crack':
        return { gust: wordAt(scene, 'branch-cracks', 'ਤੇਜ਼') - 100, crack: wordAt(scene, 'branch-cracks', 'ਤਰੇੜ') };
      case 'warning': {
        const lift = wordAt(scene, 'dove-flies', 'ਉੱਡ') - 50;
        const release = Math.max(lift + 450, wordAt(scene, 'dove-flies', 'ਟਾਹਣੀ') - 70);
        const impact = Math.max(release + 420, wordAt(scene, 'dove-flies', 'ਡਿੱਗ') + 110);
        return { lift, release, impact, land: Math.max(impact + 420, scene.duration - 100) };
      }
      default:
        return {};
    }
  }

  function eventsFor(scene) {
    const cue = cuesFor(scene);
    switch (scene.id) {
      case 'river':
        return [{ ms: cue.walk + 240, sound: 'step' }, { ms: cue.edge - 250, sound: 'step' }];
      case 'slip':
        return [{ ms: cue.splash, sound: 'plop' }];
      case 'rescue':
        return [{ ms: cue.pluck, sound: 'ribbon' }, { ms: cue.water, sound: 'plop' }];
      case 'raft':
        return [{ ms: cue.board + 130, sound: 'ribbon' }, { ms: cue.shore + 410, sound: 'step' }];
      case 'crack':
        return [{ ms: cue.gust, sound: 'gust' }, { ms: cue.crack, sound: 'twig' }];
      case 'warning':
        return [{ ms: cue.lift, sound: 'wings' }, { ms: cue.release, sound: 'twig' }, { ms: cue.impact, sound: 'plop' }];
      default:
        return [];
    }
  }

  function scenePose(scene, cue, ms, still) {
    const movement = n => still ? Math.round(n) : ease(n);
    const ant = { x: 344, y: 523, step: 0, up: 0, swim: 0, direction: 1 };
    const dove = { x: 736, y: 268, peck: 0, fly: 0, direction: 1 };
    const leaf = { x: 652, y: 192, angle: -25 };
    const branch = { crack: 0, fall: 0 };
    let breeze = .06;
    let splash = null;

    switch (scene.id) {
      case 'river': {
        const walk = between(ms, cue.walk, cue.edge);
        ant.x = mix(189, 344, movement(walk));
        ant.y = mix(544, 523, movement(walk));
        ant.step = Math.sin(Math.PI * walk);
        break;
      }
      case 'slip': {
        const skid = between(ms, cue.slip, cue.splash - 300);
        const drop = between(ms, cue.splash - 310, cue.splash);
        const drift = between(ms, cue.splash, scene.duration - 260);
        ant.x = 344 + 37 * movement(skid) + 37 * movement(drop) + 144 * movement(drift);
        ant.y = 523 + 33 * movement(drop);
        ant.swim = drop;
        splash = { ms: cue.splash, x: 418, y: 556, size: .67 };
        break;
      }
      case 'rescue': {
        const drop = between(ms, cue.release, cue.water);
        ant.x = mix(562, 665, movement(between(ms, 80, scene.duration - 240)));
        ant.y = 556;
        ant.swim = 1;
        ant.up = .42;
        dove.peck = Math.sin(Math.PI * between(ms, cue.pluck - 270, cue.release + 220));
        leaf.x = 652 + 36 * movement(drop);
        leaf.y = mix(192, 552, still ? Math.round(drop) : drop ** 1.35);
        leaf.angle = mix(-25, 1, drop) + (still ? 0 : Math.sin(drop * Math.PI * 3) * 26);
        splash = { ms: cue.water, x: 688, y: 552, size: .52 };
        break;
      }
      case 'raft': {
        const aboard = movement(between(ms, cue.board - 110, cue.board + 570));
        const drifts = movement(between(ms, cue.board + 430, cue.shore));
        const onBank = movement(between(ms, cue.shore, cue.shore + 550));
        leaf.x = mix(688, shore.leaf.x, drifts);
        leaf.y = mix(552, shore.leaf.y, drifts) + (still ? 0 : Math.sin(drifts * Math.PI * 6) * 2.7);
        leaf.angle = still ? 0 : Math.sin(drifts * Math.PI * 5) * 3.8;
        ant.x = mix(mix(665, leaf.x, aboard), shore.ant.x, onBank);
        ant.y = mix(mix(556, leaf.y - 5, aboard), shore.ant.y, onBank);
        ant.swim = 1 - aboard;
        ant.step = Math.sin(onBank * Math.PI);
        ant.up = onBank * .66;
        ant.direction = onBank > .72 ? -1 : 1;
        break;
      }
      case 'crack':
        breeze = mix(.06, .85, ease(between(ms, cue.gust, cue.gust + 780)));
        branch.crack = ease(between(ms, cue.crack - 140, cue.crack + 160));
        break;
      case 'warning': {
        const flight = between(ms, cue.lift, cue.land);
        const up = movement(between(flight, 0, .25));
        const glide = movement(between(flight, .25, 1));
        dove.x = 736 - 50 * up + (shore.dove.x - 686) * glide;
        dove.y = 268 - 111 * up + (shore.dove.y - 157) * (still ? glide : glide ** 1.36);
        dove.fly = flight > 0 && flight < 1 ? 1 : 0;
        dove.direction = flight > .29 && flight < .95 ? -1 : 1;
        branch.crack = 1;
        branch.fall = movement(between(ms, cue.release, cue.impact));
        breeze = mix(.84, .12, ease(between(ms, cue.release, cue.impact + 720)));
        splash = { ms: cue.impact, x: 804, y: 542, size: 1.32 };
        break;
      }
      case 'friends':
        branch.crack = branch.fall = 1;
        dove.x = shore.dove.x;
        dove.y = shore.dove.y;
        break;
    }
    if (['crack', 'warning', 'friends'].includes(scene.id)) {
      leaf.x = shore.leaf.x;
      leaf.y = shore.leaf.y;
      leaf.angle = 0;
      ant.x = shore.ant.x;
      ant.y = shore.ant.y;
      ant.up = scene.id === 'friends' ? .13 : .9;
      ant.direction = scene.id === 'friends' ? 1 : -1;
    }
    return { ant, dove, leaf, branch, breeze, splash };
  }

  class RiverStage {
    constructor(svg) {
      this.svg = svg;
      this.camera = new window.UmtoCamera.DeliveryCamera(svg);
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.parts = Object.fromEntries([...svg.querySelectorAll('[id]')].map(node => [node.id, node]));
      this.reflections = [...this.parts['moving-glints'].children];
    }

    select(scene) {
      this.scene = scene;
      this.cues = cuesFor(scene);
      this.shot = '';
    }

    frame(ms, speech, ant) {
      const { id, framing, focus } = this.scene;
      const still = this.reduced.matches;
      let shot = { preset: framing, focus };
      if (id === 'river' && !still && ms >= this.cues.walk) {
        shot = { preset: 'full', focus: { x: mix(612, 663, between(ant.x, 189, 344)), y: 366 }, width: 1160,
          motion: 'tracking', parallax: true };
      } else if ((id === 'slip' || id === 'raft') && !still) {
        shot = { preset: 'medium', focus: { x: ant.x + 30, y: 516 }, width: 705, motion: 'tracking' };
      } else if (id === 'rescue' && speech.speaker === 'dove') {
        shot = { preset: 'medium-close', focus: { x: 732, y: 220 }, width: 562 };
      } else if (id === 'crack' && ms >= this.cues.crack - 150) {
        shot = { preset: 'detail', focus: { x: 943, y: 266 }, width: 488 };
      } else if (id === 'warning' && speech.speaker === 'ant') {
        shot = { preset: 'medium-close', focus: { x: 1035, y: 490 }, width: 516 };
      } else if (id === 'friends') {
        shot.width = 582;
      }
      const key = [shot.preset, shot.focus.x, shot.focus.y].join('/');
      if (key !== this.shot) {
        this.camera.cue({ ...shot, cut: true });
        this.shot = key;
      }
    }

    ant(ms, state, opening, speaking) {
      const p = this.parts;
      const still = this.reduced.matches;
      const gait = still ? 0 : Math.sin(ms / 103) * state.step;
      const bob = still ? 0 : Math.sin(ms / 271) * state.swim * 3.2;
      transform(p.ant, 'translate(' + state.x + ' ' + (state.y + bob) + ') scale(' + (state.direction * .86) + ' .86)');
      p['ant-shadow'].setAttribute('cx', state.x - 8);
      p['ant-shadow'].setAttribute('cy', state.y + 2);
      opacity(p['ant-shadow'], 1 - state.swim);
      for (const [id, sign] of [['ant-far-legs', -1], ['ant-near-legs', 1]]) {
        transform(p[id], 'rotate(' + (gait * sign * 17) + ' -14 -28)');
        opacity(p[id], 1 - state.swim * .78);
      }
      transform(p['ant-head'], 'rotate(' + (-state.up * 17 - gait * 2) + ' 11 -42)');
      const aperture = speaking ? .31 + opening * .84 : .18;
      transform(p['ant-mouth'], 'translate(0 ' + (-34 * (1 - aperture)) + ') scale(1 ' + aperture + ')');
      const blink = !still && (ms + 220) % 3620 > 3500;
      opacity(p['ant-eye'], blink ? 0 : 1);
      opacity(p['ant-lid'], blink ? 1 : 0);
      p.ant.dataset.speaking = String(speaking);
    }

    dove(ms, state, branchAngle, opening, speaking) {
      const p = this.parts;
      const still = this.reduced.matches;
      let { x, y } = state;
      if (this.scene.id !== 'friends' && !state.fly && (this.cues.lift === undefined || ms <= this.cues.lift)) {
        const radians = branchAngle * Math.PI / 180;
        x = 976 + (x - 976) * Math.cos(radians) - (y - 254) * Math.sin(radians);
        y = 254 + (state.x - 976) * Math.sin(radians) + (y - 254) * Math.cos(radians);
      }
      transform(p.dove, 'translate(' + x + ' ' + y + ') scale(' + (state.direction * .82) + ' .82)');
      p['dove-shadow'].setAttribute('cx', x);
      p['dove-shadow'].setAttribute('cy', shore.dove.y + 2);
      opacity(p['dove-shadow'], between(y, shore.dove.y - 40, shore.dove.y));
      opacity(p['dove-feet'], state.fly ? .22 : 1);
      const wing = state.fly ? -78 + (still ? 0 : Math.sin(ms / 74) * 48) : 0;
      transform(p['dove-wing'], 'rotate(' + wing + ' -12 -51)');
      transform(p['dove-head'], 'rotate(' + (-state.peck * 13 + (state.fly ? 7 : 0)) + ' -12 -69)');
      transform(p['dove-lower-beak'], 'rotate(' + (speaking ? -opening * 23 : 0) + ' -69 -75)');
      const blink = !still && (ms + 1225) % 4310 > 4160;
      opacity(p['dove-eye'], blink ? 0 : 1);
      opacity(p['dove-lid'], blink ? 1 : 0);
      p.dove.dataset.speaking = String(speaking);
      this.svg.dataset.doveAirborne = String(Boolean(state.fly));
    }

    setting(ms, pose, branchAngle) {
      const p = this.parts;
      const still = this.reduced.matches;
      const time = still ? 0 : ms;
      const { ant, leaf, branch, splash, breeze } = pose;
      for (const [i, node] of this.reflections.entries()) {
        const [x, y] = glints[i];
        const drift = ((time / 21 + i * 17) % 92) - 46;
        transform(node, 'translate(' + (x + drift) + ' ' + y + ') scale(' + (.59 + (i % 4) * .17) + ' 1)');
        opacity(node, .42 + Math.sin(time / 770 + i) * .19);
      }
      transform(p['willow-crown'], 'rotate(' + (Math.sin(time / 194) * breeze * 2.7) + ' 1027 140)');
      transform(p['loose-branch'], 'translate(' + (branch.fall * 52) + ' ' + (branch.fall * 246) +
        ') rotate(' + branchAngle + ' 976 254)');
      opacity(p['branch-crack'], branch.crack);
      this.svg.dataset.branchState = branch.fall >= .99 ? 'fallen' : branch.fall > 0 ? 'falling' :
        branch.crack > .1 ? 'cracked' : 'steady';
      transform(p['rescue-leaf'], 'translate(' + leaf.x + ' ' + leaf.y + ') rotate(' + leaf.angle + ')');
      const floating = leaf.y > 544;
      const wake = ant.swim > .05 || floating;
      transform(p['water-wake'], 'translate(' + (floating ? leaf.x : ant.x) + ' ' + (floating ? leaf.y + 9 : ant.y - 7) + ')');
      opacity(p['water-wake'], wake ? .53 + Math.sin(time / 249) * .09 : 0);
      const splashTime = splash ? ms - splash.ms : -1;
      if (splashTime >= 0 && splashTime < 650) {
        const push = still ? .78 : mix(.52, 1.28, splashTime / 650);
        transform(p.splash, 'translate(' + splash.x + ' ' + splash.y + ') scale(' + (splash.size * push) + ')');
        opacity(p.splash, (1 - splashTime / 650) * .97);
      } else {
        opacity(p.splash, 0);
      }
      this.svg.dataset.antPlace = ant.swim > .45 ? 'water' : floating && ant.x < shore.ant.x - 7 ? 'leaf' : 'bank';
    }

    draw(ms, speech, word) {
      const still = this.reduced.matches;
      const pose = scenePose(this.scene, this.cues, ms, still);
      const branchAngle = (still ? 0 : -pose.breeze * .9 + Math.sin(ms / 136) * pose.breeze * 1.4) *
        (1 - pose.branch.fall) - 11 * pose.branch.fall - Math.sin(Math.PI * pose.branch.fall) * 8;
      let opening = 0;
      if (word >= 0 && speech.speaker !== 'narrator') {
        const [start, end] = speech.reading.timings[word];
        const beat = Math.sin(Math.PI * between(ms - speech.start, start, end));
        opening = .25 + beat * (/[ਆਔਓਾੌੋ]/u.test(speech.reading.words[word]) ? .78 : .58);
      }
      this.frame(ms, speech, pose.ant);
      this.setting(ms, pose, branchAngle);
      this.ant(ms, pose.ant, opening, word >= 0 && speech.speaker === 'ant');
      this.dove(ms, pose.dove, branchAngle, opening, word >= 0 && speech.speaker === 'dove');
    }
  }

  window.LittlePanthStage = { Stage: RiverStage, eventsFor };
})();
