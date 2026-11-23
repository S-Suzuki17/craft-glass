// CC0 Kenney Sound Effects + Local Procedural Web Audio Ambient Synthesizer

const SFX_FILES = {
  start: './assets/audio/start.wav',
  finish: './assets/audio/finish.wav',
  clear: './assets/audio/clear.wav',
  correct: './assets/audio/correct.wav',
  flip: './assets/audio/flip.wav',
  lock: './assets/audio/lock.wav',
  pass: './assets/audio/pass.wav',
  hit: './assets/audio/hit.wav',
  wrong: './assets/audio/wrong.wav'
};

class SoundEngine {
  constructor() {
    this.enabled = true;
    this.audioCtx = null;
    this.ambientNodes = null;
  }

  setEnabled(flag) {
    this.enabled = Boolean(flag);
  }

  play(name) {
    if (!this.enabled || !SFX_FILES[name]) return;
    try {
      const audio = new Audio(SFX_FILES[name]);
      audio.volume = 0.45;
      audio.play().catch(() => {});
    } catch {
      // Ignore autoplay errors
    }
  }

  startAmbient(mode = 'off') {
    this.stopAmbient();
    if (mode === 'off') return;
    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!this.audioCtx) this.audioCtx = new AudioContextClass();
    const ctx = this.audioCtx;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const master = ctx.createGain();
    master.gain.value = 0.08;
    master.connect(ctx.destination);

    if (mode === 'rain' || mode === 'brown') {
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = mode === 'brown'
          ? ((lastOut + 0.02 * white) / 1.02) * 3.2
          : white * 0.4;
        lastOut = data[i];
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = mode === 'rain' ? 1150 : 420;
      src.connect(filter);
      filter.connect(master);
      src.start();
      this.ambientNodes = [src, filter, master];
    } else if (mode === 'drone') {
      master.gain.value = 0.04;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.value = 174.61; // F3 warm harmonic
      osc2.frequency.value = 261.63; // C4 fifth
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 480;
      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(master);
      osc1.start();
      osc2.start();
      this.ambientNodes = [osc1, osc2, filter, master];
    }
  }

  stopAmbient() {
    if (!this.ambientNodes) return;
    for (const node of this.ambientNodes) {
      try { node.stop?.(); } catch {}
      try { node.disconnect?.(); } catch {}
    }
    this.ambientNodes = null;
  }
}

export const soundEngine = new SoundEngine();
