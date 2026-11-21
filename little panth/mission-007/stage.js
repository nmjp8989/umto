(() => {
  'use strict';

  const clamp = n => Math.min(1, Math.max(0, n));
  const between = (ms, start, stop) => clamp((ms - start) / Math.max(16, stop - start));
  const mix = (a, b, weight) => a + (b - a) * weight;
  const smooth = t => t * t * (3 - 2 * t);
  const line = (scene, id) => scene.lines.find(entry => entry.id === id);

  function atWord(scene, id, word) {
    const entry = line(scene, id);
    const index = entry.reading.words.findIndex(value => value.replace(/[\p{P}\p{S}]/gu, '') === word);
    return entry.start + (entry.reading.timings[index]?.[0] ?? entry.duration * 0.45);
  }

  function marks(scene) {
    switch (scene.id) {
      case 'meet':
        return { greet: line(scene, 'meet-hare').start };
      case 'start':
        return {
          go: atWord(scene, 'start-race', 'ਹੋਈ'),
          sprintEnd: line(scene, 'start-steps').start + 620
        };
      case 'nap':
        return { settle: atWord(scene, 'nap-sleep', 'ਲੇਟਿਆ'), sleep: atWord(scene, 'nap-sleep', 'ਸੌਂ') + 300 };
      case 'wake':
        return { eyes: atWord(scene, 'wake-eyes', 'ਜਾਗਿਆ'), run: atWord(scene, 'wake-hare', 'ਫੀਤੇ') };
      case 'finish':
        return { cross: atWord(scene, 'finish-cross', 'ਪਾਰ') + 110, greeting: line(scene, 'finish-hare').start };
      case 'friends':
        return { walk: line(scene, 'friends-home').start + 210 };
      default:
        return {};
    }
  }

  function steps(from, to, period) {
    const cues = [];
    for (let ms = from + period; ms < to; ms += period) cues.push({ ms, sound: 'step' });
    return cues;
  }

  function eventsFor(scene) {
    const cues = marks(scene);
    if (scene.id === 'start') return steps(cues.go, cues.sprintEnd, 475);
    if (scene.id === 'wake') return steps(cues.run, scene.duration - 270, 475);
    if (scene.id === 'finish') return [
      ...steps(210, Math.min(cues.greeting - 280, cues.cross + 900), 610),
      { ms: cues.cross, sound: 'ribbon' }
    ].sort((a, b) => a.ms - b.ms);
    return [];
  }

  function poses(scene, cues, ms) {
    const turtle = { x: 386, y: 609, scale: 1, face: 1, stride: 0, sleep: 0, visible: true };
    const hare = { x: 784, y: 592, scale: 1, face: -1, stride: 0, sleep: 0, visible: true };
    let t;
    switch (scene.id) {
      case 'meet':
        t = between(ms, 220, cues.greet - 130);
        turtle.x = mix(294, 431, smooth(t));
        turtle.stride = t > 0 && t < 1 ? t * 5 : 0;
        break;
      case 'start': {
        hare.face = 1;
        hare.y = 540;
        const sprint = between(ms, cues.go, cues.sprintEnd);
        hare.x = mix(500, 1465, sprint * (0.8 + 0.2 * sprint));
        hare.stride = sprint > 0 && sprint < 1 ? (ms - cues.go) / 475 : 0;
        const walking = between(ms, cues.go + 290, scene.duration);
        turtle.x = mix(415, 631, walking);
        turtle.y = 621;
        turtle.stride = walking > 0 ? (ms - cues.go - 290) / 1020 : 0;
        break;
      }
      case 'nap':
        turtle.visible = false;
        Object.assign(hare, { x: 437, y: 565, face: 1 });
        hare.sleep = smooth(between(ms, cues.settle - 130, cues.sleep));
        break;
      case 'pass':
        Object.assign(hare, { x: 437, y: 565, face: 1, sleep: 1 });
        t = between(ms, 180, scene.duration);
        turtle.x = mix(271, 905, t);
        turtle.stride = t > 0 ? (ms - 180) / 1020 : 0;
        break;
      case 'wake': {
        Object.assign(hare, { x: 437, y: 565, face: 1 });
        hare.sleep = 1 - smooth(between(ms, cues.eyes - 120, cues.eyes + 560));
        const sprint = between(ms, cues.run, scene.duration - 180);
        hare.x = mix(437, 1390, sprint ** 1.15);
        hare.stride = sprint > 0 && sprint < 1 ? (ms - cues.run) / 475 : 0;
        turtle.x = mix(939, 1148, between(ms, 0, scene.duration));
        turtle.y = 561;
        turtle.scale = 0.72;
        turtle.stride = ms / 1160;
        break;
      }
      case 'finish': {
        hare.face = 1;
        hare.y = 560;
        const sprint = between(ms, 240, cues.greeting - 280);
        hare.x = mix(449, 677, smooth(sprint));
        hare.stride = sprint > 0 && sprint < 1 ? (ms - 240) / 610 : 0;
        t = between(ms, 190, cues.cross);
        const clear = between(ms, cues.cross, cues.cross + 1430);
        turtle.x = mix(644, 853, t) + clear * 76;
        turtle.stride = t > 0 && clear < 1 ? (ms - 190) / 910 : 0;
        if (clear === 1) turtle.face = -1;
        break;
      }
      case 'friends':
        t = between(ms, cues.walk, scene.duration - 280);
        turtle.x = mix(856, 1555, smooth(t));
        hare.x = mix(620, 1450, smooth(t));
        hare.y = 586;
        turtle.face = t ? 1 : -1;
        hare.face = 1;
        turtle.stride = t > 0 && t < 1 ? (ms - cues.walk) / 1120 : 0;
        hare.stride = t > 0 && t < 1 ? (ms - cues.walk) / 1220 : 0;
        break;
    }
    return { hare, tortoise: turtle };
  }

  class RaceStage {
    constructor(svg) {
      this.svg = svg;
      this.camera = new window.UmtoCamera.DeliveryCamera(svg);
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.parts = Object.fromEntries([...svg.querySelectorAll('[id]')].map(element => [element.id, element]));
      this.scene = null;
    }

    select(scene) {
      this.scene = scene;
      this.cues = marks(scene);
      this.shot = '';
      this.parts['shade-grove'].setAttribute('opacity', scene.anchor === 'shady' ? '1' : '0');
      this.parts['start-mark'].setAttribute('opacity', scene.id === 'start' ? '1' : '0');
      const finish = scene.id === 'finish' ? '1' : '0';
      this.parts['finish-mark'].setAttribute('opacity', finish);
      this.parts['finish-ribbon'].setAttribute('opacity', finish);
      this.parts['ribbon-whole'].setAttribute('opacity', finish);
      this.parts['ribbon-far'].setAttribute('opacity', '0');
      this.parts['ribbon-near'].setAttribute('opacity', '0');
      this.svg.dataset.ribbon = finish === '1' ? 'ready' : 'off';
    }

    setCamera(ms, actors) {
      const { id, framing, focus } = this.scene;
      let shot = { name: framing, focus };
      if (id === 'meet' && ms >= this.cues.greet) shot = { name: 'two-shot', focus: { x: 598, y: 444 } };
      if (id === 'wake' && ms < this.cues.run - 250) shot = { name: 'medium', focus: { x: 516, y: 447 }, width: 900 };
      if (id === 'finish') shot = { name: 'conversation', focus: { x: 747, y: 427 }, width: 1030 };
      if (!this.reduced.matches && (id === 'start' || (id === 'wake' && ms >= this.cues.run - 250))) {
        const actor = actors.hare;
        this.camera.cue({
          preset: 'full',
          focus: { x: Math.max(620, Math.min(835, actor.x + 143)), y: 427 },
          width: id === 'start' ? 1135 : 1160,
          motion: 'tracking', parallax: true, cut: true
        });
        this.shot = 'tracking';
        return;
      }
      const signature = shot.name + ':' + shot.focus.x;
      if (signature !== this.shot) {
        this.camera.cue({ preset: shot.name, focus: shot.focus, width: shot.width, cut: true });
        this.shot = signature;
      }
    }

    drawActor(name, pose, ms, line, word) {
      const p = this.parts;
      const still = this.reduced.matches;
      const running = name === 'hare' && ['start', 'wake', 'finish'].includes(this.scene.id);
      const phase = pose.stride * Math.PI * 2;
      const hop = Math.pow(Math.sin((pose.stride % 1) * Math.PI), 1.35) * 40;
      const lift = still || pose.stride === 0 ? 0 : running ? hop : (1 - Math.cos(phase * 2)) * 2.6;
      const tilt = running && pose.stride && !still ? Math.sin(phase) * 8 : 0;
      const scaleY = pose.scale * (1 - pose.sleep * 0.31);
      p[name].setAttribute('opacity', pose.visible ? '1' : '0');
      p[name].setAttribute('transform', 'translate(' + pose.x + ' ' + (pose.y - lift) + ') rotate(' + tilt + ') scale(' + (pose.scale * pose.face) + ' ' + scaleY + ')');
      const shadow = p[name + '-shadow'];
      shadow.setAttribute('cx', pose.x);
      shadow.setAttribute('cy', pose.y + 3);
      shadow.setAttribute('opacity', pose.visible ? String(0.86 - lift / 115) : '0');

      const stride = still || pose.sleep > 0.35 ? 0 : Math.sin(phase) * (running ? 37 : 14);
      if (name === 'hare') {
        p['hare-fore-near'].setAttribute('transform', 'rotate(' + stride + ' 27 -61)');
        p['hare-fore-far'].setAttribute('transform', 'rotate(' + (-stride * 0.72) + ' 33 -68)');
        p['hare-rear-near'].setAttribute('transform', 'rotate(' + (-stride * 0.82) + ' -46 -45)');
        p['hare-rear-far'].setAttribute('transform', 'rotate(' + (stride * 0.47) + ' -52 -43)');
        p['hare-head'].setAttribute('transform', 'translate(' + (39 + pose.sleep * 21) + ' ' + (-98 + pose.sleep * 32) + ') rotate(' + (pose.sleep * 13 - tilt * 0.3) + ')');
        const ear = -59 * pose.sleep + (running && pose.stride ? -23 + stride * 0.32 : 0);
        p['hare-ear-near'].setAttribute('transform', 'rotate(' + ear + ' 6 -38)');
        p['hare-ear-far'].setAttribute('transform', 'rotate(' + (ear * 0.85 - 9) + ' 26 -38)');
      } else {
        p['tortoise-front-near'].setAttribute('transform', 'rotate(' + stride + ' 43 -28)');
        p['tortoise-front-far'].setAttribute('transform', 'rotate(' + (-stride * 0.72) + ' 54 -28)');
        p['tortoise-rear-near'].setAttribute('transform', 'rotate(' + (-stride * 0.86) + ' -49 -28)');
        p['tortoise-rear-far'].setAttribute('transform', 'rotate(' + (stride * 0.61) + ' -55 -28)');
        p['tortoise-head'].setAttribute('transform', 'translate(' + (72 + stride * 0.23) + ' -47) rotate(' + (stride * 0.22) + ')');
      }
      const sleeping = pose.sleep > 0.58;
      const blink = sleeping || (!still && (ms + (name === 'hare' ? 1560 : 780)) % 3500 > 3380);
      p[name + '-eye'].setAttribute('opacity', blink ? '0' : '1');
      p[name + '-lid'].setAttribute('opacity', blink ? '1' : '0');
      p[name].dataset.sleeping = String(sleeping);

      let openness = 0.08;
      const speaking = line.speaker === name && word >= 0 && !sleeping;
      if (speaking) {
        const [start, end] = line.reading.timings[word];
        const wide = /[ਆਓਾੌ]/u.test(line.reading.words[word]);
        openness = 0.23 + Math.sin(between(ms - line.start, start, end) * Math.PI) * (wide ? .95 : .73);
      }
      const pivot = name === 'hare' ? 20 : -2;
      p[name + '-mouth'].setAttribute('transform', 'translate(0 ' + pivot * (1 - openness) + ') scale(1 ' + openness + ')');
      p[name].dataset.speaking = String(speaking);
    }

    draw(ms, line, word) {
      const actors = poses(this.scene, this.cues, ms);
      this.setCamera(ms, actors);
      this.drawActor('hare', actors.hare, ms, line, word);
      this.drawActor('tortoise', actors.tortoise, ms, line, word);
      if (this.scene.id === 'finish') {
        const crossed = ms >= this.cues.cross;
        const settle = this.reduced.matches ? 1 : smooth(between(ms, this.cues.cross, this.cues.cross + 450));
        this.parts['ribbon-whole'].setAttribute('opacity', crossed ? '0' : '1');
        this.parts['ribbon-far'].setAttribute('opacity', crossed ? '1' : '0');
        this.parts['ribbon-near'].setAttribute('opacity', crossed ? '1' : '0');
        this.parts['ribbon-far'].setAttribute('transform', 'rotate(' + (8 + settle * 32) + ' 844 486)');
        this.parts['ribbon-near'].setAttribute('transform', 'rotate(' + (-8 - settle * 33) + ' 916 577)');
        this.svg.dataset.ribbon = crossed ? 'crossed' : 'ready';
      }
      const float = this.reduced.matches ? 0 : Math.sin(ms / 885);
      this.parts['floating-leaf'].setAttribute('transform', 'translate(' + (981 + float * 24) + ' ' + (597 - float * 8) + ') rotate(' + float * 33 + ')');
    }
  }

  window.LittlePanthStage = { Stage: RaceStage, eventsFor };
})();
