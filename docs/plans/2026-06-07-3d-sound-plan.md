# 3D Board Sound Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tactile "piece set on board" clack on unit touchdown and a single gentle turn-start chime, synthesized in Web Audio behind a swappable seam.

**Architecture:** A new `src/audio/` module in three layers — `audioEngine` (AudioContext + master gain + mute + gesture unlock + spawn-arm), `soundBank` (the swappable synth-vs-sample production layer behind a `SoundBank` interface), and `gameSounds` (the semantic `piecePlaced()` / `turnCue()` the app calls). Triggers reuse existing plumbing: clack from `AnimatedUnit` animation touchdown, chime from a rising-edge effect in `GameView` beside the existing "YOUR TURN" title effect.

**Tech Stack:** TypeScript, React, Web Audio API, `@react-three/fiber` (existing `useFrame`). No new dependencies. No test runner (project verifies via `npm run build` + browser).

**Verification convention:** This project has no test framework. Each task is verified with `npm run build` (runs `tsc -b`, which enforces `noUnusedLocals`/`noUnusedParameters`) and a browser checkpoint. Logic is kept in small pure functions for clarity even though they are not unit-tested.

---

## File Structure

- **Create** `src/audio/audioEngine.ts` — AudioContext singleton, master gain, mute state (localStorage), gesture-based context unlock, spawn-arm flag + timer arming. No game concepts.
- **Create** `src/audio/soundBank.ts` — `SoundBank` interface + `synthBank` (procedural clack + chime). The two-way door: a future `sampledBank` implements the same interface.
- **Create** `src/audio/gameSounds.ts` — semantic `piecePlaced()` (detune/gain jitter + active-voice cap) and `turnCue()`. The only audio module trigger sites import.
- **Create** `src/components/board3d/hud/SoundToggle.tsx` — fixed-position HUD speaker button bound to engine mute state.
- **Modify** `src/components/board3d/anim/AnimatedUnit.tsx` — call `piecePlaced()` at move-arc completion and on genuine (armed) spawn.
- **Modify** `src/components/pages/GameView.tsx` — mount effect to init audio; rising-edge effect to call `turnCue()`.
- **Modify** `src/components/board3d/Board3D.tsx` — render `<SoundToggle />` after `</Canvas>`.

---

### Task 1: Audio engine

**Files:**
- Create: `src/audio/audioEngine.ts`

- [ ] **Step 1: Write the engine**

```typescript
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

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = readMutedFromStorage();
let armed = false;
const muteListeners = new Set<() => void>();

function readMutedFromStorage(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function getContext(): AudioContext {
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
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
  if (master) master.gain.value = value ? 0 : 1;
  for (const l of muteListeners) l();
}

export function subscribeMute(listener: () => void): () => void {
  muteListeners.add(listener);
  return () => {
    muteListeners.delete(listener);
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
```

- [ ] **Step 2: Verify it builds**

Run: `npm run build`
Expected: build succeeds (no type errors). Nothing audible yet — engine is unused.

- [ ] **Step 3: Commit**

```bash
git add src/audio/audioEngine.ts
git commit -m "feat(3d): audio engine (context, master gain, mute, gesture unlock)"
```

---

### Task 2: Synth sound bank (the two-way door)

**Files:**
- Create: `src/audio/soundBank.ts`

- [ ] **Step 1: Write the bank**

```typescript
// src/audio/soundBank.ts
//
// THE TWO-WAY DOOR. `SoundBank` is the production-layer interface: how a sound
// is made. `synthBank` makes both sounds procedurally in Web Audio. A future
// `sampledBank` would implement the same interface from decoded audio buffers,
// and switching is a one-line change in gameSounds.ts. Trigger sites never see
// this file.

import { getContext, getMasterGain } from "./audioEngine";

export interface SoundBank {
  /** A short "piece set down" clack. Caller supplies per-hit variation. */
  playClack(opts?: { detune?: number; gain?: number }): void;
  /** A soft two-note "your move" chime. */
  playChime(): void;
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
};
```

- [ ] **Step 2: Verify it builds**

Run: `npm run build`
Expected: build succeeds. Still unused — no triggers yet.

- [ ] **Step 3: Commit**

```bash
git add src/audio/soundBank.ts
git commit -m "feat(3d): synth sound bank (clack + chime) behind SoundBank seam"
```

---

### Task 3: Semantic sound layer

**Files:**
- Create: `src/audio/gameSounds.ts`

- [ ] **Step 1: Write the semantic layer**

```typescript
// src/audio/gameSounds.ts
//
// The semantic layer trigger sites import. Maps game moments to the active bank
// and owns play-time policy (mute/arm gating, per-clack variation, voice cap).
// To swap synth for samples later, change the `bank` import below — nothing else.

import { isArmed, isMuted } from "./audioEngine";
import { synthBank as bank } from "./soundBank";

// Active-voice cap: a huge simultaneous move could fire a dozen clacks in one
// frame and clip. Allow a small handful within a short window, drop the rest.
const CLACK_WINDOW_MS = 80;
const CLACK_MAX_IN_WINDOW = 6;
let recentClacks: number[] = [];

/** A unit set down on the board (after a move) or popped in (a spawn). */
export function piecePlaced(): void {
  if (isMuted() || !isArmed()) return;
  const t = performance.now();
  recentClacks = recentClacks.filter((ts) => t - ts < CLACK_WINDOW_MS);
  if (recentClacks.length >= CLACK_MAX_IN_WINDOW) return;
  recentClacks.push(t);
  // Per-hit variation so several pieces settling sound like several pieces.
  const detune = (Math.random() * 2 - 1) * 220; // cents
  const gain = 0.8 + Math.random() * 0.4;
  bank.playClack({ detune, gain });
}

/** It just became this player's move. Fired once on the rising edge. */
export function turnCue(): void {
  // Not arm-gated: it is edge-triggered (never a load-storm) and should be able
  // to fire on the very first turn. Mute still applies; the context being locked
  // before the first gesture naturally silences anything pre-interaction.
  if (isMuted()) return;
  bank.playChime();
}
```

- [ ] **Step 2: Verify it builds**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/audio/gameSounds.ts
git commit -m "feat(3d): semantic sound layer (piecePlaced + turnCue)"
```

---

### Task 4: Clack on unit touchdown

**Files:**
- Modify: `src/components/board3d/anim/AnimatedUnit.tsx`

Context: `AnimatedUnit` already detects the exact set-down frame. In `useFrame`, a
move arc completes inside `if (p >= 1) { base.current.set(...); move.current = null; }`,
and the spawn pop-in finishes when `enter.current` reaches 1. We clack at both.
`piecePlaced()` self-gates on mute/arm, so initial-roster spawns (before the arm
timer) stay silent and only real moves/spawns sound.

- [ ] **Step 1: Add the import**

At the top of `src/components/board3d/anim/AnimatedUnit.tsx`, add below the existing imports:

```typescript
import { piecePlaced } from "../../../audio/gameSounds";
```

- [ ] **Step 2: Add a spawn-clack guard ref**

Beside the other refs in the component body (after `const exit = useRef(0);`), add:

```typescript
  // Fires once when the spawn pop-in completes (gated to armed units only).
  const clackedSpawn = useRef(false);
```

- [ ] **Step 3: Clack on move completion**

In `useFrame`, find the move-completion block:

```typescript
        if (p >= 1) {
          base.current.set(cur.tx, cur.ty, cur.tz);
          move.current = null;
        }
```

Replace it with:

```typescript
        if (p >= 1) {
          base.current.set(cur.tx, cur.ty, cur.tz);
          move.current = null;
          piecePlaced(); // touchdown: the piece is set on the board
        }
```

- [ ] **Step 4: Clack on spawn completion**

In `useFrame`, find the enter/exit progression line:

```typescript
    enter.current = Math.min(enter.current + dt / ENTER_DURATION, 1);
```

Immediately after it, add:

```typescript
    if (!clackedSpawn.current && enter.current >= 1) {
      clackedSpawn.current = true;
      piecePlaced(); // pop-in finished: the figure has landed
    }
```

- [ ] **Step 5: Verify it builds**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Browser checkpoint**

Run the app, open the 3D board. Verify:
- Loading into a game makes **no clack-storm** (initial roster is silent).
- Moving a unit produces a single clack synced to the visual set-down (after the arc), not when the action is chosen.
- A multi-unit move sounds like several pitch-varied clacks, not one flat tone.
- Mute is not wired yet, so to confirm audio at all you may need to interact first (the gesture unlock).

- [ ] **Step 7: Commit**

```bash
git add src/components/board3d/anim/AnimatedUnit.tsx
git commit -m "feat(3d): clack when a unit is set down (move touchdown + spawn)"
```

---

### Task 5: Turn-start chime + audio init

**Files:**
- Modify: `src/components/pages/GameView.tsx`

Context: `isMyInput`, `isPlanning`, and `canCommit` already exist (around lines
103–153). The existing title effect at ~line 211 (`document.title = isMyInput ? ...`)
is the sibling pattern. We add (a) a mount effect to install the gesture unlock and
start the spawn-arm timer, and (b) a rising-edge effect for the chime with a re-arm
guard so a flicker between sub-prompts cannot double-ding.

- [ ] **Step 1: Add imports**

At the top of `src/components/pages/GameView.tsx`, add to the existing import block:

```typescript
import { installAudioUnlock, armSounds } from "../../audio/audioEngine";
import { turnCue } from "../../audio/gameSounds";
```

Ensure `useRef` and `useEffect` are imported from `react` (add them if the existing
`react` import does not already include them).

- [ ] **Step 2: Add the audio-init mount effect**

After the existing `const isPlanning = ...` / `const canCommit = ...` lines (~152–153),
add:

```typescript
  // Install the first-gesture context unlock, and arm spawn clacks after a beat
  // so the initial roster popping in stays silent.
  useEffect(() => {
    installAudioUnlock();
    const id = window.setTimeout(armSounds, 1200);
    return () => window.clearTimeout(id);
  }, []);
```

- [ ] **Step 3: Add the rising-edge chime effect**

Below the audio-init effect, add:

```typescript
  // Chime once when this player's move opens — a targeted resolution prompt
  // (isMyInput) or the start of the planning phase (still needs to commit).
  // Silent through follow-up sub-prompts; a re-arm guard ignores sub-400ms
  // off→on flicker so back-to-back prompts cannot double-ding.
  const needsMyAction = !!isMyInput || (isPlanning && canCommit);
  const prevNeedsRef = useRef(false);
  const lastOffAtRef = useRef(0);
  useEffect(() => {
    const REARM_MS = 400;
    if (needsMyAction && !prevNeedsRef.current) {
      const offDur = performance.now() - lastOffAtRef.current;
      if (lastOffAtRef.current === 0 || offDur >= REARM_MS) turnCue();
    }
    if (!needsMyAction && prevNeedsRef.current) {
      lastOffAtRef.current = performance.now();
    }
    prevNeedsRef.current = needsMyAction;
  }, [needsMyAction]);
```

- [ ] **Step 4: Verify it builds**

Run: `npm run build`
Expected: build succeeds (watch for unused `useRef`/`useEffect` or duplicate imports).

- [ ] **Step 5: Browser checkpoint**

In a game, verify:
- A single soft chime when it becomes your move (a prompt directed at you, and at the start of a planning phase where you still owe a card).
- **No** repeat chime as you click through follow-up sub-prompts within the same decision window.
- No chime while waiting on other players.

- [ ] **Step 6: Commit**

```bash
git add src/components/pages/GameView.tsx
git commit -m "feat(3d): turn-start chime on rising edge of your-move"
```

---

### Task 6: HUD mute toggle

**Files:**
- Create: `src/components/board3d/hud/SoundToggle.tsx`
- Modify: `src/components/board3d/Board3D.tsx`

- [ ] **Step 1: Write the toggle component**

```tsx
// src/components/board3d/hud/SoundToggle.tsx
import { useSyncExternalStore } from "react";
import { isMuted, setMuted, subscribeMute } from "../../../audio/audioEngine";

/** Fixed-corner speaker toggle bound to the engine's persisted mute state. */
export function SoundToggle() {
  const muted = useSyncExternalStore(subscribeMute, isMuted, isMuted);
  return (
    <button
      type="button"
      onClick={() => setMuted(!muted)}
      aria-label={muted ? "Unmute sound" : "Mute sound"}
      title={muted ? "Unmute sound" : "Mute sound"}
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 150,
        width: 40,
        height: 40,
        borderRadius: 8,
        background: "rgba(20,16,12,0.6)",
        border: "1px solid rgba(255,216,155,0.3)",
        color: "#ffd89b",
        cursor: "pointer",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 18,
        lineHeight: 1,
      }}
    >
      {muted ? "\u{1F507}" : "\u{1F50A}"}
    </button>
  );
}
```

- [ ] **Step 2: Render it in Board3D**

In `src/components/board3d/Board3D.tsx`, add the import near the other `hud/` imports:

```typescript
import { SoundToggle } from "./hud/SoundToggle";
```

Then, immediately after the `</Canvas>` line (~619), add:

```tsx
      <SoundToggle />
```

- [ ] **Step 3: Verify it builds**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Browser checkpoint**

- A speaker button shows in the bottom-right of the 3D board.
- Clicking it toggles the icon and silences/restores both clacks and the chime.
- Reload the page: the mute choice persists (localStorage).

- [ ] **Step 5: Commit**

```bash
git add src/components/board3d/hud/SoundToggle.tsx src/components/board3d/Board3D.tsx
git commit -m "feat(3d): HUD speaker toggle for sound mute (persisted)"
```

---

## Self-Review Notes

- **Spec coverage:** clack on move touchdown + spawn (Task 4), one-clack-per-unit pitch-varied with voice cap (Task 3), turn cue on rising edge of `isMyInput || (isPlanning && canCommit)` with re-arm guard (Task 5), synth behind a swappable `SoundBank` seam (Task 2), mute toggle default-unmuted + localStorage (Tasks 1, 6), "no clack on initial load" via gesture-locked context + spawn-arm timer (Tasks 1, 4, 5). All covered.
- **Type consistency:** `SoundBank.playClack(opts?)`/`playChime()` (Task 2) match calls in `gameSounds.ts` (Task 3). Engine exports `getContext`, `getMasterGain`, `isMuted`, `setMuted`, `subscribeMute`, `isArmed`, `armSounds`, `installAudioUnlock` (Task 1) — all consumed with matching names in Tasks 3, 5, 6.
- **No tests by design:** per project convention (no runner); verification is build + browser checkpoints, called out per task.
