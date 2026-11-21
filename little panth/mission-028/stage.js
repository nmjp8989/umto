(() => {
  'use strict';

  const { open, Character } = window.UmtoNativeCharacterPlayer;
  const point = (x, y) => ({ x, y });
  const offset = (p, x, y) => point(p.x + x, p.y + y);
  const mix = (a, b, t) => a + (b - a) * t;
  const between = (a, b, t) => point(mix(a.x, b.x, t), mix(a.y, b.y, t));
  const phase = (ms, from, to) => Math.max(0, Math.min(1, (ms - from) / Math.max(1, to - from)));
  const ease = t => t * t * (3 - 2 * t);
  const opacity = (node, value) => node.setAttribute('opacity', String(Number(value)));
  const translate = ({ x, y }) => 'translate(' + x + ' ' + y + ')';
  const transform = (node, value) => node.setAttribute('transform', value);
  const radians = angle => angle * Math.PI / 180;
  const mehar = { preset: 'kid-meher', view: 'right', height: 218, serial: 651, hipHinge: true, fluidArms: true };
  const sidak = { preset: 'kid-sidak', view: 'right', height: 207, serial: 652, hipHinge: true, fluidArms: true };
  const launchMehar = point(345, 632);
  const launchSidak = point(475, 638);
  const leafMehar = point(441, 640);
  const leafSidak = point(554, 644);
  const launch = point(419, 551);
  const leafInWater = point(681, 548);
  const leafOnBank = point(664, 580);
  const boatGrip = point(-7, -15);
  const bow = point(34, -11);
  const leafStem = point(-20, 0);
  const leafRest = point(0, 3);
  const twigEnd = point(74, -4);
  const twigAtRest = { grip: point(594, 574), angle: 8 };
  const pinch = point(-30, 84);
  const handWidth = .78;
  const pinchAnchor = point(pinch.x * handWidth, pinch.y);
  const stream = [
    launch, point(513, 548), point(627, 559), point(786, 560),
    point(838, 548), point(906, 526), point(957, 532), point(1032, 553),
    point(1103, 541), point(1188, 529), point(1320, 505)
  ];
  let studio;

  function wordAt(scene, id, word) {
    const line = scene.lines.find(entry => entry.id === id);
    const index = line.reading.words.findIndex(text => text.replace(/\p{P}/gu, '') === word);
    if (index < 0) throw Error('Missing "' + word + '" in ' + id);
    return line.start + (line.reading.timings[index]?.[0] ?? line.duration / 2);
  }

  function cuesFor(scene) {
    const at = (id, word) => wordAt(scene, id, word);
    switch (scene.id) {
      case 'after-the-rain': return { arrive: at('rain-stops', 'ਆਈ') };
      case 'launch-the-boat': return { bend: at('boat-goes-in', 'ਝੁਕ'), set: at('boat-goes-in', 'ਰੱਖੀ'),
        release: at('boat-goes-in', 'ਛੱਡ') };
      case 'yellow-leaf': return { leaf: at('boat-gets-stuck', 'ਪੀਲਾ'), hit: at('boat-gets-stuck', 'ਟਕਰਾਈ') };
      case 'lift-the-leaf': return { point: at('sidak-spots-the-leaf', 'ਰੋਕ'), pick: at('sidak-clears-the-leaf', 'ਚੁੱਕੀ'),
        hook: at('sidak-clears-the-leaf', 'ਲਾਇਆ'), lift: at('sidak-clears-the-leaf', 'ਚੁੱਕ'),
        setDown: at('sidak-clears-the-leaf', 'ਰੱਖ') };
      case 'under-the-bridge': return { shadow: at('through-the-arch', 'ਛਾਂ'), hide: at('through-the-arch', 'ਗਾਇਬ'),
        emerge: at('through-the-arch', 'ਨਿਕਲ') };
      case 'around-the-bend': return { walk: at('the-boat-sails-away', 'ਤੁਰੇ'), bend: at('the-boat-sails-away', 'ਮੋੜ'),
        wave: at('the-boat-sails-away', 'ਹਿਲਾ'), exit: at('the-boat-sails-away', 'ਅਲਵਿਦਾ') };
      default: return {};
    }
  }

  function eventsFor(scene) {
    const c = cuesFor(scene);
    const cue = (ms, sound) => ({ ms: Math.max(0, ms), sound });
    switch (scene.id) {
      case 'after-the-rain': return [cue(c.arrive - 1550, 'step'), cue(c.arrive - 1000, 'step'), cue(c.arrive - 450, 'step')];
      case 'launch-the-boat': return [cue(c.set + 40, 'sip'), cue(c.release + 280, 'sip')];
      case 'yellow-leaf': return [cue(c.hit, 'twig')];
      case 'lift-the-leaf': return [cue(c.pick, 'twig'), cue(c.lift + 190, 'sip'), cue(c.setDown, 'ribbon')];
      case 'under-the-bridge': return [cue(c.shadow, 'sip'), cue(c.emerge - 100, 'sip')];
      case 'around-the-bend': return [cue(c.walk - 420, 'step'), cue(c.walk + 160, 'step'), cue(c.walk + 750, 'step')];
      default: return [];
    }
  }

  function rotate(p, angle) {
    const a = radians(angle);
    return point(p.x * Math.cos(a) - p.y * Math.sin(a), p.x * Math.sin(a) + p.y * Math.cos(a));
  }

  function align(anchor, target, angle) {
    const local = rotate(anchor, angle);
    return offset(target, -local.x, -local.y);
  }

  function onWater(x) {
    const next = stream.findIndex(p => p.x >= x);
    if (next <= 0) return point(x, x <= launch.x ? launch.y : stream.at(-1).y);
    const a = stream[next - 1];
    const b = stream[next];
    return point(x, mix(a.y, b.y, ease(phase(x, a.x, b.x))));
  }

  function walk(actor, from, to, ms, start, end) {
    const t = ease(phase(ms, start, end));
    Object.assign(actor, between(from, to, t));
    if (t > 0 && t < 1) actor.walk = (ms - start) / 1000;
  }

  function touch(actor, target, weight = 1, hand = 'pinch', anchor = pinchAnchor, wrist = 0) {
    actor.grips[1] = { target, weight, hand, anchor, wrist };
  }

  function placeTwig(tip, angle) {
    return { grip: align(twigEnd, tip, angle), angle };
  }

  function frameFor(scene, c, ms, still) {
    const move = (from, to) => ease(phase(ms, from, to));
    const pulse = (a, b, d, e) => move(a, b) * (1 - move(d, e));
    const girl = { ...launchMehar, lean: 0, bend: 0, gazeY: 56, grips: [], quietHands: true };
    const boy = { ...launchSidak, lean: 0, bend: 0, gazeY: 52, grips: [], quietHands: true };
    const frame = {
      girl, boy, boat: launch, held: false, bowOnLeaf: false, floating: false, groundedLeaf: false,
      leaf: leafInWater, leafAngle: 0, leafOnTwig: false, twig: twigAtRest, holdsTwig: false, wake: 0, ring: 0
    };
    const drift = x => {
      frame.boat = onWater(x);
      frame.floating = true;
      frame.wake = .81;
    };
    const grounded = () => {
      frame.leaf = leafOnBank;
      frame.leafAngle = -19;
      frame.groundedLeaf = true;
      frame.twig = placeTwig(offset(leafOnBank, 0, 10), 13);
    };
    const carryBoat = () => offset(girl, 58, -102);

    switch (scene.id) {
      case 'after-the-rain':
        walk(girl, point(170, 619), launchMehar, ms, c.arrive - 2480, c.arrive + 140);
        walk(boy, point(288, 632), launchSidak, ms, c.arrive - 2280, c.arrive + 365);
        touch(girl, carryBoat());
        frame.held = true;
        girl.gazeY = 26;
        boy.gazeY = 19;
        break;
      case 'launch-the-boat': {
        const lowering = move(c.bend - 200, c.set - 10);
        const withdraw = move(c.release + 45, c.release + 1150);
        const launchGrip = offset(launch, boatGrip.x, boatGrip.y);
        const lean = move(c.bend - 405, c.set - 180) * (1 - move(c.release + 265, c.release + 1420));
        girl.bend = 23 * lean;
        const arc = Math.sin(lowering * Math.PI);
        const reach = offset(between(carryBoat(), launchGrip, lowering), 5 * arc, -7 * arc);
        touch(girl, reach, 1 - withdraw, ms > c.release + 40 ? 'open' : 'pinch', pinchAnchor, mix(8, -9, lowering));
        frame.held = ms <= c.release;
        if (!frame.held) {
          drift(mix(launch.x, 513, move(c.release, scene.duration)));
          frame.wake *= move(c.release, c.release + 900);
        }
        if (ms >= c.set) frame.ring = 1 - phase(ms, c.set, c.set + 765);
        break;
      }
      case 'yellow-leaf':
        walk(girl, launchMehar, leafMehar, ms, c.leaf - 1380, c.hit - 350);
        walk(boy, launchSidak, leafSidak, ms, c.leaf - 1070, c.hit - 230);
        drift(mix(513, 627, move(c.leaf + 70, c.hit)));
        frame.bowOnLeaf = ms >= c.hit;
        if (frame.bowOnLeaf) frame.wake = .22 + .24 * (1 - phase(ms, c.hit, c.hit + 860));
        girl.bend = 9 * pulse(c.hit - 715, c.hit + 110, c.hit + 1380, c.hit + 2190);
        break;
      case 'lift-the-leaf': {
        Object.assign(girl, leafMehar);
        Object.assign(boy, leafSidak);
        const pointToLeaf = pulse(c.point - 470, c.point + 290, c.point + 1420, c.point + 1990);
        if (pointToLeaf > 0) touch(boy, point(622, 521), pointToLeaf * .98, 'point', point(-47 * handWidth, 146));
        const take = pulse(c.pick - 780, c.pick - 20, c.setDown + 240, c.setDown + 690);
        const hook = move(c.pick + 190, c.hook);
        const lift = move(c.lift, c.setDown + 40);
        const lower = move(c.setDown + 95, c.setDown + 305);
        boy.bend = take * (28 - 8 * Math.sin(Math.PI * lift));
        const groundOffset = rotate(twigEnd, twigAtRest.angle);
        const tipFromGround = offset(twigAtRest.grip, groundOffset.x, groundOffset.y);
        const underLeaf = offset(leafInWater, leafRest.x, leafRest.y);
        const hookTip = offset(between(tipFromGround, underLeaf, hook), 0, -12 * Math.sin(hook * Math.PI));
        const raisedTip = offset(between(hookTip, offset(leafOnBank, leafRest.x, leafRest.y), lift), 0, -27 * Math.sin(lift * Math.PI) + 7 * lower);
        frame.twig = placeTwig(raisedTip, mix(mix(twigAtRest.angle, -18, hook), 13, lift));
        frame.holdsTwig = ms >= c.pick && ms <= c.setDown + 310;
        if (take > 0) touch(boy, frame.twig.grip, take, 'pinch', pinchAnchor, mix(9, -13, hook * (1 - lift)));
        frame.leaf = between(leafInWater, leafOnBank, lift);
        frame.leafAngle = -19 * lift - 10 * Math.sin(lift * Math.PI);
        frame.leafOnTwig = ms >= c.lift && ms < c.setDown + 40;
        frame.groundedLeaf = ms >= c.setDown + 40;
        drift(mix(627, 786, move(c.lift + 330, scene.duration)));
        frame.bowOnLeaf = ms < c.lift + 200;
        if (frame.bowOnLeaf) frame.wake = .23;
        break;
      }
      case 'under-the-bridge': {
        grounded();
        Object.assign(girl, leafMehar);
        Object.assign(boy, leafSidak);
        const entry = move(c.shadow - 1760, c.hide + 30);
        const tunnel = phase(ms, c.hide + 30, c.emerge - 430);
        const outlet = move(c.emerge - 430, scene.duration - 180);
        const x = ms < c.hide + 30 ? mix(786, 906, entry)
          : ms < c.emerge - 430 ? mix(906, 969, tunnel)
            : mix(969, 1103, outlet);
        drift(x);
        break;
      }
      case 'around-the-bend': {
        grounded();
        walk(girl, leafMehar, point(614, 655), ms, c.walk - 1160, c.bend + 690);
        walk(boy, leafSidak, point(741, 654), ms, c.walk - 1100, c.bend + 410);
        const corner = move(c.walk - 640, c.bend + 340);
        const outOfSight = phase(ms, c.bend + 340, c.exit + 1140);
        drift(ms < c.bend + 340 ? mix(1103, 1182, corner) : mix(1182, 1320, outOfSight));
        const wave = pulse(c.wave - 450, c.wave + 155, c.exit + 400, c.exit + 1090);
        const arc = still ? 0 : Math.sin((ms - c.wave) / 141);
        if (wave > 0) touch(girl, offset(girl, 56 + arc * 4.5, -151), wave, 'wave', point(0, 105), arc * 18);
        girl.gazeY = 32 * (1 - wave);
        boy.gazeY = 33;
        break;
      }
    }
    return frame;
  }

  class PaperBoatStage {
    constructor(svg) {
      this.svg = svg;
      this.camera = new window.UmtoCamera.DeliveryCamera(svg);
      this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
      this.parts = Object.fromEntries([...svg.querySelectorAll('[id]')].map(node => [node.id, node]));
      this.mehar = new Character(studio, svg, this.parts.mehar, this.parts['mehar-props'], mehar);
      this.sidak = new Character(studio, svg, this.parts.sidak, this.parts['sidak-props'], sidak);
    }

    select(scene) {
      this.scene = scene;
      this.cue = cuesFor(scene);
      this.shot = '';
    }

    frameCamera(ms, line, frame, still) {
      const { id, framing, focus } = this.scene;
      const c = this.cue;
      const shotAt = (preset, x, y, width, track = false) => ({
        preset, focus: point(x, y), width, motion: track && !still ? 'tracking' : 'static',
        parallax: track && !still
      });
      let shot = { preset: framing, focus };
      if (id === 'after-the-rain') {
        shot = shotAt('establishing', 618, 370, 1210);
      } else if (id === 'launch-the-boat') {
        shot = ms < c.bend - 230 ? shotAt('two-shot', 434, 484, 755) : shotAt('medium', 450, 510, 635);
      } else if (id === 'yellow-leaf') {
        shot = line.speaker === 'mehar' ? shotAt('medium', 552, 503, 622)
          : shotAt('detail', ms >= c.leaf - 430 ? 634 : 571, 523, 610);
      } else if (id === 'lift-the-leaf') {
        shot = ms > c.pick - 315 && ms < c.setDown + 620 ? shotAt('detail', 617, 518, 540)
          : shotAt('two-shot', 560, 490, 710);
      } else if (id === 'under-the-bridge') {
        const x = still ? 937 : Math.round(mix(899, 979, phase(frame.boat.x, 786, 1103)));
        shot = shotAt('detail', x, 522, 528, !still);
      } else if (id === 'around-the-bend') {
        shot = ms < c.walk - 1250 ? shotAt('two-shot', 541, 493, 722) : shotAt('wide', 743, 391, 1130);
      }
      const key = [shot.preset, shot.focus.x, shot.focus.y, shot.width, shot.motion].join('/');
      if (this.shot !== key) {
        this.camera.cue({ ...shot, cut: true });
        this.shot = key;
      }
      this.svg.dataset.shot = id === 'under-the-bridge' ? 'bridge' : shot.preset;
    }

    hand(id) {
      const hand = this.parts[id].querySelector('[data-hand="' + id + '-right"]');
      const world = new DOMPoint(pinch.x, pinch.y).matrixTransform(hand.getScreenCTM())
        .matrixTransform(this.svg.getScreenCTM().inverse());
      return point(world.x, world.y);
    }

    paintProps(frame, ms, still) {
      const p = this.parts;
      const { twig, boat, leafAngle } = frame;
      const twigGrip = frame.holdsTwig ? this.hand('sidak') : twig.grip;
      const tipOffset = rotate(twigEnd, twig.angle);
      const twigTip = offset(twigGrip, tipOffset.x, tipOffset.y);
      transform(p['leaf-twig'], translate(twigGrip) + ' rotate(' + twig.angle + ')');
      p['leaf-twig'].dataset.held = String(frame.holdsTwig);
      const leaf = frame.leafOnTwig ? align(leafRest, twigTip, leafAngle) : frame.leaf;
      transform(p['yellow-leaf'], translate(leaf) + ' rotate(' + leafAngle + ')');
      p['yellow-leaf'].dataset.state = frame.groundedLeaf ? 'bank' : frame.leafOnTwig ? 'lifting' : 'in-water';

      const bob = still || !frame.floating ? 0 : .9 * Math.sin(ms / 275);
      const pitch = still ? 0 : frame.held ? -7 : frame.bowOnLeaf ? Math.sin(ms / 219) * 4.5 : Math.sin(ms / 375) * 2.8;
      let position = offset(boat, 0, bob);
      if (frame.held) {
        const lowering = this.scene.id === 'launch-the-boat' ? ease(phase(ms, this.cue.bend - 200, this.cue.set - 10)) : 0;
        const heldAngle = pitch * (1 - lowering);
        position = align(boatGrip, this.hand('mehar'), heldAngle);
        transform(p['paper-boat'], translate(position) + ' rotate(' + heldAngle + ')');
      } else {
        if (frame.bowOnLeaf) position = align(bow, offset(leafInWater, leafStem.x, leafStem.y), pitch);
        transform(p['paper-boat'], translate(position) + ' rotate(' + pitch + ')');
      }
      p['paper-boat'].dataset.state = frame.held ? 'held' : frame.bowOnLeaf ? 'stuck' : 'afloat';
      transform(p['boat-wake'], translate(position));
      opacity(p['boat-wake'], frame.wake * (still ? .63 : 1));
      const ringSize = 1 + (1 - frame.ring) * 1.36;
      transform(p['launch-ripple'], translate(launch) + ' scale(' + ringSize + ')');
      opacity(p['launch-ripple'], frame.ring * (still ? .42 : .77));
      const flow = still ? .5 : (ms / 2860) % 1;
      transform(p['water-streaks'], 'translate(' + (flow * 46) + ' 0)');
      opacity(p['water-streaks'], .58 * Math.sin(Math.PI * flow));
    }

    draw(ms, line, word) {
      const still = this.reduced.matches;
      const frame = frameFor(this.scene, this.cue, ms, still);
      this.frameCamera(ms, line, frame, still);
      const mouth = word >= 0 ? { text: line.reading.words[word],
        phase: phase(ms - line.start, ...line.reading.timings[word]) } : null;
      this.mehar.paint(frame.girl, ms, line.speaker === 'mehar' ? mouth : null, still);
      this.sidak.paint(frame.boy, ms, line.speaker === 'friend' ? mouth : null, still);
      transform(this.parts['mehar-ground-shadow'], translate(frame.girl));
      transform(this.parts['sidak-ground-shadow'], translate(frame.boy));
      this.paintProps(frame, ms, still);
    }
  }

  async function prepare() {
    studio = await open(document.getElementById('paper-boat-studio'));
  }

  window.LittlePanthStage = { Stage: PaperBoatStage, eventsFor, prepare };
})();
