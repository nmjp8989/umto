(() => {
  'use strict';

  const ns = 'http://www.w3.org/2000/svg';
  const degrees = 180 / Math.PI;
  const shoulderPivot = 48;
  const palmCenter = 56;
  const transform = (node, value) => node.setAttribute('transform', value);
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

  function armAngles(arm, screen, target, proportions) {
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
    const handX = palmCenter * Math.sin(wrist);
    const handY = proportions.forearm + palmCenter * Math.cos(wrist);
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
      this.mountArms();
    }

    mountArms() {
      const arms = [...this.torso.querySelectorAll('[data-rig-arm]')];
      if (arms.length !== 2) throw Error('Missing articulated Studio arms for ' + this.spec.preset);
      const foreground = arms.at(-1);
      foreground.parentElement.insertBefore(this.props, foreground);
      this.arms = arms.sort((a, b) => Number(a.dataset.rigArm) - Number(b.dataset.rigArm));
      for (const [index, side] of ['left', 'right'].entries()) {
        const hand = this.arms[index].querySelector('[data-action-hand]');
        hand.dataset.hand = this.root.id + '-' + side;
        hand.dataset.gripY = String(palmCenter);
      }
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
            api.walk(frame / 18, node.scope);
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
        api.face(node, expression);
        root.dataset.speaking = String(expression.mouth !== 'closed');
        root.dataset.studioMotion = walking ? 'walk' : 'stand';

        const rest = walking ? api.restArms() : expression.arms ?? api.restArms();
        const screen = stage.getScreenCTM();
        for (const [index, side] of ['left', 'right'].entries()) {
          const grip = pose.grips[index];
          const arm = this.arms[index];
          if (walking && !grip?.weight) continue;
          const resting = rest[side] ?? [0, 0, 0];
          const angles = grip?.weight
            ? armAngles(arm, screen, grip.target, api.proportions).map((angle, i) => mix(resting[i], angle, grip.weight))
            : resting;
          const hand = grip?.weight > .57
            ? { pose: grip.hand || 'fist', view: 'edge' }
            : expression.hands?.[side] ?? { pose: 'relaxed', view: 'edge' };
          api.arm(arm, angles, hand, this.facing);
        }
        const inverse = props.parentElement.getScreenCTM().inverse().multiply(screen);
        transform(props, 'matrix(' + [inverse.a, inverse.b, inverse.c, inverse.d, inverse.e, inverse.f].join(' ') + ')');
      });
    }
  }

  window.UmtoNativeCharacterPlayer = { open, Character };
})();
