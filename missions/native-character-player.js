(() => {
  'use strict';

  const ns = 'http://www.w3.org/2000/svg';
  const degrees = 180 / Math.PI;
  const shoulderPivot = 48;
  const palmCenter = 56;
  const transform = (node, value) => node.setAttribute('transform', value);
  const matrixString = m => 'matrix(' + [m.a, m.b, m.c, m.d, m.e, m.f].join(' ') + ')';
  const pathPair = /(-?[\d.]+(?:e[+-]?\d+)?)\s+(-?[\d.]+(?:e[+-]?\d+)?)/gi;

  function groupLayers(layers) {
    if (!layers.length) return null;
    const group = document.createElementNS(ns, 'g');
    layers[0].before(group);
    group.append(...layers);
    return group;
  }
  const mix = (a, b, t) => a + (b - a) * t;
  const inRange = (number, min, max) => Math.min(max, Math.max(min, number));

  function open(frame) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(Error('The Studio character rig did not load'));
      }, 18000);
      function cleanup() {
        clearTimeout(timeout);
        window.removeEventListener('message', message);
        frame.removeEventListener('load', ready);
      }
      function ready() {
        const rig = frame.contentWindow?.UmtoStudioRig;
        if (!rig) return;
        cleanup();
        resolve(rig);
      }
      function message(event) {
        if (event.origin === location.origin && event.source === frame.contentWindow &&
            event.data?.type === 'umto-native-rig-ready') ready();
      }
      window.addEventListener('message', message);
      frame.addEventListener('load', ready);
      ready();
    });
  }

  function armAngles(arm, screen, target, proportions, anchor) {
    const local = new DOMPoint(target.x, target.y).matrixTransform(screen)
      .matrixTransform(arm.getScreenCTM().inverse());
    const x = local.x;
    const y = local.y - shoulderPivot;
    const upper = proportions.upperArm - shoulderPivot;
    const requested = Math.hypot(x, y);
    // A hand close to the shoulder curls at the wrist as well as the elbow.
    const close = inRange((proportions.forearm + palmCenter - upper + 64 - requested) / 64, 0, 1);
    const wristDegrees = -Math.round(close * 90 * 2) / 2;
    const wrist = wristDegrees / degrees;
    const anchorX = anchor?.x ?? 0;
    const anchorY = anchor?.y ?? palmCenter;
    const handX = anchorY * Math.sin(wrist) - anchorX * Math.cos(wrist);
    const handY = proportions.forearm + anchorX * Math.sin(wrist) + anchorY * Math.cos(wrist);
    const lower = Math.hypot(handX, handY);
    const handAngle = Math.atan2(handX, handY);
    const distance = inRange(requested, Math.abs(upper - lower) + 1, upper + lower - 1);
    const cosine = (distance ** 2 - upper ** 2 - lower ** 2) / (2 * upper * lower);
    const elbow = Math.acos(inRange(cosine, -1, 1));
    const shoulder = Math.atan2(-x, y) - Math.atan2(lower * Math.sin(elbow), upper + lower * Math.cos(elbow));
    return [shoulder * degrees, (elbow - handAngle) * degrees, wristDegrees];
  }

  class Character {
    constructor(api, stage, root, props, spec) {
      this.api = api;
      this.stage = stage;
      this.root = root;
      this.props = props;
      this.spec = spec;
      const { actor, node } = api.create(spec.preset, spec.view, spec.serial);
      this.actor = actor;
      this.node = node;
      this.walkFrame = null;
      this.facing = api.direction(actor.view);
      this.torso = node.layers.torso;
      this.standing = this.torso.innerHTML;

      for (const style of node.svg.querySelectorAll('style')) style.remove();
      const artwork = document.createElementNS(ns, 'g');
      artwork.replaceChildren(...node.svg.children);
      root.replaceChildren(artwork);
      node.svg = artwork;
      const select = selector => selector.replace(/#torso/g, '[data-scene-layer="torso"]');
      node.scope = {
        querySelector: selector => artwork.querySelector(select(selector)),
        querySelectorAll: selector => artwork.querySelectorAll(select(selector))
      };
      const box = artwork.getBBox();
      const scale = spec.height / box.height;
      transform(artwork, 'scale(' + scale + ') translate(-627 ' + (-box.y - box.height) + ')');
      root.dataset.studioPreset = actor.id;
      if (spec.hipHinge) {
        const layers = [...artwork.children];
        const torsoIndex = layers.indexOf(this.torso);
        this.headLayers = [groupLayers(layers.slice(0, torsoIndex).filter(layer => layer.localName !== 'defs')),
          groupLayers(layers.slice(torsoIndex + 1))].filter(Boolean);
      }
      this.mountArms();
    }

    mountArms() {
      const arms = [...this.torso.querySelectorAll('[data-rig-arm]')];
      if (arms.length !== 2) throw Error('Missing articulated Studio arms for ' + this.spec.preset);
      const foreground = arms.at(-1);
      foreground.parentElement.insertBefore(this.props, foreground);
      if (this.spec.hipHinge) {
        const firstArm = arms[0];
        const layers = [...firstArm.parentElement.children];
        this.upperBody = groupLayers(layers.slice(layers.indexOf(firstArm)));
        this.upperBody.dataset.upperBody = '';
        this.hip = this.torso.querySelector('[data-rig-leg]');
        this.garment = this.upperBody.querySelector('[data-moving-garment]');
        this.garmentPaths = Array.from(this.garment.querySelectorAll('path'));
        this.garmentDetails = Array.from(this.garment.querySelectorAll('circle, ellipse'));
        this.rememberGarment();
        this.bendAngle = 0;
      }
      this.arms = arms.sort((a, b) => Number(a.dataset.rigArm) - Number(b.dataset.rigArm));
      for (const [index, side] of ['left', 'right'].entries()) {
        const hand = this.arms[index].querySelector('[data-action-hand]');
        hand.dataset.hand = this.root.id + '-' + side;
        hand.dataset.gripY = String(palmCenter);
      }
    }

    rememberGarment() {
      this.garmentRest = this.garmentPaths.map(path => path.getAttribute('d'));
      this.detailRest = this.garmentDetails.map(node => new DOMPoint(Number(node.getAttribute('cx')), Number(node.getAttribute('cy'))));
    }

    bendAtHips(angle = 0) {
      if (angle === 0 && this.bendAngle === 0) return;
      const artwork = DOMMatrix.fromMatrix(this.node.svg.getScreenCTM());
      const pivot = new DOMPoint().matrixTransform(this.hip.getScreenCTM()).matrixTransform(artwork.inverse());
      const bend = new DOMMatrix().translate(pivot.x, pivot.y).rotate(angle).translate(-pivot.x, -pivot.y);
      const toRig = DOMMatrix.fromMatrix(this.upperBody.parentElement.getScreenCTM()).inverse().multiply(artwork);
      const rigBend = toRig.multiply(bend).multiply(toRig.inverse());
      transform(this.upperBody, matrixString(rigBend));
      for (const layer of this.headLayers) transform(layer, matrixString(bend));

      // The cloth over the hips and thighs follows the legs at the hem, while
      // the upper part of the garment moves with the shoulders and neck.
      transform(this.garment, matrixString(rigBend.inverse()));
      const waist = pivot.matrixTransform(toRig).y - 160;
      const span = Math.max(150, Number(this.garment.dataset.clothHem) - waist - 24);
      const movePoint = point => {
        const t = inRange((point.y - waist) / span, 0, 1);
        const weight = 1 - t * t * (3 - 2 * t);
        const bent = point.matrixTransform(rigBend);
        return new DOMPoint(mix(point.x, bent.x, weight), mix(point.y, bent.y, weight));
      };
      for (const [i, path] of this.garmentPaths.entries()) {
        const shape = angle === 0 ? this.garmentRest[i] : this.garmentRest[i].replace(pathPair, (_, x, y) => {
          const moved = movePoint(new DOMPoint(Number(x), Number(y)));
          return moved.x.toFixed(3) + ' ' + moved.y.toFixed(3);
        });
        path.setAttribute('d', shape);
      }
      for (const [i, mark] of this.garmentDetails.entries()) {
        const moved = movePoint(this.detailRest[i]);
        mark.setAttribute('cx', String(moved.x));
        mark.setAttribute('cy', String(moved.y));
      }
      this.bendAngle = angle;
    }

    paint(pose, ms, word, reduced) {
      const { api, actor, node, root, props, stage } = this;
      transform(root, 'translate(' + pose.x + ' ' + pose.y + ') rotate(' + pose.lean + ')');
      api.withActor(actor, () => {
        const seconds = ms / 1000;
        const walking = !reduced && pose.walk != null;
        const frame = walking ? Math.floor(pose.walk * 18) : null;
        if (frame !== this.walkFrame) {
          if (walking) {
            if (this.spec.hipHinge && this.walkFrame === null) this.bendAtHips(0);
            api.walk(frame / 18, node.scope);
            if (this.spec.hipHinge) this.rememberGarment();
          } else {
            props.remove();
            this.torso.innerHTML = this.standing;
            this.mountArms();
          }
          this.walkFrame = frame;
        }
        const active = Boolean(word);
        const beat = reduced ? 0 : seconds + this.spec.serial * .43;
        const expression = api.reaction(active ? 'explain' : 'smile', beat);
        const match = word?.text ?? '';
        expression.mouth = active && word.phase > .085 && word.phase < .93
          ? /[ਓਔਊੌੋੂ]/u.test(match) ? 'O' : /[ਈਇਏੀਿੇ]/u.test(match) ? 'EE' : 'A'
          : 'closed';
        if (!active) expression.eyes = api.reaction('neutral', beat).eyes;
        if (reduced) expression.eyes = 'open';
        if (pose.gazeX != null) expression.gazeX = Math.round(pose.gazeX / 10) * 10;
        if (pose.gazeY != null) expression.gazeY = Math.round(pose.gazeY / 10) * 10;
        api.face(node, expression);
        if (this.spec.hipHinge) this.bendAtHips(pose.bend);
        root.dataset.speaking = String(expression.mouth !== 'closed');
        root.dataset.studioMotion = walking ? 'walk' : 'stand';

        const rest = walking || pose.quietHands ? api.restArms() : expression.arms ?? api.restArms();
        const screen = stage.getScreenCTM();
        for (const [index, side] of ['left', 'right'].entries()) {
          const grip = pose.grips[index];
          const arm = this.arms[index];
          if (walking && !grip?.weight) continue;
          const resting = rest[side] ?? [0, 0, 0];
          const angles = grip?.weight
            ? armAngles(arm, screen, grip.target, api.proportions, grip.anchor).map((angle, i) => mix(resting[i], angle, grip.weight))
            : resting;
          const hand = grip?.weight > .57
            ? { pose: grip.hand || 'fist', view: 'edge' }
            : (!pose.quietHands && expression.hands?.[side]) || { pose: 'relaxed', view: 'edge' };
          api.arm(arm, angles, hand, this.facing);
        }
        const inverse = props.parentElement.getScreenCTM().inverse().multiply(screen);
        transform(props, matrixString(inverse));
      });
    }
  }

  window.UmtoNativeCharacterPlayer = { open, Character };
})();
