(() => {
  'use strict';

  const effectDurations = { wings: .48, plop: .43, sip: .64, step: .18, ribbon: .3, gust: 1.55, chirp: .47, spring: .29, twig: .23, bark: .35 };

  function effect(context, name) {
    const duration = effectDurations[name];
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = 217 + name.length;
    let filtered = 0;
    for (let i = 0; i < samples.length; i++) {
      const t = i / context.sampleRate;
      seed = (1664525 * seed + 1013904223) >>> 0;
      const smoothing = name === 'gust' ? 0.024 : name === 'wings' ? 0.065 : 0.28;
      filtered += (seed / 2147483648 - 1 - filtered) * smoothing;
      if (name === 'wings') {
        const flutter = (1 + Math.sin(t * 2 * Math.PI * 9)) * 0.5;
        samples[i] = filtered * flutter * Math.sin(Math.PI * t / duration) * 0.6;
      } else if (name === 'sip') {
        const bubble = t % 0.18;
        samples[i] = (Math.sin(2 * Math.PI * (420 * bubble - 315 * bubble * bubble)) * 0.12 + filtered * 0.1) *
          Math.exp(-bubble * 26) * Math.sin(Math.PI * t / duration);
      } else if (name === 'step') {
        const soil = 0.15 * Math.sin(2 * Math.PI * (104 * t - 121 * t * t));
        samples[i] = (filtered * 0.28 + soil) * Math.exp(-t * 29) * Math.min(t * 120, 1);
      } else if (name === 'gust') {
        const swell = Math.sin(Math.PI * t / duration) ** 1.5;
        const whistle = Math.sin(2 * Math.PI * (161 * t + 47 * t * t)) * 0.05;
        samples[i] = (filtered * 0.68 + whistle) * swell * (0.7 + Math.sin(t * 16) * 0.2);
      } else if (name === 'chirp') {
        const note = t % .16;
        const sweep = 2190 * note + 6300 * note * note;
        const envelope = Math.min(1, note * 180) * Math.exp(-note * 51);
        samples[i] = Math.sin(2 * Math.PI * sweep) * envelope * .18 * (1 - t / duration);
      } else if (name === 'bark') {
        const barkPitch = 2 * Math.PI * (410 * t - 268 * t * t);
        const harmonics = .64 * Math.sin(barkPitch) + .29 * Math.sin(2 * barkPitch) + .16 * Math.sin(4 * barkPitch);
        const envelope = Math.min(1, t * 78) * Math.exp(-t * 11) * (1 - t / duration);
        samples[i] = (.41 * harmonics + .42 * filtered) * envelope;
      } else if (name === 'spring') {
        const sweep = 210 * t + 459 * t * t;
        const pluck = Math.sin(2 * Math.PI * sweep) + .18 * Math.sin(4 * Math.PI * sweep);
        samples[i] = pluck * Math.min(1, t * 95) * Math.exp(-t * 17) * .21;
      } else if (name === 'twig') {
        const snap = Math.exp(-t * 58) + .42 * Math.exp(-Math.abs(t - .082) * 71);
        const wood = Math.sin(2 * Math.PI * (620 * t - 1050 * t * t)) * .12;
        samples[i] = (filtered * .58 + wood) * snap * Math.min(1, t * 490);
      } else if (name === 'ribbon') {
        samples[i] = (filtered * 0.38 + 0.08 * Math.sin(2 * Math.PI * 420 * t)) *
          Math.exp(-t * 18) * Math.min(t * 380, 1);
      } else {
        const clay = 0.13 * Math.sin(t * 2 * Math.PI * 1070) * Math.exp(-t * 70);
        const bubble = 0.33 * Math.sin(2 * Math.PI * (244 * t - 115 * t * t)) * Math.exp(-t * 15);
        samples[i] = (clay + bubble + filtered * 0.19 * Math.exp(-t * 19)) * Math.min(t * 260, 1);
      }
    }
    return buffer;
  }

  // A quiet original loop is used when a generated score is unavailable.
  function fallbackScore(context, theme) {
    const orchard = theme === 'orchard';
    const beat = orchard ? .51 : .73;
    const bars = 8;
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * beat * 4 * bars), context.sampleRate);
    const samples = buffer.getChannelData(0);
    const melody = orchard
      ? [67, 71, 74, null, 72, 71, 69, null, 74, 76, 74, 71, 69, null, 67, null,
        71, 74, 79, 76, 74, 71, 69, null, 72, 76, 74, 69, 67, null, null, null]
      : [74, null, 71, 69, 71, null, 74, null, 76, 74, 71, null, 69, null, 67, null,
        74, null, 76, 78, 74, null, 71, null, 69, 71, 74, null, 71, null, 67, null];
    const decay = orchard ? 6.2 : 3.9;
    for (const [index, note] of melody.entries()) {
      if (note === null) continue;
      const hz = 440 * (2 ** ((note - 69) / 12));
      const start = Math.floor(index * beat * context.sampleRate);
      const end = Math.min(samples.length, start + Math.floor(beat * 0.94 * context.sampleRate));
      for (let i = start; i < end; i++) {
        const t = (i - start) / context.sampleRate;
        const phase = 2 * Math.PI * hz * t + 0.27 * Math.sin(t * 32);
        const tone = Math.sin(phase) + 0.13 * Math.sin(2 * phase);
        samples[i] += tone * 0.31 * Math.min(1, t * 18) * Math.exp(-t * decay);
      }
    }
    if (orchard) {
      const bass = [55, 50, 52, 55, 55, 50, 48, 55];
      for (const [bar, note] of bass.entries()) {
        const hz = 440 * (2 ** ((note - 69) / 12));
        const start = Math.floor(bar * 4 * beat * context.sampleRate);
        const end = Math.min(samples.length, start + Math.floor(1.15 * context.sampleRate));
        for (let i = start; i < end; i++) {
          const t = (i - start) / context.sampleRate;
          samples[i] += Math.sin(t * 2 * Math.PI * hz) * Math.min(1, t * 15) * Math.exp(-t * 4.2) * .16;
        }
      }
    }
    return buffer;
  }

  class StorySound {
    constructor() {
      const Audio = window.AudioContext || window.webkitAudioContext;
      this.context = Audio ? new Audio() : null;
      this.clips = new Map();
      this.sources = [];
      this.music = null;
      this.startedAt = null;
      this.offset = 0;
      if (!this.context) return;
      this.speech = this.context.createGain();
      this.scoreGain = this.context.createGain();
      this.foleyGain = this.context.createGain();
      this.speech.gain.value = 0.94;
      this.foleyGain.gain.value = 0.42;
      for (const bus of [this.speech, this.scoreGain, this.foleyGain]) bus.connect(this.context.destination);
      this.effects = Object.fromEntries(Object.keys(effectDurations).map(name => [name, effect(this.context, name)]));
    }

    async decode(url) {
      const response = await fetch(url);
      if (!response.ok) return null;
      return this.context.decodeAudioData(await response.arrayBuffer());
    }

    async load(ids, scorePath = 'audio/score.mp3', theme) {
      if (!this.context) return;
      const [score] = await Promise.all([
        scorePath ? this.decode(scorePath).catch(() => null) : Promise.resolve(null),
        ...ids.map(async id => {
          const buffer = await this.decode('audio/' + id + '.mp3').catch(() => null);
          if (buffer) this.clips.set(id, buffer);
        })
      ]);
      this.generatedScore = Boolean(score);
      this.score = score || fallbackScore(this.context, theme);
    }

    async unlock() {
      if (!this.context) return false;
      await this.context.resume();
      return this.context.state === 'running';
    }

    source(buffer, bus, when, offset = 0) {
      const node = this.context.createBufferSource();
      node.buffer = buffer;
      node.connect(bus);
      node.start(when, offset);
      this.sources.push(node);
      return node;
    }

    playScene(scene, offset) {
      this.stopScene();
      if (this.context?.state !== 'running') return false;
      const when = this.context.currentTime + 0.04;
      this.startedAt = when;
      this.offset = offset;
      this.scoreGain.gain.cancelScheduledValues(when);
      this.scoreGain.gain.setValueAtTime(0.10, when);
      if (!this.music && this.score) {
        const node = this.context.createBufferSource();
        node.buffer = this.score;
        node.loop = true;
        node.connect(this.scoreGain);
        node.start(when, ((scene.episodeStart + offset) / 1000) % this.score.duration);
        this.music = node;
      }
      for (const line of scene.lines) {
        const buffer = this.clips.get(line.id);
        if (!buffer || line.end <= offset) continue;
        const jump = Math.max(0, (offset - line.start) / 1000);
        if (jump >= buffer.duration) continue;
        const start = when + Math.max(0, (line.start - offset) / 1000);
        this.source(buffer, this.speech, start, jump);
        const level = this.generatedScore ? 0.065 : 0.13;
        this.scoreGain.gain.setValueAtTime(level, start);
        this.scoreGain.gain.setTargetAtTime(level * 1.65, start + buffer.duration - jump, 0.08);
      }
      for (const cue of scene.events) {
        if (cue.ms >= offset) this.source(this.effects[cue.sound], this.foleyGain, when + (cue.ms - offset) / 1000);
      }
      return true;
    }

    elapsed() {
      if (this.startedAt === null) return null;
      return this.offset + Math.max(0, this.context.currentTime - this.startedAt) * 1000;
    }

    stopScene() {
      for (const node of this.sources) {
        node.stop();
        node.disconnect();
      }
      this.sources.length = 0;
      this.startedAt = null;
    }

    stop() {
      this.stopScene();
      if (this.music) {
        this.music.stop();
        this.music.disconnect();
        this.music = null;
      }
    }
  }

  window.LP005Sound = StorySound;
})();
