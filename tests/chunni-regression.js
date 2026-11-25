/* Shared by body-rig.cjs and the local visual review page. Run inside the Studio document. */
(() => {
  'use strict';
  const ns = 'http://www.w3.org/2000/svg';
  const fail = (message, context) => { throw Error(message + ' · ' + context); };
  const finiteMatrix = matrix => matrix && ['a', 'b', 'c', 'd', 'e', 'f'].every(key => Number.isFinite(matrix[key]));
  const transformedBox = (box, matrix) => {
    const points = [[box.x, box.y], [box.x + box.width, box.y],
      [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]]
      .map(([x, y]) => new DOMPoint(x, y).matrixTransform(matrix));
    return { left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)),
      top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)) };
  };

  // isPointInFill alone ignores ancestor clip paths. Respect the Studio's camera
  // strips so a hidden duplicate cannot create a false shoulder overlap.
  function geometry(path, root, context) {
    const rootToScreen = root.getScreenCTM();
    const toRoot = rootToScreen.inverse().multiply(path.getScreenCTM());
    if (!finiteMatrix(toRoot)) fail('Non-finite cloth transform', context);
    const inverse = toRoot.inverse(), box = transformedBox(path.getBBox(), toRoot), clips = [];
    for (let parent = path; parent && parent !== root; parent = parent.parentElement) {
      const match = parent.getAttribute('clip-path')?.match(/^url\(#([^)]*)\)$/);
      if (!match) continue;
      const clip = root.querySelector('#' + CSS.escape(match[1]));
      if (!clip) fail('Missing fabric clip ' + match[1], context);
      if (clip.getAttribute('clipPathUnits') === 'objectBoundingBox') fail('Unsupported cloth clip units', context);
      const toClip = rootToScreen.inverse().multiply(parent.getScreenCTM()).inverse();
      const clipTransform = clip.transform.baseVal.consolidate()?.matrix || new DOMMatrix();
      const shapes = [...clip.querySelectorAll('path,rect,circle,ellipse,polygon,polyline')].map(shape => {
        let matrix = new DOMMatrix();
        for (let node = shape; node && node !== clip; node = node.parentElement) {
          matrix = (node.transform?.baseVal.consolidate()?.matrix || new DOMMatrix()).multiply(matrix);
        }
        return { shape, inverse: clipTransform.multiply(matrix).inverse() };
      });
      if (!shapes.length) fail('Empty fabric clip', context);
      clips.push({ toClip, shapes });
    }
    return {
      box, toRoot,
      contains(point) {
        if (point.x < box.left || point.x > box.right || point.y < box.top || point.y > box.bottom) return false;
        for (const clip of clips) {
          const local = point.matrixTransform(clip.toClip);
          if (!clip.shapes.some(({ shape, inverse }) => shape.isPointInFill(local.matrixTransform(inverse)))) return false;
        }
        return path.isPointInFill(point.matrixTransform(inverse));
      }
    };
  }

  function combinedBox(paths) {
    return { left: Math.min(...paths.map(p => p.box.left)), right: Math.max(...paths.map(p => p.box.right)),
      top: Math.min(...paths.map(p => p.box.top)), bottom: Math.max(...paths.map(p => p.box.bottom)) };
  }

  window.checkChunniDrape = async function checkChunniDrape({ capture = false, onProgress = () => {} } = {}) {
    const frames = [...new Set([...Array.from({ length: 31 }, (_, i) => i * .12),
      Math.PI / 10, 3 * Math.PI / 10, 5 * Math.PI / 10, 7 * Math.PI / 10, 9 * Math.PI / 10])].sort((a, b) => a - b);
    const result = { cases: 0, poses: 0, facePoints: 0, minimumOverlap: Infinity,
      seamPoints: 0, maximumSeamGap: 0, captures: [] };
    let serial = 9950;
    for (const preset of ['elder-bibi-ji', 'elder-bibi']) for (const view of ['front', 'left', 'right']) {
      const variants = [{}, { colour: '#416e86' }, ...(view === 'front' ? [{ headSize: 75 }, { headSize: 103 }] : [])];
      for (const variant of variants) {
        const actor = newSceneActor(preset, 0);
        actor.view = view;
        if (variant.colour) actor.appearance.headwearColour = variant.colour;
        if (variant.headSize) actor.appearance.headSize = variant.headSize;
        const cloth = actor.appearance.headwearColour.toLowerCase();
        const context = preset + ' / ' + view + ' / ' + cloth + ' / head ' + actor.appearance.headSize;
        const node = createSceneActor(actor, serial++);
        const root = node.svg;
        root.style.cssText = 'position:absolute;left:-3000px;top:0;width:700px;height:1000px;overflow:visible;';
        document.body.append(root);
        try {
          const heads = [...node.layers.headwearFront.querySelectorAll('[data-chunni-head]')];
          const shoulders = [...node.layers.torso.querySelectorAll('[data-chunni-shoulders]')];
          if (!heads.length || !shoulders.length) fail('Missing chunni layer', context);
          const panels = [...heads, ...shoulders];
          const back = node.layers.headwearBack;
          const backPaths = [...back.querySelectorAll('path')].filter(p => p.getAttribute('fill') && p.getAttribute('fill') !== 'none');
          if (backPaths.length) panels.push(back);
          const palette = new Set([cloth, ...Array.from({ length: 51 }, (_, i) => bodyShade(cloth, i / 100).toLowerCase())]);
          for (const panel of panels) {
            const base = panel.querySelector('path');
            if (base?.getAttribute('fill')?.toLowerCase() !== cloth) fail('Head, back and shoulders use different scarf colours', context);
            for (const path of panel.querySelectorAll('path')) {
              const fill = path.getAttribute('fill');
              const channels = /^#[0-9a-f]{6}$/i.test(fill || '') ? [1, 3, 5].map(i => parseInt(fill.slice(i, i + 2), 16)) : [];
              const highlight = path.hasAttribute('data-chunni-highlight') && channels.length === 3 && channels.every(c => c >= 230) &&
                path.hasAttribute('opacity') && Number(path.getAttribute('opacity')) <= .2;
              const hairline = path.hasAttribute('data-chunni-hairline') && heads.includes(panel) &&
                fill?.toLowerCase() === actor.appearance.hairColour?.toLowerCase();
              if (fill && fill !== 'none' && !palette.has(fill.toLowerCase()) && !highlight && !hairline) fail('Fabric shade does not follow the scarf colour', context);
            }
          }
          for (const panel of [...heads, ...shoulders]) {
            if (![...panel.querySelectorAll('[stroke]')].some(p => p.getAttribute('stroke') === chunniTrim)) fail('Scarf trim colour is inconsistent', context);
          }
          const headEdge = node.layers.headwearFront.querySelector('[data-chunni-edge="head"]');
          const shoulderEdges = ['near', 'far'].map(side => node.layers.torso.querySelector('[data-chunni-edge="' + side + '"]'));
          if (!headEdge || shoulderEdges.some(edge => !edge)) fail('Missing continuous scarf border', context);

          const landmarks = document.createElementNS(ns, 'g');
          landmarks.setAttribute('opacity', '0');
          landmarks.innerHTML = sceneWithState(actor, () => cameraMarkup('headwearFront',
            '<g transform="translate(377 210) scale(5)">' +
            [[34, 78], [68, 78], [52, 97], [52, 110]].map(([x, y], i) =>
              '<circle data-check-landmark="' + i + '" cx="' + x + '" cy="' + y + '" r=".4"/>').join('') +
            '<circle data-check-crown="" cx="52" cy="28" r=".4"/></g>'));
          remapSceneRefs(landmarks, node.prefix);
          root.append(landmarks);

          for (const time of frames) {
            const at = context + ' / nod ' + time.toFixed(3) + 's';
            sceneWithState(actor, () => paintSceneActorFace(node, reactionPose('nod', time)));
            landmarks.setAttribute('transform', node.layers.face.getAttribute('transform') || '');
            for (const el of root.querySelectorAll('[d],[transform]')) {
              if (/NaN|Infinity|undefined/.test((el.getAttribute('d') || '') + (el.getAttribute('transform') || ''))) fail('Non-finite SVG geometry', at);
            }
            const filled = layer => [...layer.querySelectorAll('path')].filter(path => path.getAttribute('fill')?.toLowerCase() === cloth);
            const headCloth = [...filled(node.layers.headwearFront), ...filled(back)].map(path => geometry(path, root, at));
            const drapeCloth = shoulders.flatMap(filled).map(path => geometry(path, root, at));
            const h = combinedBox(headCloth), d = combinedBox(drapeCloth);
            const bounds = { left: Math.max(h.left, d.left), right: Math.min(h.right, d.right),
              top: Math.max(h.top, d.top), bottom: Math.min(h.bottom, d.bottom) };
            const middle = (d.left + d.right) / 2, hits = [0, 0], rows = [0, 0];
            for (const side of [0, 1]) {
              // Establish a real overlap patch beside each side of the neck.
              // Stop after two rows of hits; exhaustively measuring the entire
              // scarf adds no regression coverage and blocks interactive QA.
              const left = side ? Math.max(bounds.left, middle + 65) : bounds.left;
              const right = side ? bounds.right : Math.min(bounds.right, middle - 65);
              for (let y = bounds.top + 4; y < bounds.bottom; y += 8) {
                let rowHit = false;
                for (let x = left + 4; x < right; x += 8) {
                  const point = new DOMPoint(x, y);
                  if (headCloth.some(p => p.contains(point)) && drapeCloth.some(p => p.contains(point))) {
                    hits[side]++;
                    rowHit = true;
                    if (rows[side] && hits[side] >= 6) break;
                  }
                }
                if (rowHit) rows[side]++;
                if (hits[side] >= 6 && rows[side] >= 2) break;
              }
            }
            if (Math.min(...hits) < 6 || Math.min(...rows) < 2) fail('Chunni loses filled overlap at a shoulder (' + hits.join(', ') + ')', at);
            result.minimumOverlap = Math.min(result.minimumOverlap, ...hits);

            // Matching fill alone can conceal a disconnected, rigid hood. Its
            // visible gold border must meet both torso edges through the nod.
            const toRoot = path => root.getScreenCTM().inverse().multiply(path.getScreenCTM());
            for (const [side, edge] of shoulderEdges.entries()) {
              const headPoint = headEdge.getPointAtLength(side ? headEdge.getTotalLength() : 0).matrixTransform(toRoot(headEdge));
              const shoulderPoint = edge.getPointAtLength(0).matrixTransform(toRoot(edge));
              const gap = Math.hypot(headPoint.x - shoulderPoint.x, headPoint.y - shoulderPoint.y);
              if (!Number.isFinite(gap) || gap > .08) fail('Gold scarf border separates from shoulder (' + gap.toFixed(3) + ')', at);
              result.maximumSeamGap = Math.max(result.maximumSeamGap, gap);
              result.seamPoints++;
            }

            const frontCloth = [...node.layers.headwearFront.querySelectorAll('path')]
              .filter(path => path.getAttribute('fill') && path.getAttribute('fill') !== 'none').map(path => geometry(path, root, at));
            const visibleLandmarks = new Set();
            for (const mark of landmarks.querySelectorAll('[data-check-landmark]')) {
              const test = geometry(mark, root, at);
              const point = new DOMPoint(Number(mark.getAttribute('cx')), Number(mark.getAttribute('cy'))).matrixTransform(test.toRoot);
              if (!test.contains(point)) continue;
              visibleLandmarks.add(mark.dataset.checkLandmark);
              for (const [dx, dy] of [[0, 0], [-4, 0], [4, 0], [0, -4], [0, 4]]) {
                if (frontCloth.some(path => path.contains(new DOMPoint(point.x + dx, point.y + dy)))) fail('Scarf covers an eye, nose or mouth', at);
                result.facePoints++;
              }
            }
            if (visibleLandmarks.size !== 4) fail('Face clearance check lost a projected landmark', at);
            const crown = [...landmarks.querySelectorAll('[data-check-crown]')].map(mark => {
              const probe = geometry(mark, root, at);
              const point = new DOMPoint(52, 28).matrixTransform(probe.toRoot);
              return probe.contains(point) && frontCloth.some(path => path.contains(point));
            });
            if (!crown.some(Boolean)) fail('Chunni lifts away from the crown', at);
            result.poses++;
            if (result.poses % 6 === 0) onProgress({ cases: result.cases, poses: result.poses });
            // CUA and a human reviewer must be able to inspect or navigate away
            // while this check runs, including when a geometry defect is slow.
            await new Promise(resolve => setTimeout(resolve, 0));
          }
          landmarks.remove();
          if (capture && !variant.colour && !variant.headSize) {
            sceneWithState(actor, () => paintSceneActorFace(node, reactionPose('nod', 3 * Math.PI / 10)));
            const copy = root.cloneNode(true);
            copy.removeAttribute('style');
            copy.setAttribute('viewBox', '235 200 810 1430');
            copy.setAttribute('width', '100%');
            copy.setAttribute('height', '470');
            result.captures.push({ preset, view, svg: new XMLSerializer().serializeToString(copy) });
          }
          result.cases++;
          onProgress({ cases: result.cases, poses: result.poses });
        } finally { root.remove(); }
      }
    }
    return result;
  };
})();
