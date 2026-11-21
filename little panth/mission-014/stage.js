(() => {
  'use strict';

  const phase = (value, from, to) => Math.max(0, Math.min(1, (value - from) / Math.max(Number.EPSILON, to - from)));
  const ease = t => t * t * (3 - 2 * t);
  const mix = (a, b, t) => a + (b - a) * t;
  const point = (x, y, angle = 0) => ({ x, y, angle });
  const between = (a, b, t) => point(mix(a.x, b.x, t), mix(a.y, b.y, t), mix(a.angle, b.angle, t));
  const transform = (node, value) => node.setAttribute('transform', value);
  const opacity = (node, value) => node.setAttribute('opacity', String(value));

  const { open, Character } = window.UmtoNativeCharacterPlayer;
  const cast = {
    dadi: { preset: 'elder-bibi-ji', view: 'right', height: 295, serial: 440 },
    mehar: { preset: 'kid-meher', view: 'right', height: 268, serial: 441 },
    boy: { preset: 'kid-sidak', view: 'right', height: 250, serial: 442 }
  };
  const roadStart = point(374, 615);
  const roadEnd = point(714, 615);
  const afterTurn = point(810, 619);
  const afterSpill = point(864, 624);
  const heldAtSpill = point(754, 526, 9);
  const fallen = point(754, 583, 77);
  const wetGround = point(790, 634);
  const tapside = point(849, 505);
  const eggSites = [point(393, 543), point(504, 527), point(610, 543)];
  let studio;

  const lineFor = (scene, id) => scene.lines.find(line => line.id === id);

  function wordAt(scene, id, word) {
    const line = lineFor(scene, id);
    const index = line.reading.words.findIndex(value => value.replace(/\p{P}/gu, '') === word);
    return line.start + (line.reading.timings[index]?.[0] ?? line.duration / 2);
  }

  function cuesFor(scene) {
    switch (scene.id) {
      case 'courtyard':
        return { pass: wordAt(scene, 'pail', 'ਦਿੱਤੀ') };
      case 'path':
        return { think: wordAt(scene, 'market-path', 'ਸੋਚਣ') };
      case 'daydream':
        return { hatch: wordAt(scene, 'imagine-eggs', 'ਨਿਕਲਣਗੇ'), grown: wordAt(scene, 'imagine-eggs', 'ਵੱਡੇ'),
          lay: wordAt(scene, 'sell-eggs', 'ਦੇਣਗੀਆਂ') };
      case 'scarf':
        return { scarf: wordAt(scene, 'blue-scarf', 'ਚੁੰਨੀ'), turn: wordAt(scene, 'blue-scarf', 'ਘੁੰਮੀ') };
      case 'spill': {
        const tip = wordAt(scene, 'milk-spills', 'ਝੁਕ');
        const pour = Math.max(tip + 330, wordAt(scene, 'milk-spills', 'ਦੁੱਧ') - 130);
        const drop = Math.max(pour + 500, wordAt(scene, 'milk-spills', 'ਡੁੱਲ੍ਹ') - 300);
        return { tip, pour, drop };
      }
      case 'sidak-helps':
        return { enter: lineFor(scene, 'sidak-arrives').start, lift: wordAt(scene, 'sidak-arrives', 'ਚੁੱਕੀ') };
      case 'home':
        return { unload: wordAt(scene, 'back-home', 'ਆਏ'), wash: wordAt(scene, 'back-home', 'ਧੋ'),
          place: wordAt(scene, 'back-home', 'ਰੱਖ'), finish: wordAt(scene, 'bibi-comforts', 'ਮੁਕਾ') };
    }
  }

  function eventsFor(scene) {
    const cue = cuesFor(scene);
    switch (scene.id) {
      case 'courtyard': return [{ ms: 650, sound: 'chirp' }, { ms: cue.pass + 260, sound: 'ribbon' }];
      case 'path': return [580, 1140, 1700, 2330].map(ms => ({ ms, sound: 'step' }));
      case 'daydream': return [{ ms: cue.hatch, sound: 'twig' }, { ms: cue.hatch + 280, sound: 'chirp' },
        { ms: cue.hatch + 650, sound: 'chirp' }, { ms: cue.lay + 200, sound: 'ribbon' }];
      case 'scarf': return [{ ms: cue.scarf + 220, sound: 'ribbon' }, { ms: cue.turn - 220, sound: 'step' }];
      case 'spill': return [{ ms: cue.pour + 75, sound: 'sip' }, { ms: cue.pour + 140, sound: 'plop' },
        { ms: cue.drop + 410, sound: 'twig' }];
      case 'sidak-helps': return [250, 730, 1260].map(offset => ({ ms: cue.enter + offset, sound: 'step' }));
      case 'home': return [{ ms: cue.unload + 630, sound: 'step' }, { ms: cue.wash + 170, sound: 'sip' },
        { ms: cue.place + 460, sound: 'ribbon' }];
    }
  }

  const actor = (position, visible = false) => ({ ...position, visible, lean: 0, mirror: false, grips: [] });

  function walk(actor, ms, from, to, start, end, move) {
    const progress = move(phase(ms, from, to));
    Object.assign(actor, between(start, end, progress));
    if (progress > 0 && progress < 1) actor.walk = (ms - from) / 1000;
  }

  function grip(actor, arm, target, weight = 1) {
    actor.grips[arm] = { target, weight };
  }

  function offset(pose, x, y) {
    const angle = pose.angle * Math.PI / 180;
    return point(pose.x + x * Math.cos(angle) - y * Math.sin(angle),
      pose.y + x * Math.sin(angle) + y * Math.cos(angle));
  }

  function makeFrame(scene, cue, ms, still) {
    const move = still ? Math.round : ease;
    const mehar = actor(roadEnd, true);
    const boy = actor(point(300, 566));
    const dadi = actor(point(481, 614));
    const state = { actors: { mehar, boy, dadi }, yard: false, washStation: false, rinse: 0, dream: 0,
      openingEggs: 0, hatch: [0, 0, 0], hens: 0, newEggs: 0, scarf: 0, stream: 0, stain: 0,
      milk: 1, pail: { position: heldAtSpill, owner: 'objects', visible: 1 } };
    const hold = (owner, arm, position, weight = 1) => {
      state.pail = { position, owner, arm, visible: 1, lock: 1 };
      grip(state.actors[owner], arm, position, weight);
    };

    switch (scene.id) {
      case 'courtyard': {
        state.yard = true;
        boy.visible = dadi.visible = true;
        Object.assign(boy, point(274, 596));
        mehar.mirror = true;
        walk(dadi, ms, cue.pass - 1390, cue.pass - 460, point(504, 608), point(559, 615), move);
        walk(mehar, ms, cue.pass - 1180, cue.pass - 440, point(780, 617), point(731, 616), move);
        const handoff = move(phase(ms, cue.pass - 490, cue.pass + 490));
        const pail = between(point(608, 514), point(683, 528), handoff);
        if (handoff < .51) hold('dadi', 1, pail);
        else hold('mehar', 1, pail);
        const take = ease(phase(ms, cue.pass - 440, cue.pass + 50));
        const release = ease(phase(ms, cue.pass - 30, cue.pass + 460));
        grip(mehar, 1, pail, take);
        grip(dadi, 1, pail, 1 - release);
        state.pail.lock = 1 - Math.sin(Math.PI * handoff);
        break;
      }
      case 'path': {
        const end = cue.think + 510;
        walk(mehar, ms, 90, end, roadStart, roadEnd, move);
        const swing = mehar.walk != null ? Math.sin(ms / 146) : 0;
        hold('mehar', 1, point(mehar.x + 66 + swing * 3.6, mehar.y - 88 + swing * 2, swing * 4.5));
        boy.visible = true;
        walk(boy, ms, 320, end + 740, point(139, 533), point(358, 550), move);
        break;
      }
      case 'daydream': {
        state.dream = move(phase(ms, 80, 720));
        Object.assign(mehar, between(roadEnd, point(957, 618), state.dream));
        const grow = move(phase(ms, cue.grown - 170, cue.grown + 990));
        state.openingEggs = 1 - grow;
        state.hens = grow;
        state.newEggs = move(phase(ms, cue.lay + 90, cue.lay + 780));
        state.hatch = eggSites.map((_, index) => move(phase(ms, cue.hatch - 120 + index * 155, cue.hatch + 330 + index * 205)));
        hold('mehar', 1, point(mehar.x + 66, mehar.y - 88));
        state.pail.visible = 1 - state.dream;
        break;
      }
      case 'scarf': {
        state.dream = 1 - move(phase(ms, cue.turn - 980, cue.turn - 340));
        state.scarf = state.dream * move(phase(ms, cue.scarf - 310, cue.scarf + 270));
        walk(mehar, ms, cue.turn - 520, cue.turn + 350, point(759, 613), afterTurn, move);
        const turn = move(phase(ms, cue.turn - 490, cue.turn + 330));
        mehar.mirror = turn >= .48;
        mehar.lean = still ? 0 : 8 * Math.sin(Math.PI * phase(ms, cue.turn - 520, cue.turn + 460));
        const pail = between(point(818, 525), heldAtSpill, turn);
        hold('mehar', 1, pail);
        state.pail.visible = 1 - state.dream;
        break;
      }
      case 'spill': {
        const tip = move(phase(ms, cue.tip - 170, cue.pour + 290));
        const drop = move(phase(ms, cue.drop, cue.drop + 410));
        const slanted = between(heldAtSpill, point(765, 537, 64), tip);
        const pail = between(slanted, fallen, drop);
        walk(mehar, ms, cue.drop - 40, cue.drop + 620, afterTurn, afterSpill, move);
        mehar.mirror = true;
        mehar.lean = still ? 0 : 6 * Math.sin(Math.PI * phase(ms, cue.tip - 150, cue.drop + 360));
        hold('mehar', 1, pail, 1 - ease(phase(ms, cue.drop - 180, cue.drop + 240)));
        state.pail.lock = 1 - ease(phase(ms, cue.drop - 240, cue.drop + 50));
        if (drop > .08) state.pail.owner = 'objects';
        const draining = phase(ms, cue.pour, cue.drop + 590);
        state.milk = 1 - ease(draining);
        state.stream = ease(phase(draining, 0, .13)) * (1 - ease(phase(draining, .72, 1)));
        state.stain = move(phase(ms, cue.pour + 80, cue.drop + 480));
        break;
      }
      case 'sidak-helps': {
        boy.visible = true;
        Object.assign(mehar, afterSpill);
        mehar.mirror = true;
        state.milk = 0;
        state.stain = 1;
        walk(boy, ms, cue.enter - 90, cue.lift - 610, point(333, 583), point(686, 620), move);
        const lift = move(phase(ms, cue.lift - 100, cue.lift + 490));
        const pail = between(fallen, point(749, 533), lift);
        const reach = ease(phase(ms, cue.lift - 490, cue.lift - 60));
        hold('boy', 1, pail, reach);
        state.pail.lock = ease(phase(lift, .05, .52));
        if (lift < .035) state.pail.owner = 'objects';
        boy.lean = still ? 0 : 9 * reach * (1 - lift);
        break;
      }
      case 'home': {
        state.yard = state.washStation = true;
        boy.visible = dadi.visible = true;
        state.milk = 0;
        walk(mehar, ms, 0, cue.unload + 460, point(1020, 640), point(681, 620), move);
        mehar.mirror = ms < cue.unload + 460;
        walk(boy, ms, 50, cue.unload + 350, point(1172, 630), point(908, 618), move);
        boy.mirror = true;
        const put = move(phase(ms, cue.unload + 400, cue.unload + 1010));
        const delivered = between(point(boy.x - 61, boy.y - 88), tapside, put);
        hold('boy', 1, delivered, 1 - ease(phase(ms, cue.unload + 985, cue.unload + 1360)));
        state.pail.lock = 1 - ease(phase(put, .56, 1));
        if (put > .99) state.pail.owner = 'objects';
        const washing = ease(phase(ms, cue.wash - 260, cue.wash + 250)) *
          (1 - ease(phase(ms, cue.place + 140, cue.place + 680)));
        state.pail.position = between(state.pail.position, point(843, 509, 15), washing);
        grip(mehar, 1, state.pail.position, washing);
        state.rinse = phase(ms, cue.wash, cue.wash + 220) * (1 - phase(ms, cue.place + 60, cue.place + 420));
        if (ms >= cue.wash - 1170) {
          walk(mehar, ms, cue.wash - 1170, cue.wash - 350, point(681, 620), point(766, 622), move);
          mehar.mirror = false;
        }
        if (ms >= cue.place + 710) {
          walk(mehar, ms, cue.place + 710, cue.place + 1620, point(766, 622), point(675, 622), move);
          mehar.mirror = true;
        }
        if (ms >= cue.unload + 1150) {
          walk(boy, ms, cue.unload + 1150, cue.unload + 2340, point(908, 618), point(1038, 613), move);
          boy.mirror = false;
        }
        break;
      }
    }
    return state;
  }

  function eggSprite(group, index) {
    group.insertAdjacentHTML('beforeend',
      '<g id="hatch-' + index + '"><use data-whole href="#egg"/><use data-lid href="#shell-top"/>' +
      '<use data-chick href="#chick-art"/><use data-shell href="#shell-bottom"/></g>');
    const root = group.lastElementChild;
    return { root, whole: root.querySelector('[data-whole]'), lid: root.querySelector('[data-lid]'),
      chick: root.querySelector('[data-chick]'), shell: root.querySelector('[data-shell]') };
  }

  class PailStage {
    constructor(svg) {
      this.svg = svg;
      this.camera = new window.UmtoCamera.DeliveryCamera(svg);
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.parts = Object.fromEntries([...svg.querySelectorAll('[id]')].map(node => [node.id, node]));
      this.eggs = eggSites.map((_, index) => eggSprite(this.parts.hatchery, index));
      this.puppets = Object.fromEntries(Object.entries(cast).map(([id, spec]) => [
        id, new Character(studio, svg, this.parts[id], this.parts[id + '-props'], spec)
      ]));
    }

    select(scene) {
      this.scene = scene;
      this.cue = cuesFor(scene);
      this.lastShot = '';
    }

    frame(ms, line, still, state) {
      const { id, framing, focus } = this.scene;
      const cue = this.cue;
      const shotAt = (preset, x, y, width, motion = 'static') =>
        ({ preset, focus: point(x, y), width, motion, parallax: motion === 'tracking' });
      let shot = { preset: framing, focus };
      const mehar = state.actors.mehar;
      if (id === 'courtyard' && ms >= cue.pass - 1610) {
        shot = shotAt('two-shot', 621, 445, 786);
      } else if (id === 'path' && mehar.walk != null && !still) {
        shot = shotAt('full', Math.round(mehar.x + 42), 432, 1030, 'tracking');
      } else if (id === 'path' && line.speaker === 'mehar') {
        shot = shotAt('medium', 727, 461, 741);
      } else if (id === 'daydream' && ms >= cue.hatch - 680 && ms < cue.grown - 240) {
        shot = shotAt('detail', 516, 469, 703);
      } else if (id === 'daydream' && state.hens > .3) {
        shot = shotAt('full', 729, 419, 1050);
      } else if (id === 'scarf' && state.dream > .55) {
        shot = shotAt('medium-close', 742, 440, 653);
      } else if (id === 'scarf') {
        shot = shotAt('medium', 757, 458, 754);
      } else if (id === 'spill' && ms < cue.tip - 180) {
        shot = shotAt('medium', 782, 455, 768);
      } else if (id === 'sidak-helps' && ms < cue.lift - 380) {
        shot = shotAt('full', Math.round((state.actors.boy.x + mehar.x) / 2 + 45), 449, 1110,
          still ? 'static' : 'tracking');
      } else if (id === 'sidak-helps') {
        shot = shotAt('two-shot', 763, 455, 805);
      } else if (id === 'home' && ms >= cue.wash - 600 && ms < cue.place + 510) {
        shot = shotAt('detail', 819, 499, 697);
      } else if (id === 'home' && line.speaker === 'dadi' && ms < cue.finish) {
        shot = shotAt('two-shot', 584, 436, 787);
      }
      const key = [shot.preset, shot.focus.x, shot.focus.y, shot.width, shot.motion].join('/');
      if (this.lastShot === key) return;
      this.camera.cue({ ...shot, cut: true });
      this.lastShot = key;
    }

    paintDream(state, ms, still) {
      const p = this.parts;
      opacity(p.dream, state.dream);
      opacity(p.nest, state.openingEggs);
      opacity(p.hatchery, state.openingEggs);
      opacity(p['chicken-yard'], state.hens);
      opacity(p['new-eggs'], state.newEggs);
      this.eggs.forEach(({ root, whole, lid, chick, shell }, index) => {
        const hatch = state.hatch[index];
        const site = eggSites[index];
        const wobble = still ? 0 : hatch > 0 && hatch < 1 ? 5 * Math.sin(ms / 48 + index) : 1.5 * Math.sin(ms / 270 + index);
        const hop = still ? 0 : hatch * 4 * Math.abs(Math.sin(ms / 159 + index));
        transform(root, 'translate(' + site.x + ' ' + site.y + ') rotate(' + wobble + ')');
        opacity(whole, 1 - phase(hatch, 0, .27));
        opacity(lid, phase(hatch, 0, .22));
        opacity(shell, phase(hatch, 0, .26));
        opacity(chick, phase(hatch, .16, .66));
        transform(lid, 'translate(' + (-26 * hatch) + ' ' + (-19 * hatch) + ') rotate(' + (-59 * hatch) + ')');
        transform(chick, 'translate(' + (9 * hatch) + ' ' + (-12 * hatch - hop) + ') scale(' + mix(.72, 1.07, hatch) + ')');
        root.dataset.hatched = String(hatch >= .83 && state.openingEggs > .2);
      });
      const drift = this.scene.id === 'daydream' ? ease(phase(ms, this.cue.grown, this.cue.lay + 980)) : 0;
      [point(402, 551), point(604, 509), point(767, 562)].forEach((hen, index) => {
        const sway = still ? 0 : Math.sin(ms / 330 + index);
        transform(p[['hen-one', 'hen-two', 'hen-three'][index]],
          'translate(' + (hen.x + (still ? 1 : drift) * (index === 1 ? -19 : 43)) + ' ' +
          (hen.y - Math.abs(sway) * 4) + ') scale(' + (index === 1 ? '-.86 .86' : '.92') +
          ') rotate(' + (sway * 5) + ')');
      });
      const head = state.actors.mehar;
      opacity(p['imagined-scarf'], state.scarf);
      transform(p['imagined-scarf'], 'translate(' + (head.x + 4) + ' ' + (head.y - cast.mehar.height + 13) +
        ') rotate(' + (still ? 0 : Math.sin(ms / 290) * 3) + ')');
    }

    paintProps(state) {
      const p = this.parts;
      opacity(p['yard-background'], Number(state.yard));
      opacity(p['wash-station'], Number(state.washStation));
      const { owner, arm, visible, lock } = state.pail;
      let position = state.pail.position;
      if (owner !== 'objects' && lock > 0 && visible > 0) {
        const hand = this.puppets[owner].arms[arm].querySelector('[data-action-hand]');
        const palm = new DOMPoint(0, Number(hand.dataset.gripY)).matrixTransform(hand.getScreenCTM())
          .matrixTransform(this.svg.getScreenCTM().inverse());
        position = between(position, point(palm.x, palm.y, position.angle), lock);
      }
      const parent = p[owner === 'objects' ? owner : owner + '-props'];
      if (p.pail.parentElement !== parent) parent.append(p.pail);
      transform(p.pail, 'translate(' + position.x + ' ' + position.y + ') rotate(' + position.angle + ')');
      opacity(p.pail, visible);
      opacity(p['milk-level'], state.milk);
      opacity(p.puddle, state.stain);
      transform(p.puddle, 'translate(' + wetGround.x + ' ' + wetGround.y + ') scale(' + Math.max(.04, state.stain) + ' ' +
        mix(.3, 1, state.stain) + ')');
      opacity(p['spill-stream'], state.stream);
      if (state.stream > 0) {
        const lip = offset(position, 39, 30);
        const stream = 'M' + lip.x + ' ' + lip.y + ' Q' + (lip.x + 28) + ' ' + (lip.y + 19) + ' ' +
          wetGround.x + ' ' + wetGround.y;
        p['milk-ribbon'].setAttribute('d', stream);
        p['milk-glint'].setAttribute('d', stream);
        transform(p.splash, 'translate(' + wetGround.x + ' ' + wetGround.y + ') scale(' + state.stream + ')');
      }
      opacity(p['rinse-stream'], state.rinse);
      if (state.rinse > 0) {
        const mouth = offset(position, 0, 30);
        const water = 'M842 496 Q849 513 ' + mouth.x + ' ' + mouth.y;
        p['rinse-water'].setAttribute('d', water);
        p['rinse-glint'].setAttribute('d', water);
      }
      this.svg.dataset.pail = state.milk === 1 ? 'full' : state.milk > 0 ? 'pouring' : 'empty';
    }

    draw(ms, line, word) {
      const still = this.reduced.matches;
      const state = makeFrame(this.scene, this.cue, ms, still);
      this.frame(ms, line, still, state);
      this.paintDream(state, ms, still);
      const reading = word >= 0 ? {
        text: line.reading.words[word],
        phase: phase(ms - line.start, ...line.reading.timings[word])
      } : null;
      for (const [id, puppet] of Object.entries(this.puppets)) {
        const pose = state.actors[id];
        const plane = this.parts[id + '-plane'];
        plane.setAttribute('visibility', pose.visible ? 'visible' : 'hidden');
        transform(plane, pose.mirror ? 'translate(' + (2 * pose.x) + ' 0) scale(-1 1)' : '');
        const shadow = this.parts[id + '-shadow'];
        opacity(shadow, Number(pose.visible));
        shadow.setAttribute('cx', pose.x);
        shadow.setAttribute('cy', pose.y + 1);
        if (pose.visible) puppet.paint(pose, ms, line.speaker === id ? reading : null, still);
        else this.parts[id].dataset.speaking = 'false';
      }
      this.paintProps(state);
    }
  }

  async function prepare() {
    studio = await open(document.getElementById('milk-pail-studio'));
  }

  window.LittlePanthStage = { Stage: PailStage, eventsFor, prepare };
})();
