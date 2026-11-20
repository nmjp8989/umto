(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const $ = id => document.getElementById(id);
  const svg = (name, attributes, parent) => {
    const node = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    parent?.append(node);
    return node;
  };
  const move = (node, x, y, degrees = 0, scale = 1) =>
    node.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${degrees.toFixed(2)}) scale(${scale})`);
  const ease = t => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const path = (parent, d, fill, stroke = 'none', width = 1) =>
    svg('path', {d, fill, stroke, 'stroke-width': width, 'stroke-linecap':'round', 'stroke-linejoin':'round'}, parent);

  const paperWhole = 'M0-91 82-7 0 96-72-6Z';
  const paperTorn = 'M0-91 40-50 35-19 52-9 35 16 43 42 0 96-72-6Z';
  const patchPath = 'M40-50 82-7 43 42 35 16 52-9 35-19Z';
  const seam = 'M40-50 35-19 52-9 35 16 43 42';

  function kite(parent, {damaged = false, tail = true, mended = false} = {}) {
    const node = svg('g', {}, parent);
    path(node, damaged ? paperTorn : paperWhole, 'url(#paper-blue)', '#2c4755', 2.5);
    path(node, 'M0-88-4-3-70-6Z', '#94bab5').setAttribute('opacity', '.34');
    path(node, 'M0-89-4-3 0 93M-68-6Q-27-20-4-3Q21 5 41-9', 'none', '#eddbad', 1.5);
    const patch = path(node, patchPath, '#89b3c0', '#467787', 1.8);
    patch.style.display = mended ? '' : 'none';
    const join = path(node, seam, 'none', '#c5d9c5', 2);
    join.setAttribute('stroke-dasharray', '3 5');
    join.style.display = mended ? '' : 'none';
    const ribbon = svg('g', {}, node);
    ribbon.style.display = tail ? '' : 'none';
    path(ribbon, 'M0 96 Q-21 127 6 149T-14 207', 'none', '#a64d38', 4);
    path(ribbon, 'M-2 119Q-23 105-26 120-23 131-2 122Q16 107 23 120 18 131-2 123ZM6 154Q-9 140-18 148-14 159 5 156Q23 142 28 154 23 165 5 157ZM-9 190Q-26 175-31 187-30 199-9 193Q11 176 19 187 14 198-9 193Z', '#b6533f', '#863a30', 1.2);
    return {node, patch, join, ribbon};
  }

  function reel(parent) {
    const group = svg('g', {}, parent);
    path(group, 'M-26-3H26', 'none', '#78533d', 7);
    svg('rect', {x:-17,y:-10,width:34,height:20,rx:3,fill:'#cba876',stroke:'#805d43','stroke-width':2}, group);
    path(group, 'M-11-9v18m5-18v18m5-18v18m5-18v18m5-18v18', 'none', '#ead2a0', 1.2);
    path(group, 'M-16-12v24m32-24v24', 'none', '#9e7350', 4);
    return group;
  }

  function leaf(parent, x, y, turn, fill, size = 1) {
    const leaf = svg('g', {}, parent);
    move(leaf, x, y, turn, size);
    path(leaf, 'M0 7Q-17-22 0-22 18-19 0 7Z', fill);
    path(leaf, 'M0 5-1-18', 'none', '#d1b766', 1.1).setAttribute('opacity', '.61');
    return leaf;
  }

  function plants(parent, background) {
    parent.replaceChildren();
    if (!['banyan','sunset','courtyard'].includes(background)) return;
    const isDusk = background === 'sunset';
    const color = isDusk ? '#4e5340' : '#576432';
    for (const [sx, sy, side] of [[-24,742,1],[1247,740,-1]]) {
      for (let i = 0; i < 10; i++) {
        const x = sx + side * i * 12;
        const height = (i < 2 ? 85 : 103 - i * 7) + Math.sin(i * 19) * 34;
        const dx = side * (18 + 13 * Math.cos(i));
        const y = sy - height;
        path(parent, `M${x} ${sy}q${dx / 2} ${-height / 2} ${dx} ${-height}`, 'none', color, 2.3);
        leaf(parent, x + dx * .8, y + 13, side * 60, i % 2 ? '#657442' : '#687548', .56);
        if (i % 3 === 1) {
          svg('circle', {cx:x+dx,cy:y,r:4.5,fill:isDusk?'#ae8c4c':'#cc922f'}, parent);
          svg('circle', {cx:x+dx-4,cy:y-2,r:3.1,fill:isDusk?'#a97743':'#d9a84a'}, parent);
        }
      }
    }
  }

  function workbench(parent) {
    svg('rect', {x:0,y:0,width:1280,height:720,fill:'#74553c'}, parent);
    for (let row = 0; row < 9; row++) {
      const y = row * 86 - 15;
      svg('rect', {x:0,y,width:1280,height:84,fill:['#98714b','#a37951','#946c49','#a6774a'][row % 4]}, parent);
      for (let i = 0; i < 10; i++) {
        const x = ((i * 151 + row * 197) % 1480) - 75;
        path(parent, `M${x} ${y+15+(i*23)%65}q45 -8 ${90+(i*17)%110} 1`, 'none', '#674a34', 1.3)
          .setAttribute('opacity', '.28');
      }
    }
    const mat = svg('g', {filter:'url(#gouache-grain)'}, parent);
    path(mat, 'M205 101Q211 78 235 79L1105 85Q1122 85 1124 102L1115 598Q1116 621 1099 623L205 635Q181 631 184 610Z', '#e2c998', '#be9a67', 3);
    const stitch = path(mat, 'M221 104 1102 110 1094 601 209 613Z', 'none', '#a88d66', 2);
    stitch.setAttribute('stroke-dasharray', '5 6');
    const scissors = svg('g', {transform:'translate(337 200) rotate(30)'}, parent);
    path(scissors, 'M-6 13-30 93 2 60 13 9M5 12l26 70-2-39-13-34', '#a0a19a', '#6c7271', 2);
    svg('circle', {cx:-10,cy:0,r:13,fill:'none',stroke:'#866651','stroke-width':6}, scissors);
    svg('circle', {cx:18,cy:-3,r:12,fill:'none',stroke:'#866651','stroke-width':6}, scissors);
    svg('circle', {cx:6,cy:25,r:4,fill:'#6e685e'}, scissors);
  }

  function paintFabrics(defs) {
    const pigments = {
      '#ca903e':['#e5b762','#ca903e','#98612d'],
      '#305e60':['#698584','#305e60','#274448'],
      '#344a74':['#576f93','#344a74','#23324d'],
      '#a9553d':['#cd805a','#a9553d','#70362c'],
      '#ddc397':['#eddaa9','#ddc397','#ae8c66'],
      '#856882':['#aa8d9e','#856882','#654d6a'],
      '#bea185':['#e1c8a5','#bea185','#96795f'],
      '#8d6b7b':['#aa8390','#8d6b7b','#694e65'],
      '#b78453':['#d7a56a','#b78453','#8d5d3d']
    };
    const styles = [];
    for (const [color,stops] of Object.entries(pigments)) {
      const id = 'pigment-' + color.slice(1);
      const gradient = svg('linearGradient',{id,x1:'0%',y1:'10%',x2:'97%',y2:'85%'},defs);
      stops.forEach((value,i) => svg('stop',{offset:[0,.52,1][i],'stop-color':value},gradient));
      styles.push(`.costume [fill="${color}"],#set [fill="${color}"] {fill:url(#${id})}`);
    }
    svg('style',{},defs).textContent = styles.join('\n');
  }

  function makeActor(bank, [id, x, y, height, view, pose]) {
    const slot = bank[id]?.[view];
    if (!slot) throw Error('Missing UMTO rig pose for ' + id);
    const node = svg('g', {'data-actor':id}, $('actors'));
    svg('ellipse', {cx:height*.035,cy:-height*.028,rx:height*.21,ry:height*.035,fill:'url(#contact-shadow)'}, node);
    const costume = svg('g', {class:'costume', filter:'url(#gouache-grain)'}, node);
    const frame = svg('svg', {x:-height*.32,y:-height*.96,width:height*.64,height,overflow:'visible'}, costume);
    frame.innerHTML = slot.base;
    const layers = Object.fromEntries([...frame.querySelectorAll('[data-scene-layer]')].map(node => [node.dataset.sceneLayer, node]));
    move(node, x, y);
    return {id, x, y, homeX:x, homeY:y, height, pose, node, costume, layers, slot, key:'', parts:{}};
  }

  function drawActor(actor, seconds, moving, speech, reduce) {
    const walking = moving && !reduce;
    const pose = walking ? 'walk' + Math.floor(seconds * 12.8) % 12 : actor.pose;
    const blink = !reduce && !walking && (seconds + actor.homeX * .006) % 4.3 < .13;
    const mouth = speech || 'idle';
    const key = [pose,blink,mouth].join('/');
    if (key === actor.key) return;
    actor.key = key;
    const frames = actor.slot.frames;
    const selected = frames[pose] || frames.idle;
    for (const [part, original] of Object.entries(selected.parts)) {
      const layer = actor.layers[part];
      if (!layer) continue;
      let art = original;
      if (blink && part === 'eyeGroup') art = frames.blink.parts[part];
      if (mouth !== 'idle' && ['mouthGroup', 'beardGroup'].includes(part)) art = frames[mouth].parts[part] ?? art;
      if (art !== actor.parts[part]) layer.innerHTML = actor.parts[part] = art;
    }
    for (const name of actor.slot.headLayers) actor.layers[name]?.setAttribute('transform', selected.head || '');
  }

  class KiteArt {
    constructor() {
      this.actors = [];
      this.background = '';
      this.backdrops = [...$('sky-layer').querySelectorAll('[data-backdrop]')];
      paintFabrics($('stage').querySelector('defs'));
    }

    show(shot, bank) {
      this.shot = shot;
      this.fx = {};
      for (const id of ['actors','props','set','depth-layer']) $(id).replaceChildren();
      if (this.background !== shot.bg) {
        this.background = shot.bg;
        for (const background of this.backdrops) {
          background.setAttribute('opacity', background.dataset.backdrop === shot.bg ? '1' : '0');
        }
        plants($('foreground'), shot.bg);
      }
      if (shot.bg === 'workbench') workbench($('set'));
      $('stage').dataset.light = shot.bg === 'sunset' ? 'sunset' : 'day';
      this.actors = shot.cast.map(character => makeActor(bank, character));
      if (shot.bg === 'banyan' || shot.bg === 'sunset') {
        const layer = $('depth-layer');
        this.fx.leaves = Array.from({length:7}, (_, i) =>
          leaf(layer, 150 + i * 170, 110 + i * 42 % 220, i * 67, i % 2 ? '#c6a54c' : '#798349', .25));
      }
      this.dress(shot.props);
    }

    dress(kind) {
      const layer = $('props');
      const set = $('set');
      const fx = this.fx;
      this.kind = kind;
      if (kind === 'bench') {
        const bench = svg('g', {filter:'url(#gouache-grain)'}, set);
        path(bench, 'M586 559 574 642 592 642 603 559ZM784 559 795 638 812 636 801 553Z', '#7a5134', '#704832', 2);
        path(bench, 'M560 545 764 532 810 552 600 572 558 558Z', '#b78453', '#855638', 3);
        path(bench, 'M601 570 808 551 808 565 601 583 558 564 558 556Z', '#886040', '#785637', 2);
      }
      if (kind === 'clues') {
        leaf(set, 430, 597, 62, '#9b782d', .62);
        path(set,'M954 619Q951 606 963 603 986 599 990 613 990 619 954 619Z','#b29876','#9a805f',1.5);
        fx.scrap = path(layer,'M-17 11-6-8-1-2 8-15 18 2 12 11Z','#4c83a0','#335b70',1.4);
        move(fx.scrap,756,590,12);
      }
      if (['patch','smooth','tie','fixed'].includes(kind)) {
        fx.kite = kite(layer, {damaged:true,tail:kind==='fixed',mended:kind==='tie'||kind==='fixed'});
        move(fx.kite.node,640,350,0,1.55);
        if (kind === 'patch') {
          for (const y of [195,343,492]) svg('circle',{cx:1005,cy:y,r:44,fill:'#d4b985',stroke:'#ae8e60','stroke-width':2},set);
          svg('circle',{cx:1005,cy:195,r:29,fill:'#86a7ad',stroke:'#4f7887','stroke-width':2},layer);
          path(layer,'M978 317 1031 320 1030 369 977 369Z','#8daeb3','#537b8a',2);
          fx.piece = path(layer, patchPath,'#89b3c0','#467787',1.8);
          move(fx.piece,973,494,0,.83);
        }
        if (kind === 'tie') {
          const loose = kite(layer,{damaged:true});
          fx.loose = loose.ribbon;
          layer.append(loose.ribbon);
          loose.node.remove();
          move(fx.loose,748,414,-21,.87);
        }
        return;
      }
      if (['teaser','bench','chase','snag','canopy','rescue','return','torn','handoff','launch','airborne'].includes(kind)) {
        fx.kite = kite(layer, {damaged:['canopy','rescue','return','torn'].includes(kind),mended:['handoff','launch','airborne'].includes(kind)});
      }
      if (['bench','reel','chase','snag','return','torn','handoff','launch','airborne'].includes(kind)) {
        fx.reel = reel(layer);
      }
      if (['chase','snag','launch','airborne'].includes(kind)) {
        fx.string = path(layer, '', 'none', '#e5cf9e', 1.6);
        layer.insertBefore(fx.string, layer.firstChild);
      }
      if (kind === 'canopy') {
        fx.scrap = path(layer,'M-18 15-6-11-1-2 8-16 23 6 14 14Z','#648ea2','#375769',1.5);
      }
      if (kind === 'rescue') fx.stick = path(layer,'M0 0-46-222-30-243','none','#9a774b',5.5);
    }

    draw(seconds, voicedActor, mouth, reduce, resolved) {
      const {shot, fx, actors, kind} = this;
      const motion = reduce ? 0 : seconds;
      if (fx.leaves) fx.leaves.forEach((leaf, i) =>
        move(leaf,(130+i*173+motion*(10+i%3*5))%1420-55,145+(i*79)%330+Math.sin(i+motion*.78)*19, i*67+motion*35,.26));
      for (const actor of actors) {
        const walking = shot.walk?.id === actor.id;
        const t = walking ? ease(reduce ? 1 : seconds / shot.walk.seconds) : 0;
        if (walking) {
          actor.x = lerp(actor.homeX, shot.walk.x, t);
          actor.y = lerp(actor.homeY, shot.walk.y, t);
          move(actor.node, actor.x, actor.y);
        }
        drawActor(actor, motion, walking && t < 1, actor.id === voicedActor ? mouth : null, reduce);
      }

      let x, y, angle = 0, size = .64, rx, ry, rotation = 0;
      const mehar = actors.find(actor => actor.id === 'mehar');
      const wave = Math.sin(motion * 2.6);
      if (kind === 'teaser') { x=899+Math.sin(motion*.46)*38; y=283+wave*8; angle=12+wave*5; size=.49; }
      if (kind === 'bench') { x=697; y=536; angle=-77+wave*.9; size=.46; rx=771; ry=551; }
      if (kind === 'chase') { x=mehar.x+238; y=303-wave*23; angle=18+wave*9; rx=mehar.x+32; ry=mehar.y-151; }
      if (kind === 'snag') { x=990; y=302; angle=22+wave*4; rx=802; ry=481; }
      if (kind === 'canopy') {
        x=790; y=321; size=.85; angle=18+wave*2;
        const falling = ease(seconds / 4.6);
        move(fx.scrap,862+wave*31-falling*58,311+falling*434,seconds*65,.92);
      }
      if (kind === 'rescue') {
        const t = ease((seconds-1.4)/5.9);
        x=lerp(977,628,t); y=lerp(296,565,t); angle=lerp(18,-24,t)+wave*5;
        move(fx.stick,836,464,22-57*t);
      }
      if (kind === 'clues' && resolved) move(fx.scrap,756,582+wave*3,13);
      if (kind === 'return') { x=mehar.x-41; y=mehar.y-154; size=.63; angle=-18+wave*2; rx=mehar.x-18; ry=mehar.y-137; }
      if (kind === 'torn') { x=(mehar?.x || 490)+80; y=516; angle=-21; rx=x-31; ry=532; }
      if (kind === 'reel') { rx=542; ry=508; rotation=-14; }
      if (kind === 'handoff') {
        const pass = shot.handoff ? ease((seconds-1)/2.2) : 0;
        x=730; y=523; angle=-16; rx=lerp(761,580,pass); ry=513; rotation=pass*16;
      }
      if (kind === 'launch' || kind === 'airborne') {
        const takeoff = kind === 'airborne' ? 1 : ease(seconds / 5.2);
        x=lerp(765,855,takeoff)+Math.sin(motion*.76)*28; y=lerp(460,171,takeoff)+wave*11;
        angle=lerp(-13,15,takeoff)+wave*6;
        rx=578; ry=511;
      }
      if (fx.reel && rx !== undefined) move(fx.reel,rx,ry,rotation);
      if (fx.kite && x !== undefined) move(fx.kite.node,x,y,angle,size);
      if (fx.string) fx.string.setAttribute('d',
        `M${rx} ${ry}Q${lerp(rx,x,.51)-22} ${lerp(ry,y,.46)+40} ${x} ${y}`);
      if (fx.piece && resolved) {
        const slide = ease(resolved / 1.2);
        move(fx.piece,lerp(973,640,slide),lerp(494,350,slide),0,lerp(.83,1.55,slide));
        fx.kite.join.style.display = slide === 1 ? '' : 'none';
      }
      if (kind === 'smooth') {
        fx.kite.patch.style.display = '';
        fx.kite.patch.setAttribute('fill', resolved ? '#8ab3bf' : '#a8bdbe');
        fx.kite.join.style.display = '';
        fx.kite.join.setAttribute('opacity', resolved ? '.45' : '1');
      }
      if (kind === 'tie') {
        fx.loose.style.display = resolved ? 'none' : '';
        fx.kite.ribbon.style.display = resolved ? '' : 'none';
      }
    }
  }

  window.KiteArt = KiteArt;
})();
