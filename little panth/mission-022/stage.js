(() => {
  'use strict';

  const { open, Character } = window.UmtoNativeCharacterPlayer;
  const cast = { preset: 'kid-rohan', view: 'right', height: 265, serial: 551 };
  const colors = ['blue', 'yellow', 'green'];
  const point = (x, y) => ({ x, y });
  const mix = (a, b, t) => a + (b - a) * t;
  const phase = (ms, start, end) => Math.max(0, Math.min(1, (ms - start) / Math.max(1, end - start)));
  const ease = t => t * t * (3 - 2 * t);
  const between = (a, b, t) => point(mix(a.x, b.x, t), mix(a.y, b.y, t));
  const translate = ({ x, y }) => 'translate(' + x + ' ' + y + ')';
  const transform = (node, value) => node.setAttribute('transform', value);
  const opacity = (node, value) => node.setAttribute('opacity', String(value));
  const basketSite = point(705, 503);
  const roadEnd = point(624, 621);
  const stoneSide = point(658, 632);
  const resting = point(539, 625);
  const brim = point(-8, 3);
  const crown = point(0, -96);
  const headPivot = point(0, -62);
  const slots = {
    blue: { x: -36, y: 30, angle: -18, size: .58 },
    yellow: { x: -1, y: 25, angle: 8, size: .62 },
    green: { x: 31, y: 31, angle: 20, size: .58 },
    red: { x: -20, y: 40, angle: -7, size: .59 }
  };
  const homes = [
    { x: 615, y: 204, face: 1, size: .85 },
    { x: 744, y: 194, face: -1, size: .94 },
    { x: 877, y: 198, face: -1, size: .89 }
  ];
  const vines = [
    [point(615, 206), point(596, 331), point(610, 481), point(611, 578)],
    [point(744, 196), point(763, 334), point(738, 482), point(752, 582)],
    [point(877, 199), point(895, 343), point(867, 469), point(879, 582)]
  ];
  const atBasket = [point(639, 595), point(754, 579), point(804, 608)];
  const bowActor = point(600, 626);
  const redFlight = 725;
  const monkeyFlight = 805;
  let studio;

  function wordAt(scene, id, word, last = false) {
    const line = scene.lines.find(entry => entry.id === id);
    const words = line.reading.words.map(value => value.replace(/\p{P}/gu, ''));
    const index = last ? words.lastIndexOf(word) : words.indexOf(word);
    return line.start + (line.reading.timings[index]?.[0] ?? line.duration / 2);
  }

  function cuesFor(scene) {
    const at = (id, word, last = false) => wordAt(scene, id, word, last);
    switch (scene.id) {
      case 'road-to-the-fair':
        return { arrive: at('caps-for-the-fair', 'ਟੋਕਰੀ') + 1560 };
      case 'under-the-tree':
        return { set: at('basket-on-the-stone', 'ਰੱਖੀ'), rest: at('basket-on-the-stone', 'ਮੀਟ') };
      case 'monkeys-take-caps':
        return { down: at('three-monkeys', 'ਉਤਰੇ'), take: ['ਨੀਲੀ', 'ਪੀਲੀ', 'ਹਰੀ'].map(word => at('three-monkeys', word) + 140),
          up: at('three-monkeys', 'ਟਾਹਣੀਆਂ') };
      case 'copying-game':
        return { up: at('copying-rohan', 'ਉੱਪਰ'), wave: at('copying-rohan', 'ਹਿਲਾਇਆ'),
          copy: at('copying-rohan', 'ਹਿਲਾਇਆ', true) - 415 };
      case 'red-cap':
        return { bow: at('red-cap-first', 'ਝੁਕਾਇਆ'), drop: at('red-cap-first', 'ਡਿੱਗੀ') - redFlight + 80 };
      case 'caps-tumble':
        return { drop: ['ਇੱਕ', 'ਦੋ', 'ਤਿੰਨ'].map(word => at('caps-come-down', word)),
          count: at('caps-come-down', 'ਗਿਣੀਆਂ') };
      case 'on-to-the-fair':
        return { lift: at('on-to-the-fair', 'ਚੁੱਕੀ'), grip: at('on-to-the-fair', 'ਫੜੀ'), home: at('on-to-the-fair', 'ਤੁਰ') };
    }
  }

  function eventsFor(scene) {
    const c = cuesFor(scene);
    switch (scene.id) {
      case 'road-to-the-fair': return [750, 1375, 2050, 2780, 3455, 4160].map(ms => ({ ms, sound: 'step' }));
      case 'under-the-tree': return [{ ms: c.set + 170, sound: 'twig' }, { ms: c.rest, sound: 'gust' }];
      case 'monkeys-take-caps': return [{ ms: c.down - 240, sound: 'chirp' },
        ...c.take.map(ms => ({ ms: ms + 75, sound: 'ribbon' })), { ms: c.up + 160, sound: 'twig' }];
      case 'copying-game': return [{ ms: c.copy + 570, sound: 'chirp' }];
      case 'red-cap': return [{ ms: c.drop + redFlight, sound: 'plop' }];
      case 'caps-tumble': return c.drop.map(ms => ({ ms: ms + monkeyFlight, sound: 'plop' }));
      case 'on-to-the-fair': return [{ ms: c.lift, sound: 'ribbon' },
        ...[150, 700, 1380, 2090].map(offset => ({ ms: c.home + offset, sound: 'step' }))];
    }
  }

  function rotate({ x, y }, degrees) {
    const radians = degrees * Math.PI / 180;
    return point(x * Math.cos(radians) - y * Math.sin(radians), x * Math.sin(radians) + y * Math.cos(radians));
  }

  function offset(pos, dx, dy) {
    return point(pos.x + dx, pos.y + dy);
  }

  function arc(a, b, t, height) {
    return offset(between(a, b, t), 0, -height * Math.sin(Math.PI * t));
  }

  function vinePoint(index, t) {
    const [a, b, c, d] = vines[index];
    return between(between(between(a, b, t), between(b, c, t), t),
      between(between(b, c, t), between(c, d, t), t), t);
  }

  function monkeyCrown(monkey) {
    const local = rotate(point(crown.x - headPivot.x, crown.y - headPivot.y), monkey.bow);
    return point(monkey.x + monkey.face * monkey.size * (local.x + headPivot.x),
      monkey.y + monkey.size * (local.y + headPivot.y));
  }

  function grasp(cap, size, angle) {
    const tip = rotate(point(brim.x * size, brim.y * size), angle);
    return offset(cap, tip.x, tip.y);
  }

  function grip(actor, target, weight = 1, arm = 1, hand = 'fist') {
    actor.grips[arm] = { target, weight, hand };
  }

  function walk(actor, from, to, ms, start, end, movement) {
    const t = phase(ms, start, end);
    Object.assign(actor, between(from, to, movement(t)));
    if (t > 0 && t < 1) actor.walk = (ms - start) / 1000;
  }

  function frameFor(scene, c, ms, still) {
    const movement = still ? Math.round : ease;
    const motion = (start, end) => movement(phase(ms, start, end));
    const pulse = (start, full, fade, end) => motion(start, full) * (1 - motion(fade, end));
    const actor = { ...resting, mirror: false, lean: 0, bow: 0, eyes: '', grips: [] };
    const monkeys = homes.map(home => ({ ...home, visible: 1, bow: 0, wave: 0 }));
    const hats = { red: { source: 'rohan-head' } };
    const frame = { actor, monkeys, hats, basket: { position: basketSite }, basketAngle: 0 };
    colors.forEach(color => { hats[color] = { source: 'basket' }; });

    function carryBasket(target, arm = 1) {
      grip(actor, target, 1, arm);
      frame.basket = { arm };
    }

    function hatsOnMonkeys() {
      colors.forEach((color, index) => { hats[color] = { source: 'monkey-head', index }; });
    }

    switch (scene.id) {
      case 'road-to-the-fair': {
        walk(actor, point(211, 635), roadEnd, ms, 380, c.arrive, movement);
        const swing = still || actor.walk == null ? 0 : Math.sin(actor.walk * 8);
        frame.basketAngle = 4 * swing;
        carryBasket(point(actor.x + 51, actor.y - 102 + 3 * swing));
        monkeys.forEach(monkey => { monkey.visible = 0; });
        break;
      }
      case 'under-the-tree': {
        walk(actor, roadEnd, stoneSide, ms, c.set - 940, c.set - 270, movement);
        const set = motion(c.set - 550, c.set + 170);
        if (set < 1) carryBasket(between(point(actor.x + 51, actor.y - 102), basketSite, set));
        else grip(actor, basketSite, 1 - motion(c.set + 170, c.set + 580));
        if (ms >= c.set + 460) {
          walk(actor, stoneSide, resting, ms, c.set + 460, c.set + 1660, movement);
          actor.mirror = ms < c.set + 1680;
        }
        actor.eyes = ms >= c.rest - 40 ? 'closed' : '';
        monkeys.forEach(monkey => { monkey.visible = 0; });
        break;
      }
      case 'monkeys-take-caps': {
        actor.eyes = 'closed';
        colors.forEach((color, index) => {
          const monkey = monkeys[index];
          const slot = slots[color];
          const take = c.take[index];
          const down = motion(c.down - 880 + 270 * index, c.down + 810 + 290 * index);
          const walkIn = motion(c.down + 820 + 290 * index, take - 350);
          const walkOut = motion(c.up - 805 + 90 * index, c.up - 155 + 165 * index);
          const up = motion(c.up - 140 + 165 * index, scene.duration - 100 + 10 * index);
          const bottom = offset(vinePoint(index, 1), 0, 17);
          if (down > 0 && down < 1) {
            Object.assign(monkey, vinePoint(index, down));
            monkey.vine = vinePoint(index, Math.max(0, down - .12));
          } else if (up > 0) {
            Object.assign(monkey, between(vinePoint(index, 1 - up), homes[index], up ** 7));
            if (up < 1) monkey.vine = vinePoint(index, Math.max(0, .88 - up));
          } else if (down >= 1) {
            Object.assign(monkey, between(between(bottom, atBasket[index], walkIn), bottom, walkOut));
            if ((walkIn > 0 && walkIn < 1) || (walkOut > 0 && walkOut < 1)) monkey.walk = ms / 111;
          }
          const lift = motion(take, take + 650);
          const seat = monkeyCrown(monkey);
          const base = offset(basketSite, slot.x, slot.y);
          const reach = motion(take - 330, take - 1) * (1 - motion(take + 620, take + 825));
          if (reach > 0) {
            const position = arc(base, seat, lift, still ? 0 : 14);
            const size = mix(slot.size, monkey.size * .91, lift);
            const angle = mix(slot.angle, -5 * monkey.face, lift);
            const neutral = point(monkey.x + 26 * monkey.face, monkey.y - 27);
            monkey.paw = between(neutral, grasp(position, size, angle), reach);
            if (lift > 0 && lift < 1) hats[color] = { source: 'monkey-paw', position, size, angle };
          }
          if (lift === 1) hats[color] = { source: 'monkey-head', index };
        });
        break;
      }
      case 'copying-game': {
        hatsOnMonkeys();
        const wave = pulse(c.wave - 270, c.wave + 110, c.wave + 720, c.wave + 1050);
        if (wave > 0) grip(actor, point(actor.x + 65, actor.y - 198 +
          (still ? 0 : 10 * Math.sin(ms / 102))), wave, 1, 'open');
        actor.bow = -12 * pulse(c.up - 140, c.up + 340, c.wave - 460, c.wave - 50);
        monkeys.forEach((monkey, index) => {
          const delay = 180 * index;
          monkey.wave = pulse(c.copy + delay - 115, c.copy + delay + 120, c.copy + delay + 745, c.copy + delay + 1070);
        });
        break;
      }
      case 'red-cap': {
        hatsOnMonkeys();
        walk(actor, resting, bowActor, ms, 820, c.bow - 630, movement);
        const bow = pulse(c.bow - 390, c.bow + 230, c.drop + redFlight, c.drop + redFlight + 780);
        actor.lean = 14 * bow;
        actor.bow = 29 * bow;
        if (bow > 0) grip(actor, point(actor.x + 71, actor.y - 101), bow * .64, 1, 'open');
        if (ms >= c.drop + redFlight) hats.red = { source: 'basket' };
        else if (ms >= c.drop) hats.red = { source: 'red-flight', progress: phase(ms, c.drop, c.drop + redFlight) };
        break;
      }
      case 'caps-tumble': {
        Object.assign(actor, bowActor);
        hats.red = { source: 'basket' };
        colors.forEach((color, index) => {
          const monkey = monkeys[index];
          const drop = c.drop[index];
          monkey.bow = 46 * pulse(drop - 570, drop - 8, drop + monkeyFlight, drop + monkeyFlight + 515);
          if (ms < drop) hats[color] = { source: 'monkey-head', index };
          else if (ms < drop + monkeyFlight) {
            hats[color] = { source: 'monkey-flight', index, progress: phase(ms, drop, drop + monkeyFlight) };
          }
        });
        const count = pulse(c.count - 690, c.count - 260, c.count + 310, c.count + 720);
        if (count > 0) grip(actor, point(actor.x + 61, actor.y - 143), count, 1, 'point');
        break;
      }
      case 'on-to-the-fair': {
        hats.red = { source: 'basket' };
        const pickup = point(654, 654);
        const turn = c.home - 620;
        walk(actor, bowActor, pickup, ms, c.lift - 1560, c.lift - 375, movement);
        if (ms >= turn) {
          walk(actor, pickup, point(257, 639), ms, turn, c.home + 3090, movement);
          actor.mirror = true;
        }
        const redSlot = slots.red;
        const redPickup = grasp(offset(basketSite, redSlot.x, redSlot.y), redSlot.size, redSlot.angle);
        const redCarry = point(actor.x + (actor.mirror ? 41 : -43), actor.y - 98);
        const take = motion(c.lift - 20, c.lift + 505);
        grip(actor, between(redPickup, redCarry, take), motion(c.lift - 400, c.lift - 30), 0);
        if (ms >= c.lift) hats.red = { source: 'rohan-hand', angle: mix(redSlot.angle, -24, take), size: redSlot.size };
        const lift = motion(c.grip - 30, c.grip + 595);
        const basketCarry = point(actor.x + (actor.mirror ? -48 : 52), actor.y - 106);
        const lifting = between(basketSite, basketCarry, lift);
        if (ms >= c.grip) carryBasket(lifting);
        else grip(actor, lifting, motion(c.grip - 430, c.grip - 30));
        break;
      }
    }
    return frame;
  }

  class CapStage {
    constructor(svg) {
      this.svg = svg;
      this.camera = new window.UmtoCamera.DeliveryCamera(svg);
      this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
      this.parts = Object.fromEntries([...svg.querySelectorAll('[id]')].map(node => [node.id, node]));
      this.rohan = new Character(studio, svg, this.parts.rohan, this.parts['rohan-props'], cast);
      const template = this.parts['cap-monkey-template'];
      this.monkeys = colors.map(color => {
        const root = this.parts[color + '-monkey'];
        root.append(...template.cloneNode(true).children);
        return { root, head: root.querySelector('[data-head]'), eyes: root.querySelector('[data-eyes]'),
          limbs: [...root.querySelectorAll('[data-arm], [data-leg]')],
          tail: [...root.querySelectorAll('[data-tail], [data-tail-light]')] };
      });
      template.remove();
    }

    select(scene) {
      this.scene = scene;
      this.cue = cuesFor(scene);
      this.shot = '';
    }

    frameCamera(ms, line, state, still) {
      const { id, framing, focus } = this.scene;
      const c = this.cue;
      const shotAt = (preset, x, y, width, motion = 'static') =>
        ({ preset, focus: point(x, y), width, motion, parallax: motion === 'tracking' });
      let shot = { preset: framing, focus };
      if (id === 'road-to-the-fair' && ms > 1360 && state.actor.walk != null) {
        shot = shotAt('full', Math.round(state.actor.x + 90), 425, 1040, still ? 'static' : 'tracking');
      } else if (id === 'under-the-tree' && ms >= c.set - 1050) {
        shot = shotAt('medium', 642, 457, 825);
      } else if (id === 'monkeys-take-caps') {
        shot = ms > c.down + 1280 && ms < c.up - 690 ? shotAt('detail', 686, 493, 690)
          : shotAt('full', 739, 344, 1130);
      } else if (id === 'copying-game') {
        shot = line.speaker === 'friend' ? shotAt('medium', 594, 427, 768) : shotAt('full', 694, 344, 1190);
      } else if (id === 'red-cap') {
        shot = ms < c.drop + redFlight + 1080 ? shotAt('detail', 635, 467, 725)
          : shotAt('three-shot', 742, 231, 845);
      } else if (id === 'caps-tumble' && ms > c.drop[2] + monkeyFlight + 310) {
        shot = shotAt('detail', 658, 477, 772);
      } else if (id === 'on-to-the-fair' && ms < c.home - 700) {
        shot = shotAt('full', 661, 455, 946);
      } else if (id === 'on-to-the-fair' && state.actor.walk != null) {
        shot = shotAt('wide', Math.round(state.actor.x + 162), 360, 1195, still ? 'static' : 'tracking');
      }
      const key = [shot.preset, shot.focus.x, shot.focus.y, shot.width, shot.motion].join('/');
      if (key !== this.shot) {
        this.camera.cue({ ...shot, cut: true });
        this.shot = key;
      }
    }

    paintRohan(actor, ms, line, word, still) {
      const plane = this.parts['rohan-plane'];
      transform(plane, actor.mirror ? 'translate(' + (2 * actor.x) + ' 0) scale(-1 1)' : '');
      transform(this.parts['rohan-shadow'], translate(point(actor.x, actor.y + 3)));
      const reading = line.speaker === 'friend' && word >= 0 ? {
        text: line.reading.words[word], phase: phase(ms - line.start, ...line.reading.timings[word])
      } : null;
      this.rohan.paint(actor, ms, reading, still);
      if (actor.eyes || actor.bow) {
        const { api, node } = this.rohan;
        api.withActor(this.rohan.actor, () => {
          const expression = api.reaction('neutral', still ? 0 : ms / 1000);
          api.face(node, { ...expression, mouth: 'closed', eyes: actor.eyes || 'open', angle: actor.bow,
            gazeY: actor.bow > 0 ? 55 : -44 });
        });
      }
    }

    local(node, x, y) {
      return new DOMPoint(x, y).matrixTransform(node.getScreenCTM()).matrixTransform(this.svg.getScreenCTM().inverse());
    }

    palm(arm) {
      const hand = this.rohan.arms[arm].querySelector('[data-action-hand]');
      return this.local(hand, 0, Number(hand.dataset.gripY));
    }

    rohanCrown() {
      const layer = this.rohan.node.layers.frontHair;
      const box = layer.getBBox();
      const seat = this.local(layer, box.x + box.width / 2, box.y + box.height * .39);
      const side = this.local(layer, box.x + box.width, box.y + box.height * .39);
      return { position: seat, size: Math.min(1.2, Math.max(.83, Math.hypot(side.x - seat.x, side.y - seat.y) / 27)),
        angle: Math.atan2(side.y - seat.y, side.x - seat.x) * 180 / Math.PI };
    }

    paintMonkey(view, pose, ms, still) {
      const { root, head, limbs, tail, eyes } = view;
      opacity(root, pose.visible);
      transform(root, translate(pose) + ' scale(' + pose.face * pose.size + ' ' + pose.size + ')');
      transform(head, 'rotate(' + pose.bow + ' ' + headPivot.x + ' ' + headPivot.y + ')');
      const beat = still ? 0 : Math.sin(ms / 265 + pose.x * .039);
      const step = pose.walk == null || still ? 0 : Math.sin(pose.walk);
      transform(eyes, 'translate(0 ' + (Math.max(0, pose.bow) / 30) + ') scale(1 1)');
      const tailPath = 'M20-24C40-19 55-30 58-51Q61-73 ' + (42 + 5 * beat) + ' -65Q33-59 39-52';
      for (const path of tail) path.setAttribute('d', tailPath);
      const local = target => point((target.x - pose.x) / (pose.face * pose.size), (target.y - pose.y) / pose.size);
      for (const limb of limbs) {
        const front = (limb.dataset.arm ?? limb.dataset.leg) === 'near';
        const direction = front ? 1 : -1;
        const isArm = limb.hasAttribute('data-arm');
        let from = point(direction * 15, -20);
        let to = point(direction * 19 + 8 * step * direction, -5 - 7 * Math.max(0, step * direction));
        if (isArm) {
          from = point(direction * 20, -50);
          to = point(direction * (31 + 3 * beat), -21 - 7 * step * direction);
          if (front && pose.vine) to = local(pose.vine);
          if (front && pose.paw) to = local(pose.paw);
          if (front && pose.wave) to = between(to, point(42 + 5 * beat, -85 + 6 * beat), pose.wave);
        }
        const bend = offset(between(from, to, .54), direction * (isArm ? 8 : 4), isArm ? 7 : -3);
        const path = 'M' + from.x + ' ' + from.y + ' Q' + bend.x + ' ' + bend.y + ' ' + to.x + ' ' + to.y;
        for (const stroke of limb.querySelectorAll(':scope > path')) stroke.setAttribute('d', path);
        transform(limb.querySelector('[data-paw], [data-foot]'), translate(to));
      }
    }

    paintProps(state) {
      const p = this.parts;
      const basket = p['cap-basket'];
      const basketParent = state.basket.arm == null ? p['cap-objects'] : p['rohan-props'];
      if (basket.parentNode !== basketParent) basketParent.append(basket);
      const base = state.basket.arm == null ? state.basket.position : this.palm(state.basket.arm);
      transform(basket, translate(base) + ' rotate(' + state.basketAngle + ')');
      basket.dataset.owner = state.basket.arm == null ? 'stone' : 'rohan';

      for (const color of ['red', ...colors]) {
        const node = p[color + '-cap'];
        const hat = state.hats[color];
        const slot = slots[color];
        const monkey = state.monkeys[hat.index];
        let parent = p['cap-objects'];
        let drawn = hat;
        if (hat.source === 'basket') {
          parent = p['cap-basket-slots'];
          drawn = { position: slot, angle: slot.angle, size: slot.size };
        } else if (hat.source === 'rohan-head') {
          drawn = this.rohanCrown();
        } else if (hat.source === 'monkey-head') {
          drawn = { position: monkeyCrown(monkey), angle: monkey.face * (monkey.bow - 5), size: monkey.size * .91 };
        } else if (hat.source === 'rohan-hand') {
          parent = p['rohan-props'];
          const palm = this.palm(0);
          const tip = grasp(point(0, 0), hat.size, hat.angle);
          drawn = { ...hat, position: offset(palm, -tip.x, -tip.y) };
        } else if (hat.source.endsWith('flight')) {
          const start = hat.source === 'red-flight' ? this.rohanCrown()
            : { position: monkeyCrown(monkey), angle: monkey.face * (monkey.bow - 5), size: monkey.size * .91 };
          const t = hat.progress;
          const target = offset(base, slot.x, slot.y);
          const clearance = hat.source === 'red-flight' ? 55 * Math.sin(Math.PI * t) : 0;
          const fall = point(mix(start.position.x, target.x, ease(t)) + clearance,
            mix(start.position.y, target.y, t ** 1.56));
          drawn = { position: fall, angle: mix(start.angle, slot.angle + 360, t), size: mix(start.size, slot.size, t) };
        }
        if (node.parentNode !== parent) parent.append(node);
        transform(node, translate(drawn.position) + ' rotate(' + drawn.angle + ') scale(' + drawn.size + ')');
        node.dataset.owner = hat.source;
      }
      const rack = p['cap-basket-slots'];
      if (state.hats.red.source === 'basket' && rack.lastElementChild !== p['red-cap']) rack.append(p['red-cap']);
    }

    draw(ms, line, word) {
      const still = this.reduced.matches;
      const state = frameFor(this.scene, this.cue, ms, still);
      this.frameCamera(ms, line, state, still);
      this.paintRohan(state.actor, ms, line, word, still);
      state.monkeys.forEach((monkey, index) => this.paintMonkey(this.monkeys[index], monkey, ms, still));
      this.paintProps(state);
    }
  }

  async function prepare() {
    studio = await open(document.getElementById('cap-seller-studio'));
  }

  window.LittlePanthStage = { Stage: CapStage, eventsFor, prepare };
})();
