(() => {
  'use strict';

  const phase = (value, from, to) => Math.max(0, Math.min(1, (value - from) / Math.max(Number.EPSILON, to - from)));
  const ease = t => t * t * (3 - 2 * t);
  const mix = (a, b, t) => a + (b - a) * t;
  const point = (x, y, angle = 0) => ({ x, y, angle });
  const between = (a, b, t) => point(mix(a.x, b.x, t), mix(a.y, b.y, t), mix(a.angle, b.angle, t));
  const transform = (node, value) => node.setAttribute('transform', value);
  const opacity = (node, value) => node.setAttribute('opacity', String(value));
  const radians = degrees => degrees * Math.PI / 180;

  const crowScale = .69;
  const foxScale = .86;
  const perch = point(737, 281, 7);
  const proudAngle = -14;
  const cawAngle = -11;
  const foxStop = point(471, 623, -23);
  const ground = point(655, 613, 106);
  const crowHead = point(39, -103);
  const crowGrip = point(96, 19);
  const foxHead = point(42, -124);
  const foxGrip = point(73, 12);
  const haunch = point(-63, -80);
  const tilt = 27;
  let artwork;

  function rotate(p, angle, about = point(0, 0)) {
    const cos = Math.cos(radians(angle));
    const sin = Math.sin(radians(angle));
    return point(about.x + (p.x - about.x) * cos - (p.y - about.y) * sin,
      about.y + (p.x - about.x) * sin + (p.y - about.y) * cos);
  }

  function gripPosition(actor, scale, head, grip, bounce = 0) {
    const tip = rotate(grip, actor.angle);
    return point(actor.x + actor.facing * scale * (head.x + tip.x),
      actor.y - bounce + scale * (head.y + tip.y), actor.facing * actor.angle);
  }

  const biteHead = rotate(foxHead, tilt, haunch);
  const reach = Math.hypot(foxGrip.x, foxGrip.y);
  const pickupPitch = Math.asin(((ground.y - foxStop.y) / foxScale - biteHead.y) / reach);
  const pickup = point(ground.x - foxScale * (biteHead.x + reach * Math.cos(pickupPitch)), foxStop.y,
    (pickupPitch - Math.atan2(foxGrip.y, foxGrip.x)) * 180 / Math.PI);
  const dropOrigin = gripPosition({ ...perch, angle: cawAngle, facing: -1 }, crowScale, crowHead, crowGrip);

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
      case 'perch': return { approach: wordAt(scene, 'crow-finds-paneer', 'ਪਨੀਰ') + 280,
        land: wordAt(scene, 'crow-finds-paneer', 'ਬੈਠਾ') };
      case 'fox-notices': return { stop: wordAt(scene, 'fox-passes', 'ਰੁਕ') };
      case 'flattery': return { pride: wordAt(scene, 'crow-feels-proud', 'ਉੱਚਾ') };
      case 'song-and-fall': {
        const call = wordAt(scene, 'paneer-falls', 'ਖੋਲ੍ਹੀ');
        return { call, release: call + 120, land: call + 1010 };
      }
      case 'the-trick': return { take: wordAt(scene, 'fox-picks-up-paneer', 'ਚੁੱਕ') + 120,
        look: wordAt(scene, 'fox-picks-up-paneer', 'ਹੇਠਾਂ') };
      case 'think-first': return { leave: wordAt(scene, 'fox-goes-away', 'ਚਲੀ') };
      case 'fly-home': return { spread: wordAt(scene, 'crow-goes-home', 'ਖੰਭ'),
        lift: wordAt(scene, 'crow-goes-home', 'ਉੱਡ') };
    }
  }

  function eventsFor(scene) {
    const q = cuesFor(scene);
    switch (scene.id) {
      case 'perch': return [{ ms: 560, sound: 'chirp' }, { ms: q.land - 760, sound: 'wings' }];
      case 'fox-notices': return [{ ms: 750, sound: 'step' }, { ms: q.stop - 500, sound: 'step' }];
      case 'flattery': return [{ ms: q.pride + 220, sound: 'ribbon' }];
      case 'song-and-fall': return [{ ms: q.land, sound: 'step' }];
      case 'the-trick': return [{ ms: q.take + 165, sound: 'ribbon' }];
      case 'think-first': return [{ ms: q.leave + 290, sound: 'step' }, { ms: q.leave + 850, sound: 'step' }];
      case 'fly-home': return [{ ms: q.lift + 120, sound: 'wings' }, { ms: q.lift + 980, sound: 'chirp' }];
    }
  }

  function walk(actor, ms, from, to, start, end, move) {
    const progress = move(phase(ms, from, to));
    Object.assign(actor, between(start, end, progress));
    actor.gait = Math.sin((end.x - start.x) * progress / 13) *
      ease(phase(progress, 0, .07)) * (1 - ease(phase(progress, .93, 1)));
  }

  function makeFrame(scene, q, ms, still) {
    const move = still ? Math.round : ease;
    const crow = { ...perch, facing: -1, flying: 0, call: 0 };
    const fox = { ...foxStop, facing: 1, gait: 0, bend: 0, visible: true };
    const state = { crow, fox, paneer: 'crow', piece: ground, dust: 0, turn: 0 };

    switch (scene.id) {
      case 'perch': {
        fox.visible = false;
        const path = move(phase(ms, q.approach, q.land + 270));
        Object.assign(crow, between(point(1379, 160, -2), perch, path));
        crow.y -= 32 * Math.sin(Math.PI * path);
        crow.flying = 1 - ease(phase(path, .89, 1));
        break;
      }
      case 'fox-notices':
        walk(fox, ms, 420, q.stop + 380, point(157, 629, 0), foxStop, move);
        break;
      case 'flattery':
        crow.angle = mix(perch.angle, proudAngle, move(phase(ms, q.pride - 560, q.pride + 390)));
        break;
      case 'song-and-fall': {
        crow.angle = mix(proudAngle, cawAngle, ease(phase(ms, q.call - 320, q.release)));
        crow.angle = mix(crow.angle, 10, move(phase(ms, q.release + 720, q.release + 1510)));
        crow.call = ease(phase(ms, q.call - 130, q.release)) * (1 - ease(phase(ms, q.release + 170, q.release + 550)));
        if (ms >= q.release) {
          const fall = phase(ms, q.release, q.land);
          state.paneer = fall < 1 ? 'falling' : 'ground';
          state.piece = between(dropOrigin, ground, still ? Math.round(fall) : fall);
          state.piece.y = mix(dropOrigin.y, ground.y, still ? Math.round(fall) : fall * fall);
          state.dust = ease(phase(ms, q.land - 25, q.land + 85)) * (1 - ease(phase(ms, q.land + 125, q.land + 470)));
        }
        break;
      }
      case 'the-trick': {
        const stoop = move(phase(ms, q.take - 520, q.take));
        const rise = move(phase(ms, q.take + 80, q.take + 750));
        walk(fox, ms, 120, q.take - 615, foxStop, point(pickup.x - 16, foxStop.y, -9), move);
        fox.x = mix(fox.x, pickup.x, stoop);
        fox.angle = mix(mix(fox.angle, pickup.angle, stoop), -4, rise);
        fox.bend = stoop * (1 - rise);
        state.paneer = ms >= q.take ? 'fox' : 'ground';
        state.turn = move(phase(ms, q.take, q.take + 510));
        crow.angle = mix(10, 21, move(phase(ms, q.look - 210, q.look + 540)));
        break;
      }
      case 'think-first':
        state.paneer = 'fox';
        walk(fox, ms, q.leave - 370, lineFor(scene, 'fox-goes-away').end + 980,
          point(pickup.x, foxStop.y, -4), point(-176, 634), move);
        fox.facing = ms >= q.leave - 370 ? -1 : 1;
        state.turn = 1;
        crow.angle = mix(21, 4, move(phase(ms, q.leave + 420, q.leave + 1610)));
        break;
      case 'fly-home': {
        fox.visible = false;
        state.paneer = 'none';
        const path = move(phase(ms, q.lift - 240, q.lift + 2430));
        Object.assign(crow, between(point(perch.x, perch.y, 4), point(-172, 57, -16), path));
        crow.y -= 40 * Math.sin(Math.PI * path);
        crow.flying = ease(phase(ms, q.spread - 190, q.lift + 310));
        break;
      }
    }
    return state;
  }

  class OrchardStage {
    constructor(svg) {
      this.svg = svg;
      this.camera = new window.UmtoCamera.DeliveryCamera(svg);
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      const defs = svg.querySelector('defs');
      const actors = svg.querySelector('#animals');

      for (const gradient of artwork.gradients) defs.append(document.importNode(gradient, true));
      for (const actor of artwork.actors) actors.append(document.importNode(actor, true));

      window.LittlePanthFox.mount(svg, actors);
      this.parts = Object.fromEntries([...svg.querySelectorAll('[id]')].map(node => [node.id, node]));
    }

    select(scene) {
      this.scene = scene;
      this.cue = cuesFor(scene);
      this.lastShot = '';
    }

    frame(ms, line, state, still) {
      const { id, framing, focus } = this.scene;
      const q = this.cue;
      const shotAt = (preset, x, y, width, follow = false) =>
        ({ preset, focus: point(x, y), width, motion: follow && !still ? 'tracking' : 'static', parallax: follow && !still });
      let shot = { preset: framing, focus };
      if (id === 'perch' && ms > q.land - 2390) {
        shot = shotAt('full', Math.round(state.crow.x - 92), 346, 1050, true);
      } else if (id === 'fox-notices') {
        shot = shotAt('two-shot', Math.round((state.fox.x + perch.x) / 2), 361, 1140, ms < q.stop);
      } else if (id === 'flattery') {
        shot = line.speaker === 'fox' ? shotAt('two-shot', 599, 367, 1090) : shotAt('medium', 704, 232, 633);
      } else if (id === 'song-and-fall' && ms < q.call - 380) {
        shot = shotAt('two-shot', 601, 373, 1090);
      } else if (id === 'song-and-fall') {
        const y = still ? 374 : Math.round(mix(257, 471, phase(ms, q.release + 80, q.land)));
        shot = shotAt('full', 636, y, still ? 1180 : 860, true);
      } else if (id === 'the-trick') {
        shot = line.speaker === 'crow' || ms >= q.look - 230
          ? shotAt('medium', 707, 241, 626)
          : shotAt('detail', 570, 503, 700);
      } else if (id === 'think-first') {
        shot = line.speaker === 'crow' ? shotAt('medium', 707, 237, 664) : shotAt('full', 548, 372, 1110);
      } else if (id === 'fly-home' && ms >= q.lift - 470 && ms < q.lift + 1450) {
        shot = shotAt('full', Math.round(state.crow.x + 72), 337, 1130, true);
      }
      const key = [shot.preset, shot.focus.x, shot.focus.y, shot.width, shot.motion].join('/');
      if (key !== this.lastShot) {
        this.camera.cue({ ...shot, cut: true });
        this.lastShot = key;
      }
    }

    paintCrow(pose, ms, speaking, opening, still) {
      const p = this.parts;
      transform(p.crow, 'translate(' + pose.x + ' ' + pose.y + ') scale(' + (pose.facing * crowScale) + ' ' + crowScale + ')');
      transform(p['crow-head'], 'translate(' + crowHead.x + ' ' + crowHead.y + ') rotate(' + pose.angle + ')');
      const flap = still ? 0 : Math.sin(ms / 137);
      transform(p['wing-near'], 'rotate(' + (pose.flying * (-54 + flap * 79)) + ' -7 -91)');
      transform(p['wing-far'], 'rotate(' + (-14 - flap * 43) + ' -13 -80)');
      opacity(p['wing-far'], pose.flying);
      transform(p['crow-legs'], 'rotate(' + (pose.flying * 30) + ' 0 -35)');
      transform(p.tail, 'rotate(' + (pose.flying * flap * 8) + ' -53 -64)');
      const blink = !still && (ms + 842) % 4340 > 4205;
      opacity(p['crow-eye'], blink ? 0 : 1);
      opacity(p.eyelid, blink ? 1 : 0);
      const gape = Math.max(22 * opening, pose.call * (still ? 27 : 27 + 4 * Math.sin(ms / 44)));
      transform(p['lower-beak'], 'rotate(' + gape + ' 49 13)');
      p.crow.dataset.speaking = String(speaking);
      p.crow.dataset.flying = String(pose.flying > .09);
      p.crow.dataset.calling = String(pose.call > .44);
    }

    paintFox(pose, ms, speaking, opening, still) {
      const p = this.parts;
      const bend = tilt * pose.bend;
      const stride = still ? 0 : 24 * pose.gait;
      const bounce = Math.abs(stride) * .12;
      const head = rotate(foxHead, bend, haunch);
      transform(p.fox, 'translate(' + pose.x + ' ' + (pose.y - bounce) + ') scale(' + (pose.facing * foxScale) + ' ' + foxScale + ')');
      opacity(p.fox, Number(pose.visible));
      opacity(p['fox-shadow'], Number(pose.visible));
      p['fox-shadow'].setAttribute('cx', String(pose.x - 22 * pose.facing));
      p['fox-shadow'].setAttribute('cy', String(pose.y + 2));
      window.LittlePanthFox.draw(p, {
        walk: stride, bend, head: pose.angle, headPosition: head, headMotion: false
      }, ms, still, speaking, opening);
      return gripPosition(pose, foxScale, head, foxGrip, bounce);
    }

    draw(ms, line, word) {
      const still = this.reduced.matches;
      const state = makeFrame(this.scene, this.cue, ms, still);
      const p = this.parts;
      this.frame(ms, line, state, still);
      const voiced = word >= 0 && line.speaker !== 'narrator';
      const beat = voiced ? phase(ms - line.start, ...line.reading.timings[word]) : 0;
      const opening = beat > .06 && beat < .95 ? .27 + Math.sin(Math.PI * beat) * .71 : 0;
      this.paintCrow(state.crow, ms, line.speaker === 'crow' && opening > 0, line.speaker === 'crow' ? opening : 0, still);
      const foxMouth = this.paintFox(state.fox, ms, line.speaker === 'fox' && opening > 0, line.speaker === 'fox' ? opening : 0, still);

      let piece = state.piece;
      if (state.paneer === 'crow') piece = gripPosition(state.crow, crowScale, crowHead, crowGrip);
      else if (state.paneer === 'fox') piece = { ...foxMouth, angle: mix(ground.angle, foxMouth.angle, state.turn) };
      transform(p.paneer, 'translate(' + piece.x + ' ' + piece.y + ') rotate(' + piece.angle + ') scale(.82)');
      opacity(p.paneer, Number(state.paneer !== 'none'));
      p['paneer-shadow'].setAttribute('cx', String(piece.x));
      opacity(p['paneer-shadow'], ['falling', 'ground'].includes(state.paneer) ? ease(phase(piece.y, 516, ground.y)) : 0);
      transform(p.crumbs, 'translate(' + ground.x + ' ' + (ground.y + 5) + ')');
      opacity(p.crumbs, state.dust);
      this.svg.dataset.paneer = state.paneer;
    }
  }

  async function openArtwork(url, id, gradients) {
    const response = await fetch(url);
    if (!response.ok) throw Error('Could not load ' + id + ' artwork.');
    const source = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
    const actor = source.querySelector('#' + id);
    const paint = gradients.map(name => source.querySelector('#' + name));
    if (!actor || paint.some(value => !value)) throw Error('The ' + id + ' artwork is incomplete.');
    return { actor, paint };
  }

  async function prepare() {
    const [crow] = await Promise.all([
      openArtwork('../mission-005/art/stage.svg', 'crow', ['feathers', 'wing-color', 'beak-color']),
      window.LittlePanthFox.prepare()
    ]);
    crow.actor.querySelector('#carried-stone')?.remove();
    artwork = { actors: [crow.actor], gradients: crow.paint };
  }

  window.LittlePanthStage = { Stage: OrchardStage, eventsFor, prepare };
})();
