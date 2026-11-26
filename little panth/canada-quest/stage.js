'use strict';

window.questStage = (() => {
  const svg = document.querySelector('#stage');
  const ns = 'http://www.w3.org/2000/svg';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const camera = new UmtoCamera.DeliveryCamera(svg);
  const rig = window.UmtoNativeCharacterPlayer;
  const layer = document.querySelector('#scenery-map');
  for (const d of Object.values(QUEST_MAP.paths)) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill-rule', 'evenodd');
    layer.append(path);
  }
  let guide, explorer, speech, reaction;
  let screen = 'wide';
  let cameraUntil = 0;
  let frameRequested = false;
  let lastPaint = 0;

  function requestFrame() {
    if (frameRequested || !guide) return;
    frameRequested = true;
    requestAnimationFrame(paint);
  }

  function paint(now) {
    frameRequested = false;
    if (document.hidden) return;
    camera.update(now, null, false);
    if (reduce.matches || now - lastPaint > 36) {
      lastPaint = now;
      const elapsed = speech && (now - speech.start) / 1000;
      const word = speech && speech.length > elapsed ? {
        text: speech.word || speech.text[Math.floor(elapsed * 13) % speech.text.length],
        phase: (elapsed * 4.5) % 1, seconds: elapsed, length: speech.length
      } : null;
      const responding = reaction && now < reaction.until;
      guide.paint({
        x:787, y:644, lean:0, grips:[], quietHands:!word, gazeX:word ? 0 : 34,
        expression:word ? 'explain' : 'calm', gesture:speech?.gesture || 'explain'
      }, now, word, reduce.matches);
      explorer.paint({
        x:1065, y:644, lean:0, grips:[], quietHands:true, gazeX:word ? -48 : 0,
        expression:responding ? reaction.expression : word ? 'curious' : undefined
      }, now, null, reduce.matches);
      svg.dataset.rigReady = 'true';
    }
    const animating = now < Math.max(cameraUntil, reaction?.until || 0, (speech?.start || 0)+(speech?.length || 0)*1000);
    if (animating && !reduce.matches) requestFrame();
  }

  rig.open(document.querySelector('#studio')).then(api => {
    guide = new rig.Character(api, svg, document.querySelector('#guide'), document.querySelector('#guide-props'),
      {preset:'adult-harpreet',view:'front',height:346,serial:815});
    explorer = new rig.Character(api, svg, document.querySelector('#explorer'), document.querySelector('#explorer-props'),
      {preset:'kid-meher',view:'front',height:257,serial:816});
    requestFrame();
  }).catch(error => console.warn('Canada Quest could not start the UMTO character rig.', error));

  document.addEventListener('visibilitychange', requestFrame);
  reduce.addEventListener('change', requestFrame);
  return {
    cut(shot) {
      if (shot === screen) return;
      screen = shot;
      svg.setAttribute('preserveAspectRatio',shot==='wide'?'xMaxYMax slice':'xMaxYMid slice');
      // Wide to establish the atlas station, two-shot for each activity,
      // and a closer two-shot for feedback. The interactive map sits outside the camera.
      camera.cue({
        preset:shot, width:shot==='medium' ? 900 : shot==='two-shot' ? 1060 : 1280,
        duration:500, motion:shot==='wide' ? 'static' : 'dolly', parallax:true
      }, {x:808,y:393});
      cameraUntil = performance.now()+580;
      requestFrame();
    },
    react(correct) {
      reaction = {expression:correct ? 'delight' : 'curious',until:performance.now()+1350};
      requestFrame();
    },
    speak(text, length, gesture) {
      speech = {text, length, gesture, start:performance.now()};
      requestFrame();
    },
    word(text) {if (speech) speech.word = text;},
    silence() {speech = null; requestFrame();}
  };
})();
