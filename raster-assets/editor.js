(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const ns = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs = {}) {
    const element = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
    return element;
  }

  const catalog = [];
  function slot(group, id, name, selector, options = {}) {
    catalog.push({group, id, name, selector, ...options});
  }
  const layer = name => '[data-scene-layer="' + name + '"]';
  [
    ['face', 'Face / skin', 'face'], ['nose', 'Nose', 'noseGroup'],
    ['ear-l', 'Left ear', 'earLeft'], ['ear-r', 'Right ear', 'earRight'],
    ['brows', 'Eyebrows', 'eyebrowGroup'], ['mouth', 'Mouth', 'mouthGroup'],
    ['beard', 'Beard', 'beardGroup'], ['moustache', 'Moustache', 'moustacheGroup'],
    ['glasses', 'Glasses', 'glassesGroup', [459, 540, 338, 133]]
  ].forEach(([id, name, target, box]) => slot('Face', id, name, layer(target), {box}));
  for (const [key, name, start] of [['l', 'Left', 458], ['r', 'Right', 627]]) {
    slot('Eyes', 'eye-' + key, name + ' eye', layer('eyeGroup'), {box: [start, 523, 169, 168], cut: true});
    slot('Eyes', 'pupil-' + key, name + ' pupil', layer('eyeGroup'), {box: [start + 49, 578, 78, 65], overlay: true});
  }
  [
    ['turban-f', 'Turban front', 'headwearFront', [320, 235, 610, 380]],
    ['turban-b', 'Turban back', 'headwearBack', [320, 235, 610, 380]],
    ['hair-f', 'Front hair', 'frontHair', [360, 330, 535, 240]],
    ['hair-b', 'Back hair', 'hairBack', [339, 327, 577, 563]]
  ].forEach(([id, name, target, box]) => slot('Headwear & hair', id, name, layer(target), {fallback: box}));
  slot('Clothing', 'kurta', 'Kurta / chest', '[data-moving-garment]');
  slot('Clothing', 'waist', 'Trouser waist', '[data-rig-pelvis]');
  for (const [side, key, name] of [[-1, 'l', 'Left'], [1, 'r', 'Right']]) {
    const arm = '[data-rig-arm="' + side + '"]';
    const shoulder = arm + ' [data-rig-shoulder]';
    const palm = arm + ' [data-action-hand]';
    const leg = '[data-rig-leg="' + side + '"]';
    slot('Clothing', 'sleeve-' + key, name + ' upper sleeve', shoulder + ' > path:last-of-type');
    slot('Clothing', 'cuff-' + key, name + ' sleeve & cuff', arm + ' [data-sleeve-elbow]');
    slot('Arms & hands', 'upper-' + key, name + ' upper arm', shoulder, {box: [-63, 0, 126, 238], overlay: true});
    slot('Arms & hands', 'fore-' + key, name + ' forearm', arm + ' [data-rig-elbow]', {box: [-60, 0, 120, 235], overlay: true});
    slot('Arms & hands', 'hand-' + key, name + ' hand / palm', palm, {box: [-70, 0, 140, 168], cut: true});
    const fingers = [
      ['thumb', 'thumb', [-55, 23, 48, 81]],
      ['index', 'index finger', [-27, 45, 28, 116]],
      ['middle', 'middle finger', [-9, 52, 28, 113]],
      ['ring', 'ring finger', [10, 47, 28, 105]],
      ['little', 'little finger', [25, 40, 29, 100]]
    ];
    for (const [id, label, box] of fingers) {
      slot('Fingers', key + '-' + id, name + ' ' + label, palm, {box, overlay: true});
    }
    slot('Legs & shoes', 'leg-' + key, name + ' trouser leg', leg + ' [data-rig-hip] > [data-leg-surface]');
    slot('Legs & shoes', 'shoe-' + key, name + ' shoe', leg + ' [data-rig-foot]');
  }

  const defaults = {x: 0, y: 0, scale: 100, rotation: 0};
  const saved = new Map();
  const urls = new Map();
  let database, rig, actor, studio, current, active, referenceUrl, frameToken, activeReference, generating = false;
  const iframe = $('studio');
  const note = message => $('edit-status').textContent = message;
  const slotNodes = new Map();

  function transaction(mode, task) {
    return new Promise((resolve, reject) => {
      const tx = database.transaction('assets', mode);
      const request = task(tx.objectStore('assets'));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = tx.onerror = () => reject(tx.error || Error('Local storage was unavailable'));
    });
  }

  async function openAssets() {
    database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('umto-harpreet-raster-assets', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('assets', {keyPath: 'id'});
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    for (const row of await transaction('readonly', store => store.getAll())) {
      saved.set(row.id, row);
      urls.set(row.id, URL.createObjectURL(row.blob));
    }
  }

  function rectFor(part, target) {
    if (part.box) return part.box;
    const {x, y, width, height} = target.getBBox();
    if (!width || !height) return part.fallback;
    const pad = Math.max(width, height) * .05 + 2;
    return [x - pad, y - pad, width + 2 * pad, height + 2 * pad];
  }

  function targetOf(part) {
    return rig.svg.querySelector(part.selector);
  }

  // Keep the geometry in the same local coordinates the original rig animates.
  function referenceFor(part) {
    const target = targetOf(part);
    if (!target) return;
    const box = rectFor(part, target);
    if (!box) return;
    const [x, y, width, height] = box;
    const bounds = target.getBBox();
    const drawable = bounds.width > 0 && bounds.height > 0;
    const root = svg('svg', {viewBox: box.join(' '), width: Math.ceil(width), height: Math.ceil(height)});
    const defs = svg('defs');
    const ids = new Set();
    for (const element of rig.svg.querySelectorAll('defs > *')) {
      if (element.id && ids.has(element.id)) continue;
      if (element.id) ids.add(element.id);
      defs.append(element.cloneNode(true));
    }
    root.append(defs);
    const sample = target.cloneNode(true);
    sample.removeAttribute('transform');
    sample.removeAttribute('id');
    sample.querySelectorAll('defs, [data-raster-image]').forEach(node => node.remove());
    root.append(sample);
    return {box: [x, y, width, height], drawable, svgText: new XMLSerializer().serializeToString(root)};
  }

  function restoreVector() {
    rig.svg.querySelectorAll('[data-raster-image], [data-raster-mask]').forEach(node => node.remove());
    rig.svg.querySelectorAll('[data-original-mask]').forEach(node => {
      const mask = node.dataset.originalMask;
      if (mask) node.setAttribute('mask', mask);
      else node.removeAttribute('mask');
      delete node.dataset.originalMask;
    });
  }

  function compose() {
    restoreVector();
    if (!$('composite').checked) return;
    const cuts = new Map();
    for (const part of catalog) {
      const value = saved.get(part.id);
      const target = value && targetOf(part);
      if (!target) continue;
      const box = slotNodes.get(part.id)?.box;
      if (!box) continue;
      const [x, y, width, height] = box;
      const {x: shiftX, y: shiftY, scale, rotation} = value.alignment;
      const cx = x + width / 2, cy = y + height / 2;
      const image = svg('image', {href: urls.get(part.id), x, y, width, height, 'data-raster-image': part.id,
        transform: 'translate(' + shiftX + ' ' + shiftY + ') translate(' + cx + ' ' + cy + ') rotate(' + rotation + ') scale(' + scale / 100 + ') translate(' + -cx + ' ' + -cy + ')'});
      if (!part.overlay) {
        const holes = cuts.get(target) || [];
        holes.push(part.cut ? box : [-4000, -4000, 8000, 8000]);
        cuts.set(target, holes);
      }
      const graphics = svg('g', {'data-raster-image': part.id});
      const transform = target.getAttribute('transform');
      if (transform) graphics.setAttribute('transform', transform);
      graphics.append(image);
      // A hand or eye can have several rasters. Preserve the order those layers
      // are listed in the catalog so detail layers sit over the larger pieces.
      let after = target;
      while (after.nextElementSibling?.hasAttribute('data-raster-image')) after = after.nextElementSibling;
      after.after(graphics);
    }
    let index = 0;
    for (const [target, holes] of cuts) {
      const id = 'umto-raster-cut-' + index++;
      const mask = svg('mask', {id, maskUnits: 'userSpaceOnUse', x: -4000, y: -4000, width: 8000, height: 8000, 'data-raster-mask': ''});
      mask.append(svg('rect', {x: -4000, y: -4000, width: 8000, height: 8000, fill: 'white'}));
      for (const [x, y, width, height] of holes) mask.append(svg('rect', {x, y, width, height, fill: 'black'}));
      rig.svg.prepend(mask);
      target.dataset.originalMask = target.getAttribute('mask') || '';
      target.setAttribute('mask', 'url(#' + id + ')');
    }
  }

  function renderSlots() {
    const root = $('slots');
    root.replaceChildren();
    const query = $('search').value.trim().toLowerCase();
    const groups = new Map();
    for (const part of catalog) {
      if (!slotNodes.has(part.id) || !(part.group + ' ' + part.name).toLowerCase().includes(query)) continue;
      let section = groups.get(part.group);
      if (!section) {
        section = document.createElement('section');
        const title = document.createElement('h2');
        title.textContent = part.group;
        section.append(title);
        groups.set(part.group, section);
        root.append(section);
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'slot';
      button.dataset.slot = part.id;
      button.setAttribute('aria-current', String(current?.id === part.id));
      button.append(part.name);
      const indicator = document.createElement('span');
      indicator.textContent = saved.has(part.id) ? '✓' : '○';
      indicator.setAttribute('aria-label', saved.has(part.id) ? 'Raster ready' : 'Empty');
      indicator.classList.toggle('has-art', saved.has(part.id));
      button.append(indicator);
      button.onclick = () => select(part);
      section.append(button);
    }
    if (!root.childElementCount) root.textContent = 'No matching assets.';
    const count = [...slotNodes.keys()].filter(id => saved.has(id)).length;
    $('progress').textContent = count + ' / ' + slotNodes.size + ' filled';
    $('fill').disabled = generating || ![...slotNodes].some(([id, reference]) => reference.drawable && !saved.has(id));
  }

  function showInspector() {
    const row = saved.get(current.id);
    $('part-status').textContent = row ? row.width + ' × ' + row.height + ' px' : 'Empty';
    $('part-status').title = row?.generated ? 'Rasterized vector reference' : row ? 'Imported artwork' : '';
    $('raster').hidden = !row;
    $('empty').hidden = Boolean(row);
    if (row) $('raster').src = urls.get(current.id);
    else $('raster').removeAttribute('src');
    for (const name of Object.keys(defaults)) $(name).value = row?.alignment[name] ?? defaults[name];
    $('upload').disabled = !current;
    $('make').disabled = !activeReference?.drawable || generating;
    $('download').disabled = $('remove').disabled = $('alignment').disabled = !row;
  }

  function select(part) {
    current = part;
    activeReference = slotNodes.get(part.id);
    if (referenceUrl) URL.revokeObjectURL(referenceUrl);
    referenceUrl = URL.createObjectURL(new Blob([activeReference.svgText], {type: 'image/svg+xml'}));
    $('reference').src = referenceUrl;
    $('reference').hidden = false;
    $('part-name').textContent = part.name;
    $('part-note').textContent = !activeReference.drawable ? 'Harpreet has no vector artwork on this layer. You can still upload a raster.' : part.group === 'Fingers' ? 'Finger detail layers sit on the palm and follow its wrist joint.'
      : part.overlay ? 'This layer sits over the vector guide.' : 'The raster uses the reference area for placement.';
    note('');
    renderSlots();
    showInspector();
  }

  async function setAsset(part, blob, {generated = false, quiet = false} = {}) {
    if (!part || !blob || !/^image\/(png|webp|jpeg|avif)$/.test(blob.type)) {
      note('Choose a PNG, WebP, JPEG, or AVIF file.');
      return;
    }
    if (blob.size > 30 * 1024 * 1024) {
      note('Choose an image under 30 MB.');
      return;
    }
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const value = {id: part.id, blob, width: image.naturalWidth, height: image.naturalHeight, alignment: {...defaults}, generated};
      if (database) await transaction('readwrite', store => store.put(value));
      if (urls.has(part.id)) URL.revokeObjectURL(urls.get(part.id));
      urls.set(part.id, url);
      saved.set(part.id, value);
      if (!quiet) {
        renderSlots();
        showInspector();
        compose();
        note(database ? 'Saved in this browser.' : 'Added for this session.');
      }
      return true;
    } catch {
      URL.revokeObjectURL(url);
      note('Could not read or save this image.');
    }
  }

  $('upload').onchange = event => {
    setAsset(current, event.target.files[0]);
    event.target.value = '';
  };

  const drop = $('drop-zone');
  drop.ondragover = event => {
    event.preventDefault();
    if (current) drop.classList.add('dragging');
  };
  drop.ondragleave = () => drop.classList.remove('dragging');
  drop.ondrop = event => {
    event.preventDefault();
    drop.classList.remove('dragging');
    if (current) setAsset(current, event.dataTransfer.files[0]);
  };

  async function rasterize(reference, longestSide) {
    const [, , width, height] = reference.box;
    const url = URL.createObjectURL(new Blob([reference.svgText], {type: 'image/svg+xml'}));
    try {
      const source = new Image();
      source.src = url;
      await source.decode();
      const scale = longestSide / Math.max(width, height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(width * scale);
      canvas.height = Math.ceil(height * scale);
      const context = canvas.getContext('2d');
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!png) throw Error('Could not rasterize');
      return png;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function generate(parts, pixels) {
    generating = true;
    showInspector();
    renderSlots();
    let count = 0;
    let errors = 0;
    for (const part of parts) {
      try {
        if (parts.length > 1 && saved.has(part.id)) continue;
        const png = await rasterize(slotNodes.get(part.id), pixels);
        if (parts.length > 1 && saved.has(part.id)) continue;
        if (await setAsset(part, png, {generated: true, quiet: true})) count++;
        else errors++;
      } catch {
        errors++;
      }
      note('Created ' + count + ' of ' + parts.length + ' rasters…');
    }
    generating = false;
    renderSlots();
    showInspector();
    compose();
    note(count + (count === 1 ? ' raster created.' : ' rasters created.') + (errors ? ' ' + errors + ' could not be created.' : ''));
  }

  $('make').onclick = () => generate([current], 1536);
  $('fill').onclick = () => generate(catalog.filter(part => slotNodes.get(part.id)?.drawable && !saved.has(part.id)), 768);

  $('download').onclick = () => {
    const item = saved.get(current.id);
    const extension = {'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/avif': 'avif'}[item.blob.type];
    const link = document.createElement('a');
    link.href = urls.get(item.id);
    link.download = 'harpreet-' + item.id + '.' + extension;
    link.click();
  };

  $('remove').onclick = async () => {
    const id = current.id;
    try {
      if (database) await transaction('readwrite', store => store.delete(id));
      saved.delete(id);
      URL.revokeObjectURL(urls.get(id));
      urls.delete(id);
      renderSlots();
      showInspector();
      compose();
      note('Raster cleared.');
    } catch {
      note('Could not clear this slot.');
    }
  };

  async function align(values) {
    const item = saved.get(current.id);
    if (!item) return;
    const updated = {...item, alignment: values};
    saved.set(item.id, updated);
    compose();
    if (!database) return;
    try {
      await transaction('readwrite', store => store.put(updated));
    } catch {
      note('Alignment could not be saved.');
    }
  }
  for (const name of Object.keys(defaults)) $(name).onchange = () => {
    const input = $(name);
    const value = Math.max(Number(input.min), Math.min(Number(input.max), input.valueAsNumber || defaults[name]));
    input.value = value;
    align({...saved.get(current.id).alignment, [name]: value});
  };
  $('reset').onclick = () => {
    align({...defaults});
    showInspector();
  };
  $('search').oninput = renderSlots;
  $('composite').onchange = compose;

  function poseAt(seconds) {
    restoreVector();
    studio.sceneWithState(actor, () => {
      const pose = studio.reactionPose('point', seconds);
      studio.setBodyArmPose(pose.arms, pose.hands, rig.scope);
      for (const hand of rig.svg.querySelectorAll('[data-hand-action]')) studio.remapSceneRefs(hand, rig.prefix);
    });
    compose();
  }

  $('gesture').onclick = () => {
    if (frameToken !== undefined) {
      cancelAnimationFrame(frameToken);
      frameToken = undefined;
      poseAt(0);
      $('gesture').textContent = 'Try pointing';
      return;
    }
    $('gesture').textContent = 'Stop gesture';
    const start = performance.now();
    let last = 0;
    function tick(now) {
      if (now - last > 32) {
        poseAt((now - start) / 1000);
        last = now;
      }
      frameToken = requestAnimationFrame(tick);
    }
    frameToken = requestAnimationFrame(tick);
  };

  async function start() {
    if (active) return;
    active = true;
    try {
      studio = iframe.contentWindow;
      if (typeof studio.createSceneActor !== 'function') throw Error('The UMTO rig did not load');
      actor = studio.newSceneActor('adult-harpreet', 0);
      actor.view = 'front';
      Object.assign(actor.appearance, {framing: 'full', shirt: 'kurta', headwear: 'dastaar', shirtColour: '#368083', headwearColour: '#b75332'});
      rig = studio.createSceneActor(actor, 610);
      rig.svg.setAttribute('viewBox', '115 185 1040 2110');
      rig.svg.setAttribute('aria-label', 'Harpreet with the selected raster layers');
      $('stage').replaceChildren(rig.svg);
      for (const part of catalog) {
        const reference = referenceFor(part);
        if (reference) slotNodes.set(part.id, reference);
      }
      try {
        await openAssets();
      } catch {
        note('Local storage is unavailable. Changes last for this session.');
      }
      select(catalog.find(part => part.id === 'eye-l'));
      compose();
      $('gesture').disabled = false;
      $('app-status').textContent = '';
    } catch (error) {
      $('app-status').textContent = error.message + '. Reload the page to try again.';
    }
  }

  iframe.addEventListener('load', start, {once: true});
  if (typeof iframe.contentWindow?.createSceneActor === 'function') start();
})();
