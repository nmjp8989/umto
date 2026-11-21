(() => {
  'use strict';

  const ns = 'http://www.w3.org/2000/svg';
  const { open, Character } = window.UmtoNativeCharacterPlayer;
  const cast = {
    dadi: { preset: 'elder-bibi-ji', view: 'right', height: 295, serial: 501 },
    boy: { preset: 'kid-sidak', view: 'right', height: 239, serial: 503 },
    mehar: { preset: 'kid-meher', view: 'right', height: 247, serial: 502 }
  };
  const phase = (value, start, end) => Math.max(0, Math.min(1, (value - start) / (end - start)));
  const ease = t => t * t * (3 - 2 * t);
  const mix = (a, b, t) => a + (b - a) * t;
  const point = (x, y) => ({ x, y });
  const between = (a, b, t) => point(mix(a.x, b.x, t), mix(a.y, b.y, t));
  const translate = ({ x, y }) => 'translate(' + x + ' ' + y + ')';
  const transform = (node, value) => node.setAttribute('transform', value);
  const opacity = (node, value) => node.setAttribute('opacity', String(Number(value)));
  const show = (node, value) => node.setAttribute('visibility', value ? 'visible' : 'hidden');
  const make = name => document.createElementNS(ns, name);
  const groundSeed = point(586, 615);
  const bedSeed = point(765, 601);
  const furrow = point(806, 620);
  const grainDish = point(866, 616);
  const servingPlate = point(732, 546);
  const hotRoti = point(581, 541);
  const sharingPlate = point(686, 594);
  const henScale = .61;
  const henHinge = point(0, 72);
  let studio;
  let henSource;

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
      case 'found-grains':
        return { pick: wordAt(scene, 'hen-finds-wheat', 'ਚੁੱਕ'), set: wordAt(scene, 'hen-finds-wheat', 'ਰੱਖੇ') };
      case 'children-playing':
        return { call: wordAt(scene, 'hen-calls', 'ਕੁੜ'), ball: wordAt(scene, 'hen-calls', 'ਗੇਂਦ'),
          reply: lineFor(scene, 'sidak-finishes-game').start };
      case 'planting':
        return { scratch: wordAt(scene, 'hen-plants', 'ਖੁਰਚੀ'), drop: wordAt(scene, 'hen-plants', 'ਸੁੱਟ'),
          rain: wordAt(scene, 'hen-plants', 'ਮੀਂਹ') };
      case 'wheat-grows':
        return { grow: wordAt(scene, 'wheat-ripens', 'ਨਿਕਲੇ'), gold: wordAt(scene, 'wheat-ripens', 'ਪੱਕੀ'),
          arrive: wordAt(scene, 'wheat-ripens', 'ਆਏ'), harvest: wordAt(scene, 'mehar-helps', 'ਲੈ') };
      case 'mill':
        return { load: wordAt(scene, 'basket-to-mill', 'ਪਾਈ'), deliver: wordAt(scene, 'basket-to-mill', 'ਲੈ'),
          grind: wordAt(scene, 'basket-to-mill', 'ਚੱਕੀ'), flour: wordAt(scene, 'basket-to-mill', 'ਆਟਾ') };
      case 'roti':
        return { lift: wordAt(scene, 'roti-is-served', 'ਲਾਹ'), serve: wordAt(scene, 'roti-is-served', 'ਰੱਖੀ'),
          plate: wordAt(scene, 'roti-is-served', 'ਚੁੱਕੀ'), bowl: wordAt(scene, 'roti-is-served', 'ਰੱਖੇ') };
      case 'share':
        return { peck: wordAt(scene, 'share-the-meal', 'ਚੁਗੇ'), eat: wordAt(scene, 'share-the-meal', 'ਖਾਣਾ') };
    }
  }

  function eventsFor(scene) {
    const c = cuesFor(scene);
    switch (scene.id) {
      case 'found-grains': return [{ ms: c.pick, sound: 'twig' }, { ms: c.set, sound: 'twig' }];
      case 'children-playing': return [{ ms: c.call, sound: 'chirp' }, { ms: c.ball + 140, sound: 'plop' }];
      case 'planting': return [{ ms: c.scratch, sound: 'twig' }, { ms: c.drop, sound: 'plop' },
        ...[120, 460, 815].map(offset => ({ ms: c.rain + offset, sound: 'sip' }))];
      case 'wheat-grows': return [{ ms: c.grow, sound: 'ribbon' }, { ms: c.gold, sound: 'gust' },
        { ms: c.arrive - 440, sound: 'step' }];
      case 'mill': return [{ ms: c.deliver - 420, sound: 'step' }, { ms: c.deliver + 150, sound: 'twig' },
        ...[160, 740, 1330].map(offset => ({ ms: c.grind + offset, sound: 'twig' }))];
      case 'roti': return [{ ms: c.serve, sound: 'twig' }, { ms: c.bowl, sound: 'twig' }];
      case 'share': return [{ ms: c.peck, sound: 'twig' }, { ms: c.peck + 620, sound: 'twig' },
        { ms: c.eat + 1100, sound: 'ribbon' }];
    }
  }

  function rotated({ x, y }, angle, around) {
    const rad = angle * Math.PI / 180;
    const dx = x - around.x;
    const dy = y - around.y;
    return point(around.x + dx * Math.cos(rad) - dy * Math.sin(rad),
      around.y + dx * Math.sin(rad) + dy * Math.cos(rad));
  }

  function beak(hen) {
    const tip = rotated(point(-84, -40), -55 * hen.dip, henHinge);
    return point(hen.x + hen.face * henScale * tip.x, hen.y + henScale * (tip.y - 80));
  }

  function stance(target, face) {
    const offset = beak({ x: 0, y: 0, face, dip: 1 });
    return point(target.x - offset.x, target.y - offset.y);
  }

  function hop(from, to, t, height) {
    return point(mix(from.x, to.x, t), mix(from.y, to.y, t) - height * Math.sin(Math.PI * t));
  }

  function actor(x, y, mirror = false) {
    return { x, y, mirror, lean: 0, visible: false, grips: [] };
  }

  function grip(actor, target, weight = 1, hand = 'fist') {
    actor.grips[1] = { target, weight, hand };
  }

  function walking(actor, from, to, ms, start, end, tween) {
    const t = phase(ms, start, end);
    Object.assign(actor, between(from, to, tween(t)));
    if (t > 0 && t < 1) actor.walk = (ms - start) / 1000;
  }

  function makeFrame(scene, c, ms, still) {
    const tween = still ? Math.round : ease;
    const motion = (a, b) => tween(phase(ms, a, b));
    const pulse = (a, b, d, e) => motion(a, b) * (1 - motion(d, e));
    const hen = { x: 489, y: 620, face: -1, dip: 0, visible: true, scratch: 0 };
    const dadi = actor(517, 617);
    const boy = actor(320, 618);
    const mehar = actor(531, 619, true);
    const frame = { hen, actors: { dadi, boy, mehar }, yard: true, plot: false, ground: 0, rain: 0,
      grow: 0, gold: 0, harvest: 0, scratch: 0, meal: false,
      seedMode: 'none', seed: groundSeed, basket: null, ball: null, flour: 0, grindAngle: 0,
      crank: null, roti: null, plate: null, tongs: 0, dish: null, pecks: 0, bites: {} };

    switch (scene.id) {
      case 'found-grains': {
        frame.plot = true;
        const atSeed = stance(groundSeed, hen.face);
        const atBed = stance(bedSeed, hen.face);
        walking(hen, point(375, 613), atSeed, ms, c.pick - 3550, c.pick - 630, tween);
        const carry = motion(c.pick + 100, c.set - 180);
        if (ms >= c.pick) {
          Object.assign(hen, between(atSeed, atBed, carry));
          if (carry > 0 && carry < 1) hen.walk = (ms - c.pick) / 1000;
        }
        hen.dip = Math.max(pulse(c.pick - 440, c.pick - 60, c.pick + 80, c.pick + 440),
          pulse(c.set - 430, c.set - 8, c.set + 160, c.set + 570));
        frame.seedMode = ms < c.pick ? 'ground' : ms < c.set ? 'beak' : 'bed';
        frame.seed = frame.seedMode === 'ground' ? groundSeed : frame.seedMode === 'beak' ? beak(hen) : bedSeed;
        break;
      }
      case 'children-playing': {
        frame.plot = boy.visible = mehar.visible = true;
        hen.x = 701;
        hen.face = 1;
        hen.dip = still ? 0 : .16 * pulse(c.call - 110, c.call + 80, c.call + 510, c.call + 680) * Math.abs(Math.sin(ms / 75));
        mehar.mirror = ms < c.call;
        boy.lean = still ? 0 : -6 * pulse(c.ball - 170, c.ball + 180, c.ball + 560, c.ball + 900);
        frame.seedMode = 'bed';
        frame.seed = bedSeed;
        const roll = motion(c.ball - 210, c.ball + 790);
        const back = motion(c.reply - 280, c.reply + 770);
        frame.ball = point(390 + 80 * roll - 70 * back, 602);
        break;
      }
      case 'planting': {
        frame.yard = false;
        frame.plot = true;
        const atSeed = stance(bedSeed, hen.face);
        const atFurrow = stance(furrow, hen.face);
        const take = c.drop - 670;
        walking(hen, point(674, 615), atSeed, ms, 60, take - 280, tween);
        if (ms >= take) Object.assign(hen, between(atSeed, atFurrow, motion(take + 30, c.drop - 90)));
        hen.scratch = still ? 0 : pulse(c.scratch - 140, c.scratch + 60, c.scratch + 530, c.scratch + 790);
        hen.dip = Math.max(pulse(take - 230, take - 10, take + 50, take + 240),
          pulse(c.drop - 195, c.drop - 8, c.drop + 100, c.drop + 410));
        frame.scratch = motion(c.scratch - 90, c.scratch + 490);
        frame.seedMode = ms < take ? 'bed' : ms < c.drop ? 'beak' : 'soil';
        frame.seed = frame.seedMode === 'beak' ? beak(hen) : frame.seedMode === 'soil'
          ? between(furrow, point(806, 626), motion(c.drop, c.drop + 180)) : bedSeed;
        frame.seedFade = frame.seedMode === 'soil' ? 1 - motion(c.drop + 35, c.drop + 205) : 1;
        frame.rain = pulse(c.rain - 90, c.rain + 450, scene.duration - 580, scene.duration);
        frame.ground = motion(c.rain + 130, c.rain + 1460);
        break;
      }
      case 'wheat-grows': {
        frame.yard = false;
        frame.plot = boy.visible = mehar.visible = true;
        frame.ground = .45 * (1 - motion(c.grow, c.gold));
        frame.grow = motion(c.grow - 420, c.gold + 140);
        frame.gold = motion(c.gold - 270, c.gold + 380);
        frame.harvest = motion(c.harvest - 400, c.harvest + 630);
        hen.x = 607;
        walking(boy, point(151, 627), point(489, 629), ms, c.arrive - 1960, c.arrive + 410, tween);
        walking(mehar, point(335, 634), point(673, 635), ms, c.arrive - 1800, c.arrive + 480, tween);
        const ready = ms >= c.arrive - 2020;
        boy.visible = mehar.visible = ready;
        mehar.mirror = false;
        if (ready) {
          frame.basket = { target: point(boy.x + 59, boy.y - 90), owner: 'boy', fill: frame.harvest };
          grip(boy, frame.basket.target);
          const gather = pulse(c.harvest - 410, c.harvest - 100, c.harvest + 300, c.harvest + 660);
          grip(mehar, between(point(716, 532), point(718, 554), frame.harvest), gather, 'pinch');
        }
        break;
      }
      case 'mill': {
        frame.hen.visible = false;
        dadi.visible = boy.visible = mehar.visible = true;
        Object.assign(dadi, point(555, 602));
        walking(boy, point(96, 622), point(342, 622), ms, c.deliver - 2420, c.deliver + 30, tween);
        walking(mehar, point(230, 609), point(438, 611), ms, c.deliver - 2150, c.deliver + 240, tween);
        mehar.mirror = false;
        const set = motion(c.deliver - 190, c.deliver + 570);
        frame.basket = { target: between(point(boy.x + 62, boy.y - 88), point(419, 566), set),
          owner: set < 1 ? 'boy' : null, fill: motion(c.load - 90, c.load + 500) * (1 - motion(c.grind - 380, c.flour)) };
        grip(boy, frame.basket.target, 1 - motion(c.deliver + 470, c.deliver + 880));
        const work = phase(ms, c.grind - 160, c.flour + 440);
        frame.grindAngle = (still ? Math.round(work) : work) * 4.4 * Math.PI;
        const hold = pulse(c.grind - 910, c.grind - 240, c.flour + 470, c.flour + 840);
        frame.crank = { base: point(650 + 18 * Math.cos(frame.grindAngle), 533 + 7 * Math.sin(frame.grindAngle)), hold };
        frame.crank.target = point(frame.crank.base.x - 6, frame.crank.base.y - 45);
        grip(dadi, frame.crank.target, hold);
        frame.flour = motion(c.grind + 210, c.flour + 340);
        frame.flourFlow = pulse(c.grind + 330, c.grind + 625, c.flour + 130, c.flour + 435);
        break;
      }
      case 'roti': {
        dadi.visible = boy.visible = mehar.visible = true;
        boy.mirror = true;
        Object.assign(boy, point(823, 622));
        Object.assign(mehar, point(1008, 625));
        Object.assign(dadi, between(point(474, 606), point(560, 607), motion(c.lift - 340, c.serve)));
        frame.hen.x = 925;
        frame.hen.face = 1;
        const lift = motion(c.lift - 30, c.serve);
        const plate = motion(c.plate - 50, c.plate + 535);
        frame.plate = { position: between(servingPlate, point(760, 516), plate), owner: plate > 0 ? 'boy' : null };
        frame.roti = hop(hotRoti, servingPlate, lift, 47);
        frame.rotiAngle = -15 * Math.sin(Math.PI * lift);
        frame.tongs = pulse(c.lift - 720, c.lift - 125, c.serve + 75, c.serve + 485);
        frame.tongTip = point(frame.roti.x - 26, frame.roti.y - 1);
        grip(dadi, point(frame.tongTip.x - 43 + 5 * lift, frame.tongTip.y - 36), frame.tongs);
        const plateGrip = point(frame.plate.position.x + 40, frame.plate.position.y);
        grip(boy, plateGrip, pulse(c.plate - 335, c.plate - 60, scene.duration, scene.duration + 1));
        const setting = motion(c.bowl - 1190, c.bowl);
        const release = motion(c.bowl, c.bowl + 500);
        frame.dish = { position: between(point(947, 538), grainDish, setting), owner: setting < 1 ? 'mehar' : null };
        Object.assign(mehar, between(point(1060, 625), point(964, 621), setting));
        mehar.lean = still ? 0 : -14 * Math.sin(Math.PI * setting / 2) * (1 - release);
        grip(mehar, point(frame.dish.position.x + 21, frame.dish.position.y - 2), 1 - release);
        break;
      }
      case 'share': {
        frame.meal = dadi.visible = boy.visible = mehar.visible = true;
        Object.assign(dadi, point(611, 612));
        Object.assign(boy, point(465, 622));
        Object.assign(mehar, point(796, 626));
        frame.plate = { position: sharingPlate };
        frame.roti = sharingPlate;
        frame.dish = { position: grainDish };
        hen.face = 1;
        const contact = stance(point(grainDish.x, grainDish.y + 2), hen.face);
        Object.assign(hen, between(point(971, 624), contact, motion(c.peck - 860, c.peck - 140)));
        hen.dip = Math.max(...[0, 620, 1240].map(offset =>
          pulse(c.peck - 165 + offset, c.peck + offset, c.peck + 88 + offset, c.peck + 265 + offset)));
        frame.pecks = ms >= c.peck + 96 ? 1 : 0;
        for (const [id, offset] of [['boy', 0], ['mehar', 290]]) {
          const time = c.eat + offset;
          frame.bites[id] = { lift: motion(time - 560, time + 185),
            reach: pulse(time - 950, time - 580, time + 245, time + 770),
            visible: ms >= time - 565 && ms <= time + 255 };
        }
        break;
      }
    }
    return frame;
  }

  class HenStage {
    constructor(svg) {
      this.svg = svg;
      this.camera = new window.UmtoCamera.DeliveryCamera(svg);
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      const defs = svg.querySelector('defs');
      const gradient = document.importNode(henSource.querySelector('#chickenGrad'), true);
      const colors = ['#f7ba7a', '#cd6c40', '#943e33'];
      gradient.querySelectorAll('stop').forEach((stop, index) => stop.setAttribute('stop-color', colors[index]));
      defs.append(gradient);
      const hen = document.importNode(henSource.querySelector('#asset-chicken'), true);
      hen.querySelector('#chicken-panic-fx').remove();
      const lean = make('g');
      lean.id = 'hen-lean';
      for (const part of ['tail', 'body', 'wing', 'head']) lean.append(hen.querySelector('#chicken-' + part));
      hen.append(lean);
      lean.querySelector('#chicken-wing').setAttribute('fill', '#b65136');
      lean.querySelector('#chicken-head path:nth-child(2)').setAttribute('fill', '#e79058');
      svg.querySelector('#hen-animal').append(hen);
      this.parts = Object.fromEntries([...svg.querySelectorAll('[id]')].map(node => [node.id, node]));
      this.puppets = Object.fromEntries(Object.entries(cast).map(([id, spec]) => [
        id, new Character(studio, svg, this.parts[id], this.parts[id + '-props'], spec)
      ]));
      this.legs = [...hen.querySelectorAll('#chicken-legs path')];
      this.stalks = Array.from({ length: 20 }, (_, index) => {
        const stalk = make('g');
        stalk.append(...this.parts['hen-wheat-shape'].cloneNode(true).children);
        this.parts['hen-wheat-rows'].append(stalk);
        const row = Math.floor(index / 7);
        return { stalk, ear: stalk.querySelector('[data-ear]'), x: 718 + index % 7 * 35 + row * 14,
          y: 600 + row * 19 + 3 * Math.sin(index), size: .66 + index % 5 * .14 };
      });
      this.drops = Array.from({ length: 31 }, (_, index) => {
        const drop = make('path');
        drop.setAttribute('d', 'M0 0l-9 23');
        drop.setAttribute('opacity', String(.2 + (index % 4) * .13));
        this.parts['hen-rain'].append(drop);
        return drop;
      });
    }

    select(scene) {
      this.scene = scene;
      this.cue = cuesFor(scene);
      this.lastShot = '';
    }

    frameCamera(ms, line, state, still) {
      const { id, framing, focus } = this.scene;
      const c = this.cue;
      const shotAt = (preset, x, y, width, motion = 'static') =>
        ({ preset, focus: point(x, y), width, motion, parallax: motion === 'tracking' });
      let shot = { preset: framing, focus };
      if (id === 'found-grains' && ms >= c.pick - 2340) {
        shot = shotAt('detail', Math.round(state.hen.x + 79), 520, 740, still ? 'static' : 'tracking');
      } else if (id === 'planting') {
        shot = shotAt('detail', 744, 521, ms < c.rain - 160 ? 672 : 895);
      } else if (id === 'wheat-grows' && ms >= c.grow - 650 && ms < c.arrive - 2040) {
        shot = shotAt('detail', 805, 508, 760);
      } else if (id === 'wheat-grows' && ms >= c.arrive - 2040) {
        shot = shotAt('full', 650, 438, 1020);
      } else if (id === 'mill' && ms < c.deliver + 320) {
        shot = shotAt('full', Math.round((state.actors.boy.x + 676) / 2), 427, 1090, still ? 'static' : 'tracking');
      } else if (id === 'mill' && line.speaker === 'narrator' && ms >= c.grind - 570) {
        shot = shotAt('detail', 637, 489, 776);
      } else if (id === 'roti') {
        shot = ms < c.plate + 770 ? shotAt('two-shot', 645, 432, 1000)
          : shotAt('two-shot', 869, 464, 945);
      } else if (id === 'share' && line.speaker === 'boy') {
        shot = shotAt('two-shot', 637, 428, 875);
      } else if (id === 'share' && ms >= c.peck - 360 && ms < c.eat + 930) {
        shot = shotAt('full', 697, 448, 1005);
      }
      const key = [shot.preset, shot.focus.x, shot.focus.y, shot.width, shot.motion].join('/');
      if (key !== this.lastShot) {
        this.camera.cue({ ...shot, cut: true });
        this.lastShot = key;
      }
    }

    paintHen(hen, ms, still) {
      const p = this.parts;
      show(p['hen-animal'], hen.visible);
      const step = still || hen.walk == null ? 0 : Math.sin(hen.walk * 16);
      transform(p['asset-chicken'], translate(point(hen.x, hen.y - 80 * henScale)) +
        ' scale(' + hen.face * henScale + ' ' + henScale + ')');
      transform(p['hen-lean'], 'rotate(' + (-55 * hen.dip) + ' ' + henHinge.x + ' ' + henHinge.y + ')');
      transform(p['chicken-wing'], 'rotate(' + (12 * step + 2 * Math.sin(ms / 220) * Number(!still)) + ' -10 -4)');
      for (const [index, [hipX, ankleX, ankleY]] of [[-8, -14, 68], [16, 12, 72]].entries()) {
        const hip = rotated(point(hipX, 28), -55 * hen.dip, henHinge);
        const gait = (index ? -step : step);
        const rake = index ? 0 : hen.scratch * Math.sin(ms / 62);
        const x = ankleX + gait * 13 + rake * 19;
        const y = ankleY - 9 * Math.max(0, gait) - 7 * Math.abs(rake);
        const path = 'M' + hip.x + ' ' + hip.y + 'L' + x + ' ' + y +
          'm0 0l-16 4m16-4 2 8m-2-8 12 6';
        this.legs[index * 2].setAttribute('d', path);
        this.legs[index * 2 + 1].setAttribute('d', path);
      }
      p['hen-animal'].dataset.pecking = String(hen.dip > .95);
    }

    paintField(state, ms, still) {
      const p = this.parts;
      opacity(p['hen-yard'], state.yard);
      opacity(p['hen-overcast'], state.rain * .25);
      show(p['hen-plot'], state.plot);
      opacity(p['hen-wet-soil'], state.ground * .68);
      opacity(p['hen-furrow'], state.scratch * .86);
      for (const [index, { stalk, ear, x, y, size }] of this.stalks.entries()) {
        const sway = still ? 0 : Math.sin(ms / 405 + index) * 2;
        const cut = ease(phase(state.harvest, index % 7 * .045, .72 + index % 7 * .035));
        const height = size * state.grow * mix(1, index % 3 === 0 ? .16 : .4, cut);
        const green = state.gold < .55;
        stalk.style.color = green ? '#728749' : '#b58b34';
        opacity(ear, state.gold * (1 - cut));
        opacity(stalk, state.grow);
        transform(stalk, translate(point(x, y)) + ' rotate(' + sway + ') scale(' + Math.max(.01, height) + ')');
      }
      opacity(p['hen-rain'], state.rain * (still ? .35 : 1));
      if (state.rain > 0) {
        this.drops.forEach((drop, i) => transform(drop, translate(point(445 + i * 73 % 650,
          227 + (i * 89 + (still ? 0 : ms * .41)) % 416))));
      }
      show(p['hen-ball'], Boolean(state.ball));
      if (state.ball) {
        transform(p['hen-ball'], translate(state.ball));
        transform(p['hen-ball-spin'], 'rotate(' + (state.ball.x - 390) * 3.5 + ')');
      }
      opacity(p['hen-seed'], state.seedMode === 'none' ? 0 : state.seedFade ?? 1);
      transform(p['hen-seed'], translate(state.seed) + ' rotate(-27)');
      this.svg.dataset.seed = state.seedMode;
      this.svg.dataset.wheat = state.harvest > .85 ? 'cut' : state.gold >= .6 ? 'gold' : state.grow > .03 ? 'green' : 'soil';
    }

    local(node, x, y) {
      return new DOMPoint(x, y).matrixTransform(node.getScreenCTM()).matrixTransform(this.svg.getScreenCTM().inverse());
    }

    palm(owner) {
      const hand = this.puppets[owner].arms[1].querySelector('[data-action-hand]');
      return this.local(hand, 0, Number(hand.dataset.gripY));
    }

    mouth(owner) {
      const node = this.puppets[owner].node.layers.mouthGroup;
      const box = node.getBBox();
      return this.local(node, box.x + box.width / 2, box.y + box.height / 2);
    }

    prop(id, data, offset = point(0, 0)) {
      const node = this.parts[id];
      show(node, Boolean(data));
      const layer = this.parts[data?.owner ? data.owner + '-props' : 'hen-objects'];
      if (node.parentElement !== layer) layer.append(node);
      if (!data) return;
      const pos = data.owner ? this.palm(data.owner) : data.position ?? data.target;
      const placed = point(pos.x - offset.x, pos.y - offset.y);
      transform(node, translate(placed));
      return placed;
    }

    paintCooking(state, ms) {
      const p = this.parts;
      show(p['hen-mill'], Boolean(state.crank));
      show(p['hen-tawa'], this.scene.id === 'roti');
      show(p['hen-meal-mat'], state.meal);
      this.prop('hen-basket', state.basket);
      opacity(p['hen-basket-load'], state.basket?.fill ?? 0);
      show(p['hen-crank'], Boolean(state.crank));
      if (state.crank) {
        const { base, target, hold } = state.crank;
        const palm = hold > .98 ? this.palm('dadi') : target;
        const shaft = 'M' + base.x + ' ' + base.y + 'L' + base.x + ' ' + (base.y - 17) +
          'L' + palm.x + ' ' + palm.y;
        p['hen-crank-dark'].setAttribute('d', shaft);
        p['hen-crank-shine'].setAttribute('d', shaft);
        transform(p['hen-crank-contact'], translate(palm));
        transform(p['hen-mill-etch'], 'translate(657 535) scale(1 .33) rotate(' + state.grindAngle * 180 / Math.PI + ')');
        p['hen-flour-stream'].setAttribute('stroke-dashoffset', String(this.reduced.matches ? 0 : -ms / 32));
        opacity(p['hen-flour-stream'], state.flourFlow);
        opacity(p['hen-flour'], state.flour);
        transform(p['hen-flour'], 'translate(740 601) scale(' + mix(.15, 1, state.flour) + ') translate(-740 -601)');
      }
      const plate = this.prop('hen-plate', state.plate, state.plate?.owner ? point(40, 0) : point(0, 0));
      if (p['hen-roti'].parentElement !== p['hen-plate'].parentElement) {
        p['hen-plate'].parentElement.insertBefore(p['hen-roti'], p['hen-plate'].nextSibling);
      }
      show(p['hen-roti'], Boolean(state.roti));
      if (state.roti) {
        const roti = state.plate.owner ? point(plate.x, plate.y - 1) : state.roti;
        transform(p['hen-roti'], translate(roti) + ' rotate(' + (state.rotiAngle ?? 0) + ')');
      }
      this.prop('hen-feed', state.dish, state.dish?.owner ? point(21, -2) : point(0, 0));
      opacity(p['hen-picked-grain'], 1 - state.pecks);
      opacity(p['hen-tongs'], state.tongs);
      if (state.tongs) {
        const palm = this.palm('dadi');
        const tip = state.tongTip;
        p['hen-tong-near'].setAttribute('d', 'M' + palm.x + ' ' + palm.y + ' Q' + (tip.x - 18) + ' ' +
          (tip.y - 28) + ' ' + tip.x + ' ' + (tip.y + 2));
        p['hen-tong-far'].setAttribute('d', 'M' + palm.x + ' ' + palm.y + ' Q' + (tip.x - 26) + ' ' +
          (tip.y - 32) + ' ' + tip.x + ' ' + (tip.y - 3));
        transform(p['hen-tong-contact'], translate(palm));
      }
    }

    draw(ms, line, word) {
      const still = this.reduced.matches;
      const state = makeFrame(this.scene, this.cue, ms, still);
      this.frameCamera(ms, line, state, still);
      this.paintField(state, ms, still);
      this.paintHen(state.hen, ms, still);
      const speech = word >= 0 ? { text: line.reading.words[word],
        phase: phase(ms - line.start, ...line.reading.timings[word]) } : null;
      for (const [id, puppet] of Object.entries(this.puppets)) {
        const pose = state.actors[id];
        const plane = this.parts[id + '-plane'];
        const shadow = this.parts[id + '-shadow'];
        show(plane, pose.visible);
        transform(plane, pose.mirror ? 'translate(' + (2 * pose.x) + ' 0) scale(-1 1)' : '');
        transform(shadow, translate(point(pose.x, pose.y + 2)));
        opacity(shadow, pose.visible);
        if (pose.visible) puppet.paint(pose, ms, line.speaker === id ? speech : null, still);
        else this.parts[id].dataset.speaking = 'false';
        const bite = state.bites[id];
        if (bite?.reach) {
          const mouth = this.mouth(id);
          const from = point(pose.x + (pose.mirror ? -63 : 64), pose.y - 95);
          const end = point(mouth.x + (pose.mirror ? -5 : 5), mouth.y + 4);
          grip(pose, hop(from, end, bite.lift, 12), bite.reach, 'pinch');
          puppet.paint(pose, ms, null, still);
        }
      }
      this.paintCooking(state, ms);
      for (const id of ['boy', 'mehar']) {
        this.prop('hen-bite-' + id, state.bites[id]?.visible ? { owner: id } : null, point(0, 5));
      }
    }
  }

  async function prepare() {
    [studio, henSource] = await Promise.all([
      open(document.getElementById('red-hen-studio')),
      fetch('../assets/props/chicken.svg').then(response => {
        if (!response.ok) throw Error('The Studio hen could not load');
        return response.text();
      }).then(svg => new DOMParser().parseFromString(svg, 'image/svg+xml'))
    ]);
  }

  window.LittlePanthStage = { Stage: HenStage, eventsFor, prepare };
})();
