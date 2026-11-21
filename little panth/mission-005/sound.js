(() => {
  'use strict';

  function effect(context, name) {
    const durations = { wings: 0.48, plop: 0.43, sip: 0.64, step: 0.18, ribbon: 0.3 };
    const duration = durations[name];
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = 217 + name.length;
    let filtered = 0;
    for (let i = 0; i < samples.length; i++) {
      const t = i / context.sampleRate;
      seed = (1664525 * seed + 1013904223) >>> 0;
      filtered += (seed / 2147483648 - 1 - filtered) * (name === 'wings' ? 0.065 : 0.28);
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
  function fallbackScore(context) {
    const beat = 0.73;
    const bars = 8;
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * beat * 4 * bars), context.sampleRate);
    const samples = buffer.getChannelData(0);
    const melody = [74, null, 71, 69, 71, null, 74, null, 76, 74, 71, null, 69, null, 67, null, 74, null, 76, 78, 74, null, 71, null, 69, 71, 74, null, 71, null, 67, null];
    for (const [index, note] of melody.entries()) {
      if (note === null) continue;
      const hz = 440 * (2 ** ((note - 69) / 12));
      const start = Math.floor(index * beat * context.sampleRate);
      const end = Math.min(samples.length, start + Math.floor(beat * 0.94 * context.sampleRate));
      for (let i = start; i < end; i++) {
        const t = (i - start) / context.sampleRate;
        const phase = 2 * Math.PI * hz * t + 0.27 * Math.sin(t * 32);
        const tone = Math.sin(phase) + 0.13 * Math.sin(2 * phase);
        samples[i] += tone * 0.31 * Math.min(1, t * 18) * Math.exp(-t * 3.9);
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
      this.effects = Object.fromEntries(['wings', 'plop', 'sip', 'step', 'ribbon'].map(name => [name, effect(this.context, name)]));
    }

    async decode(url) {
      const response = await fetch(url);
      if (!response.ok) return null;
      return this.context.decodeAudioData(await response.arrayBuffer());
    }

    async load(ids, scorePath = 'audio/score.mp3') {
      if (!this.context) return;
      const [score] = await Promise.all([
        scorePath ? this.decode(scorePath).catch(() => null) : Promise.resolve(null),
        ...ids.map(async id => {
          const buffer = await this.decode('audio/' + id + '.mp3').catch(() => null);
          if (buffer) this.clips.set(id, buffer);
        })
      ]);
      this.generatedScore = Boolean(score);
      this.score = score || fallbackScore(this.context);
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
