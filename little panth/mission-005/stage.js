(() => {
  'use strict';

  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const mix = (a, b, t) => a + (b - a) * t;
  const progress = (ms, start, end) => clamp((ms - start) / Math.max(1, end - start));
  const ease = t => t * t * (3 - 2 * t);
  const lineById = (scene, id) => scene.lines.find(line => line.id === id);

  function wordTime(line, token, last = false) {
    const words = line.reading.words.map(word => word.replace(/[\p{P}\p{S}]/gu, ''));
    const index = last ? words.lastIndexOf(token) : words.indexOf(token);
    return line.start + (line.reading.timings[index]?.[0] ?? line.duration * 0.6);
  }

  function eventsFor(scene) {
    if (scene.id === 'search') return [{ ms: lineById(scene, 'field-dry').duration * 0.49, sound: 'wings' }];
    if (scene.id === 'find') return [{ ms: lineById(scene, 'jar-land').start + 130, sound: 'wings' }];
    if (scene.id === 'drink') {
      const line = lineById(scene, 'sip-water');
      return [{ ms: wordTime(line, 'ਪੀਤਾ') - 160, sound: 'sip' }];
    }
    if (scene.id === 'ending') return [{ ms: 280, sound: 'wings' }];
    if (scene.id !== 'drops') return [];
    const first = lineById(scene, 'drop-first');
    const count = lineById(scene, 'drop-count');
    const taps = [wordTime(first, 'ਸੁੱਟ') + 180, ...['ਇੱਕ', 'ਦੋ', 'ਤਿੰਨ'].map(word => wordTime(count, word, true) + 100)];
    return taps.map((ms, index) => ({ ms, sound: 'plop', stone: index }));
  }

  function arc(from, to, t, lift) {
    return { x: mix(from.x, to.x, ease(t)), y: mix(from.y, to.y, ease(t)) - Math.sin(t * Math.PI) * lift };
  }

  const perch = { x: 767, y: 453 };
  const besidePot = { x: 540, y: 626 };

  function crowPose(scene, ms, still) {
    const pose = { ...perch, flying: false, dip: 0, carrying: false, glance: 0, angle: 0, alpha: 1 };
    let t;
    switch (scene.id) {
      case 'heat':
        Object.assign(pose, { x: 435, y: 316, glance: -2, angle: -4 });
        break;
      case 'search':
        t = progress(ms, 180, lineById(scene, 'field-dry').duration * 0.81);
        Object.assign(pose, arc({ x: 291, y: 308 }, { x: 839, y: 578 }, still ? Math.round(t) : t, 126));
        pose.flying = t > 0 && t < 1;
        pose.glance = t === 1 ? 4 : 0;
        pose.angle = t === 1 ? 9 : -5;
        break;
      case 'find':
        t = progress(ms, lineById(scene, 'jar-land').start + 100, scene.duration - 340);
        Object.assign(pose, arc({ x: 398, y: 603 }, perch, still ? Math.round(t) : t, 103));
        pose.flying = t > 0 && t < 1;
        pose.angle = pose.flying ? -9 : 0;
        break;
      case 'reach': {
        const line = lineById(scene, 'reach-low');
        const reach = wordTime(line, 'ਚੁੰਝ') - 210;
        pose.dip = ease(progress(ms, reach, reach + 430)) * (1 - ease(progress(ms, line.start + line.duration - 350, line.start + line.duration)));
        pose.glance = 5;
        break;
      }
      case 'idea':
        t = progress(ms, 40, 560);
        Object.assign(pose, arc(perch, besidePot, still ? Math.round(t) : t, 45));
        pose.flying = t > 0 && t < 1;
        pose.angle = pose.flying ? 4 : 11;
        pose.glance = 5;
        if (ms >= lineById(scene, 'idea-plan').start) pose.angle = -9;
        break;
      case 'drops': {
        const drops = scene.events.filter(event => event.stone !== undefined);
        const next = drops.find(event => event.ms >= ms);
        const previous = drops.findLast(event => event.ms < ms);
        if (!next) break;
        const interval = next.ms - (previous?.ms ?? 0);
        const pickup = next.ms - Math.min(1100, interval * 0.73);
        const hop = next.ms - Math.min(600, interval * 0.47);
        const release = next.ms - Math.min(240, interval * 0.27);
        const nearGround = next.stone === 0 ? besidePot : { x: 574 + next.stone * 11, y: 622 };
        if (!previous || ms >= pickup) {
          const landing = progress(ms, hop, release);
          Object.assign(pose, arc(nearGround, perch, still ? Math.round(landing) : landing, 58));
          pose.flying = landing > 0 && landing < 1;
          pose.dip = ms < hop ? 0.63 * progress(ms, pickup, hop) : 0.63 * landing;
          pose.carrying = ms >= hop && ms < release;
        } else {
          const descend = progress(ms, Math.max(previous.ms + 60, pickup - 360), pickup);
          Object.assign(pose, arc(perch, nearGround, still ? Math.round(descend) : descend, 22));
          pose.flying = descend > 0 && descend < 1;
          pose.dip = 0.55 * (1 - ease(progress(ms, previous.ms, previous.ms + 160)));
        }
        if (ms >= release) pose.dip = 0.63;
        break;
      }
      case 'drink': {
        const line = lineById(scene, 'sip-water');
        const reach = wordTime(line, 'ਪਹੁੰਚ') - 160;
        const sip = scene.events[0].ms;
        const touch = ease(progress(ms, reach - 450, reach)) * (1 - ease(progress(ms, reach + 270, reach + 720)));
        const drink = ease(progress(ms, sip - 630, sip - 140)) * (1 - ease(progress(ms, sip + 280, sip + 650)));
        pose.dip = Math.max(touch, drink);
        pose.glance = 3;
        pose.angle = ms > sip + 650 ? -11 : 0;
        break;
      }
      case 'ending': {
        const leave = lineById(scene, 'end-fly').duration;
        t = progress(ms, 125, leave - 280);
        Object.assign(pose, arc(perch, { x: 1455, y: 117 }, still ? Math.round(t) : t, 104));
        pose.flying = t > 0 && t < 1;
        pose.alpha = 1 - progress(t, 0.91, 1);
        pose.angle = -12;
        break;
      }
    }
    return pose;
  }

  class CrowStage {
    constructor(svg) {
      this.svg = svg;
      this.camera = new window.UmtoCamera.DeliveryCamera(svg);
      this.still = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.parts = Object.fromEntries([...svg.querySelectorAll('[id]')].map(node => [node.id, node]));
      this.visibleStones = [...this.parts['stone-pile'].querySelectorAll('use')];
      this.sunkStones = [...this.parts['submerged-stones'].querySelectorAll('use')];
      this.scene = null;
    }

    select(scene) {
      this.scene = scene;
      const yard = scene.anchor === 'courtyard';
      this.parts.courtyard.setAttribute('opacity', yard ? '1' : '0');
      this.parts.fields.setAttribute('opacity', yard ? '0' : '1');
      this.parts.props.setAttribute('opacity', yard ? '1' : '0');
      this.parts['heat-lines'].setAttribute('opacity', yard ? '0' : '.47');
      this.parts['jar-cutaway'].setAttribute('opacity', ['reach', 'drops', 'drink'].includes(scene.id) ? '1' : '0');
      const closeups = {
        drops: { width: 940, focus: { x: 745, y: 416 } },
        reach: { width: 740, focus: { ...scene.focus, y: 455 } },
        drink: { width: 740, focus: { ...scene.focus, y: 455 } }
      };
      const framing = closeups[scene.id] || { focus: scene.focus };
      this.camera.cue({ preset: scene.framing, ...framing, cut: true });
    }

    draw(ms, line, word) {
      const scene = this.scene;
      const still = this.still.matches;
      const p = this.parts;
      const t = ms / 1000;
      const pose = crowPose(scene, ms, still);
      const tilt = pose.flying ? -10 + Math.sin(t * 5) * 4 : 0;
      const bob = still ? 0 : Math.sin(t * 2.6) * 1.15;
      p.crow.setAttribute('transform', 'translate(' + pose.x + ' ' + (pose.y + bob) + ') rotate(' + (still ? 0 : tilt) + ')');
      p.crow.setAttribute('opacity', pose.alpha);
      p['crow-shadow'].setAttribute('cx', pose.x - 12);
      p['crow-shadow'].setAttribute('cy', Math.max(331, pose.y + 5));
      p['crow-shadow'].setAttribute('opacity', pose.flying || scene.id === 'heat' ? '0' : String(pose.alpha * 0.78));
      const onRim = !pose.flying && Math.abs(pose.x - perch.x) < 2 && Math.abs(pose.y - perch.y) < 2;
      p['crow-legs'].setAttribute('transform', onRim ? 'translate(12 -1)' : 'rotate(' + (pose.flying ? 26 : 0) + ' 0 -35)');

      const flap = pose.flying && !still ? Math.sin(t * 23) : 0;
      p['wing-near'].setAttribute('transform', 'rotate(' + (pose.flying ? -64 + flap * 90 : bob * 1.6) + ' -7 -91)');
      p['wing-far'].setAttribute('opacity', pose.flying ? '.90' : '0');
      p['wing-far'].setAttribute('transform', 'rotate(' + (-14 - flap * 47) + ' -13 -80)');
      p.tail.setAttribute('transform', 'rotate(' + (pose.flying ? flap * 12 : -bob * 1.7) + ' -53 -64)');

      const eyeX = 44 + (pose.dip ? 1 : 0);
      const eyeY = -14 + pose.glance;
      p['crow-pupil'].setAttribute('cx', eyeX);
      p['crow-pupil'].setAttribute('cy', eyeY);
      p['crow-glint'].setAttribute('cx', eyeX + 2.6);
      p['crow-glint'].setAttribute('cy', eyeY - 4.5);
      const blink = !still && !pose.flying && ((ms + 1200) % 3800 > 3690 || pose.dip > 0.79);
      p['crow-eye'].setAttribute('opacity', blink ? '0' : '1');
      p.eyelid.setAttribute('opacity', blink ? '1' : '0');
      p.brow.setAttribute('transform', 'rotate(' + (scene.id === 'reach' ? -11 : scene.id === 'idea' || scene.id === 'drink' ? 8 : 0) + ' 38 -35)');
      p['crow-head'].setAttribute('transform', 'translate(' + (39 - pose.dip * 10) + ' ' + (-103 + pose.dip * 53) + ') rotate(' + (pose.angle + pose.dip * 55) + ')');
      p['carried-stone'].setAttribute('opacity', pose.carrying ? '1' : '0');

      let beak = 0;
      const speaking = line.speaker === 'crow' && word >= 0;
      if (speaking) {
        const [start, end] = line.reading.timings[word];
        const phase = progress(ms - line.start, start, end);
        const vowel = /[ਆਾੌਓ]/u.test(line.reading.words[word]) ? 27 : /[ਉੂੋਈੀ]/u.test(line.reading.words[word]) ? 16 : 21;
        beak = still ? vowel * 0.55 : Math.sin(phase * Math.PI) * vowel;
      }
      p.crow.dataset.speaking = String(speaking);
      p['lower-beak'].setAttribute('transform', 'rotate(' + beak + ' 49 13)');

      this.drawWater(ms, pose);
      if (scene.id === 'search' && !still) {
        this.camera.cue({ preset: 'full', focus: { x: pose.x + 168, y: pose.y - 118 }, motion: 'tracking', cut: true });
      }
    }

    drawWater(ms, pose) {
      const scene = this.scene;
      const p = this.parts;
      const dropEvents = scene.events.filter(event => event.stone !== undefined);
      const landed = dropEvents.filter(event => event.ms <= ms);
      const count = ['drink', 'ending'].includes(scene.id) ? 4 : landed.length;
      const last = landed.at(-1);
      const amount = last && !this.still.matches ? 1 - ease(progress(ms, last.ms, last.ms + 220)) : 0;
      const level = 615 - (count - amount) * 31;
      const next = dropEvents.find(event => event.ms > ms);
      p['water-level'].setAttribute('transform', 'translate(0 ' + level + ')');

      for (const [i, stone] of this.sunkStones.entries()) {
        stone.setAttribute('opacity', count > i ? '1' : '0');
        this.visibleStones[i].setAttribute('opacity', count > i || (next?.stone === i && pose.carrying) ? '0' : '1');
      }
      let fall = 0;
      if (next && ms >= next.ms - 230) {
        fall = progress(ms, next.ms - 230, next.ms);
        const end = 615 - count * 31;
        p['falling-stone'].setAttribute('transform', 'translate(' + mix(861, 820, fall) + ' ' + mix(443, end, fall ** 1.7) + ') rotate(' + fall * 108 + ')');
      }
      p['falling-stone'].setAttribute('opacity', fall > 0 ? '1' : '0');

      const ripple = last ? clamp(1 - (ms - last.ms) / 500) : scene.id === 'drink' && pose.dip > 0.86 ? 0.58 : 0;
      p['water-ripple'].setAttribute('rx', (1 - ripple) * 32);
      p['water-ripple'].setAttribute('ry', (1 - ripple) * 6);
      p['water-ripple'].setAttribute('opacity', ripple);
      p.splash.setAttribute('opacity', last ? Math.max(0, ripple * 1.5 - 0.32) : 0);
      p.splash.setAttribute('transform', 'translate(820 ' + (level - 3) + ') scale(' + (0.48 + 0.5 * (1 - ripple)) + ')');
      p.props.dataset.stones = String(count);
      p.props.dataset.waterLevel = String(Math.round(level));
    }
  }

  window.LP005Stage = { CrowStage, eventsFor };
})();
