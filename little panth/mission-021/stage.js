(() => {
  'use strict';

  const { open, Character, voiceFrame } = window.UmtoNativeCharacterPlayer;
  const cast = {
    baldev: { preset: 'elder-baldev', view: 'right', height: 298, serial: 521 },
    pari: { preset: 'adult-anaya', view: 'right', height: 281, serial: 522 }
  };
  const ns = 'http://www.w3.org/2000/svg';
  const metals = ['gold', 'silver', 'iron'];
  const phase = (n, a, b) => Math.min(1, Math.max(0, (n - a) / Math.max(1, b - a)));
  const ease = t => t * t * (3 - 2 * t);
  const mix = (a, b, t) => a + (b - a) * t;
  const point = (x, y) => ({ x, y });
  const between = (a, b, t) => point(mix(a.x, b.x, t), mix(a.y, b.y, t));
  const translated = ({ x, y }) => 'translate(' + x + ' ' + y + ')';
  const transform = (node, value) => node.setAttribute('transform', value);
  const opacity = (node, value) => node.setAttribute('opacity', String(value));
  const show = (node, value) => node.setAttribute('visibility', value ? 'visible' : 'hidden');
  const handle = point(3, 11);
  const bladeCorner = point(35, -44);
  const rockContact = point(650, 549);
  const waterContact = point(721, 585);
  const releaseAt = point(562, 489);
  const rockAngle = 129;
  const waterAngle = 170;
  const ledge = { gold: point(730, 535), silver: point(731, 547) };
  const tableAngle = { gold: 85, silver: 93 };
  const presented = point(751, 493);
  const exchange = point(685, 460);
  const firewoodSite = point(564, 553);
  const bagSite = point(639, 551);
  const bank = point(495, 622);
  const steppingStone = point(802, 608);
  let studio;

  function lineFor(scene, id) {
    return scene.lines.find(line => line.id === id);
  }

  function wordAt(scene, id, word) {
    const line = lineFor(scene, id);
    const words = line.reading.words.map(value => value.replace(/\p{P}/gu, ''));
    const index = words.indexOf(word);
    return line.start + (line.reading.timings[index]?.[0] ?? line.duration / 2);
  }

  function cuesFor(scene) {
    switch (scene.id) {
      case 'riverbank':
        return { stop: wordAt(scene, 'morning-by-the-river', 'ਰੁਕਿਆ') };
      case 'splash': {
        const slip = wordAt(scene, 'the-axe-slips', 'ਫਿਸਲ');
        const hit = Math.max(slip + 520, wordAt(scene, 'the-axe-slips', 'ਵੱਜੀ') + 25);
        return { slip, release: Math.max(slip + 55, hit - 1120), hit,
          water: Math.max(hit + 290, Math.min(hit + 1170, wordAt(scene, 'the-axe-slips', 'ਛਪਾਕ') + 80)) };
      }
      case 'lost-tool':
        return { home: wordAt(scene, 'baldev-remembers-his-father', 'ਪਿਉ') };
      case 'gold-axe':
        return { appear: wordAt(scene, 'the-river-fairy', 'ਦਿਸੀ'), gold: wordAt(scene, 'the-river-fairy', 'ਸੋਨੇ') };
      case 'silver-axe':
        return { silver: wordAt(scene, 'silver-and-iron', 'ਚਾਂਦੀ'), shake: wordAt(scene, 'silver-and-iron', 'ਹਿਲਾਇਆ'),
          iron: wordAt(scene, 'silver-and-iron', 'ਪੁਰਾਣੇ') };
      case 'honest-return':
        return { recognize: wordAt(scene, 'baldev-recognizes-the-axe', 'ਮੇਰੀ'),
          give: wordAt(scene, 'fairy-rewards-honesty', 'ਲੈ'), award: wordAt(scene, 'fairy-rewards-honesty', 'ਦੋ') };
      case 'homeward':
        return { pack: wordAt(scene, 'baldev-heads-home', 'ਪਾਈਆਂ'), lift: wordAt(scene, 'baldev-heads-home', 'ਚੁੱਕੀ'),
          walk: wordAt(scene, 'baldev-heads-home', 'ਤੁਰ') };
    }
  }

  function eventsFor(scene) {
    const c = cuesFor(scene);
    switch (scene.id) {
      case 'riverbank': return [490, 1100, 1840].map(ms => ({ ms, sound: 'step' }));
      case 'splash': return [{ ms: c.hit, sound: 'twig' }, { ms: c.water, sound: 'plop' }, { ms: c.water + 130, sound: 'sip' }];
      case 'lost-tool': return [];
      case 'gold-axe': return [{ ms: c.appear, sound: 'ribbon' }];
      case 'silver-axe': return [{ ms: c.silver + 100, sound: 'ribbon' }, { ms: c.iron + 210, sound: 'twig' }];
      case 'honest-return': return [{ ms: c.give + 125, sound: 'twig' }];
      case 'homeward': return [{ ms: c.pack, sound: 'twig' }, { ms: c.lift, sound: 'twig' },
        { ms: c.walk + 140, sound: 'step' }, { ms: c.walk + 450, sound: 'step' }];
    }
  }

  function rotate({ x, y }, angle) {
    const a = angle * Math.PI / 180;
    return point(x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a));
  }

  function anchorFor(touch, angle) {
    const offset = rotate(point(bladeCorner.x - handle.x, bladeCorner.y - handle.y), angle);
    return point(touch.x - offset.x, touch.y - offset.y);
  }

  function arc(from, to, t, height) {
    return point(mix(from.x, to.x, t), mix(from.y, to.y, t) - height * Math.sin(Math.PI * t));
  }

  function walk(pose, from, to, ms, start, end, movement) {
    const t = phase(ms, start, end);
    Object.assign(pose, between(from, to, movement(t)));
    if (t > 0 && t < 1) pose.walk = (ms - start) / 1000;
  }

  function grip(pose, target, weight = 1, arm = 1) {
    pose.grips[arm] = { target, weight };
  }

  function frameFor(scene, c, ms, still) {
    const movement = still ? Math.round : ease;
    const motion = (a, b) => movement(phase(ms, a, b));
    const pulse = (a, b, d, e) => motion(a, b) * (1 - motion(d, e));
    const baldev = { ...bank, visible: 1, mirror: false, lean: 0, grips: [] };
    const pari = { ...steppingStone, visible: 0, mirror: true, lean: 0, grips: [] };
    const frame = { actors: { baldev, pari }, tools: {}, branch: null, bag: null, splash: 0, ripple: 0,
      shine: 0, flap: 0, status: 'bank' };

    function held(metal, owner, target, angle, weight = 1, arm = 1) {
      frame.tools[metal] = { owner, angle, position: target, arm };
      grip(frame.actors[owner], target, weight, arm);
    }

    function setAside(metal) {
      frame.tools[metal] = { position: ledge[metal], angle: tableAngle[metal], layer: 'woodcut-ledge-props' };
    }

    switch (scene.id) {
      case 'riverbank': {
        walk(baldev, point(195, 631), bank, ms, 250, c.stop + 380, movement);
        const sway = still || baldev.walk == null ? 0 : Math.sin(baldev.walk * 8);
        held('iron', 'baldev', point(baldev.x + 65, baldev.y - 89 + 2 * sway), 26 + 5 * sway);
        frame.status = 'carried';
        break;
      }
      case 'splash': {
        const raise = motion(c.slip - 1420, c.slip - 170);
        const target = between(point(bank.x + 65, bank.y - 89), releaseAt, raise);
        const rest = 1 - motion(c.hit - 175, c.hit + 330);
        baldev.lean = still ? 0 : 4 * pulse(c.release + 75, c.release + 310, c.water + 40, c.water + 700);
        grip(baldev, target, rest);
        if (ms < c.release) {
          held('iron', 'baldev', target, mix(26, -21, raise));
          frame.status = 'held';
        } else if (ms <= c.hit) {
          frame.tools.iron = { angle: mix(-21, rockAngle, phase(ms, c.release, c.hit)),
            flight: phase(ms, c.release, c.hit), position: target };
          frame.status = 'falling';
        } else if (ms < c.water) {
          const t = phase(ms, c.hit, c.water);
          frame.tools.iron = { angle: mix(rockAngle, waterAngle, t), position: arc(
            anchorFor(rockContact, rockAngle), anchorFor(waterContact, waterAngle), t, still ? 0 : 13) };
          frame.status = 'bounced';
        } else if (ms < c.water + 430) {
          const t = phase(ms, c.water, c.water + 430);
          const entry = anchorFor(waterContact, waterAngle);
          frame.tools.iron = { angle: waterAngle, position: point(entry.x + t * 13, entry.y + t * 35), alpha: 1 - t };
          frame.status = 'submerged';
        } else {
          frame.status = 'submerged';
        }
        frame.splash = pulse(c.water - 1, c.water + 130, c.water + 220, c.water + 690);
        frame.ripple = phase(ms, c.water, c.water + 1900);
        break;
      }
      case 'lost-tool':
        frame.ripple = mix(.5, 1, phase(ms, 0, c.home + 380));
        baldev.lean = still ? 0 : 4 * (1 - ease(phase(ms, c.home, c.home + 520)));
        frame.status = 'submerged';
        break;
      case 'gold-axe': {
        pari.visible = motion(c.appear - 870, c.appear + 360);
        const raise = motion(c.gold - 220, c.gold + 410);
        held('gold', 'pari', between(point(754, 536), presented, raise), -11 - 7 * raise);
        frame.tools.gold.alpha = pari.visible;
        frame.shine = pulse(c.appear - 380, c.appear + 210, c.gold + 940, c.gold + 1620);
        break;
      }
      case 'silver-axe': {
        pari.visible = 1;
        const goldEnd = c.silver - 180;
        const setGold = motion(0, goldEnd);
        const goldRelease = motion(goldEnd - 180, goldEnd);
        if (setGold < 1) {
          const target = between(presented, point(735, 506), setGold);
          held('gold', 'pari', target, mix(-18, tableAngle.gold, setGold));
          if (goldRelease > 0) frame.tools.gold.settle = { rest: ledge.gold, progress: goldRelease };
        } else setAside('gold');

        const raiseSilver = motion(c.silver - 130, c.silver + 540);
        const setSilver = motion(c.iron - 880, c.iron - 140);
        const silverRelease = motion(c.iron - 310, c.iron - 140);
        if (raiseSilver > 0 && setSilver < 1) {
          const palm = between(between(point(764, 540), presented, raiseSilver), point(735, 507), setSilver);
          held('silver', 'pari', palm, mix(-12, tableAngle.silver, setSilver));
          frame.tools.silver.alpha = raiseSilver;
          if (silverRelease > 0) frame.tools.silver.settle = { rest: ledge.silver, progress: silverRelease };
        } else if (setSilver === 1) setAside('silver');

        const raiseIron = motion(c.iron - 100, c.iron + 610);
        if (raiseIron > 0) {
          held('iron', 'pari', between(point(770, 539), presented, raiseIron), mix(11, -15, raiseIron));
          frame.tools.iron.alpha = raiseIron;
        }
        baldev.lean = still ? 0 : -4.5 * Math.sin((ms - c.shake) / 75) *
          pulse(c.shake - 160, c.shake + 100, c.shake + 390, c.shake + 610);
        frame.shine = pulse(c.silver - 160, c.silver + 300, c.silver + 740, c.silver + 1220);
        break;
      }
      case 'honest-return': {
        pari.visible = 1;
        setAside('gold');
        setAside('silver');
        walk(baldev, bank, point(612, 621), ms, c.recognize - 880, c.recognize + 700, movement);
        Object.assign(pari, between(steppingStone, point(760, 608), motion(c.give - 1100, c.give - 430)));
        const pass = motion(c.give - 600, c.give - 35);
        const keep = motion(c.give + 190, c.give + 840);
        const target = between(presented, exchange, pass);
        const angle = mix(-15, -8, pass);
        const offset = rotate(point(1, 17), angle);
        const takeAt = point(target.x + offset.x, target.y + offset.y);
        grip(pari, target, 1 - motion(c.give + 160, c.give + 560));
        grip(baldev, between(takeAt, point(baldev.x + 63, baldev.y - 105), keep),
          motion(c.give - 650, c.give + 45));
        const passed = ms >= c.give + 130;
        frame.tools.iron = { owner: passed ? 'baldev' : 'pari', angle: mix(angle, 18, keep),
          secondGrip: passed, position: target };
        const presentAward = pulse(c.award - 240, c.award + 80, c.award + 480, c.award + 930);
        if (presentAward > .01) grip(pari, point(778, 548), presentAward, 0);
        frame.status = passed ? 'returned' : 'offered';
        break;
      }
      case 'homeward': {
        pari.visible = 1 - motion(c.walk - 260, c.walk + 920);
        Object.assign(baldev, point(528, 623));
        const nearBag = point(587, 623);
        walk(baldev, point(528, 623), nearBag, ms, c.pack - 2060, c.pack - 1100, movement);
        const packOrder = ['gold', 'silver', 'iron'];
        for (const [index, metal] of packOrder.entries()) {
          const start = c.pack - 1250 + 500 * index;
          const toBag = motion(start, start + 365);
          const tuck = motion(start + 365, start + 495);
          const nearby = point(639 + 15 * index, 536 - 15 * index);
          const opening = point(bagSite.x + 2, bagSite.y + 2 + 13 * tuck);
          const target = between(nearby, opening, toBag);
          if (ms < start) {
            frame.tools[metal] = { position: nearby, angle: 48 + 17 * index };
          } else if (tuck < 1) {
            held(metal, 'baldev', target, mix(48 + 17 * index, 150, toBag));
            frame.tools[metal].alpha = 1 - tuck;
          }
        }
        const packed = motion(c.pack + 260, c.pack + 610);
        frame.flap = packed;
        const lift = motion(c.lift - 90, c.lift + 550);
        const bagReach = motion(c.pack + 530, c.pack + 950);
        const bagLift = motion(c.pack + 950, c.pack + 1490);
        const woodSide = point(607, 623);
        const leaving = Math.max(c.walk - 320, c.lift + 390);
        if (ms >= c.pack + 500) {
          baldev.mirror = true;
          walk(baldev, nearBag, woodSide, ms, c.pack + 500, c.lift - 290, movement);
        }
        if (ms >= leaving) {
          walk(baldev, woodSide, point(268, 625), ms, leaving, scene.duration - 110, movement);
        }
        const branchCarry = point(baldev.x + (baldev.mirror ? -59 : 66), baldev.y - 104);
        const branchTarget = between(firewoodSite, branchCarry, lift);
        const bagCarry = point(baldev.x + (baldev.mirror ? 49 : -50), baldev.y - 76);
        const bagTarget = between(bagSite, bagCarry, bagLift);
        frame.branch = { position: branchTarget, owner: lift > 0 ? 'baldev' : null,
          angle: -4 + (still ? 0 : lift * 4 * Math.sin(ms / 183)) };
        frame.bag = { position: bagTarget, owner: bagReach >= 1 ? 'baldev' : null, arm: 0, angle: -4 };
        if (lift > 0) grip(baldev, branchTarget);
        else if (ms > c.lift - 430) grip(baldev, firewoodSite, motion(c.lift - 430, c.lift - 90));
        if (bagReach > 0) grip(baldev, bagTarget, bagReach, 0);
        frame.status = packed >= 1 ? 'packed' : 'packing';
        break;
      }
    }
    return frame;
  }

  class RiverStage {
    constructor(svg) {
      this.svg = svg;
      this.camera = new window.UmtoCamera.DeliveryCamera(svg);
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.parts = Object.fromEntries([...svg.querySelectorAll('[id]')].map(node => [node.id, node]));
      this.puppets = Object.fromEntries(Object.entries(cast).map(([id, spec]) => [
        id, new Character(studio, svg, this.parts[id], this.parts[id + '-props'], spec)
      ]));
      this.sparkles = Array.from({ length: 17 }, (_, index) => {
        const line = document.createElementNS(ns, 'path');
        line.setAttribute('d', 'M0 0Q13-3 ' + (22 + index % 5 * 8) + ' -3');
        this.parts['woodcut-current'].append(line);
        return line;
      });
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
      if (id === 'riverbank' && ms >= 1420 && state.actors.baldev.walk != null) {
        shot = shotAt('full', Math.round(state.actors.baldev.x + 133), 432, 1040, still ? 'static' : 'tracking');
      } else if (id === 'splash') {
        shot = ms < c.release ? shotAt('detail', 552, 452, 665) : shotAt('detail', 664, 507, 675);
      } else if (id === 'gold-axe' && line.speaker === 'pari') {
        shot = shotAt('two-shot', 687, 428, 895);
      } else if (id === 'silver-axe' && ms >= c.iron + 210) {
        shot = shotAt('detail', 745, 445, 624);
      } else if (id === 'honest-return' && ms > c.give - 370 && ms < c.give + 690) {
        shot = shotAt('detail', 693, 465, 703);
      } else if (id === 'homeward' && ms < c.lift + 300) {
        shot = shotAt('full', 665, 463, 984);
      } else if (id === 'homeward' && state.actors.baldev.walk != null && ms >= c.walk) {
        shot = shotAt('full', Math.round(state.actors.baldev.x + 148), 429, 1040, still ? 'static' : 'tracking');
      }
      const shotKey = [shot.preset, shot.focus.x, shot.focus.y, shot.width, shot.motion].join('/');
      if (this.shot !== shotKey) {
        this.camera.cue({ ...shot, cut: true });
        this.shot = shotKey;
      }
    }

    palm(id, arm = 1) {
      const hand = this.puppets[id].arms[arm].querySelector('[data-action-hand]');
      return new DOMPoint(0, Number(hand.dataset.gripY)).matrixTransform(hand.getScreenCTM())
        .matrixTransform(this.svg.getScreenCTM().inverse());
    }

    paintProp(node, pose, tool = false) {
      show(node, Boolean(pose));
      const layer = this.parts[pose?.owner ? pose.owner + '-props' : pose?.layer ?? 'woodcut-objects'];
      if (node.parentElement !== layer) layer.append(node);
      if (!pose) return;
      let p = pose.owner ? this.palm(pose.owner, pose.arm) : pose.position;
      if (pose.flight != null) {
        let from = releaseAt;
        if (pose.flight < .099) from = this.palm('baldev');
        p = arc(from, anchorFor(rockContact, rockAngle), pose.flight, this.reduced.matches ? 0 : 13);
      }
      if (pose.settle) p = between(p, pose.settle.rest, pose.settle.progress);
      if (pose.secondGrip) {
        const offset = rotate(point(1, 17), pose.angle);
        p = point(p.x - offset.x, p.y - offset.y);
      }
      const pivot = tool ? translated(point(-handle.x, -handle.y)) : '';
      transform(node, translated(p) + ' rotate(' + pose.angle + ') ' + pivot);
      opacity(node, pose.alpha ?? 1);
      node.dataset.owner = pose.owner ?? 'none';
    }

    draw(ms, line, word) {
      const still = this.reduced.matches;
      const state = frameFor(this.scene, this.cue, ms, still);
      const p = this.parts;
      this.frameCamera(ms, line, state, still);
      const spoken = voiceFrame(line, word, ms);
      for (const [id, puppet] of Object.entries(this.puppets)) {
        const pose = state.actors[id];
        const plane = p[id + '-plane'];
        const shadow = p[id + '-shadow'];
        show(plane, pose.visible > 0);
        opacity(plane, pose.visible);
        transform(plane, pose.mirror ? 'translate(' + (2 * pose.x) + ' 0) scale(-1 1)' : '');
        transform(shadow, translated(point(pose.x, pose.y + 5)));
        opacity(shadow, pose.visible);
        if (pose.visible > 0) puppet.paint(pose, ms, line.speaker === id ? spoken : null, still);
        else p[id].dataset.speaking = 'false';
      }

      for (const metal of metals) this.paintProp(p[metal + '-axe'], state.tools[metal], true);
      this.paintProp(p['woodcut-firewood'], state.branch);
      this.paintProp(p['woodcut-satchel'], state.bag);
      opacity(p['woodcut-bag-flap'], state.flap);
      opacity(p['woodcut-splash'], Math.max(state.splash, state.ripple < 1 ? Math.sin(Math.PI * state.ripple) * .57 : 0));
      opacity(p['woodcut-droplets'], state.splash);
      transform(p['woodcut-ring'], 'scale(' + mix(.06, 1.41, state.ripple) + ' ' + mix(.15, 1.07, state.ripple) + ')');
      opacity(p['woodcut-river-shimmer'], state.shine * .66);
      this.sparkles.forEach((path, index) => {
        const wave = still ? 0 : ms / 62;
        const x = 651 + (index * 57 + wave) % 672;
        const y = 488 + (index * 71 % 215);
        transform(path, translated(point(x, y)));
        opacity(path, still ? .27 : .21 + .13 * Math.cos(ms / 630 + index));
      });
      this.svg.dataset.tool = state.status;
    }
  }

  async function prepare() {
    studio = await open(document.getElementById('woodcutter-studio'));
  }

  window.LittlePanthStage = { Stage: RiverStage, eventsFor, prepare };
})();
