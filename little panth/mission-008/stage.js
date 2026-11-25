(() => {
  'use strict';

  const clamp = n => Math.min(1, Math.max(0, n));
  const between = (ms, start, stop) => clamp((ms - start) / Math.max(16, stop - start));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const point = (x, y) => ({ x, y });
  const along = (from, to, t) => point(mix(from.x, to.x, t), mix(from.y, to.y, t));
  const line = (scene, id) => scene.lines.find(entry => entry.id === id);
  const opacity = (node, value) => node.setAttribute('opacity', String(value));
  const windHome = { x: 461, y: 137 };
  const { open, Character, voiceFrame } = window.UmtoNativeCharacterPlayer;
  const travellerSpec = { preset: 'adult-harpreet', view: 'right', height: 330, serial: 408, hipHinge: true };
  let studio;
  const transform = (node, value) => node.setAttribute('transform', value);
  const matrixString = m => 'matrix(' + [m.a, m.b, m.c, m.d, m.e, m.f].join(' ') + ')';

  function wordAt(scene, id, word) {
    const entry = line(scene, id);
    const index = entry.reading.words.findIndex(value => value.replace(/[\p{P}\p{S}]/gu, '') === word);
    return entry.start + (entry.reading.timings[index]?.[0] ?? entry.duration * 0.5);
  }

  function cuesFor(scene) {
    switch (scene.id) {
      case 'gust':
        return { blows: wordAt(scene, 'gust-leaves', 'ਜ਼ੋਰ'), grip: wordAt(scene, 'gust-leaves', 'ਘੁੱਟ') - 90 };
      case 'wrap':
        return {
          blows: wordAt(scene, 'wrap-shawl', 'ਤੇਜ਼'),
          grip: wordAt(scene, 'wrap-shawl', 'ਲਪੇਟ') - 290,
          rests: line(scene, 'wrap-wind').start
        };
      case 'sunlight':
        return { clear: wordAt(scene, 'sunlight-clouds', 'ਪਾਸੇ'), warms: wordAt(scene, 'sunlight-clouds', 'ਨਿੱਘੀ') };
      case 'fold':
        return {
          remove: wordAt(scene, 'fold-shawl', 'ਲਾਹੀ'),
          fold: wordAt(scene, 'fold-shawl', 'ਤਹਿ'),
          carry: wordAt(scene, 'fold-shawl', 'ਬਾਂਹ')
        };
      case 'lesson':
        return { walk: wordAt(scene, 'lesson-home', 'ਤੁਰ') - 860 };
      default:
        return {};
    }
  }

  function eventsFor(scene) {
    const cues = cuesFor(scene);
    if (scene.id === 'gust' || scene.id === 'wrap') {
      return [{ ms: cues.blows, sound: 'gust' }, { ms: cues.grip + 140, sound: 'ribbon' }];
    }
    if (scene.id === 'fold') return [{ ms: cues.remove, sound: 'ribbon' }];
    if (scene.id === 'lesson') {
      const cuesOnPath = [];
      for (let ms = cues.walk + 380; ms < scene.duration - 550; ms += 630) cuesOnPath.push({ ms, sound: 'step' });
      return cuesOnPath;
    }
    return [];
  }

  function sceneState(scene, cues, ms, still) {
    let light = .23, wind = .04, clutched = 0, takeOff = 0, folding = 0, carry = 0;
    let x = 626, stride = 0, walking = 0, grasp = 0, lookingUp = 0, cloudShift = 0;
    switch (scene.id) {
      case 'road': {
        const walk = between(ms, 180, scene.duration - 380);
        x = mix(398, 626, still ? Math.round(walk) : smooth(walk));
        stride = (x - 398) / 88;
        walking = smooth(Math.min(1, walk / .08, (1 - walk) / .08));
        break;
      }
      case 'challenge':
        lookingUp = 1;
        break;
      case 'gust': {
        const rising = smooth(between(ms, cues.blows - 110, cues.blows + 800));
        wind = .06 + rising * (.73 + (still ? .1 : Math.sin(ms / 330) * .13));
        light = mix(.23, .12, rising);
        clutched = .77 * smooth(between(ms, cues.grip - 180, cues.grip + 480));
        break;
      }
      case 'wrap': {
        const gust = smooth(between(ms, cues.blows - 180, cues.blows + 660));
        const rest = smooth(between(ms, cues.rests - 720, cues.rests + 220));
        wind = mix(.77, 1, gust) * (1 - rest);
        light = .12;
        clutched = mix(.77, 1, smooth(between(ms, cues.grip, cues.grip + 520)));
        break;
      }
      case 'sunlight': {
        const clearing = smooth(between(ms, cues.clear - 200, cues.clear + 1720));
        const warming = smooth(between(ms, cues.warms - 450, cues.warms + 1100));
        light = mix(.12, 1, warming);
        wind = 0;
        cloudShift = clearing;
        clutched = mix(1, .23, warming);
        lookingUp = 1 - .6 * warming;
        break;
      }
      case 'fold':
        light = 1;
        cloudShift = 1;
        clutched = .23;
        grasp = smooth(between(ms, cues.remove - 680, cues.remove - 130));
        takeOff = smooth(between(ms, cues.remove - 90, cues.remove + 640));
        folding = smooth(between(ms, cues.fold - 120, cues.fold + 540));
        carry = smooth(between(ms, cues.carry - 200, cues.carry + 480));
        break;
      case 'lesson': {
        light = 1;
        cloudShift = 1;
        takeOff = folding = carry = 1;
        const stop = scene.duration - 470;
        const walk = between(ms, cues.walk, stop);
        // Match the opening's calm walking pace and finish in view. Covering
        // the whole remaining road during this short spoken outro caused a sprint.
        const distance = Math.min(90, Math.max(0, stop - cues.walk) * .026);
        x = mix(626, 626 + distance, still ? Math.round(walk) : smooth(walk));
        stride = (x - 626) / 88;
        walking = smooth(Math.min(1, walk / .18, (1 - walk) / .18));
        break;
      }
    }
    return { light, wind, clutched, grasp, takeOff, folding, carry, x, stride, walking, lookingUp, cloudShift };
  }

  // One continuous cloth keeps its winding while it slips off the shoulders,
  // hangs from the two hands, folds, and settles across the near forearm.
  // The asymmetric long end reaches the resting knee plane.
  const wornCloth = [
    [-.77,-.03],[-.70,-.13],[-.41,-.14],[-.28,-.06],
    [-.16,.05],[-.08,.11],[.02,.10],[.18,.08],[.34,-.05],[.45,-.08],
    [.70,-.02],[.86,.13],[.78,.30],[.72,.55],[.78,.90],[.70,.99],
    [.56,1.07],[.26,1.03],[.20,.97],[.13,.70],[-.20,.60],[-.50,.63],
    [-.30,.66],[-1.46,.24],[-.77,-.03]
  ];
  const clothOutline = [[0,0],[.12,-.03],[.25,.02],[.33,.02],[.45,.04],[.55,.04],[.67,.02],
    [.8,0],[.9,-.03],[1,0],[1.02,.2],[.98,.42],[.99,.55],
    [1.01,.78],[.97,.98],[.88,1],[.65,1.06],[.4,1.02],[.25,1],
    [.14,1.04],[.03,.98],[.02,.8],[-.02,.55],[.01,.2],[0,0]];
  function drape(left, right, depth) {
    return clothOutline.map(([x,y]) => point(mix(left.x,right.x,x), mix(left.y,right.y,x) + y * depth));
  }
  const blendCloth = (a,b,t) => a.map((p,i) => along(p,b[i],t));
  function clothPath(points) {
    return points.map((p,i) => `${i === 0 ? 'M' : (i - 1) % 3 === 0 ? 'C' : ''}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') + 'Z';
  }
  function curve(a,b,c,d,t) {
    const u=1-t;
    return point(u*u*u*a.x+3*u*u*t*b.x+3*u*t*t*c.x+t*t*t*d.x,
      u*u*u*a.y+3*u*u*t*b.y+3*u*t*t*c.y+t*t*t*d.y);
  }
  function sidePoint(cloth, side, t) {
    if (side === 0) return curve(cloth[24],cloth[23],cloth[22],cloth[21],t);
    return t < .5 ? curve(cloth[9],cloth[10],cloth[11],cloth[12],t*2)
      : curve(cloth[12],cloth[13],cloth[14],cloth[15],(t-.5)*2);
  }
  function topPoint(cloth,t) {
    const segment=Math.min(2,Math.floor(t*3)),index=segment*3;
    return curve(cloth[index],cloth[index+1],cloth[index+2],cloth[index+3],t*3-segment);
  }
  const svgMatrix=node=>DOMMatrix.fromMatrix(node.transform.baseVal.consolidate()?.matrix||new DOMMatrix());
  const blendMatrix=(a,b,t)=>new DOMMatrix(['a','b','c','d','e','f'].map(key=>mix(a[key],b[key],t)));
  const numberPattern=/[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/gi;
  function blendPath(rest,moving,t) {
    const values=rest.match(numberPattern).map(Number);let i=0;
    return moving.replace(numberPattern,value=>mix(values[i++],Number(value),t).toFixed(4));
  }

  class WindStage {
    constructor(svg) {
      this.svg = svg;
      this.camera = new window.UmtoCamera.DeliveryCamera(svg);
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.parts = Object.fromEntries([...svg.querySelectorAll('[id]')].map(node => [node.id, node]));
      this.leaves = [...this.parts['blowing-leaves'].children];
      this.performer = new Character(studio, svg, this.parts.traveller, this.parts['traveller-props'], travellerSpec);
      this.puppets = { traveller: this.performer };
      this.shawlLength = null;
      this.walkSpeed = null;
      this.standingLegs = this.legSnapshots();
      this.fullWalkFrame = null;
    }

    select(scene) {
      this.scene = scene;
      this.cues = cuesFor(scene);
      this.shot = '';
    }

    frame(ms, speech, pose) {
      const id = this.scene.id;
      const afterWarmCue = id === 'sunlight' && ms >= this.cues.clear - 60;
      const face = speech.speaker === 'wind' || speech.speaker === 'sun';
      const focusOnFace = face && ['challenge', 'wrap', 'lesson'].includes(id) || speech.speaker === 'sun' && id === 'sunlight' && !afterWarmCue;
      if (!this.reduced.matches && id === 'road') {
        this.camera.cue({ preset: 'full', width: 1175, focus: { x: mix(581, 679, between(pose.x, 398, 626)), y: 380 },
          motion: 'tracking', parallax: true, cut: true });
        this.shot = 'tracking';
        return;
      }
      const shot = focusOnFace ? {
        preset: 'medium',
        focus: speech.speaker === 'wind' ? { x: windHome.x + 25, y: windHome.y + 16 } : { x: 1035, y: 162 },
        width: 590
      } : {
        preset: this.scene.framing, focus: this.scene.focus, width: id === 'gust' ? 1060 : undefined
      };
      const signature = shot.preset + '/' + shot.focus.x;
      if (signature !== this.shot) {
        this.camera.cue({ ...shot, cut: true });
        this.shot = signature;
      }
    }

    face(name, ms, line, word, pose) {
      const p = this.parts;
      const speaking = line.speaker === name && word >= 0;
      const blink = !this.reduced.matches && (ms + { sun: 1380, wind: 740, traveller: 250 }[name]) % 3900 > 3790;
      opacity(p[name + '-eyes'], blink ? 0 : 1);
      opacity(p[name + '-lids'], blink ? 1 : 0);
      let opening = name === 'wind' && pose.wind > .43 ? .38 : .13;
      if (speaking) {
        const [start, end] = line.reading.timings[word];
        const vowel = /[ਆਓਾੌ]/u.test(line.reading.words[word]);
        const beat = Math.sin(between(ms - line.start, start, end) * Math.PI);
        opening = .23 + beat * (vowel ? .88 : .65);
      }
      const pivot = name === 'sun' ? 18 : name === 'wind' ? 18 : -13;
      p[name + '-mouth'].setAttribute('transform', 'translate(0 ' + pivot * (1 - opening) + ') scale(1 ' + opening + ')');
      p[name].dataset.speaking = String(speaking);
    }

    weather(ms, pose) {
      const p = this.parts;
      const still = this.reduced.matches;
      const time = still ? 0 : ms / 1000;
      const gust = pose.wind;
      opacity(p['clear-sky-layer'], .11 + pose.light * .83);
      opacity(p['sun-on-path'], .13 + pose.light * .85);
      opacity(p['sun-halo'], .27 + pose.light * .72);
      opacity(p['sun-rays'], .47 + pose.light * .48);
      p['sun-rays'].setAttribute('transform', 'rotate(' + time * 2.1 + ')');
      p['shade-clouds'].setAttribute('transform', 'translate(' + pose.cloudShift * 270 + ' ' + (-pose.cloudShift * 34) + ')');
      opacity(p['shade-clouds'], (1 - pose.cloudShift) * .6);
      p.wind.setAttribute('transform', 'translate(' + (windHome.x + Math.sin(time * 2) * gust * 15) + ' ' +
        (windHome.y + Math.sin(time * 1.8) * 3) + ')');
      p['tree-crown'].setAttribute('transform', 'rotate(' + (Math.sin(time * 6) * gust * 2.9) + ' 128 297)');
      opacity(p['wind-streams'], gust * (still ? .52 : .78));
      p['wind-streams'].setAttribute('transform', 'translate(' + (Math.sin(time * 6.8) * gust * 18) + ' 0)');
      opacity(p['blowing-leaves'], gust * .94);
      for (const [index, leaf] of this.leaves.entries()) {
        const phase = ((time * (1.8 + (index % 3) * .14) + index * .114) % 1 + 1) % 1;
        const x = 288 + phase * 1040;
        const y = 380 + (index % 4) * 46 + Math.sin(phase * 8 + index) * (32 + index * 2);
        const tilt = (index % 2 ? 1 : -1) * (phase * 311 + index * 39);
        leaf.setAttribute('transform', 'translate(' + x + ' ' + y + ') rotate(' + tilt + ')');
        opacity(leaf, Math.min(1, phase * 6, (1 - phase) * 6));
      }
      this.svg.dataset.warmth = pose.light.toFixed(2);
    }

    rigPoint(node, x=0, y=0) {
      return new DOMPoint(x,y).matrixTransform(node.getScreenCTM())
        .matrixTransform(this.svg.getScreenCTM().inverse());
    }

    legSnapshots() {
      return [...this.performer.torso.querySelectorAll('[data-rig-leg]')].map(leg=>{
        const knee=svgMatrix(leg.querySelector('[data-rig-knee]'));
        return {side:leg.dataset.rigLeg,node:leg,path:leg.querySelector('[data-leg-surface]').getAttribute('d'),
          details:svgMatrix(leg.querySelector('[data-moving-leg-details]')),knee,
          ankle:knee.multiply(svgMatrix(leg.querySelector('[data-rig-ankle]'))),
          foot:svgMatrix(leg.querySelector('[data-rig-foot]'))};
      });
    }

    settleWalking(frame,weight) {
      if(frame==null){this.fullWalkFrame=null;return;}
      const legs=[...this.performer.torso.querySelectorAll('[data-rig-leg]')];
      if(frame!==this.fullWalkFrame||this.walkLeg!==legs[0]){
        this.fullWalkLegs=this.legSnapshots();this.fullWalkFrame=frame;this.walkLeg=legs[0];
      }
      // Blend the shared leg contours and joint frames into the standing pose
      // at the existing entry/exit envelope. Interpolate the ankle in leg space,
      // then derive its local transform, keeping planted soles level throughout.
      for(const leg of legs){
        const rest=this.standingLegs.find(p=>p.side===leg.dataset.rigLeg);
        const moving=this.fullWalkLegs.find(p=>p.side===leg.dataset.rigLeg);
        const knee=blendMatrix(rest.knee,moving.knee,weight);
        const ankle=blendMatrix(rest.ankle,moving.ankle,weight);
        leg.querySelector('[data-leg-surface]').setAttribute('d',blendPath(rest.path,moving.path,weight));
        transform(leg.querySelector('[data-moving-leg-details]'),matrixString(blendMatrix(rest.details,moving.details,weight)));
        transform(leg.querySelector('[data-rig-knee]'),matrixString(knee));
        transform(leg.querySelector('[data-rig-ankle]'),matrixString(knee.inverse().multiply(ankle)));
        transform(leg.querySelector('[data-rig-foot]'),matrixString(blendMatrix(rest.foot,moving.foot,weight)));
      }
    }

    handOverlay(index, contact, visible) {
      const hand=this.performer.arms[index].querySelector('[data-action-hand]');
      const overlay=this.parts[index ? 'shawl-right-hand' : 'shawl-left-hand'];
      const clipped=overlay.firstElementChild;
      // Copy the current shared hand artwork after a possible torso remount.
      // Its proximal forearm is below y=0 in hand space and stays under cloth.
      const sources=[...hand.querySelectorAll('[data-arm-skin],[data-hand-lines]')];
      while(clipped.children.length<sources.length)clipped.append(document.createElementNS('http://www.w3.org/2000/svg','path'));
      sources.forEach((source,i)=>{
        const copy=clipped.children[i];
        for(const attribute of [...copy.attributes])copy.removeAttribute(attribute.name);
        for(const attribute of source.attributes)copy.setAttribute(attribute.name,attribute.value);
      });
      transform(overlay,matrixString(overlay.parentElement.getScreenCTM().inverse().multiply(hand.getScreenCTM())));
      overlay.dataset.shawlContact=String(contact);
      opacity(overlay,visible);
    }

    traveller(ms, pose, speech) {
      const p=this.parts, actor=this.performer, still=this.reduced.matches;
      const nativePose={x:pose.x,y:618,lean:0,bend:still?0:pose.wind*2.3,
        gazeY:-pose.lookingUp*55,quietHands:true,grips:[null,null]};
      const distance=this.scene.id==='road'?pose.x-398:pose.x-626;
      if(!still&&pose.walking>.001&&this.walkSpeed)nativePose.walk=distance/this.walkSpeed;
      // Establish this frame's grounded body and hip bend before measuring
      // attachment points; the shawl uses the same stage coordinate system.
      actor.paint(nativePose,ms,speech,still);
      const shoulders=actor.arms.map(arm=>this.rigPoint(arm,0,48));
      const center=along(shoulders[0],shoulders[1],.5);
      const width=Math.hypot(shoulders[1].x-shoulders[0].x,shoulders[1].y-shoulders[0].y);
      const axis=point((shoulders[1].x-shoulders[0].x)/width,(shoulders[1].y-shoulders[0].y)/width);
      if(this.shawlLength===null){
        const knees=[...actor.torso.querySelectorAll('[data-rig-knee]')].map(knee=>this.rigPoint(knee));
        this.shawlLength=Math.max(...knees.map(knee=>knee.y))-center.y+6;
        const leg=actor.torso.querySelector('[data-rig-leg="-1"]');
        const matrix=this.svg.getScreenCTM().inverse().multiply(leg.getScreenCTM());
        this.walkSpeed=Math.abs(matrix.a)*.72*210/(1.2*.6);
      }
      const length=this.shawlLength;
      const at=(x,y)=>point(center.x+axis.x*x*width,center.y+axis.y*x*width+y*length);
      const time=still?0:ms/1000;
      const flutter=still?0:Math.sin(time*5.8)*pose.wind*5;
      const wrapped=wornCloth.map(([x,y])=>{
        const loose=clamp((y-.16)/.84),q=at(x*(1-pose.clutched*.075*loose),y);
        return point(q.x+flutter*loose*(1-pose.clutched*.58),q.y-pose.clutched*7*loose);
      });
      let held=blendCloth(drape(at(-.34,.44),at(.36,.44),length*.68),
        drape(at(-.15,.44),at(.32,.44),length*.38),pose.folding);
      // Lay the folded shawl along the near forearm. The near hand slides
      // across the folded top edge as the far hand lets go, and ends at its
      // right corner; the doubled cloth rests across the elbow-to-wrist span.
      held=blendCloth(held,drape(at(-.52,.17),at(.18,.30),length*.44),pose.carry);
      const cloth=blendCloth(wrapped,held,pose.takeOff);
      const edgeSlide=Math.pow(1-pose.takeOff,.55);
      const contacts=[pose.carry>0?topPoint(cloth,smooth(pose.carry)):sidePoint(cloth,0,.59*edgeSlide),
        sidePoint(cloth,1,.55*edgeSlide)];
      const release=smooth(clamp((pose.carry-.12)/.43));
      nativePose.grips=contacts.map((target,index)=>({target,weight:index?1-release:1,hand:'pinch',elbow:index?'down':'up'}));
      actor.paint(nativePose,ms,speech,still);
      this.settleWalking(nativePose.walk,still?0:pose.walking);
      // Keep cloth above both sleeves but below the native beard and head.
      // Character.mountArms restores props between the arms after a walk, so
      // reattach here and undo every enclosing rig/root transform explicitly.
      actor.torso.after(actor.props);
      transform(actor.props,matrixString(actor.props.parentElement.getScreenCTM().inverse().multiply(this.svg.getScreenCTM())));
      p['traveller-shadow'].setAttribute('cx',pose.x);
      const q=index=>`${cloth[index].x} ${cloth[index].y}`;
      p['shawl-main'].setAttribute('d',clothPath(cloth));
      p['shawl-front-fold'].setAttribute('d',`M${q(6)}Q${q(8)} ${q(9)}C${q(10)} ${q(11)} ${q(12)}C${q(13)} ${q(14)} ${q(15)}Q${q(17)} ${q(18)}Q${q(7)} ${q(6)}Z`);
      p['shawl-fold-line'].setAttribute('d',`M${q(1)}Q${q(6)} ${q(9)}M${q(23)}Q${q(18)} ${q(13)}M${q(11)}Q${q(12)} ${q(14)}`);
      const foldRidge=Array.from({length:10},(_,i)=>{const a=topPoint(cloth,i/9);return `${i?'L':'M'}${a.x} ${a.y+mix(2.5,6,pose.carry)}`;}).join(' ');
      p['shawl-double-fold'].setAttribute('d',foldRidge);
      opacity(p['shawl-double-fold'],pose.folding);
      const hem=`M${q(21)}C${q(20)} ${q(19)} ${q(18)}C${q(17)} ${q(16)} ${q(15)}`;
      p['shawl-hem'].setAttribute('d',hem);
      p['shawl-hem-stitch'].setAttribute('d',hem);
      transform(p['shawl-hem-stitch'],'translate(0 -3)');
      p['shawl-fringe'].setAttribute('d',Array.from({length:15},(_,i)=>{
        const t=i/14,a=t<.5?curve(cloth[21],cloth[20],cloth[19],cloth[18],t*2)
          :curve(cloth[18],cloth[17],cloth[16],cloth[15],(t-.5)*2);
        return `M${a.x} ${a.y}l${flutter*.12} ${mix(5,3,pose.folding)}`;
      }).join(' '));
      this.handOverlay(0,true,1);
      this.handOverlay(1,release<.001,1-smooth(clamp(release/.22)));
      actor.node.layers.face.id='traveller-head';
      actor.arms[0].id='near-arm';actor.arms[1].id='far-arm';
      this.svg.dataset.shawl=pose.carry>.98?'folded':pose.folding>.05?'folding':pose.takeOff>.06?'removing':pose.clutched>.69?'wrapped':'worn';
    }

    draw(ms, line, word) {
      const pose = sceneState(this.scene, this.cues, ms, this.reduced.matches);
      this.frame(ms, line, pose);
      this.weather(ms, pose);
      const speech=line.speaker==='traveller'?voiceFrame(line,word,ms):null;
      this.traveller(ms,pose,speech);
      for(const name of ['sun','wind'])this.face(name,ms,line,word,pose);
    }
  }

  async function prepare(){
    studio=await open(document.getElementById('wind-studio'));
  }

  window.LittlePanthStage = { Stage: WindStage, eventsFor, prepare };
})();
