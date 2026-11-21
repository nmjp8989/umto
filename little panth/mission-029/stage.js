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
  const transform = (node, value) => node.setAttribute('transform', value);
  const translate = ({ x, y }) => 'translate(' + x + ' ' + y + ')';
  const sidak = { preset: 'kid-sidak', view: 'right', height: 208, serial: 671, hipHinge: true };
  const elder = { preset: 'elder-bibi-ji', view: 'right', height: 287, serial: 672 };
  const dogScale = .53;
  const headJoint = point(42, -108);
  const muzzle = point(81, 20);
  const boyHome = point(520, 640);
  const boyAtStool = point(625, 641);
  const bibiHome = point(331, 640);
  const dogNook = point(891, 614);
  const dogReveal = point(752, 615);
  const alertHead = -22;
  const ballOnStool = point(597, 554);
  const ballRelease = point(596, 575);
  const ballFar = point(1042, 618);
  const ballNear = point(662, 628);
  const shoeStool = point(674, 579);
  const shoePair = point(563, 552);
  const ballGrip = point(-7, -8);
  const shoeGrip = point(-13, -13);
  const shoeTilt = -19;
  const pinch = point(-30, 84);
  const pinchAnchor = point(pinch.x * .78, pinch.y);
  const indexAnchor = point(-47 * .78, 146);
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
      case 'only-one-jutti': return { spot: at('fair-day', 'ਇੱਕ'), ask: at('sidak-asks', 'ਕਿੱਥੇ') };
      case 'listen-under-the-charpai': return { rustle: at('hear-a-rustle', 'ਖੜਖੜਾਹਟ'), bend: at('hear-a-rustle', 'ਝੁਕ'),
        tail: at('bibi-sees-the-tail', 'ਪੂਛ') };
      case 'moti-has-the-jutti': return { out: at('moti-comes-out', 'ਨਿਕਲਿਆ'), wag: at('moti-comes-out', 'ਹਿਲਾਈ'),
        offer: at('sidak-offers-the-ball', 'ਗੇਂਦ') };
      case 'roll-the-ball': return { pick: at('moti-chases', 'ਚੁੱਕੀ'), roll: at('moti-chases', 'ਰੋੜ੍ਹ'),
        drop: at('moti-chases', 'ਛੱਡੀ'), chase: at('moti-chases', 'ਭੱਜਿਆ') };
      case 'the-pair-is-together': return { pick: at('sidak-finds-the-pair', 'ਚੁੱਕ'), set: at('sidak-finds-the-pair', 'ਰੱਖ') };
      case 'one-more-game': return { back: at('puppy-comes-back', 'ਆਇਆ'), laugh: at('puppy-comes-back', 'ਹੱਸ'),
        play: at('puppy-comes-back', 'ਖੇਡਿਆ') };
      default: return {};
    }
  }

  function eventsFor(scene) {
    const c = cuesFor(scene);
    const cue = (ms, sound) => ({ ms: Math.max(0, ms), sound });
    switch (scene.id) {
      case 'only-one-jutti': return [cue(c.spot - 890, 'step'), cue(c.spot - 365, 'step')];
      case 'listen-under-the-charpai': return [cue(c.rustle, 'ribbon'), cue(c.rustle + 290, 'ribbon')];
      case 'moti-has-the-jutti': return [cue(c.out - 600, 'step'), cue(c.out + 160, 'step')];
      case 'roll-the-ball': return [cue(c.roll + 297, 'plop'), cue(c.drop + 322, 'plop'), cue(c.drop + 470, 'bark'),
        cue(c.chase - 865, 'step'), cue(c.chase - 380, 'step'), cue(c.chase + 140, 'step')];
      case 'the-pair-is-together': return [cue(c.pick - 815, 'step'), cue(c.set + 158, 'ribbon')];
      case 'one-more-game': return [cue(c.back - 850, 'step'), cue(c.back - 450, 'step'), cue(c.play - 280, 'plop')];
      default: return [];
    }
  }

  function rotate(p, angle) {
    const a = angle * Math.PI / 180;
    return point(p.x * Math.cos(a) - p.y * Math.sin(a), p.x * Math.sin(a) + p.y * Math.cos(a));
  }

  function fromAnchor(anchor, target, angle, mirror = 1) {
    const vector = rotate(point(mirror * anchor.x, anchor.y), angle);
    return offset(target, -vector.x, -vector.y);
  }

  function atAnchor(anchor, center, angle, mirror = 1) {
    const vector = rotate(point(mirror * anchor.x, anchor.y), angle);
    return offset(center, vector.x, vector.y);
  }

  function person(home, gazeY = 0) {
    return { ...home, lean: 0, bend: 0, gazeY, quietHands: true, grips: [] };
  }

  function walk(actor, from, to, ms, start, end) {
    const t = ease(phase(ms, start, end));
    Object.assign(actor, between(from, to, t));
    if (t > 0 && t < 1) actor.walk = (ms - start) / 1000;
  }

  function grip(actor, target, weight = 1, hand = 'pinch', anchor = pinchAnchor) {
    actor.grips[1] = { target, weight, hand, anchor };
  }

  function puppy(base, look, changes = {}) {
    return { ...base, facing: -1, head: look, crouch: 0, swivel: 1, gait: 0, wag: .25,
      bark: 0, front: true, ...changes };
  }

  function mouthOffset(dog, still) {
    const head = rotate(muzzle, dog.head);
    const vertical = dogScale * (1 - .28 * dog.crouch);
    const horizontal = dog.facing * dogScale * dog.swivel;
    const bounce = still ? 0 : Math.abs(dog.gait) * 3.2;
    return point((headJoint.x + head.x) * horizontal, (headJoint.y + head.y) * vertical - bounce);
  }

  function dogMouth(dog, still) {
    const m = mouthOffset(dog, still);
    return offset(dog, m.x, m.y);
  }

  function placeMouth(dog, target) {
    const m = mouthOffset(dog, true);
    return { ...dog, x: target.x - m.x, y: target.y - m.y };
  }

  function trot(from, to, ms, start, end) {
    const t = ease(phase(ms, start, end));
    const pace = t > 0 && t < 1 ? Math.sin(t * Math.abs(to.x - from.x) / 10.9) : 0;
    return { ...between(from, to, t), gait: pace };
  }

  function frameFor(scene, c, ms, still) {
    const move = (from, to) => ease(phase(ms, from, to));
    const pulse = (a, b, d, e) => move(a, b) * (1 - move(d, e));
    const boy = person(boyHome, 56);
    const bibi = person(bibiHome, 29);
    const revealed = puppy(dogReveal, alertHead);
    const buried = puppy(dogNook, 8, { crouch: 1, wag: 0, front: false });
    const takenBall = (p, facing) => placeMouth(puppy(p, 21, { facing, wag: .73 }), offset(p, facing * -6, -3));
    const caught = takenBall(ballFar, 1);
    const frame = { boy, bibi, dog: buried, quilt: 0,
      shoe: { owner: 'dog', center: shoeStool, angle: shoeTilt },
      ball: { owner: 'stool', center: ballOnStool, angle: 0 } };
    const carryBall = (p = ballFar, facing = 1) => {
      frame.dog = takenBall(p, facing);
      frame.ball = { owner: 'dog', center: p, angle: 0 };
    };

    switch (scene.id) {
      case 'only-one-jutti':
        walk(boy, point(431, 628), boyHome, ms, c.spot - 1280, c.spot + 155);
        grip(boy, point(575, 557), pulse(c.ask - 760, c.ask - 10, c.ask + 365, c.ask + 1080), 'point', indexAnchor);
        break;
      case 'listen-under-the-charpai': {
        const listen = pulse(c.bend - 560, c.bend + 290, c.tail + 350, c.tail + 1260);
        const rustle = pulse(c.rustle - 30, c.rustle + 245, c.rustle + 680, c.rustle + 1125);
        const wag = pulse(c.tail - 380, c.tail + 210, c.tail + 970, c.tail + 1820);
        boy.bend = 33 * listen;
        boy.gazeY = 84 * listen;
        bibi.gazeY = 39 + 37 * wag;
        grip(bibi, point(422, 493), wag * .93, 'point', indexAnchor);
        frame.quilt = still ? 0 : rustle * 4.5 * Math.sin(ms / 89);
        frame.dog.wag = Math.max(rustle * .74, wag);
        break;
      }
      case 'moti-has-the-jutti': {
        const t = move(c.out - 1590, c.out + 390);
        const wag = pulse(c.wag - 480, c.wag + 220, c.wag + 1430, c.wag + 2110);
        const step = trot(dogNook, dogReveal, ms, c.out - 1590, c.out + 390);
        frame.dog = puppy(step, mix(8, alertHead, t), {
          crouch: 1 - t, front: t > .9, gait: step.gait * .69, wag: .31 + .69 * wag
        });
        frame.quilt = still ? 0 : Math.sin(t * Math.PI) * 5.5;
        boy.bend = 12 * pulse(c.offer - 510, c.offer + 110, c.offer + 550, c.offer + 1110);
        grip(boy, point(584, 550), pulse(c.offer - 390, c.offer + 170, c.offer + 530, c.offer + 1080), 'point', indexAnchor);
        break;
      }
      case 'roll-the-ball': {
        const catchAt = Math.max(c.chase + 160, scene.duration - 430);
        const forward = move(c.pick + 450, c.roll);
        const grab = pulse(c.pick - 430, c.pick - 25, c.roll + 50, c.roll + 710);
        const carried = offset(between(ballOnStool, ballRelease, forward), 0, -31 * Math.sin(forward * Math.PI));
        boy.bend = 32 * grab;
        grip(boy, offset(carried, ballGrip.x, ballGrip.y), grab);
        frame.ball.owner = ms < c.pick ? 'stool' : ms <= c.roll ? 'boy' : 'rolling';
        if (ms > c.roll) {
          const roll = move(c.roll, catchAt);
          const x = mix(ballRelease.x, ballFar.x, roll);
          const y = mix(ballRelease.y, ballFar.y, move(c.roll, c.roll + 365));
          frame.ball = { owner: 'rolling', center: point(x, y), angle: (x - ballRelease.x) * 3.5 };
        }

        const flip = move(c.drop + 165, c.drop + 735);
        const bark = pulse(c.drop + 385, c.drop + 482, c.drop + 570, c.drop + 765);
        const chase = trot(revealed, caught, ms, c.drop + 550, catchAt);
        frame.dog = puppy(chase, mix(alertHead, 21, flip), {
          facing: flip < .5 ? -1 : 1, swivel: 1 - .32 * Math.sin(Math.PI * flip),
          gait: chase.gait, wag: .63, bark
        });
        if (ms >= catchAt) {
          frame.dog = caught;
          frame.ball.owner = 'dog';
        }

        if (ms > c.drop) {
          const start = fromAnchor(shoeGrip, dogMouth(revealed, still), shoeTilt, -1);
          const fall = phase(ms, c.drop, c.drop + 322);
          frame.shoe = { owner: fall < 1 ? 'falling' : 'stool',
            center: between(start, shoeStool, fall ** 1.5), angle: mix(shoeTilt, 4, fall) };
        }
        break;
      }
      case 'the-pair-is-together': {
        carryBall(ballFar, -1);
        walk(boy, boyHome, boyAtStool, ms, 0, c.pick - 330);
        if (ms >= c.pick + 90) walk(boy, boyAtStool, boyHome, ms, c.pick + 90, c.set - 440);
        const transfer = move(c.pick + 140, c.set - 20);
        const hold = pulse(c.pick - 440, c.pick - 11, c.set + 104, c.set + 655);
        const firstGrip = atAnchor(shoeGrip, shoeStool, 4, -1);
        const pairGrip = atAnchor(shoeGrip, shoePair, -4, -1);
        boy.bend = hold * (28 + 10 * Math.sin(Math.PI * transfer));
        const target = offset(between(firstGrip, pairGrip, transfer), 0, -23 * Math.sin(transfer * Math.PI));
        grip(boy, target, hold);
        frame.shoe = ms < c.pick ? { owner: 'stool', center: shoeStool, angle: 4 }
          : ms <= c.set + 100 ? { owner: 'boy', center: shoePair, angle: mix(4, -4, transfer) }
            : { owner: 'pair', center: shoePair, angle: -4 };
        bibi.gazeY = 25 + 43 * hold;
        break;
      }
      case 'one-more-game': {
        frame.shoe = { owner: 'pair', center: shoePair, angle: -4 };
        const setBall = c.play - 290;
        const pupAtDoor = takenBall(ballNear, -1);
        const starting = takenBall(ballFar, -1);
        const returning = trot(starting, pupAtDoor, ms, c.back - 1990, c.back + 460);
        const returnProgress = move(c.back - 1990, c.back + 460);
        frame.dog = puppy(returning, mix(21, 2, returnProgress), { wag: .89, gait: returning.gait * .78 });
        const headLow = move(setBall - 550, setBall);
        Object.assign(frame.dog, between(frame.dog, pupAtDoor, headLow));
        frame.dog.head = mix(frame.dog.head, 21, headLow);
        frame.ball = { owner: 'dog', center: ballNear, angle: 0 };
        if (ms >= setBall) {
          const nudge = move(setBall, c.play + 800);
          const x = mix(ballNear.x, ballNear.x - 58, nudge);
          frame.ball = { owner: 'rolling', center: point(x, ballNear.y), angle: (x - ballNear.x) * 3.5 };
          frame.dog = puppy(offset(pupAtDoor, -25 * nudge, 0), mix(21, -3, move(c.play + 120, c.play + 650)), { wag: 1 });
        }
        const laugh = pulse(c.laugh - 300, c.laugh + 100, c.laugh + 620, c.laugh + 1150);
        const play = pulse(c.play - 480, c.play + 165, c.play + 730, c.play + 1290);
        boy.bend = 7 * laugh + 22 * play;
        if (play > 0) grip(boy, point(576, 565), play, 'open', point(0, 75));
        break;
      }
    }
    return frame;
  }

  class MissingJuttiStage {
    constructor(svg) {
      this.svg = svg;
      this.camera = new window.UmtoCamera.DeliveryCamera(svg);
      this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
      this.parts = Object.fromEntries([...svg.querySelectorAll('[id]')].map(node => [node.id, node]));
      this.boy = new Character(studio, svg, this.parts.sidak, this.parts['sidak-props'], sidak);
      this.bibi = new Character(studio, svg, this.parts.bibi, this.parts['bibi-props'], elder);
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
      if (id === 'only-one-jutti' && line.speaker === 'friend') {
        shot = shotAt('two-shot', 471, 488, 771);
      } else if (id === 'listen-under-the-charpai') {
        shot = ms >= c.tail - 315 && ms < c.tail + 950 ? shotAt('detail', 884, 511, 530)
          : line.speaker === 'dadi' ? shotAt('two-shot', 462, 493, 796)
            : shotAt('medium', 674, 488, 1040);
      } else if (id === 'moti-has-the-jutti') {
        shot = line.speaker === 'friend' ? shotAt('two-shot', 608, 492, 729)
          : shotAt('detail', 793, 505, 620);
      } else if (id === 'roll-the-ball') {
        const x = still ? 804 : Math.round(mix(690, 938, phase(frame.ball.center.x, ballRelease.x, ballFar.x)));
        shot = ms < c.roll + 95 ? shotAt('detail', 603, 515, 585)
          : shotAt('detail', x, 522, 685, true);
      } else if (id === 'the-pair-is-together') {
        shot = line.speaker === 'dadi' ? shotAt('two-shot', 455, 478, 752)
          : shotAt('medium', 663, 515, 510);
      } else if (id === 'one-more-game') {
        shot = shotAt('wide', 682, 394, 1137);
      }
      const key = [shot.preset, shot.focus.x, shot.focus.y, shot.width, shot.motion].join('/');
      if (this.shot !== key) {
        this.camera.cue({ ...shot, cut: true });
        this.shot = key;
      }
      this.svg.dataset.shot = shot.preset;
    }

    hand() {
      const hand = this.parts.sidak.querySelector('[data-hand="sidak-right"]');
      const world = new DOMPoint(pinch.x, pinch.y).matrixTransform(hand.getScreenCTM())
        .matrixTransform(this.svg.getScreenCTM().inverse());
      return point(world.x, world.y);
    }

    paintPuppy(dog, ms, still) {
      const p = this.parts;
      const parent = p[dog.front ? 'puppy-front' : 'puppy-back'];
      if (p.moti.parentElement !== parent) parent.append(p.moti);
      const stride = still ? 0 : 28 * dog.gait;
      const y = dog.y - (still ? 0 : Math.abs(dog.gait) * 3.2);
      transform(p.moti, translate(point(dog.x, y)) + ' scale(' +
        (dogScale * dog.facing * dog.swivel) + ' ' + (dogScale * (1 - .28 * dog.crouch)) + ')');
      transform(p['dog-head'], 'translate(42 -108) rotate(' + dog.head + ')');
      const wag = still ? 0 : Math.sin(ms / 107) * (4 + 28 * dog.wag);
      transform(p['dog-tail'], 'rotate(' + (wag + dog.crouch * -12) + ' -82 -80)');
      transform(p['dog-ear'], 'rotate(' + (-stride * .38 + 9 * dog.bark) + ' -10 -39)');
      transform(p['dog-front-far'], 'rotate(' + stride + ' 29 -80)');
      transform(p['dog-front-near'], 'rotate(' + -stride + ' 56 -82)');
      transform(p['dog-rear-far'], 'rotate(' + (-stride * .8) + ' -55 -72)');
      transform(p['dog-rear-near'], 'rotate(' + (stride * .85) + ' -70 -78)');
      const blink = !still && (ms + 970) % 4200 > 4040;
      opacity(p['dog-eye'], !blink);
      opacity(p['dog-eye-glint'], !blink);
      opacity(p['dog-lid'], blink);
      opacity(p['dog-open-mouth'], dog.bark);
      transform(p['dog-jaw'], 'rotate(' + (23 * dog.bark) + ' 53 23)');
      transform(p['dog-shadow'], translate(offset(dog, -10 * dog.facing, 3)));
      p.moti.dataset.pose = dog.front ? (dog.gait ? 'walking' : 'standing') : 'under-charpai';
    }

    paintProps(frame, still) {
      const p = this.parts;
      const { ball, dog, shoe } = frame;
      const mouth = dogMouth(dog, still);
      const hand = ball.owner === 'boy' || shoe.owner === 'boy' ? this.hand() : null;
      const mount = p[shoe.owner === 'dog' && !dog.front ? 'puppy-back' : 'jutti-front'];
      if (p['lost-jutti'].parentElement !== mount) mount.append(p['lost-jutti']);
      const shoeBase = shoe.owner === 'dog' ? fromAnchor(shoeGrip, mouth, shoe.angle, -1)
        : shoe.owner === 'boy' ? fromAnchor(shoeGrip, hand, shoe.angle, -1) : shoe.center;
      transform(p['lost-jutti'], translate(shoeBase) + ' rotate(' + shoe.angle + ') scale(-1 1)');
      p['lost-jutti'].dataset.owner = shoe.owner;
      const ballCenter = ball.owner === 'boy' ? fromAnchor(ballGrip, hand, 0)
        : ball.owner === 'dog' ? offset(mouth, dog.facing * 6, 3) : ball.center;
      transform(p['cloth-ball'], translate(ballCenter));
      transform(p['ball-spin'], 'rotate(' + (still ? 0 : ball.angle) + ')');
      transform(p['ball-shadow'], translate(offset(ballCenter, 1, 18)));
      opacity(p['ball-shadow'], ball.owner === 'rolling' ? .74 : .24);
      p['cloth-ball'].dataset.owner = ball.owner;
    }

    draw(ms, line, word) {
      const still = this.reduced.matches;
      const frame = frameFor(this.scene, this.cue, ms, still);
      this.frameCamera(ms, line, frame, still);
      const speech = word >= 0 ? { text: line.reading.words[word],
        phase: phase(ms - line.start, ...line.reading.timings[word]) } : null;
      this.boy.paint(frame.boy, ms, line.speaker === 'friend' ? speech : null, still);
      this.bibi.paint(frame.bibi, ms, line.speaker === 'dadi' ? speech : null, still);
      transform(this.parts['sidak-shadow'], translate(frame.boy));
      transform(this.parts['bibi-shadow'], translate(frame.bibi));
      transform(this.parts['charpai-quilt'], 'skewX(' + frame.quilt / 6 + ') translate(' + frame.quilt + ' 0)');
      this.paintPuppy(frame.dog, ms, still);
      this.paintProps(frame, still);
    }
  }

  async function prepare() {
    studio = await open(document.getElementById('missing-jutti-studio'));
  }

  window.LittlePanthStage = { Stage: MissingJuttiStage, eventsFor, prepare };
})();
