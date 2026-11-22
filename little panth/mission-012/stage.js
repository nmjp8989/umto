(() => {
  'use strict';

  const clamp = n => Math.min(1, Math.max(0, n));
  const phase = (ms, start, end) => clamp((ms - start) / Math.max(1, end - start));
  const ease = t => t * t * (3 - 2 * t);
  const mix = (a, b, t) => a + (b - a) * t;
  const point = (x, y, angle = 0) => ({ x, y, angle });
  const between = (a, b, t) => point(mix(a.x, b.x, t), mix(a.y, b.y, t), mix(a.angle, b.angle, t));
  const transform = (node, value) => node.setAttribute('transform', value);
  const opacity = (node, value) => node.setAttribute('opacity', String(value));
  const { open, Character, voiceFrame } = window.UmtoNativeCharacterPlayer;
  const cast = {
    dadi: { preset: 'elder-bibi-ji', view: 'left', height: 315, serial: 420 },
    mehar: { preset: 'kid-meher', view: 'right', height: 290, serial: 421 },
    boy: { preset: 'kid-sidak', view: 'left', height: 287, serial: 422 }
  };
  const clay = point(570, 522);
  const glaze = point(764, 513);
  const pouch = point(646, 472);
  const canRest = point(479, 493);
  const canPour = point(493, 442, 22);
  const soil = point(clay.x, clay.y - 68);
  let studio;

  function wordAt(scene, id, word) {
    const line = scene.lines.find(entry => entry.id === id);
    const index = line.reading.words.findIndex(value => value.replace(/\p{P}/gu, '') === word);
    return line.start + (line.reading.timings[index]?.[0] ?? line.duration / 2);
  }

  function cuesFor(scene) {
    switch (scene.id) {
      case 'seeds':
        return { opening: Math.min(1960, wordAt(scene, 'the-pouch', 'ਵਿਹੜੇ')),
          invite: wordAt(scene, 'the-pouch', 'ਸੱਦਿਆ'), share: wordAt(scene, 'bibi-invites', 'ਬੀਜ') };
      case 'planting':
        return { plant: wordAt(scene, 'plant-and-water', 'ਰੱਖਿਆ'),
          water: wordAt(scene, 'plant-and-water', 'ਪਾਣੀ') };
      case 'waiting':
        return { days: wordAt(scene, 'days-pass', 'ਦਿਨ'), look: wordAt(scene, 'days-pass', 'ਵੇਖਦੀ') };
      case 'return':
        return { enter: wordAt(scene, 'sidak-returns', 'ਸਿਦਕ'), pickup: wordAt(scene, 'sidak-returns', 'ਚੁੱਕਿਆ') };
      case 'honesty':
        return { setDown: wordAt(scene, 'mehar-tells', 'ਗਮਲਾ') };
      case 'reveal':
        return { setDown: scene.lines[0].start + 1050 };
      case 'new-growth':
        return { fresh: wordAt(scene, 'second-chance', 'ਨਵੇਂ'),
          days: wordAt(scene, 'second-chance', 'ਦਿਨਾਂ'), leaves: wordAt(scene, 'second-chance', 'ਪੱਤੇ') };
    }
  }

  function eventsFor(scene) {
    const cue = cuesFor(scene);
    switch (scene.id) {
      case 'seeds': return [{ ms: 460, sound: 'chirp' }, { ms: cue.share + 560, sound: 'ribbon' }];
      case 'planting': return [{ ms: cue.plant + 305, sound: 'step' }, { ms: cue.water + 20, sound: 'sip' }];
      case 'waiting': return [{ ms: cue.look, sound: 'chirp' }];
      case 'return': return [{ ms: cue.enter + 340, sound: 'step' }, { ms: cue.enter + 870, sound: 'step' }];
      case 'honesty': return [{ ms: cue.setDown + 410, sound: 'step' }];
      case 'reveal': return [{ ms: cue.setDown + 410, sound: 'step' }];
      case 'new-growth': return [{ ms: cue.leaves + 320, sound: 'chirp' }];
    }
  }

  function offset(pose, x, y) {
    const angle = pose.angle * Math.PI / 180;
    return point(pose.x + x * Math.cos(angle) - y * Math.sin(angle),
      pose.y + x * Math.sin(angle) + y * Math.cos(angle));
  }

  function grip(actor, index, target, weight = 1, hand, elbow) {
    actor.grips[index] = { target, weight, hand, elbow };
  }

  function holdPot(actor, position, weight = 1) {
    // Angle the elbows outside the pot so the hands carry its sides.
    grip(actor, 0, offset(position, -34, -33), weight, 'fist', 'up');
    grip(actor, 1, offset(position, 34, -33), weight, 'fist', 'up');
  }

  const carriedPot = (actor, x, bounce = 0) => point(actor.x + x, actor.y - 74 + bounce);

  function walk(actor, ms, start, end, left, right, move) {
    const progress = move(phase(ms, start, end));
    actor.x = mix(left, right, progress);
    if (progress > 0 && progress < 1) actor.walk = (ms - start) / 1000;
    return progress;
  }

  const actor = (x, y, visible = true) => ({ x, y, visible, lean: 0, grips: [] });
  const prop = (position, owner = 'bench', visible = 1) => ({ position, owner, visible });

  function makeFrame(scene, cue, ms, still) {
    const move = still ? t => Math.round(t) : ease;
    const mehar = actor(473, 622);
    const boy = actor(864, 621);
    const dadi = actor(645, 610);
    const objects = {
      'mehar-pot': prop(clay, 'bench', 0),
      'sidak-pot': prop(glaze, 'bench', 0),
      'seed-pouch': prop(pouch, 'bench', 0),
      'watering-can': prop(canRest, 'bench', 0),
      'seed-one': prop(soil, 'objects', 0),
      'seed-two': prop(glaze, 'objects', 0)
    };
    const state = { actors: { mehar, boy, dadi }, objects, dusk: 0, opening: 0, water: 0,
      soilMark: 0, flower: 0, sprouts: 0, transplanted: 0 };
    const showClay = () => { objects['mehar-pot'].visible = 1; };

    switch (scene.id) {
      case 'seeds': {
        state.opening = 1 - move(phase(ms, cue.opening - 150, cue.opening + 210));
        walk(mehar, ms, cue.invite - 410, cue.invite + 990, 388, 533, move);
        walk(boy, ms, cue.invite - 410, cue.invite + 990, 898, 754, move);
        const set = move(phase(ms, cue.share - 160, cue.share + 320));
        const bag = between(point(647, 457, -4), point(646, 499), set);
        objects['seed-pouch'] = prop(bag, set < .97 ? 'dadi' : 'bench');
        grip(dadi, 0, offset(bag, -20, 4), 1 - phase(ms, cue.share + 360, cue.share + 670));
        grip(dadi, 1, offset(bag, 19, -16), 1 - phase(ms, cue.share + 780, cue.share + 1150), 'pinch');
        for (const [index, [child, x, hand]] of [[mehar, 577, 1], [boy, 706, 0]].entries()) {
          const release = cue.share + 335 + index * 200;
          const fall = move(phase(ms, release, release + 250));
          const pick = move(phase(ms, release + 620, release + 1120));
          const carry = point(mix(mix(bag.x, x, fall), x + (index ? 16 : -17), pick),
            mix(mix(bag.y - 22, 515, fall), 467, pick));
          objects[index ? 'seed-two' : 'seed-one'] = prop(carry, 'objects', phase(ms, release, release + 110));
          const reach = ease(phase(ms, release + 280, release + 650));
          grip(child, hand, offset(carry, 0, -3), reach, 'pinch');
        }
        break;
      }
      case 'planting': {
        showClay();
        boy.visible = dadi.visible = false;
        const stepIn = move(phase(ms, cue.plant - 1060, cue.plant - 440));
        const stepBack = move(phase(ms, cue.plant + 420, cue.water - 560));
        mehar.x = mix(mix(433, 515, stepIn), 431, stepBack);
        if (stepIn > 0 && stepIn < 1) mehar.walk = (ms - cue.plant + 1060) / 1000;
        if (stepBack > 0 && stepBack < 1) mehar.walk = (ms - cue.plant - 420) / 1000;
        const drop = move(phase(ms, cue.plant + 170, cue.plant + 400));
        const carry = between(point(553, 427), soil, drop);
        const reach = ease(phase(ms, cue.plant - 670, cue.plant - 50));
        grip(mehar, 1, offset(carry, -2, -6), reach * (1 - phase(ms, cue.plant + 185, cue.plant + 560)), 'pinch');
        objects['seed-one'] = prop(carry, 'objects', reach * (1 - phase(ms, cue.plant + 340, cue.plant + 495)));
        state.soilMark = phase(ms, cue.plant + 265, cue.plant + 420) * (1 - phase(ms, cue.plant + 440, cue.plant + 850));
        const lift = move(phase(ms, cue.water - 540, cue.water - 50)) * (1 - move(phase(ms, cue.water + 960, cue.water + 1510)));
        const can = between(canRest, canPour, lift);
        objects['watering-can'] = prop(can, lift > .01 ? 'mehar' : 'bench');
        grip(mehar, 1, offset(can, -43, 7), ease(phase(ms, cue.water - 790, cue.water - 530)) *
          (1 - phase(ms, cue.water + 1520, cue.water + 1860)));
        state.water = phase(ms, cue.water, cue.water + 125) * (1 - phase(ms, cue.water + 760, cue.water + 990));
        mehar.lean = 5 * reach * (1 - phase(ms, cue.plant + 390, cue.plant + 850));
        break;
      }
      case 'waiting': {
        showClay();
        boy.visible = dadi.visible = false;
        objects['watering-can'] = prop(canRest);
        const days = phase(ms, cue.days, cue.days + 2520);
        state.dusk = still ? 0 : .72 * Math.sin(Math.PI * days) ** 2;
        mehar.lean = still ? 0 : 8 * Math.sin(Math.PI * phase(ms, cue.look - 210, cue.look + 1130));
        break;
      }
      case 'return': {
        showClay();
        dadi.visible = false;
        const arriving = walk(boy, ms, cue.enter - 350, cue.enter + 1660, 1007, 726, move);
        const bounce = still ? 0 : Math.sin(Math.PI * arriving) * Math.sin(ms / 94) * 3;
        const full = carriedPot(boy, -9, bounce);
        objects['sidak-pot'] = prop(full, 'boy');
        holdPot(boy, full);
        state.flower = 1;
        walk(mehar, ms, cue.pickup - 1000, cue.pickup - 200, 460, 541, move);
        const pick = move(phase(ms, cue.pickup - 110, cue.pickup + 430));
        const empty = between(clay, carriedPot(mehar, 7), pick);
        objects['mehar-pot'] = prop(empty, pick > .015 ? 'mehar' : 'bench');
        holdPot(mehar, empty, ease(phase(ms, cue.pickup - 385, cue.pickup)));
        break;
      }
      case 'honesty': {
        showClay();
        const lower = move(phase(ms, cue.setDown - 110, cue.setDown + 410));
        walk(mehar, ms, cue.setDown + 700, cue.setDown + 1580, 541, 462, move);
        boy.x = 726;
        const empty = between(carriedPot(mehar, 7), clay, lower);
        const full = carriedPot(boy, -9);
        objects['mehar-pot'] = prop(empty, lower > .985 ? 'bench' : 'mehar');
        objects['sidak-pot'] = prop(full, 'boy');
        holdPot(mehar, empty, 1 - ease(phase(ms, cue.setDown + 405, cue.setDown + 800)));
        holdPot(boy, full);
        state.flower = 1;
        break;
      }
      case 'reveal': {
        showClay();
        const lower = move(phase(ms, cue.setDown - 110, cue.setDown + 410));
        mehar.x = 462;
        walk(boy, ms, cue.setDown - 685, cue.setDown - 185, 726, 751, move);
        const full = between(carriedPot(boy, -9), glaze, lower);
        walk(boy, ms, cue.setDown + 680, cue.setDown + 1790, boy.x, 871, move);
        objects['sidak-pot'] = prop(full, lower > .985 ? 'bench' : 'boy');
        holdPot(boy, full, 1 - ease(phase(ms, cue.setDown + 405, cue.setDown + 810)));
        state.flower = 1;
        break;
      }
      case 'new-growth': {
        showClay();
        objects['sidak-pot'] = prop(glaze);
        objects['seed-pouch'] = prop(point(646, 499));
        state.transplanted = 1;
        const days = phase(ms, cue.days - 280, cue.leaves - 20);
        state.dusk = still ? 0 : .55 * Math.sin(Math.PI * days) ** 2;
        state.sprouts = move(phase(ms, cue.leaves - 130, cue.leaves + 700));
        const seed = ease(phase(ms, cue.fresh - 90, cue.fresh + 420));
        const planted = move(phase(ms, cue.fresh + 670, cue.fresh + 1080));
        const stepIn = move(phase(ms, cue.fresh - 680, cue.fresh - 40));
        const stepBack = move(phase(ms, cue.fresh + 1000, cue.fresh + 1700));
        mehar.x = mix(mix(473, 527, stepIn), 473, stepBack);
        boy.x = mix(mix(864, 812, stepIn), 864, stepBack);
        if (stepIn > 0 && stepIn < 1) mehar.walk = boy.walk = (ms - cue.fresh + 680) / 1000;
        if (stepBack > 0 && stepBack < 1) mehar.walk = boy.walk = (ms - cue.fresh - 1000) / 1000;
        for (const [index, [child, pot, hand]] of [[mehar, clay, 1], [boy, glaze, 0]].entries()) {
          const dropping = point(pot.x - 8, pot.y - mix(87, 68, planted));
          objects[index ? 'seed-two' : 'seed-one'] = prop(dropping, 'objects', seed * (1 - planted));
          grip(child, hand, offset(dropping, 0, -8), seed * (1 - phase(ms, cue.fresh + 720, cue.fresh + 1260)), 'pinch');
        }
        break;
      }
    }
    return state;
  }

  class GardenStage {
    constructor(svg) {
      this.svg = svg;
      this.camera = new window.UmtoCamera.DeliveryCamera(svg);
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.parts = Object.fromEntries([...svg.querySelectorAll('[id]')].map(node => [node.id, node]));
      this.puppets = Object.fromEntries(Object.entries(cast).map(([id, spec]) => [
        id, new Character(studio, svg, this.parts[id], this.parts[id + '-props'], spec)
      ]));
    }

    select(scene) {
      this.scene = scene;
      this.cues = cuesFor(scene);
      this.lastShot = '';
    }

    frame(ms, line, still) {
      const { id, framing, focus } = this.scene;
      const cue = this.cues;
      let shot = { preset: framing, focus };
      if (id === 'seeds' && line.speaker === 'dadi') {
        shot = { preset: 'medium', focus: point(646, 419), width: 653 };
      } else if (id === 'planting' && ms >= cue.plant - 480 && ms <= cue.water + 1500) {
        shot = { preset: 'detail', focus: point(522, 474), width: 560 };
      } else if (id === 'waiting') {
        shot.width = 630;
      } else if (id === 'return' && !still && ms < cue.enter + 1600) {
        const pan = ease(phase(ms, cue.enter - 340, cue.enter + 1600));
        shot = { preset: 'full', focus: point(Math.round(mix(788, 630, pan)), 435),
          width: 1000, motion: 'tracking', parallax: true };
      } else if (id === 'return') {
        shot.width = 770;
      } else if (id === 'honesty') {
        shot = { preset: 'two-shot', focus: point(590, 438), width: 690 };
      } else if (id === 'reveal') {
        shot = { preset: 'two-shot', focus: point(line.speaker === 'boy' ? 789 : 673, 426),
          width: line.speaker === 'boy' ? 550 : 700 };
      } else if (id === 'new-growth' && ms > cue.leaves - 460 && ms < cue.leaves + 1660) {
        shot = { preset: 'detail', focus: point(668, 449), width: 590 };
      }
      const key = [shot.preset, shot.focus.x, shot.focus.y, shot.width, shot.motion].join('/');
      if (key !== this.lastShot) {
        this.camera.cue({ ...shot, cut: true });
        this.lastShot = key;
      }
    }

    paintProps(state, ms, still) {
      const p = this.parts;
      for (const [id, { position, owner, visible }] of Object.entries(state.objects)) {
        const parent = p[owner === 'objects' ? owner : owner + '-props'];
        if (p[id].parentElement !== parent) parent.append(p[id]);
        transform(p[id], 'translate(' + [position.x, position.y].join(' ') + ') rotate(' + position.angle + ')');
        opacity(p[id], visible);
      }
      opacity(p['opening-field'], state.opening);
      opacity(p.dusk, state.dusk);
      opacity(p['rear-plant'], state.transplanted);
      opacity(p['sidak-flower'], state.flower);
      const sway = still ? 0 : Math.sin(ms / 520) * 2.4;
      const carrying = state.objects['sidak-pot'].owner === 'boy';
      transform(p['sidak-flower'], 'translate(0 -63) rotate(' + (sway + (carrying ? 16 : 0)) + ') scale(.77)');
      for (const id of ['mehar-growth', 'sidak-growth']) {
        opacity(p[id], state.sprouts > 0 ? 1 : 0);
        transform(p[id], 'translate(0 -63) scale(' + Math.max(.01, state.sprouts) + ')');
      }
      opacity(p['soil-touch'], state.soilMark);
      transform(p['soil-touch'], 'translate(' + soil.x + ' ' + soil.y + ')');
      opacity(p.water, state.water);
      if (state.water > 0) {
        const spout = offset(state.objects['watering-can'].position, 76, -38);
        const path = 'M' + spout.x + ' ' + spout.y + ' Q' + (spout.x + 9) + ' ' +
          (spout.y + 10) + ' ' + soil.x + ' ' + soil.y;
        p['water-ribbon'].setAttribute('d', path);
        p['water-glint'].setAttribute('d', path);
        p['water-glint'].setAttribute('stroke-dashoffset', still ? '0' : String(-ms / 24));
      }
      this.svg.dataset.growth = state.sprouts === 0 ? 'empty' : state.sprouts < 1 ? 'sprouting' : 'sprouted';
      this.svg.dataset.watering = String(state.water > .35);
    }

    draw(ms, line, word) {
      const still = this.reduced.matches;
      const state = makeFrame(this.scene, this.cues, ms, still);
      this.frame(ms, line, still);
      this.paintProps(state, ms, still);
      const reading = voiceFrame(line, word, ms);
      for (const [id, performer] of Object.entries(this.puppets)) {
        const pose = state.actors[id];
        this.parts[id + '-plane'].setAttribute('visibility', pose.visible ? 'visible' : 'hidden');
        const shadow = this.parts[id + '-shadow'];
        opacity(shadow, pose.visible ? 1 : 0);
        shadow.setAttribute('cx', pose.x);
        shadow.setAttribute('cy', pose.y + 1);
        if (pose.visible) performer.paint(pose, ms, line.speaker === id ? reading : null, still);
        else this.parts[id].dataset.speaking = 'false';
      }
    }
  }

  async function prepare() {
    studio = await open(document.getElementById('pot-studio'));
  }

  window.LittlePanthStage = { Stage: GardenStage, eventsFor, prepare };
})();
