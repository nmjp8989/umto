(() => {
  'use strict';

  const phase = (value, from, to) => Math.max(0, Math.min(1, (value - from) / Math.max(Number.EPSILON, to - from)));
  const ease = t => t * t * (3 - 2 * t);
  const mix = (a, b, t) => a + (b - a) * t;
  const point = (x, y) => ({ x, y });
  const transform = (node, value) => node.setAttribute('transform', value);
  const opacity = (node, value) => node.setAttribute('opacity', String(value));

  const { open, Character, voiceFrame } = window.UmtoNativeCharacterPlayer;
  const cast = {
    mehar: { preset: 'kid-meher', view: 'right', height: 232, serial: 451 },
    boy: { preset: 'kid-sidak', view: 'left', height: 228, serial: 452 }
  };
  const banks = { mehar: point(119, 510), boy: point(1182, 519) };
  const leftApproach = 293;
  const rightApproach = 994;
  const channiStops = 519;
  const motiStops = 763;
  const channiSteps = 538;
  const turnout = point(1045, 414);
  const leftGrass = point(205, 576);
  const rightGrass = point(1090, 572);
  const colors = {
    channi: { coat: '#d0a374', shade: '#ac7954', accent: '#f8dfba', outline: '#936a4c',
      light: '#edc89a', 'head-light': '#f4d6ae', head: '#ddb483', 'head-shade': '#ba895f', collar: '#588c8e' },
    moti: { coat: '#f4e4c8', shade: '#d7b994', accent: '#fff8e2', outline: '#a58a6d',
      light: '#fff5db', 'head-light': '#fff9e7', head: '#f6e4c7', 'head-shade': '#dfbf9b', collar: '#ab6379' }
  };
  let studio;

  const lineFor = (scene, id) => scene.lines.find(line => line.id === id);

  function wordAt(scene, id, word) {
    const line = lineFor(scene, id);
    const index = line.reading.words.findIndex(value => value.replace(/\p{P}/gu, '') === word);
    return line.start + (line.reading.timings[index]?.[0] ?? line.duration / 2);
  }

  function cuesFor(scene) {
    switch (scene.id) {
      case 'canal':
        return { go: wordAt(scene, 'near-village', 'ਬੱਕਰੀਆਂ'), warning: lineFor(scene, 'mehar-warns') };
      case 'meet':
        return { climb: wordAt(scene, 'meet-midway', 'ਚੜ੍ਹੀ'), moti: wordAt(scene, 'meet-midway', 'ਮੋਤੀ'),
          stop: wordAt(scene, 'meet-midway', 'ਰੁਕ'), call: lineFor(scene, 'sidak-calls') };
      case 'creak':
        return { foot: wordAt(scene, 'plank-creaks', 'ਰੱਖਿਆ'), creak: wordAt(scene, 'plank-creaks', 'ਚਰਮਰਾਈ'),
          look: wordAt(scene, 'plank-creaks', 'ਹੇਠਾਂ') };
      case 'plan':
        return { plan: lineFor(scene, 'mehar-plan'), back: wordAt(scene, 'moti-backs-up', 'ਪਿੱਛੇ'),
          shore: wordAt(scene, 'moti-backs-up', 'ਕੰਢੇ') };
      case 'first-crossing':
        return { praise: lineFor(scene, 'sidak-praises'), start: lineFor(scene, 'channi-crosses').start,
          shore: wordAt(scene, 'channi-crosses', 'ਗਈ'), clear: wordAt(scene, 'channi-crosses', 'ਛੱਡ') };
      case 'second-crossing':
        return { start: wordAt(scene, 'moti-crosses', 'ਮੋਤੀ'), shore: wordAt(scene, 'moti-crosses', 'ਇੱਕੋ') + 470 };
      case 'grass':
        return { graze: wordAt(scene, 'grass-on-both-banks', 'ਘਾਹ'), smile: lineFor(scene, 'mehar-smiles') };
    }
  }

  function eventsFor(scene) {
    const cue = cuesFor(scene);
    switch (scene.id) {
      case 'canal': return [{ ms: 660, sound: 'chirp' }, { ms: cue.go + 620, sound: 'step' }];
      case 'meet': return [{ ms: cue.climb + 80, sound: 'step' }, { ms: cue.moti + 480, sound: 'step' },
        { ms: cue.stop - 190, sound: 'step' }];
      case 'creak': return [{ ms: cue.foot + 140, sound: 'step' }, { ms: cue.creak, sound: 'twig' },
        { ms: cue.look + 280, sound: 'sip' }];
      case 'plan': return [{ ms: cue.back + 170, sound: 'step' }, { ms: cue.back + 760, sound: 'step' },
        { ms: cue.shore + 430, sound: 'step' }];
      case 'first-crossing': return [{ ms: cue.start + 470, sound: 'step' }, { ms: cue.start + 950, sound: 'step' },
        { ms: cue.shore + 170, sound: 'ribbon' }];
      case 'second-crossing': return [{ ms: cue.start + 1270, sound: 'step' },
        { ms: cue.start + 1940, sound: 'step' }, { ms: cue.shore + 350, sound: 'step' }];
      case 'grass': return [{ ms: cue.graze + 240, sound: 'chirp' }];
    }
  }

  function trailY(x) {
    return mix(495, 457, ease(phase(x, leftApproach, 390))) +
      (500 - 457) * ease(phase(x, 886, rightApproach));
  }

  const trail = x => point(x, trailY(x));
  const goat = (x, facing) => ({ ...trail(x), facing, step: 0, headDip: 0, onTrail: true, walking: 0, distance: 0 });
  const actor = position => ({ ...position, lean: 0, grips: [] });

  function travel(goat, ms, from, to, start, end, move, onTrail = true) {
    const progress = move(phase(ms, from, to));
    goat.x = mix(start.x, end.x, progress);
    goat.y = onTrail ? trailY(goat.x) : mix(start.y, end.y, progress);
    goat.onTrail = onTrail;
    goat.distance = Math.hypot(end.x - start.x, end.y - start.y) * progress * Math.sign(end.x - start.x);
    goat.walking = ease(phase(progress, 0, .12)) * (1 - ease(phase(progress, .88, 1)));
  }

  function signal(actor, ms, line, facing) {
    const lift = ease(phase(ms, line.start - 190, line.start + 240));
    const lower = 1 - ease(phase(ms, line.end - 250, line.end + 220));
    actor.grips[facing > 0 ? 1 : 0] = {
      target: point(actor.x + facing * 51, actor.y - 125), weight: lift * lower * .81, hand: 'relaxed'
    };
  }

  function makeFrame(scene, cue, ms, still) {
    const move = still ? Math.round : ease;
    const channi = goat(leftApproach, 1);
    const moti = goat(rightApproach, -1);
    const mehar = actor(banks.mehar);
    const boy = actor(banks.boy);
    const state = { goats: { channi, moti }, actors: { mehar, boy }, flex: 0 };

    switch (scene.id) {
      case 'canal':
        travel(channi, ms, cue.go - 470, cue.go + 810, point(246, 505), trail(leftApproach), move, false);
        travel(moti, ms, cue.go - 220, cue.go + 1070, point(1072, 498), trail(rightApproach), move, false);
        signal(mehar, ms, cue.warning, 1);
        break;
      case 'meet':
        travel(channi, ms, cue.climb - 380, cue.stop - 120, trail(leftApproach), trail(channiStops), move);
        travel(moti, ms, cue.moti - 110, cue.stop + 50, trail(rightApproach), trail(motiStops), move);
        signal(boy, ms, cue.call, -1);
        break;
      case 'creak': {
        Object.assign(moti, trail(motiStops));
        const footDown = phase(ms, cue.foot - 490, cue.foot + 140);
        Object.assign(channi, trail(mix(channiStops, channiSteps, move(footDown))));
        channi.step = still ? 0 : 22 * Math.sin(Math.PI * footDown);
        const look = move(phase(ms, cue.look - 140, cue.look + 520));
        channi.headDip = 23 * look;
        moti.headDip = 20 * look;
        state.flex = still ? 0 : 2.7 * Math.sin(Math.PI * phase(ms, cue.creak - 35, cue.creak + 485));
        break;
      }
      case 'plan':
        Object.assign(channi, trail(channiSteps));
        channi.headDip = 23 * (1 - move(phase(ms, 80, 600)));
        travel(moti, ms, cue.back - 510, cue.shore - 100, trail(motiStops), trail(977), move);
        if (ms >= cue.shore - 100) {
          travel(moti, ms, cue.shore - 100, cue.shore + 750, trail(977), turnout, move, false);
        }
        moti.headDip = 20 * (1 - move(phase(ms, 50, 590)));
        signal(mehar, ms, cue.plan, 1);
        break;
      case 'first-crossing':
        Object.assign(moti, turnout, { onTrail: false });
        travel(channi, ms, cue.start - 140, cue.shore + 350, trail(channiSteps), trail(980), move);
        if (ms >= cue.shore + 350) {
          travel(channi, ms, cue.shore + 350, cue.clear + 660, trail(980), rightGrass, move, false);
        }
        signal(boy, ms, cue.praise, -1);
        break;
      case 'second-crossing': {
        Object.assign(channi, rightGrass, { onTrail: false });
        const stepOn = cue.start + 1120;
        if (ms < stepOn) {
          travel(moti, ms, cue.start - 260, stepOn, turnout, trail(973), move, false);
        } else if (ms < cue.shore) {
          travel(moti, ms, stepOn, cue.shore, trail(973), trail(328), move);
        } else {
          travel(moti, ms, cue.shore, scene.duration - 105, trail(328), leftGrass, move, false);
        }
        break;
      }
      case 'grass': {
        Object.assign(channi, rightGrass, { onTrail: false });
        Object.assign(moti, leftGrass, { onTrail: false });
        const eat = move(phase(ms, cue.graze - 340, cue.graze + 650));
        channi.headDip = eat * (still ? 61 : 58 + 5 * Math.sin(ms / 350));
        moti.headDip = eat * (still ? 60 : 57 + 5 * Math.sin(ms / 385 + 1));
        signal(mehar, ms, cue.smile, 1);
        break;
      }
    }
    return state;
  }

  // The same continuous neck, body and curved limbs used in mission 031.
  // Hooves are adjusted to the bridge surface before the silhouette is drawn.
const round=n=>Math.round(n*100)/100;
const xy=(x,y)=>round(x)+' '+round(y);
function foot(x,walk,reach,front,far,goat,brace=0){
 const sign=front===far?1:-1;
 return {x:x+walk*sign*(goat?.59:1.02)+reach*(front?(goat?18:47):(goat?-11:-27))+brace*(front?17:0),
 y:-(Math.max(0,walk*sign)*.29+reach*(goat?13:25)+brace*(front?28:0))};
}
function limb(p,startX,startY,front,goat,far){
 const w=goat?7:11,x=p.x,y=p.y,k=front?startX-2:startX-8;
 return 'M'+xy(startX-w*1.6,startY)+' C'+xy(startX-w*2,startY+18)+' '+xy(k-w, y-35)+' '+xy(x-w*.7,y-13)+' Q'+xy(x-w,y-3)+' '+xy(x-w*.65,y)+' L'+xy(x+w,y)+' Q'+xy(x+w*1.5,y-4)+' '+xy(x+w*.65,y-11)+' C'+xy(x+w*.15,y-30)+' '+xy(startX+w*1.5,startY+18)+' '+xy(startX+w*1.45,startY)+' Z';
}
function boot(p,w,h){return 'M'+xy(p.x-w*1.7,p.y-h)+' Q'+xy(p.x,p.y-h*.52)+' '+xy(p.x+w*1.7,p.y-h)+' L'+xy(p.x+w*2,p.y+3)+' H'+round(p.x-w*2)+' Z';}
function bendHead(angle,px,py,x,y){const t=angle*Math.PI/180;return {x:px+x*Math.cos(t)-y*Math.sin(t),y:py+x*Math.sin(t)+y*Math.cos(t)};}
  function drawGoat(art, pose, ms, still, scale, bounce, flex) {
 const p=art.parts, tx=transform, op=opacity;
 const set=(id,d)=>p[id].setAttribute('d',d);
 const g={walk:still?0:18*pose.walking*Math.sin(pose.distance/9.2),reach:0,
   head:pose.headDip+(still?0:2.3*pose.walking*Math.sin(pose.distance/9.2)),worry:pose.headDip>12&&pose.headDip<35?.45:0};
 const gt=false, opening=0;
 const gw=g.walk,gr=g.reach||0,br=0;
 const gh=g.head;
 const gn=foot(47,gw,gr,true,false,true,br),grn=foot(-47,gw,gr,false,false,true);
 const gf=foot(29,gw,gr,true,true,true,br),grf=foot(-30,gw,gr,false,true,true);
 for (const hoof of [gn,grn,gf,grf]) {
  const worldX = pose.x + pose.facing * hoof.x * scale;
  hoof.y += (pose.onTrail ? trailY(worldX) - pose.y : 0) / scale - bounce / scale;
 }
 gn.x += pose.step * .35;
 gn.y -= pose.step * .65;
 if (pose.onTrail) gn.y += flex / scale;
 // A flexible neck joins the moving head and body; its endpoints rotate with the head.
 const n=bendHead(gh,26,-74,1,9),m=bendHead(gh,26,-74,34,23);
 const gd='M-81 -65 C-83 -84 -66 -95 -44 -93 Q-14 -87 7 -92 C'+xy(n.x-16,n.y-4)+' '+xy(n.x-10,n.y-21)+' '+xy(n.x+1,n.y-18)+' Q'+xy(n.x+23,n.y-13)+' '+xy(m.x,m.y-9)+' C'+xy(m.x+5,m.y+3)+' 64 -48 '+xy(gn.x+8,gn.y-24)+' C'+xy(gn.x+5,gn.y-13)+' '+xy(gn.x+10,gn.y-9)+' '+xy(gn.x+11,gn.y-2)+' Q'+xy(gn.x+10,gn.y)+' '+xy(gn.x+6,gn.y)+' L'+xy(gn.x-7,gn.y)+' Q'+xy(gn.x-10,gn.y-4)+' '+xy(gn.x-9,gn.y-11)+' C'+xy(gn.x-10,gn.y-29)+' 28 -40 24 -47 Q-5 -35 -29 -47 C-30 -33 '+xy(grn.x-1,grn.y-25)+' '+xy(grn.x-4,grn.y-12)+' Q'+xy(grn.x+9,grn.y-6)+' '+xy(grn.x+8,grn.y)+' L'+xy(grn.x-9,grn.y)+' Q'+xy(grn.x-14,grn.y-3)+' '+xy(grn.x-14,grn.y-12)+' C'+xy(grn.x-17,grn.y-30)+' -58 -47 -62 -50 Q-78 -52 -81 -65Z';
 set('goat-body',gd);set('goat-clip-shape',gd);
 set('goat-far-front',limb(gf,32,-48,true,true,true));set('goat-far-back',limb(grf,-38,-51,false,true,true));
 set('goat-far-hooves',boot(gf,6,10)+boot(grf,6,10));set('goat-near-hooves',boot(gn,7,11)+boot(grn,7,11));
 set('goat-hoof-splits','M'+xy(gn.x+1,gn.y-7)+' L'+xy(gn.x+1,gn.y)+' M'+xy(grn.x+1,grn.y-7)+' L'+xy(grn.x+1,grn.y));
 set('goat-leg-shade','M-69 -67Q-50 -59 -52 -47Q-61 -55 -69 -67Z M33 -71Q42 -54 33 -40Q36 -59 33 -71Z');
 const c1=bendHead(gh,26,-74,0,24),c2=bendHead(gh,26,-74,35,27);
 set('goat-collar-band','M'+xy(c1.x,c1.y)+' Q'+xy((c1.x+c2.x)/2,(c1.y+c2.y)/2+12)+' '+xy(c2.x,c2.y)+' L'+xy(c2.x,c2.y+6)+' Q'+xy((c1.x+c2.x)/2,(c1.y+c2.y)/2+18)+' '+xy(c1.x,c1.y+6)+' Z');
 tx(p['goat-bell-pendant'],'translate('+round((c1.x+c2.x)/2-44)+' '+round((c1.y+c2.y)/2+13+48)+') rotate('+round(still?0:gw*.15)+' 44 -48)');
 tx(p['goat-ear-near'],'rotate('+(-9*g.worry+(still?0:Math.sin(ms/870)*1.5))+' 15 -16)');
 tx(p['goat-ear-far'],'rotate('+(5*g.worry)+' 39 -24)');
 tx(p['goat-brow'],'rotate('+(-15*g.worry)+' 40 -23)');
 const gaze=g.head>10?1:g.head<0?-1:0;
 tx(p['goat-pupil'],'translate(0 '+gaze+')');tx(p['goat-glint'],'translate(0 '+gaze+')');
 tx(p['goat-jaw'],'rotate('+(gt?opening*5:0)+' 48 25)');
 p['goat-mouth'].setAttribute('ry',gt?String(1+opening*3.2):'1');op(p['goat-mouth'],gt?1:0);
 const gb=!still&&(ms+1520)%3970>3830;
 for(const id of ['goat-eye','goat-pupil','goat-glint'])op(p[id],gb?0:1);
 op(p['goat-lid'],gb?1:0);
 transform(art.head,'translate(26 -74) rotate('+gh+')');
 transform(art.tail,'rotate('+(still?0:3.3*Math.sin(ms/410+pose.x/100))+' -67 -68)');
  }

  function prepareGoat(container, template, name) {
    const artwork = template.cloneNode(true);
    const parts = Object.fromEntries([...artwork.querySelectorAll('[id]')].map(node => [node.id, node]));
    artwork.id = name;
    for (const node of artwork.querySelectorAll('[id]')) node.id = name + '-' + node.id;
    for (const node of artwork.querySelectorAll('*')) {
      for (const attr of [...node.attributes]) {
        if (attr.value.includes('url(#goat-')) node.setAttribute(attr.name, attr.value.replace(/url\(#(goat-[^)]+)\)/g, 'url(#' + name + '-$1)'));
        if (attr.name === 'href' && attr.value.startsWith('#goat-')) node.setAttribute('href', '#' + name + '-' + attr.value.slice(1));
      }
    }
    for (const [property, color] of Object.entries(colors[name])) artwork.style.setProperty('--goat-' + property, color);
    container.append(artwork);
    return { root: artwork, parts, head: artwork.querySelector('[data-head]'), tail: artwork.querySelector('[data-tail]') };
  }

  class BridgeStage {
    constructor(svg) {
      this.svg = svg;
      this.camera = new window.UmtoCamera.DeliveryCamera(svg);
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.parts = Object.fromEntries([...svg.querySelectorAll('[id]')].map(node => [node.id, node]));
      this.goats = Object.fromEntries(Object.keys(colors).map(name =>
        [name, prepareGoat(this.parts.goats, this.parts['goat-art'], name)]));
      this.puppets = Object.fromEntries(Object.entries(cast).map(([id, spec]) =>
        [id, new Character(studio, svg, this.parts[id], this.parts[id + '-props'], spec)]));
      this.glints = Array.from({ length: 17 }, () => {
        const node = document.createElementNS(svg.namespaceURI, 'use');
        node.setAttribute('href', '#sheen');
        this.parts.current.append(node);
        return node;
      });
    }

    select(scene) {
      this.scene = scene;
      this.cue = cuesFor(scene);
      this.lastShot = '';
    }

    frame(ms, line, still, state) {
      const { id, framing, focus } = this.scene;
      const cue = this.cue;
      const moti = state.goats.moti;
      const channi = state.goats.channi;
      const shotAt = (preset, x, y, width, motion = 'static') =>
        ({ preset, focus: point(x, y), width, motion, parallax: motion === 'tracking' });
      let shot = { preset: framing, focus };
      if (id === 'canal' && line.speaker === 'mehar') {
        shot = shotAt('medium', 253, 388, 695);
      } else if (id === 'meet' && line.speaker === 'boy') {
        shot = shotAt('medium', 976, 402, 775);
      } else if (id === 'creak' && ms < cue.look - 150) {
        shot = shotAt('detail', 613, 465, 615);
      } else if (id === 'creak') {
        shot = shotAt('two-shot', 640, 438, 739);
      } else if (id === 'plan' && ms > cue.back - 510) {
        shot = shotAt('full', Math.round(moti.x - 78), 412, 1002, still ? 'static' : 'tracking');
      } else if (id === 'first-crossing' && line.speaker === 'boy') {
        shot = shotAt('two-shot', 1072, 403, 735);
      } else if (id === 'first-crossing') {
        shot = shotAt('full', Math.round(channi.x + 93), 434, 1090, still ? 'static' : 'tracking');
      } else if (id === 'second-crossing') {
        shot = shotAt('full', Math.round(moti.x - 43), 434, 1090, still ? 'static' : 'tracking');
      } else if (id === 'grass' && line.speaker === 'mehar') {
        shot = shotAt('two-shot', 283, 442, 724);
      }
      const key = [shot.preset, shot.focus.x, shot.focus.y, shot.width, shot.motion].join('/');
      if (this.lastShot === key) return;
      this.camera.cue({ ...shot, cut: true });
      this.lastShot = key;
    }

    paintCanal(state, ms, still) {
      transform(this.parts['creaking-board'], 'translate(0 ' + state.flex + ')');
      const episodeTime = this.scene.episodeStart + ms;
      this.glints.forEach((node, index) => {
        const depth = (index * .207 + (still ? 0 : episodeTime / (13100 + index % 4 * 1670))) % 1;
        const x = 643 + ((index % 7) - 3) * mix(12, 99, depth);
        const y = mix(297, 759, depth ** 1.24);
        transform(node, 'translate(' + x + ' ' + y + ') scale(' + mix(.2, 1.37, depth) + ')');
        opacity(node, .52 * Math.sin(Math.PI * depth));
      });
    }

    paintGoats(state, ms, still) {
      for (const [name, art] of Object.entries(this.goats)) {
        const pose = state.goats[name];
        const { x, y, facing, walking, distance, onTrail, headDip } = pose;
        // Modest storybook scale keeps both noses apart and the bridge readable.
        const scale = .82 * (name === 'moti' ? mix(.85, 1, phase(y, turnout.y, 493)) : 1);
        const bounce = still ? 0 : -1.6 * walking * Math.abs(Math.sin(distance / 9.2));
        transform(art.root, 'translate(' + x + ' ' + (y + bounce) + ') scale(' + (facing * scale) + ' ' + scale + ')');
        drawGoat(art, pose, ms, still, scale, bounce, name === 'channi' ? state.flex : 0);
        art.root.dataset.location = onTrail && x > 350 && x < 928 ? 'bridge' : x < 640 ? 'left-bank' : 'right-bank';
        art.root.dataset.walking = String(!still && walking > .02);
        art.root.dataset.lookingDown = String(headDip >= 12);
      }
    }

    draw(ms, line, word) {
      const still = this.reduced.matches;
      const state = makeFrame(this.scene, this.cue, ms, still);
      this.frame(ms, line, still, state);
      this.paintCanal(state, ms, still);
      this.paintGoats(state, ms, still);
      const reading = voiceFrame(line, word, ms);
      for (const [id, puppet] of Object.entries(this.puppets)) {
        const pose = state.actors[id];
        const shadow = this.parts[id + '-shadow'];
        shadow.setAttribute('cx', pose.x);
        shadow.setAttribute('cy', pose.y + 1);
        puppet.paint(pose, ms, line.speaker === id ? reading : null, still);
      }
    }
  }

  async function prepare() {
    studio = await open(document.getElementById('two-goats-studio'));
  }

  window.LittlePanthStage = { Stage: BridgeStage, eventsFor, prepare };
})();
