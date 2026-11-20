(() => {
  'use strict';

  const byId = id => document.getElementById(id);
  const frame = byId('studio');
  const play = byId('play');
  const slider = byId('time');
  const duration = Number(slider.max);
  let studio, actor, vector, animation, startTime;
  let layout;

  function pointAt(milliseconds) {
    const time = Math.min(duration - 1, milliseconds) / 1000;
    const pose = studio.reactionPose('point', time);
    studio.sceneWithState(actor, () => {
      const arms = {left: pose.arms.right, right: pose.arms.left};
      studio.setBodyArmPose(arms, {right: pose.hands.left}, vector.scope);
      for (const node of vector.svg.querySelectorAll('[data-hand-action]')) studio.remapSceneRefs(node, vector.prefix);
    });

    const [shoulder, elbow] = pose.arms.left;
    byId('shoulder').setAttribute('transform', 'translate(' + layout.shoulder.join(' ') + ') rotate(' + shoulder + ')');
    byId('elbow').setAttribute('transform', 'translate(0 ' + layout.upperLength + ') rotate(' + elbow + ')');
    slider.value = milliseconds;
    byId('position').value = (milliseconds / 1000).toFixed(2) + ' s';
  }

  function loop(now) {
    startTime ??= now - Number(slider.value);
    pointAt((now - startTime) % duration);
    animation = requestAnimationFrame(loop);
  }

  function pause() {
    cancelAnimationFrame(animation);
    animation = undefined;
    startTime = undefined;
    play.textContent = 'Play loop';
  }

  play.addEventListener('click', () => {
    if (animation !== undefined) {
      pause();
    } else {
      play.textContent = 'Pause';
      animation = requestAnimationFrame(loop);
    }
  });
  slider.addEventListener('input', () => {
    pause();
    pointAt(Number(slider.value));
  });

  async function initialize() {
    try {
      const scene = frame.contentWindow;
      if (typeof scene.createSceneActor !== 'function') throw Error('Could not load the character studio');
      const response = await fetch('layout.json');
      if (!response.ok) throw Error('Could not load the painted layer layout');
      layout = await response.json();
      const entries = Object.entries(layout.images);
      await Promise.all(entries.map(async ([id, attributes]) => {
        const element = byId(id);
        const sprite = new Image();
        sprite.src = element.getAttribute('href');
        await sprite.decode();
        for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
      }));
      studio = scene;
      actor = studio.newSceneActor('adult-harpreet', 0);
      actor.view = 'right';
      Object.assign(actor.appearance, {
        framing: 'full', shirt: 'kurta', shirtColour: '#368083',
        headwear: 'dastaar', headwearColour: '#b75332'
      });
      vector = studio.createSceneActor(actor, 501);
      vector.svg.setAttribute('viewBox', '120 200 1470 1252');
      vector.svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      vector.svg.removeAttribute('width');
      vector.svg.removeAttribute('height');
      byId('vector').replaceChildren(vector.svg);
      pointAt(Number(slider.value));
      slider.disabled = play.disabled = false;
      byId('status').textContent = '';
    } catch (error) {
      byId('status').textContent = error.message + '. Try reloading the page.';
    }
  }

  frame.addEventListener('load', initialize, {once: true});
  if (typeof frame.contentWindow?.createSceneActor === 'function') {
    frame.removeEventListener('load', initialize);
    initialize();
  }
})();
