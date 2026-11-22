(() => {
  'use strict';

  const phase = (value, from, to) => Math.max(0, Math.min(1, (value - from) / Math.max(Number.EPSILON, to - from)));
  const ease = t => t * t * (3 - 2 * t);
  const mix = (a, b, t) => a + (b - a) * t;
  const point = (x, y, angle = 0) => ({ x, y, angle });
  const transform = (node, value) => node.setAttribute('transform', value);
  const opacity = (node, value) => node.setAttribute('opacity', String(value));

  const { open, Character, voiceFrame } = window.UmtoNativeCharacterPlayer;
  const cast = {
    mehar: { preset: 'kid-meher', view: 'right', height: 244, serial: 471 },
    boy: { preset: 'kid-sidak', view: 'right', height: 233, serial: 472 }
  };
  const dogScale = .68;
  const breadScale = .86 * dogScale;
  const offer = point(514, 560);
  const courtyard = { mehar: point(450, 659), boy: point(275, 656),
    dog: point(offer.x + 115 * dogScale, offer.y + 90 * dogScale) };
  const bank = { mehar: point(453, 467), boy: point(297, 474), dog: point(644, 493) };
  const lookDown = 27;
  let studio;

  function lineFor(scene, id) {
    return scene.lines.find(line => line.id === id);
  }

  function wordAt(scene, id, word) {
    const line = lineFor(scene, id);
    const index = line.reading.words.findIndex(value => value.replace(/\p{P}/gu, '') === word);
    return line.start + (line.reading.timings[index]?.[0] ?? line.duration / 2);
  }

  function cuesFor(scene) {
    switch (scene.id) {
      case 'courtyard':
        return { dog: wordAt(scene, 'in-the-courtyard', 'ਕੁੱਤਾ'), sit: wordAt(scene, 'in-the-courtyard', 'ਬੈਠ'),
          offer: wordAt(scene, 'mehar-shares', 'ਲੈ') + 250 };
      case 'canal':
        return { water: wordAt(scene, 'to-the-canal', 'ਪਹੁੰਚ') };
      case 'another-dog':
        return { lean: wordAt(scene, 'sees-his-reflection', 'ਝੁਕ'), notice: wordAt(scene, 'sees-his-reflection', 'ਦਿਸਿਆ') };
      case 'splash': {
        const bark = wordAt(scene, 'drops-the-roti', 'ਭੌਂਕਿਆ');
        return { bark, release: bark + 160, splash: bark + 690 };
      }
      case 'still-water':
        return { settle: wordAt(scene, 'ripples-settle', 'ਠਹਿਰੀਆਂ') };
      case 'realization':
        return { arrive: wordAt(scene, 'children-arrive', 'ਆ'), tilt: wordAt(scene, 'children-arrive', 'ਟੇਢਾ'),
          explain: lineFor(scene, 'sidak-explains') };
      case 'homeward':
        return { glance: wordAt(scene, 'walk-home', 'ਵੇਖਿਆ'), leave: wordAt(scene, 'walk-home', 'ਤੁਰ') };
    }
  }

  function eventsFor(scene) {
    const cue = cuesFor(scene);
    switch (scene.id) {
      case 'courtyard': return [{ ms: 730, sound: 'chirp' }, { ms: cue.dog + 390, sound: 'step' }];
      case 'canal': return [660, 1540, 2310].map(ms => ({ ms, sound: 'step' }));
      case 'another-dog': return [{ ms: cue.notice + 250, sound: 'ribbon' }];
      case 'splash': return [{ ms: cue.release - 40, sound: 'bark' }, { ms: cue.splash, sound: 'plop' }];
      case 'still-water': return [{ ms: 390, sound: 'sip' }];
      case 'realization': return [cue.arrive - 250, cue.arrive + 150].map(ms => ({ ms, sound: 'step' }));
      case 'homeward': return [{ ms: cue.leave + 260, sound: 'step' }, { ms: cue.leave + 1040, sound: 'chirp' }];
    }
  }

  function action(ms, start, ready, release, end) {
    return ease(phase(ms, start, ready)) * (1 - ease(phase(ms, release, end)));
  }

  function moveTo(actor, ms, from, to, first, last, motion) {
    const progress = motion(phase(ms, from, to));
    actor.x = mix(first.x, last.x, progress);
    actor.y = mix(first.y, last.y, progress);
    if (progress > 0 && progress < 1) {
      actor.walk = (ms - from) / 1000;
      actor.gait = Math.sin((last.x - first.x) * progress / 10.5) *
        ease(phase(progress, 0, .09)) * (1 - ease(phase(progress, .91, 1)));
    }
  }

  function mouth(dog) {
    const angle = dog.angle * Math.PI / 180;
    return point(dog.x + dog.facing * dogScale * (42 + 73 * Math.cos(angle) - 18 * Math.sin(angle)),
      dog.y + dogScale * (-108 + 73 * Math.sin(angle) + 18 * Math.cos(angle)), dog.facing * (dog.angle - 12));
  }

  const waterContact = point(mouth({ ...bank.dog, angle: lookDown, facing: 1 }).x + 38, 533);
  const child = position => ({ ...position, grips: [], lean: 0, visible: false, seated: false, mirror: false });

  function makeFrame(scene, cue, ms, still) {
    const motion = still ? Math.round : ease;
    const dog = { ...bank.dog, angle: lookDown, facing: 1, sit: 0, gait: 0, bark: 0, holding: false };
    const mehar = child(bank.mehar);
    const boy = child(bank.boy);
    const state = { dog, children: { mehar, boy }, canal: true, reflection: 1, disturbance: 0,
      ringAge: Infinity, splash: 0, bread: null, hand: 0, handoff: 0 };

    function showChildren() {
      mehar.visible = boy.visible = true;
    }

    switch (scene.id) {
      case 'courtyard': {
        state.canal = false;
        state.reflection = 0;
        showChildren();
        for (const [id, actor] of Object.entries(state.children)) {
          Object.assign(actor, courtyard[id], { seated: true });
        }
        dog.facing = -1;
        dog.angle = 0;
        const seated = point(672, 617);
        moveTo(dog, ms, cue.dog - 390, cue.sit + 280, point(921, 600), seated, motion);
        dog.sit = action(ms, cue.sit - 90, cue.sit + 480, cue.offer - 660, cue.offer - 285);
        if (ms >= cue.offer - 670) {
          moveTo(dog, ms, cue.offer - 670, cue.offer - 45, seated, courtyard.dog, motion);
        }
        state.hand = action(ms, cue.offer - 1280, cue.offer - 160, cue.offer + 80, cue.offer + 530);
        state.handoff = action(ms, cue.offer - 250, cue.offer - 20, cue.offer + 110, cue.offer + 430);
        mehar.grips[1] = { target: offer, weight: state.hand, hand: 'pinch' };
        dog.holding = ms >= cue.offer;
        if (!dog.holding) state.bread = { ...offer, visible: 1, held: true };
        break;
      }
      case 'canal':
        dog.holding = true;
        dog.angle = -3;
        moveTo(dog, ms, 240, cue.water + 430, point(293, 467), bank.dog, motion);
        state.reflection = .93 * motion(phase(ms, cue.water - 550, cue.water + 500));
        break;
      case 'another-dog':
        dog.holding = true;
        dog.angle = mix(-3, lookDown, motion(phase(ms, cue.lean - 220, cue.lean + 650)));
        break;
      case 'splash': {
        dog.holding = ms < cue.release;
        dog.bark = action(ms, cue.bark - 15, cue.release, cue.release + 100, cue.release + 330);
        if (ms >= cue.release) {
          const air = phase(ms, cue.release, cue.splash);
          const next = phase(ms, cue.splash, scene.duration);
          const anchor = mouth(dog);
          state.bread = {
            ...point(mix(anchor.x, waterContact.x, air) + 82 * next,
              mix(anchor.y, waterContact.y, air * air) + 23 * next, anchor.angle + 54 * air - 20 * next), visible: 1
          };
        }
        const afterImpact = phase(ms, cue.splash, scene.duration);
        state.ringAge = ms < cue.splash ? -1 : afterImpact * 840;
        state.splash = action(ms, cue.splash, cue.splash + 80, cue.splash + 120, cue.splash + 390);
        state.disturbance = phase(ms, cue.splash, cue.splash + 130) * (1 - .34 * ease(afterImpact));
        break;
      }
      case 'still-water': {
        const settle = motion(phase(ms, cue.settle - 1290, cue.settle + 180));
        state.disturbance = .66 * (1 - settle);
        state.ringAge = mix(840, 3400, phase(ms, 0, cue.settle + 180));
        const float = phase(ms, 0, Math.max(cue.settle, 1750));
        state.bread = { ...point(waterContact.x + mix(82, 373, float), waterContact.y + mix(23, 54, float), 49),
          visible: 1 - ease(phase(float, .76, 1)) };
        dog.angle = lookDown - 5 * settle;
        break;
      }
      case 'realization': {
        showChildren();
        moveTo(boy, ms, 100, cue.arrive + 390, point(135, 475), bank.boy, motion);
        moveTo(mehar, ms, 460, cue.arrive + 520, point(283, 448), bank.mehar, motion);
        const tilt = action(ms, cue.tilt - 190, cue.tilt + 610, cue.explain.start - 650, cue.explain.start - 40);
        dog.angle = 22 + 16 * (still ? Math.round(tilt) : tilt);
        boy.grips[1] = { target: point(boy.x + 64, boy.y - 131),
          weight: .62 * action(ms, cue.explain.start, cue.explain.start + 490, cue.explain.end - 310, cue.explain.end + 150),
          hand: 'relaxed' };
        break;
      }
      case 'homeward':
        showChildren();
        dog.angle = 22 * action(ms, cue.glance - 1270, cue.glance - 700, cue.glance + 210, cue.leave + 180);
        mehar.mirror = boy.mirror = ms >= cue.leave - 100;
        dog.facing = ms >= cue.leave + 220 ? -1 : 1;
        moveTo(boy, ms, cue.leave - 100, scene.duration - 290, bank.boy, point(97, 484), motion);
        moveTo(mehar, ms, cue.leave + 50, scene.duration - 225, bank.mehar, point(241, 477), motion);
        moveTo(dog, ms, cue.leave + 230, scene.duration - 165, bank.dog, point(409, 456), motion);
        state.reflection = 1 - ease(phase(ms, cue.leave - 160, cue.leave + 1620));
        break;
    }
    return state;
  }

  class CanalStage {
    constructor(svg) {
      this.svg = svg;
      this.camera = new window.UmtoCamera.DeliveryCamera(svg);
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.parts = Object.fromEntries([...svg.querySelectorAll('[id]')].map(node => [node.id, node]));
      const shadow = this.parts['dog-shadow'];
      shadow.setAttribute('rx', String(Number(shadow.getAttribute('rx')) * dogScale));
      shadow.setAttribute('ry', String(Number(shadow.getAttribute('ry')) * dogScale));
      this.puppets = Object.fromEntries(Object.entries(cast).map(([id, spec]) =>
        [id, new Character(studio, svg, this.parts[id], this.parts[id + '-props'], spec)]));
    }

    select(scene) {
      this.scene = scene;
      this.cue = cuesFor(scene);
      this.lastShot = '';
    }

    frame(ms, line, state, still) {
      const { id, framing, focus } = this.scene;
      const cue = this.cue;
      const shotAt = (preset, x, y, width, motion = 'static') =>
        ({ preset, focus: point(x, y), width, motion, parallax: motion === 'tracking' });
      let shot = { preset: framing, focus };
      if (id === 'courtyard' && line.speaker === 'mehar') {
        shot = shotAt('two-shot', 493, 511, 814);
      } else if (id === 'canal' && ms < cue.water + 420 && !still) {
        shot = shotAt('full', Math.round(state.dog.x + 113), 407, 1060, 'tracking');
      } else if (id === 'canal') {
        shot = shotAt('wide', 640, 367, 1280);
      } else if (id === 'another-dog') {
        shot = shotAt('two-shot', 651, 485, 789);
      } else if (id === 'splash' && ms < cue.release - 200) {
        shot = shotAt('two-shot', 651, 470, 825);
      } else if (id === 'splash') {
        shot = shotAt('detail', 677, 483, 775);
      } else if (id === 'still-water') {
        shot = shotAt('two-shot', 718, 486, 852);
      } else if (id === 'realization' && line.speaker === 'boy') {
        shot = shotAt('two-shot', 463, 364, 890);
      } else if (id === 'realization') {
        shot = shotAt('full', 542, 435, 1070);
      } else if (id === 'homeward' && line.speaker === 'mehar') {
        shot = shotAt('two-shot', 456, 362, 875);
      }
      const key = [shot.preset, shot.focus.x, shot.focus.y, shot.width, shot.motion].join('/');
      if (key !== this.lastShot) {
        this.camera.cue({ ...shot, cut: true });
        this.lastShot = key;
      }
    }

    paintChildren(state, ms, line, word, still) {
      const reading = voiceFrame(line, word, ms);
      const p = this.parts;
      for (const [id, puppet] of Object.entries(this.puppets)) {
        const pose = state.children[id];
        const plane = p[id + '-plane'];
        plane.setAttribute('visibility', pose.visible ? 'visible' : 'hidden');
        transform(plane, pose.mirror ? 'translate(' + (2 * pose.x) + ' 0) scale(-1 1)' : '');
        const shadow = p[id + '-shadow'];
        opacity(shadow, Number(pose.visible && !pose.seated));
        shadow.setAttribute('cx', pose.x);
        shadow.setAttribute('cy', pose.y + 1);
        if (pose.visible) {
          puppet.paint(pose, ms, line.speaker === id ? reading : null, still);
          for (const leg of p[id].querySelectorAll('[data-rig-leg]')) {
            const hip = leg.querySelector('[data-rig-hip]');
            const direction = Number(leg.dataset.rigLeg) * puppet.facing;
            if (pose.seated) transform(hip, 'matrix(1 0 ' + .29 * direction + ' .54 0 0)');
            else hip.removeAttribute('transform');
          }
        } else {
          p[id].dataset.speaking = 'false';
        }
      }
      if (state.hand > 0 || state.bread?.held) {
        const hand = this.puppets.mehar.arms[1].querySelector('[data-action-hand]');
        const palm = new DOMPoint(0, Number(hand.dataset.gripY)).matrixTransform(hand.getScreenCTM())
          .matrixTransform(this.svg.getScreenCTM().inverse());
        if (state.bread?.held) Object.assign(state.bread, { x: palm.x, y: palm.y });
        if (state.handoff > 0) {
          const muzzle = mouth(state.dog);
          state.dog.x += (palm.x - muzzle.x) * state.handoff;
          state.dog.y += (palm.y - muzzle.y) * state.handoff;
        }
      }
    }

    paintDog(dog, ms, still) {
      const p = this.parts;
      const stride = still ? 0 : 24 * dog.gait;
      const bounce = Math.abs(stride) * .12 * dogScale;
      transform(p.sheru, 'translate(' + dog.x + ' ' + (dog.y - bounce) + ') scale(' + (dog.facing * dogScale) + ' ' + dogScale + ')');
      transform(p['dog-head'], 'translate(42 -108) rotate(' + dog.angle + ')');
      transform(p['dog-tail'], 'rotate(' + ((still ? 0 : 7 * Math.sin(ms / 163)) - dog.sit * 16) + ' -82 -80)');
      transform(p['dog-body'], 'rotate(' + (-18 * dog.sit) + ' 43 -91)');
      transform(p['dog-front-far'], 'rotate(' + stride + ' 29 -80)');
      transform(p['dog-front-near'], 'rotate(' + (-stride) + ' 56 -82)');
      transform(p['dog-rear-far'], 'rotate(' + (-stride * .8) + ' -55 -72)');
      transform(p['dog-rear-near'], 'rotate(' + (stride * .85) + ' -70 -78)');
      for (const id of ['dog-rear-far', 'dog-rear-near']) opacity(p[id], 1 - dog.sit);
      opacity(p['dog-sit'], dog.sit);
      const blink = !still && (ms + 970) % 4280 > 4140;
      opacity(p['dog-eye'], blink ? 0 : 1);
      opacity(p['dog-eye-glint'], blink ? 0 : 1);
      opacity(p['dog-lid'], blink ? 1 : 0);
      opacity(p['dog-bread'], Number(dog.holding));
      opacity(p['dog-open-mouth'], dog.bark);
      transform(p['dog-jaw'], 'rotate(' + (26 * dog.bark) + ' 53 23)');
      p['dog-shadow'].setAttribute('cx', dog.x - 14 * dog.facing);
      p['dog-shadow'].setAttribute('cy', dog.y + 4);
      p.sheru.dataset.holding = String(dog.holding);
      p.sheru.dataset.barking = String(dog.bark > .45);
      p.sheru.dataset.walking = String(!still && dog.walk != null);
    }

    paintWater(state, ms, still) {
      const p = this.parts;
      opacity(p['courtyard-art'], Number(!state.canal));
      opacity(p.charpai, Number(!state.canal));
      opacity(p['canal-art'], Number(state.canal));
      opacity(p.reflection, .63 * state.reflection * (1 - .57 * state.disturbance));
      p['reflection-shear'].setAttribute('scale', String(1.5 + state.disturbance * 32));
      p['reflection-softness'].setAttribute('stdDeviation', String(.45 + state.disturbance * 2.3));
      transform(p['surface-glints'], 'translate(' + (still ? 0 : 11 * Math.sin((this.scene.episodeStart + ms) / 2580)) + ' 0)');
      const bread = state.bread;
      opacity(p['free-bread'], bread?.visible ?? 0);
      if (bread) transform(p['free-bread'], 'translate(' + bread.x + ' ' + bread.y + ') rotate(' + bread.angle + ') scale(' + breadScale + ')');
      opacity(p['splash-drops'], state.splash);
      transform(p['splash-drops'], 'translate(' + waterContact.x + ' ' + waterContact.y + ') scale(' + mix(.55, 1, state.splash) + ')');
      ['ring-one', 'ring-two', 'ring-three'].forEach((id, index) => {
        const life = phase(state.ringAge, index * 210, 2480 + index * 440);
        const size = mix(.12, 1.54, still ? Math.round(life * 2) / 2 : life);
        const strength = .76 * action(state.ringAge, index * 210, index * 210 + 240, 1330 + index * 220, 2410 + index * 440);
        transform(p[id], 'translate(' + waterContact.x + ' ' + waterContact.y + ') scale(' + size + ')');
        opacity(p[id], strength);
      });
      this.svg.dataset.water = state.disturbance > .2 ? 'rippling' : 'still';
      this.svg.dataset.bread = state.dog.holding ? 'carried' : bread?.visible > .05 ? bread.held ? 'offered' : 'loose' : 'gone';
    }

    draw(ms, line, word) {
      const still = this.reduced.matches;
      const state = makeFrame(this.scene, this.cue, ms, still);
      this.frame(ms, line, state, still);
      this.paintChildren(state, ms, line, word, still);
      this.paintDog(state.dog, ms, still);
      this.paintWater(state, ms, still);
    }
  }

  async function prepare() {
    studio = await open(document.getElementById('dog-studio'));
  }

  window.LittlePanthStage = { Stage: CanalStage, eventsFor, prepare };
})();
