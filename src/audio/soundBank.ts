// src/audio/soundBank.ts
//
// THE TWO-WAY DOOR. `SoundBank` is the production-layer interface: how a sound
// is made. `synthBank` makes the sounds procedurally in Web Audio. A future
// `sampledBank` would implement the same interface from decoded audio buffers,
// and switching is a one-line change in gameSounds.ts. Trigger sites never see
// this file.

import { getContext, getMasterGain } from "./audioEngine";

export interface SoundBank {
  /** A short "piece set down" clack. Caller supplies per-hit variation. */
  playClack(opts?: { detune?: number; gain?: number }): void;
  /** A soft two-note "your move" chime. */
  playChime(): void;
  /** A compact, bright tabletop attention ping. */
  playPing(): void;
}

// One reusable noise buffer for the clack transient (the contact "click").
let noiseBuf: AudioBuffer | null = null;
function getNoiseBuffer(): AudioBuffer {
  const ctx = getContext();
  if (!noiseBuf || noiseBuf.sampleRate !== ctx.sampleRate) {
    const len = Math.floor(ctx.sampleRate * 0.03);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      // Decaying white noise: loudest at contact, gone in ~30ms.
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
  }
  return noiseBuf;
}

export const synthBank: SoundBank = {
  playClack({ detune = 0, gain = 1 } = {}) {
    const ctx = getContext();
    const master = getMasterGain();
    const t = ctx.currentTime;

    // Pitched body: a fast-decaying triangle "tonk" — the wood/stone resonance.
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 200;
    osc.detune.value = detune;
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.0001, t);
    oscGain.gain.exponentialRampToValueAtTime(0.5 * gain, t + 0.002);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    osc.connect(oscGain).connect(master);
    osc.start(t);
    osc.stop(t + 0.08);

    // Transient: a band-passed noise burst — the click of contact.
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer();
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2400;
    bp.Q.value = 0.7;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.6 * gain, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    noise.connect(bp).connect(noiseGain).connect(master);
    noise.start(t);
    noise.stop(t + 0.04);
  },

  playChime() {
    const ctx = getContext();
    const master = getMasterGain();
    const t = ctx.currentTime;
    // Two gentle sine partials, slightly staggered — open and non-piercing.
    const notes = [659.25, 987.77]; // E5, B5
    notes.forEach((freq, i) => {
      const start = t + i * 0.12;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
      osc.connect(g).connect(master);
      osc.start(start);
      osc.stop(start + 0.65);
    });
  },

  playPing() {
    const ctx = getContext();
    const master = getMasterGain();
    const t = ctx.currentTime;

    // A clean 85 ms digital tap: one high fundamental plus a faint metallic
    // partial. The tiny attack avoids a speaker click while keeping the cue
    // perceptually immediate; there is no noise or long pitch sweep.
    const partials = [
      { frequency: 2240, peak: 0.17, duration: 0.085 },
      { frequency: 3360, peak: 0.045, duration: 0.052 },
    ];
    for (const { frequency, peak, duration } of partials) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(frequency, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(g).connect(master);
      osc.start(t);
      osc.stop(t + duration + 0.005);
    }
  },
};
