(() => {
  'use strict';

  // One drawing and one continuous silhouette for every returning fox.
  const artURL = new URL('art/fox.svg?v=1', document.currentScript.src);
  const tx = (node, value) => node.setAttribute('transform', value);
  const op = (node, value) => node.setAttribute('opacity', String(value));
  const round = value => Math.round(value * 100) / 100;
  const xy = (x, y) => round(x) + ' ' + round(y);
  let source;
  let loading;

  function prepare() {
    if (!loading) loading = fetch(artURL, { cache: 'no-cache' }).then(async response => {
      if (!response.ok) throw Error('The Little Panth fox could not be loaded.');
      source = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
      if (source.querySelector('parsererror') || !source.querySelector('#fox-body') ||
          !source.querySelector('#fox-clip-shape')) throw Error('The Little Panth fox artwork is incomplete.');
    });
    return loading;
  }

  function mount(svg, parent) {
    if (!source) throw Error('Prepare the Little Panth fox before mounting it.');
    const defs = svg.querySelector('defs');
    for (const paint of source.querySelector('defs').children) defs.append(document.importNode(paint, true));
    const fox = document.importNode(source.querySelector('#fox'), true);
    parent.append(fox);
    return fox;
  }

  function rotate(x, y, angle, px = 0, py = 0) {
    const radians = angle * Math.PI / 180;
    return { x: px + (x - px) * Math.cos(radians) - (y - py) * Math.sin(radians),
      y: py + (x - px) * Math.sin(radians) + (y - py) * Math.cos(radians) };
  }

  function foot(x, walk, reach, front, far) {
    const sign = front === far ? 1 : -1;
    return { x: x + walk * sign * 1.02 + reach * (front ? 47 : -27),
      y: -(Math.max(0, walk * sign) * .29 + reach * 25) };
  }

  function limb(p, start, front, up = 0) {
    const w = 11, x = p.x, y = p.y, k = start.x - (front ? 2 : 8);
    return 'M' + xy(start.x - w * 1.6, start.y) + ' C' + xy(start.x - w * 2, start.y + 18) + ' ' +
      xy(k - w, y - 35 + up * 75) + ' ' + xy(x - w * .7, y - 13 + up * 27) + ' Q' + xy(x - w, y - 3 + up * 7) + ' ' +
      xy(x - w * .65, y) + ' L' + xy(x + w, y) + ' Q' + xy(x + w * 1.5, y - 4 + up * 8) + ' ' +
      xy(x + w * .65, y - 11 + up * 25) + ' C' + xy(x + w * .15, y - 30 + up * 70) + ' ' +
      xy(start.x + w * 1.5, start.y + 18) + ' ' + xy(start.x + w * 1.45, start.y) + ' Z';
  }

  function boot(p, width, height, up = 0) {
    const top = p.y - height + (height - 14) * up;
    return 'M' + xy(p.x - width * 1.7, top) + ' Q' + xy(p.x, top + height * .48) + ' ' +
      xy(p.x + width * 1.7, top) + ' L' + xy(p.x + width * 2, p.y + 3 + up * 32) +
      ' H' + round(p.x - width * 2) + ' Z';
  }

  function draw(p, pose, ms, still, talking, opening) {
    const set = (id, value) => p[id].setAttribute('d', value);
    const walk = pose.walk || 0, reach = pose.reach || 0, bend = pose.bend || 0, up = pose.reachUp || 0;
    const torso = (x, y) => rotate(x, y, bend, -63, -80);
    const bodyPoint = (x, y) => { const point = torso(x, y); return xy(point.x, point.y); };
    const head = pose.headPosition || torso(42, -124);
    const headAngle = (pose.head || 0) - reach * 7 +
      (talking && !still && pose.headMotion !== false ? Math.sin(ms / 300) * 2 : 0);
    const headPoint = (x, y) => { const point = rotate(x, y, headAngle); return { x: head.x + point.x, y: head.y + point.y }; };
    const fn = foot(58, walk, reach, true, false), rn = foot(-77, walk, reach, false, false);
    const ff = foot(34, walk, reach, true, true), rf = foot(-53, walk, reach, false, true);
    // The orchard jump is a reach above the head, with the wrist below the paw.
    fn.y -= up * 193; fn.x += up * 3;
    ff.y -= up * 174; ff.x += up * 10;
    const fh = headPoint(-17, 8), fc = headPoint(33, 22);
    // Near legs join the body in the same curve; feet stay on their contact plane
    // when the chest lowers. Far legs remain behind the silhouette.
    const body = 'M' + bodyPoint(-103, -90) + ' C' + bodyPoint(-108, -121) + ' ' + bodyPoint(-85, -139) + ' ' + bodyPoint(-52, -136) +
      ' C' + bodyPoint(-19, -132) + ' ' + bodyPoint(0, -132) + ' ' + xy(fh.x - 8, fh.y - 12) +
      ' Q' + xy(fh.x, fh.y - 18) + ' ' + xy(fh.x + 9, fh.y - 11) +
      ' C' + xy(fc.x + 4, fc.y - 20) + ' ' + xy(fc.x + 12, fc.y - 7) + ' ' + xy(fc.x + 1, fc.y + 4) +
      ' C' + bodyPoint(80, -83) + ' ' + xy(fn.x + 12, fn.y - 40 + up * 85) + ' ' + xy(fn.x + 8, fn.y - 13 + up * 28) +
      ' Q' + xy(fn.x + 23, fn.y - 5 + up * 9) + ' ' + xy(fn.x + 16, fn.y - up * 3) + ' L' + xy(fn.x - 8, fn.y) +
      ' Q' + xy(fn.x - 13, fn.y - 2 + up * 8) + ' ' + xy(fn.x - 12, fn.y - 14 + up * 26) +
      ' C' + xy(fn.x - 9, fn.y - 34 + up * 76) + ' ' + bodyPoint(36, -50 - up * 36) + ' ' + bodyPoint(30, -68) +
      ' C' + bodyPoint(6, -58) + ' ' + bodyPoint(-24, -59) + ' ' + bodyPoint(-49, -70) +
      ' C' + bodyPoint(-52, -52) + ' ' + xy(rn.x - 4, rn.y - 37) + ' ' + xy(rn.x - 8, rn.y - 15) +
      ' Q' + xy(rn.x + 9, rn.y - 7) + ' ' + xy(rn.x + 12, rn.y) + ' L' + xy(rn.x - 12, rn.y) +
      ' Q' + xy(rn.x - 20, rn.y - 4) + ' ' + xy(rn.x - 20, rn.y - 15) +
      ' C' + xy(rn.x - 19, rn.y - 35) + ' ' + bodyPoint(-79, -60) + ' ' + bodyPoint(-83, -71) +
      ' Q' + bodyPoint(-104, -76) + ' ' + bodyPoint(-103, -90) + ' Z';
    set('fox-body', body); set('fox-clip-shape', body);
    set('fox-front-far', limb(ff, torso(30, -100), true, up));
    set('fox-rear-far', limb(rf, torso(-65, -87), false));
    set('fox-far-paws', boot(ff, 9, 29, up) + boot(rf, 9, 29));
    set('fox-near-paws', boot(fn, 12, 40, up) + boot(rn, 13, 36));
    set('fox-leg-shade', 'M-89 -98Q-66 -82 -68 -61Q-81 -73 -89 -98Z M41 -98Q58 -86 48 -68Q52 -88 41 -98Z');
    tx(p['fox-coat-details'], 'rotate(' + bend + ' -63 -80)');
    tx(p['fox-leg-shade'], 'rotate(' + bend + ' -63 -80)');
    tx(p['fox-head'], 'translate(' + head.x + ' ' + head.y + ') rotate(' + headAngle + ')');
    tx(p['fox-tail'], 'rotate(' + bend + ' -63 -80) rotate(' +
      ((still ? 0 : Math.sin(ms / 430) * 4) + walk * .14 + reach * 17) + ' -83 -89)');
    tx(p['fox-ears'], 'rotate(' + (-7 * (pose.worry || 0)) + ' -6 -44)');
    tx(p['fox-brow'], 'rotate(' + (13 * (pose.worry || 0)) + ' 39 -31)');
    tx(p['fox-pupil'], 'translate(0 ' + (pose.head > 10 ? 1.3 : pose.head < 0 ? -1.3 : 0) + ')');
    tx(p['fox-jaw'], 'rotate(' + (talking ? opening * 6 : 0) + ' 33 12)');
    tx(p['fox-mouth'], 'translate(0 12) scale(1 ' + (.22 + opening * .8) + ') translate(0 -12)');
    op(p['fox-mouth'], talking ? 1 : 0);
    const blink = !still && (ms + 420) % 3770 > 3630;
    op(p['fox-eye'], blink ? 0 : 1); op(p['fox-lid'], blink ? 1 : 0);
    p.fox.dataset.rig = 'continuous-curves';
    p.fox.dataset.speaking = String(talking);
    return { ...head, angle: headAngle };
  }

  window.LittlePanthFox = { prepare, mount, draw };
})();
