// src/audio/audioEngine.ts
//
// Owns the singleton AudioContext, the master gain, persisted mute state, and
// two gating concerns that keep the board quiet when it should be:
//   - The context only resumes after a real user gesture (browsers block audio
//     before then), so the very first render never makes noise.
//   - A "spawn-arm" flag stays false for a beat after the game mounts, so the
//     initial roster popping in does not fire a clack-storm. It is set true by a
//     timer started at game mount (see GameView).
// No game concepts live here.

const MUTE_KEY = "goa2.sound.muted";
const VOLUME_KEY = "goa2.sound.volume";

// 100% on the slider maps to this master gain. The synth voices were tuned at a
// raw gain of 1.0 and read hot, so "full" volume sits at 0.5× and the slider can
// push to 150% (= 0.75 gain) for a player who wants more.
const BASE_GAIN = 0.5;
const MAX_VOLUME = 1.5;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = readMutedFromStorage();
let volume = readVolumeFromStorage(); // 0..MAX_VOLUME, where 1.0 === 100%
let armed = false;
const settingsListeners = new Set<() => void>();

function readMutedFromStorage(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function readVolumeFromStorage(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (raw === null) return 1.0;
    const v = parseFloat(raw);
    return Number.isFinite(v) ? Math.min(Math.max(v, 0), MAX_VOLUME) : 1.0;
  } catch {
    return 1.0;
  }
}

function effectiveGain(): number {
  return muted ? 0 : volume * BASE_GAIN;
}

function applyGain(): void {
  if (master) master.gain.value = effectiveGain();
}

export function getContext(): AudioContext {
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = effectiveGain();
    // Master limiter: when many voices stack (e.g. a whole line of minions
    // landing at once) their summed signal is ducked smoothly instead of
    // clipping into distortion — so no clack ever has to be dropped.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    master.connect(limiter).connect(ctx.destination);
  }
  return ctx;
}

export function getMasterGain(): GainNode {
  getContext();
  return master as GainNode;
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    /* ignore storage failures */
  }
  applyGain();
  notifySettings();
}

/** Current volume as a 0..1.5 multiplier (1.0 === 100%). */
export function getVolume(): number {
  return volume;
}

export function setVolume(value: number): void {
  volume = Math.min(Math.max(value, 0), MAX_VOLUME);
  try {
    localStorage.setItem(VOLUME_KEY, String(volume));
  } catch {
    /* ignore storage failures */
  }
  applyGain();
  notifySettings();
}

function notifySettings(): void {
  for (const l of settingsListeners) l();
}

/** Subscribe to any sound-settings change (mute or volume). */
export function subscribeSettings(listener: () => void): () => void {
  settingsListeners.add(listener);
  return () => {
    settingsListeners.delete(listener);
  };
}

export function isArmed(): boolean {
  return armed;
}

/** Allow spawn clacks. Called from a timer started at game mount. */
export function armSounds(): void {
  armed = true;
}

/** Resume the context on the first user gesture, once. Safe to call repeatedly. */
let unlockInstalled = false;
export function installAudioUnlock(): void {
  if (unlockInstalled) return;
  unlockInstalled = true;
  const unlock = () => {
    getContext()
      .resume()
      .catch(() => {});
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}
