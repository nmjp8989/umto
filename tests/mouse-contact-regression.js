/* Focused LP006 geometry check. Load into the story's ?test=1 document. */
(() => {
  'use strict';
  const near = (a, b, tolerance) => Math.abs(a - b) <= tolerance;
  const fail = (message, context) => { throw Error(message + ' · ' + context); };
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  window.checkMouseContact = async function checkMouseContact({ onProgress = () => {} } = {}) {
    const api = window.lp006Test;
    if (!api) throw Error('Open the Lion and Mouse player with ?test=1 first.');
    const saved = api.state(), scenes = saved.scenes;
    const stage = document.getElementById('stage'), mouse = document.getElementById('mouse');
    const shadow = document.getElementById('mouse-shadow');
    const feet = [...mouse.querySelectorAll('[data-mouse-foot]')];
    if (feet.length !== 4) throw Error('Expected all four articulated mouse feet.');
    if (typeof api.mouseState !== 'function') throw Error('Mouse motion sampling API is unavailable.');
    const index = id => scenes.findIndex(scene => scene.id === id);
    const result = { groundPoses: 0, pawPoses: 0, pawContacts: 0, movingPoses: 0, stationaryHolds: 0, continuousSeams: 0,
      stanceSamples: 0, hiddenChecks: 0, maxContactError: 0, maxShadowOffset: 0, maxStanceSlip: 0, maxPawElevation: 0 };
    const floor = 628;
    const yieldBrowser = () => new Promise(resolve => setTimeout(resolve, 0));

    function snapshot(id, ms) {
      const sceneIndex = index(id);
      if (sceneIndex < 0) throw Error('Missing scene ' + id);
      api.seek(sceneIndex, ms);
      const inverse = stage.getScreenCTM().inverse();
      const matrix = node => inverse.multiply(node.getScreenCTM());
      const mouseMatrix = matrix(mouse);
      const body = new DOMPoint(0, 0).matrixTransform(mouseMatrix);
      const contactCentre = new DOMPoint(0, 8).matrixTransform(mouseMatrix);
      const sole = feet.map(foot => new DOMPoint(0, 0).matrixTransform(matrix(foot)));
      const drawnSoles = feet.map(foot => {
        // Measure the drawn foot contour, not the motion helper's own target.
        const path = foot.querySelector('path'), m = matrix(path), length = path.getTotalLength();
        let lowest = { x: 0, y: -Infinity };
        for (let i = 0; i <= 80; i++) {
          const p = path.getPointAtLength(length * i / 80).matrixTransform(m);
          if (p.y > lowest.y) lowest = { x: p.x, y: p.y };
        }
        return lowest;
      });
      const stance = feet.map(foot => {
        if (!['true', 'false'].includes(foot.dataset.stance)) fail('Missing stance state on ' + foot.id, id + ' ' + ms);
        return foot.dataset.stance === 'true';
      });
      const relativeFeet = sole.map(p => new DOMPoint(p.x, p.y).matrixTransform(mouseMatrix.inverse()));
      const shade = new DOMPoint(Number(shadow.getAttribute('cx')), Number(shadow.getAttribute('cy'))).matrixTransform(matrix(shadow));
      for (const node of mouse.querySelectorAll('[d],[transform]')) {
        if (/NaN|Infinity|undefined/.test((node.getAttribute('d') || '') + (node.getAttribute('transform') || ''))) fail('Non-finite mouse geometry', id + ' ' + ms);
      }
      const values = [...sole.concat(drawnSoles).flatMap(p => [p.x, p.y]), body.x, body.y, shade.x, shade.y, mouseMatrix.a];
      if (!values.every(Number.isFinite)) fail('Non-finite mouse contact', id + ' ' + ms);
      return { body, contactCentre, sole, drawnSoles, stance, relativeFeet, shadow: shade, facing: Math.sign(mouseMatrix.a),
        visible: Number(mouse.getAttribute('opacity') ?? 1), shadowOpacity: Number(shadow.getAttribute('opacity') ?? 1) };
    }

    function groundContact(pose, context) {
      const support = pose.sole.filter((_, i) => pose.stance[i]);
      if (!support.length) fail('Grounded mouse has no planted foot', context);
      const error = Math.max(...support.map(p => Math.abs(p.y - floor)));
      result.maxContactError = Math.max(result.maxContactError, error);
      if (error > .6) fail('A planted foot leaves the ground (sole error ' + error.toFixed(2) + 'px)', context);
      if (pose.drawnSoles.some((p, i) => pose.stance[i] && Math.abs(p.y - floor) > .8)) fail('The drawn paw floats above its contact point', context);
      if (pose.drawnSoles.some(p => p.y > floor + 1)) fail('A mouse foot sinks below the ground', context);
      const offset = Math.abs(pose.shadow.x - pose.contactCentre.x);
      result.maxShadowOffset = Math.max(result.maxShadowOffset, offset);
      if (offset > 2 || !near(pose.shadow.y, floor, 1)) fail('Ground shadow left the mouse contact plane', context);
      if (pose.visible > .5 && pose.shadowOpacity < .05) fail('Grounded mouse lost its contact shadow', context);
      result.groundPoses++;
    }

    try {
      // Only grounded travel is asserted here; climbing onto the lion is an
      // intentional change of surface and is reviewed separately in the player.
      const mercy = scenes[index('mercy')], friends = scenes[index('friends')];
      const travel = ['scamper', 'return', 'mercy', 'chew'].map(id => {
        snapshot(id, 0);
        const motion = api.mouseState();
        if (![motion.start, motion.end].every(Number.isFinite) || motion.end <= motion.start) fail('Missing movement window', id);
        return { id, from: motion.start, to: motion.end, mustMove: id !== 'chew' };
      });
      for (const journey of travel) {
        const samples = [];
        for (let i = 0; i <= 16; i++) {
          const ms = journey.from + (journey.to - journey.from) * i / 16;
          const pose = snapshot(journey.id, ms);
          groundContact(pose, journey.id + ' ' + Math.round(ms) + 'ms');
          const previous = samples.at(-1);
          if (previous && Math.abs(pose.body.x - previous.body.x) > 1) {
            if (Math.sign(pose.body.x - previous.body.x) !== pose.facing) fail('Mouse travels backwards while facing the other way', journey.id + ' ' + Math.round(ms) + 'ms');
            result.movingPoses++;
          }
          samples.push(pose);
          if (i > 1 && i < 15) {
            const before = snapshot(journey.id, ms - 16), after = snapshot(journey.id, ms + 16);
            for (let foot = 0; foot < feet.length; foot++) {
              if (!before.stance[foot] || !after.stance[foot]) continue;
              const slip = distance(before.sole[foot], after.sole[foot]);
              if (slip > .65) fail('Planted foot slides during the stride (' + slip.toFixed(2) + 'px)', journey.id + ' ' + Math.round(ms) + 'ms / ' + feet[foot].id);
              result.stanceSamples++;
              result.maxStanceSlip = Math.max(result.maxStanceSlip, slip);
            }
          }
          await yieldBrowser();
        }
        const travelled = Math.abs(samples.at(-1).body.x - samples[0].body.x);
        if (journey.mustMove && travelled < 15) fail('Expected walking action never moves', journey.id);
        if (travelled > 8 && !samples.some(pose => pose.relativeFeet.some((p, i) => Math.abs(p.x - samples[0].relativeFeet[i].x) > 1))) fail('Mouse slides without a walking cycle', journey.id);
        onProgress({ ...result });
      }

      const end = id => travel.find(move => move.id === id).to;
      const waiting = Math.max(800, Math.min(mercy.lines[0].end - 650, travel.find(move => move.id === 'mercy').from - 1100));
      const holds = [
        { id: 'mercy', from: waiting, to: waiting + 300 },
        { id: 'return', from: end('return') + 200, to: end('return') + 500 },
        { id: 'chew', from: end('chew') + 150, to: end('chew') + 450 },
        { id: 'friends', from: friends.duration - 450, to: friends.duration - 150 },
        { id: 'mercy', from: end('mercy') + 50, to: end('mercy') + 250 }
      ];
      for (const hold of holds) {
        const a = snapshot(hold.id, hold.from), b = snapshot(hold.id, hold.to);
        groundContact(a, hold.id + ' stationary start');
        groundContact(b, hold.id + ' stationary end');
        if (distance(a.body, b.body) > .5 || a.sole.some((p, i) => distance(p, b.sole[i]) > .5)) fail('Walking or body bounce continues while the mouse is stationary', hold.id);
        result.stationaryHolds++;
        await yieldBrowser();
      }

      // The caught scene explicitly climbs and descends on the lion's forepaw.
      // It must not be forced onto the forest floor by a ground-only assertion.
      const caught = scenes[index('caught')];
      const paw = document.querySelector('#lion-paw > path');
      for (let i = 0; i <= 14; i++) {
        const ms = caught.duration * i / 14, pose = snapshot('caught', ms);
        const support = pose.sole.filter((_, foot) => pose.stance[foot]);
        if (!support.length) fail('Mouse has no support while climbing the paw', 'caught ' + Math.round(ms) + 'ms');
        const low = Math.min(...support.map(p => p.y)), high = Math.max(...support.map(p => p.y));
        result.maxPawElevation = Math.max(result.maxPawElevation, floor - low);
        const elevated = pose.sole.map((p, foot) => ({ x: p.x, y: p.y, foot })).filter(p => pose.stance[p.foot] && p.y < floor - 4);
        if (elevated.length) {
          if (pose.shadow.y < low - 8 || pose.shadow.y > high + 8 || Math.abs(pose.shadow.x - pose.contactCentre.x) > 2) {
            fail('Climbing shadow is detached from the supported mouse', 'caught ' + Math.round(ms) + 'ms');
          }
          const bothEndsRaised = ['back', 'front'].every(end => elevated.some(p => feet[p.foot].dataset.mouseFoot.startsWith(end)));
          if (bothEndsRaised && pose.shadow.y > floor - 5) fail('Paw shadow remains on the forest floor', 'caught ' + Math.round(ms) + 'ms');
          const toPaw = paw.getScreenCTM().inverse().multiply(stage.getScreenCTM());
          for (const point of elevated) {
            if (![1, 2, 3, 4].some(depth => paw.isPointInFill(new DOMPoint(point.x, point.y + depth).matrixTransform(toPaw)))) {
              fail('An elevated planted foot misses the drawn lion paw', 'caught ' + Math.round(ms) + 'ms / ' + feet[point.foot].id);
            }
            result.pawContacts++;
          }
          result.pawPoses++;
        }
        await yieldBrowser();
      }
      if (!result.pawPoses) fail('The mouse never reaches its supported paw pose (maximum measured elevation ' + result.maxPawElevation.toFixed(2) + 'px)', 'caught');

      for (const [from, to] of [['scamper', 'caught'], ['caught', 'mercy'], ['return', 'chew']]) {
        const a = snapshot(from, scenes[index(from)].duration), b = snapshot(to, 0);
        if (distance(a.body, b.body) > 1) fail('Mouse jumps position across a continuous scene change', from + ' → ' + to);
        if (a.shadowOpacity > .05 && b.shadowOpacity > .05 && distance(a.shadow, b.shadow) > 1) fail('Mouse shadow jumps across a continuous scene change', from + ' → ' + to);
        result.continuousSeams++;
        await yieldBrowser();
      }
      for (const id of ['morning', 'trap']) {
        const pose = snapshot(id, 500);
        if (pose.visible > .01 || pose.shadowOpacity > .01) fail('Hidden mouse leaves a visible body or shadow', id);
        result.hiddenChecks++;
      }
      return result;
    } finally { api.seek(saved.scene, saved.position); }
  };
})();
