(() => {
  'use strict';

  const phase = (value, from, to) => Math.max(0, Math.min(1, (value - from) / Math.max(Number.EPSILON, to - from)));
  const ease = t => t * t * (3 - 2 * t);
  const mix = (a, b, t) => a + (b - a) * t;
  const point = (x, y) => ({ x, y });
  const between = (a, b, t) => point(mix(a.x, b.x, t), mix(a.y, b.y, t));
  const transform = (node, value) => node.setAttribute('transform', value);
  const opacity = (node, value) => node.setAttribute('opacity', String(value));

  const field = { mouse: point(516, 610), friend: point(758, 610) };
  const supper = { mouse: point(545, 534), friend: point(836, 534) };
  const basket = { mouse: point(1044, 607), friend: point(951, 597) };
  const floor = { mouse: point(701, 603), friend: point(873, 604) };
  const dish = { mouse: point(601, 616), friend: point(663, 614), sweet: point(622, 542) };
  const rest = point(35, -9);
  const mouth = point(68, -18);
  const coats = {
    mouse: { coat: '#c6a083', edge: '#8a716b', light: '#edd0a9', ear: '#da9fa1', tail: '#b68b8e' },
    friend: { coat: '#9b9bb1', edge: '#706c83', light: '#d7c7ca', ear: '#d6a1af', tail: '#a87990' }
  };

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
      case 'country': return { visit: wordAt(scene, 'the-country-mouse', 'ਮਿਲਣ') };
      case 'millet': return { grain: wordAt(scene, 'millet-and-gur', 'ਦਾਣੇ') };
      case 'town-kitchen': return { arrive: wordAt(scene, 'in-the-town', 'ਪਹੁੰਚੇ'), table: wordAt(scene, 'in-the-town', 'ਮੇਜ਼') };
      case 'footsteps':
        return { take: wordAt(scene, 'footsteps-nearby', 'ਚੁੱਕਿਆ'), steps: wordAt(scene, 'footsteps-nearby', 'ਕਦਮਾਂ'),
          hide: wordAt(scene, 'footsteps-nearby', 'ਟੋਕਰੀ') };
      case 'quiet-again': return { leave: wordAt(scene, 'cat-leaves', 'ਚਲੀ'), comeOut: wordAt(scene, 'cat-leaves', 'ਬਾਹਰ') };
      case 'morning-home':
        return { return: wordAt(scene, 'country-returns', 'ਮੁੜ'), eat: wordAt(scene, 'country-returns', 'ਦਾਣਾ') };
      case 'friends':
        return { visit: wordAt(scene, 'friends-eat', 'ਮਿਲਣ'), eat: wordAt(scene, 'friends-eat', 'ਖਾਂਦੇ') };
    }
  }

  function eventsFor(scene) {
    const cue = cuesFor(scene);
    switch (scene.id) {
      case 'country': return [{ ms: 680, sound: 'chirp' }, { ms: cue.visit + 240, sound: 'step' }];
      case 'millet': return [{ ms: cue.grain + 440, sound: 'ribbon' }];
      case 'town-kitchen': return [{ ms: cue.arrive + 390, sound: 'step' }, { ms: cue.table + 520, sound: 'step' }];
      case 'footsteps': return [{ ms: cue.steps, sound: 'step' }, { ms: cue.steps + 430, sound: 'step' },
        { ms: cue.hide + 100, sound: 'ribbon' }];
      case 'quiet-again': return [{ ms: cue.leave + 240, sound: 'step' }];
      case 'morning-home': return [{ ms: cue.return + 110, sound: 'chirp' }, { ms: cue.eat + 790, sound: 'ribbon' }];
      case 'friends': return [{ ms: cue.eat + 280, sound: 'chirp' }];
    }
  }

  const mouse = (position, facing) => ({ ...position, facing, gait: 0, paw: rest, food: null, visible: true });

  function walk(actor, ms, start, end, from, to, move) {
    const progress = move(phase(ms, start, end));
    Object.assign(actor, between(from, to, progress));
    actor.gait = Math.sin((to.x - from.x) * progress / 12) *
      ease(phase(progress, 0, .08)) * (1 - ease(phase(progress, .92, 1)));
  }

  function pickUp(actor, ms, take, position, kind, move, eat = true) {
    const pickup = point((position.x - actor.x) * actor.facing, position.y - actor.y);
    const bringUp = phase(ms, take, take + 510);
    const chew = eat ? phase(ms, take + 570, take + 950) : 0;
    if (ms < take) actor.paw = between(rest, pickup, move(phase(ms, take - 380, take)));
    else {
      actor.paw = between(pickup, mouth, move(bringUp));
      actor.paw.y -= 15 * Math.sin(Math.PI * move(bringUp));
      actor.food = { kind, visible: 1 - chew };
      if (eat) actor.paw = between(actor.paw, rest, move(phase(ms, take + 1000, take + 1320)));
    }
    return ms >= take;
  }

  function makeFrame(scene, cue, ms, still) {
    const move = still ? Math.round : ease;
    const country = mouse(field.mouse, 1);
    const town = mouse(field.friend, -1);
    const state = { country, town, kitchen: false, cat: 0, catX: 107, loose: null,
      grainLeft: true, grainRight: true, sweet: true };
    const indoors = () => {
      state.kitchen = true;
      Object.assign(country, supper.mouse);
      Object.assign(town, supper.friend);
    };

    switch (scene.id) {
      case 'country':
        walk(town, ms, cue.visit - 2160, cue.visit + 1000, point(1063, 574), field.friend, move);
        break;
      case 'millet':
        state.grainLeft = !pickUp(country, ms, cue.grain + 670, dish.mouse, 'grain', move);
        break;
      case 'town-kitchen':
        indoors();
        walk(country, ms, 390, cue.arrive + 1300, point(358, 616), point(493, 602), move);
        walk(town, ms, 140, cue.arrive + 820, point(557, 612), point(769, 608), move);
        if (ms >= cue.table - 1250) {
          walk(country, ms, cue.table - 1250, cue.table + 150, point(493, 602), supper.mouse, move);
        }
        if (ms >= cue.table - 1460) {
          walk(town, ms, cue.table - 1460, cue.table + 40, point(769, 608), supper.friend, move);
        }
        town.facing = ms >= cue.table + 90 ? -1 : 1;
        break;
      case 'footsteps': {
        indoors();
        const drop = cue.steps + 245;
        const dash = cue.steps + 590;
        state.cat = .66 * ease(phase(ms, cue.steps - 160, cue.steps + 650));
        state.catX = mix(98, 319, ease(phase(ms, cue.steps - 230, cue.steps + 950)));
        if (ms < drop) state.sweet = !pickUp(country, ms, cue.take + 90, dish.sweet, 'sweet', move, false);
        else {
          state.sweet = false;
          const fall = move(phase(ms, drop, drop + 370));
          state.loose = between(point(supper.mouse.x + mouth.x, supper.mouse.y + mouth.y), point(637, 545), fall);
        }
        if (ms >= dash) {
          walk(country, ms, dash + 90, cue.hide + 520, supper.mouse, basket.mouse, move);
          walk(town, ms, dash, cue.hide + 350, supper.friend, basket.friend, move);
          town.facing = ms >= cue.hide + 245 ? -1 : 1;
        }
        break;
      }
      case 'quiet-again': {
        indoors();
        state.sweet = false;
        state.loose = point(637, 545);
        state.cat = .66 * (1 - ease(phase(ms, cue.leave - 220, cue.leave + 590)));
        state.catX = mix(319, 93, ease(phase(ms, cue.leave - 220, cue.leave + 590)));
        walk(country, ms, cue.comeOut - 200, cue.comeOut + 1200, basket.mouse, floor.mouse, move);
        walk(town, ms, cue.comeOut - 90, cue.comeOut + 780, basket.friend, floor.friend, move);
        country.facing = ms > cue.comeOut + 1200 || ms < cue.comeOut - 200 ? 1 : -1;
        break;
      }
      case 'morning-home':
        town.visible = false;
        walk(country, ms, 390, cue.return + 910, point(256, 571), field.mouse, move);
        state.grainLeft = !pickUp(country, ms, cue.eat + 110, dish.mouse, 'grain', move);
        break;
      case 'friends':
        walk(town, ms, cue.visit - 1300, cue.visit + 1400, point(1031, 574), field.friend, move);
        state.grainLeft = !pickUp(country, ms, cue.eat - 30, dish.mouse, 'grain', move);
        state.grainRight = !pickUp(town, ms, cue.eat + 300, dish.friend, 'grain', move);
        break;
    }
    return state;
  }

  function prepareMouse(group, source, id) {
    const art = source.cloneNode(true);
    art.id = id;
    for (const [name, color] of Object.entries(coats[id])) art.style.setProperty('--' + name, color);
    group.append(art);
    const parts = ['tail', 'head', 'mouth', 'eye', 'lid', 'back-foot', 'front-foot', 'arm-outline', 'arm', 'paw', 'bite'];
    return { root: art, ...Object.fromEntries(parts.map(name => [name, art.querySelector('[data-' + name + ']')])) };
  }

  class MiceStage {
    constructor(svg) {
      this.svg = svg;
      this.camera = new window.UmtoCamera.DeliveryCamera(svg);
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.parts = Object.fromEntries([...svg.querySelectorAll('[id]')].map(node => [node.id, node]));
      this.country = prepareMouse(this.parts.mice, this.parts['mouse-art'], 'mouse');
      this.town = prepareMouse(this.parts.mice, this.parts['mouse-art'], 'friend');
    }

    select(scene) {
      this.scene = scene;
      this.cue = cuesFor(scene);
      this.lastShot = '';
    }

    frame(ms, line, state, still) {
      const { id, framing, focus } = this.scene;
      const q = this.cue;
      const shotAt = (preset, x, y, width, tracking = false) =>
        ({ preset, focus: point(x, y), width, motion: tracking && !still ? 'tracking' : 'static', parallax: tracking && !still });
      let shot = { preset: framing, focus };
      if (id === 'country' && ms > q.visit - 1950) {
        shot = shotAt('two-shot', Math.round((state.country.x + state.town.x) / 2), 484, 930, true);
      } else if (id === 'millet') {
        shot = line.speaker === 'friend' ? shotAt('two-shot', 656, 479, 841) : shotAt('detail', 592, 506, 695);
      } else if (id === 'town-kitchen' && ms > q.table - 1800) {
        shot = shotAt('two-shot', 692, 430, 934);
      } else if (id === 'footsteps') {
        if (ms < q.steps - 100) shot = shotAt('detail', 666, 457, 699);
        else if (ms < q.steps + 690) shot = shotAt('medium', 397, 422, 795);
        else shot = shotAt('full', Math.round((state.country.x + state.town.x) / 2), 484, 933, true);
      } else if (id === 'quiet-again') {
        shot = shotAt('two-shot', 785, 494, 864);
      } else if (id === 'morning-home') {
        shot = ms < q.eat - 550
          ? shotAt('full', Math.round(state.country.x + 146), 437, 1045, true)
          : shotAt('detail', 599, 501, 698);
      } else if (id === 'friends' && ms >= q.visit - 1020 && ms < this.scene.duration - 1750) {
        shot = shotAt('two-shot', 648, 485, 840);
      }
      const key = [shot.preset, shot.focus.x, shot.focus.y, shot.width, shot.motion].join('/');
      if (key !== this.lastShot) {
        this.camera.cue({ ...shot, cut: true });
        this.lastShot = key;
      }
    }

    paintMouse(art, pose, ms, opening, still) {
      const stride = still ? 0 : pose.gait;
      const bounce = Math.abs(stride) * 4.3;
      transform(art.root, 'translate(' + pose.x + ' ' + (pose.y - bounce) + ') scale(' + pose.facing + ' 1)');
      opacity(art.root, Number(pose.visible));
      transform(art.tail, 'rotate(' + (still ? 0 : 6.4 * Math.sin(ms / 230) + stride * 3) + ' -28 -17)');
      transform(art['back-foot'], 'translate(' + (stride * 15) + ' ' + (Math.min(stride, 0) * 5) + ')');
      transform(art['front-foot'], 'translate(' + (-stride * 15) + ' ' + (-Math.max(stride, 0) * 6) + ')');
      const arm = 'M19-23 Q' + ((pose.paw.x + 19) / 2) + ' ' + (pose.paw.y + 12) + ' ' + pose.paw.x + ' ' + pose.paw.y;
      art.arm.setAttribute('d', arm);
      art['arm-outline'].setAttribute('d', arm);
      art.paw.setAttribute('cx', pose.paw.x);
      art.paw.setAttribute('cy', pose.paw.y);
      const bite = pose.food?.visible ?? 0;
      opacity(art.bite, bite > .05 ? 1 : 0);
      if (pose.food) art.bite.setAttribute('href', '#' + pose.food.kind);
      transform(art.bite, 'translate(' + pose.paw.x + ' ' + pose.paw.y + ') scale(' + Math.max(.08, bite) + ')');
      const blink = !still && ((ms + (art.root.id === 'mouse' ? 810 : 1540)) % 4410) > 4260;
      opacity(art.eye, blink ? 0 : 1);
      opacity(art.lid, blink ? 1 : 0);
      opacity(art.mouth, opening > 0 ? 1 : 0);
      transform(art.mouth, 'translate(0 -17) scale(1 ' + Math.max(.02, opening) + ') translate(0 17)');
      art.root.dataset.speaking = String(opening > 0);
      art.root.dataset.holding = bite > .05 ? pose.food.kind : '';
    }

    draw(ms, line, word) {
      const still = this.reduced.matches;
      const state = makeFrame(this.scene, this.cue, ms, still);
      const p = this.parts;
      this.frame(ms, line, state, still);
      opacity(p.kitchen, Number(state.kitchen));
      opacity(p['field-edge'], Number(!state.kitchen));
      opacity(p['field-food'], Number(!state.kitchen));
      opacity(p['town-food'], Number(state.kitchen));
      opacity(p['kitchen-step'], Number(state.kitchen));
      opacity(p['pantry-basket'], Number(state.kitchen));
      opacity(p['cat-shadow'], state.cat);
      transform(p['cat-shadow'], 'translate(' + state.catX + ' 509) scale(1.22 1.13)');
      opacity(p['country-grain'], Number(state.grainLeft));
      opacity(p['town-grain'], Number(state.grainRight));
      opacity(p['country-sweet'], Number(state.sweet));
      opacity(p['loose-sweet'], Number(Boolean(state.loose)));
      if (state.loose) transform(p['loose-sweet'], 'translate(' + state.loose.x + ' ' + state.loose.y + ') rotate(21)');
      const voiced = word >= 0 && line.speaker !== 'narrator';
      const beat = voiced ? phase(ms - line.start, ...line.reading.timings[word]) : 0;
      const opening = beat > .06 && beat < .95 ? .28 + Math.sin(Math.PI * beat) * .65 : 0;
      this.paintMouse(this.country, state.country, ms, line.speaker === 'mouse' ? opening : 0, still);
      this.paintMouse(this.town, state.town, ms, line.speaker === 'friend' ? opening : 0, still);
      this.svg.dataset.place = state.kitchen ? 'town' : 'country';
    }
  }

  window.LittlePanthStage = { Stage: MiceStage, eventsFor };
})();
