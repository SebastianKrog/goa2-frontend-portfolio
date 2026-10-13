# 3D Board Sound — Design (M7, focused first pass)

Date: 2026-06-07
Status: approved, pre-implementation

## Goal

Add two tasteful sounds to the 3D board, nothing more:

1. **Piece clack** — a tactile "chess piece set on the board" sound when a
   token/model lands after moving or is placed on the board.
2. **Turn cue** — a single gentle chime to remind a distracted player it is
   their move, without nagging a player who is drowning in inputs.

Non-goals (explicitly out of scope for this pass): combat impact SFX, ambient
music bed, per-event sound design beyond the two above, UI click sounds.

## Decisions (locked)

- **Source: synthesized via Web Audio now**, designed so sampled `.ogg`/`.mp3`
  files can replace the synth later without touching trigger sites. Two-way door.
- **Multi-unit moves: one clack per unit, pitch-varied** (random detune + slight
  gain jitter), with a small active-voice cap to prevent clipping.
- **Turn cue fires on the rising edge of `needsMyAction = isMyInput ||
  (isPlanning && canCommit)`** — covers both targeted resolution prompts and the
  start of the card-planning phase. Silent for follow-up sub-prompts.
- **Mute: HUD speaker toggle, default unmuted, persisted to localStorage.**

## Architecture — `src/audio/` (mirrors `src/anim/`)

Three layers so the synth→sample swap is a one-file change. Trigger sites and the
semantic layer never know how audio is produced.

### 1. `audioEngine.ts`
- Owns a lazily-created singleton `AudioContext` and a master `GainNode`.
- Owns mute state, persisted to `localStorage` key `goa2.sound.muted`
  (default: unmuted). Mute sets master gain to 0.
- Resumes the `AudioContext` on the first user gesture (`pointerdown`/`keydown`,
  one-time listener). Browsers block audio before a gesture anyway — this also
  means the initial board load makes no sound, for free.
- Exposes: `getContext()`, `getMasterGain()`, `isMuted()`, `setMuted(bool)`,
  `now()`. No game concepts here.

### 2. `soundBank.ts` — the swappable production layer (THE TWO-WAY DOOR)
- Exports a `SoundBank` interface:
  - `playClack(opts?: { detune?: number; gain?: number }): void`
  - `playChime(): void`
- Ships `synthBank: SoundBank` implemented with Web Audio nodes:
  - **Clack**: a short filtered noise burst (wood/stone transient) layered with a
    fast-decaying pitched "tonk" (sine/triangle, ~12–25ms), routed through the
    master gain. Detune + gain come from the caller for per-unit variation.
  - **Chime**: a soft two-note bell (two short sine/triangle partials with a
    gentle envelope), deliberately quiet and non-piercing.
- A future `sampledBank: SoundBank` implements the same interface from decoded
  audio buffers. Swapping is: change which bank `gameSounds.ts` imports.

### 3. `gameSounds.ts` — semantic layer the app imports
- Thin mapping of game concepts to the active bank:
  - `piecePlaced()` → `bank.playClack({ detune: rand(±N), gain: jitter })`,
    subject to the active-voice cap (skip if too many clacks in the last ~80ms).
  - `turnCue()` → `bank.playChime()`.
- This is the ONLY audio module trigger sites import.

## Trigger wiring (reuse existing plumbing — no new event channel)

### Clack — `src/components/board3d/anim/AnimatedUnit.tsx`
- Fire `piecePlaced()` at the exact visual **touchdown**:
  - When a move arc completes — the existing `if (p >= 1) { ... move.current =
    null; }` branch in `useFrame`.
  - On a genuine in-game **spawn** — when the enter animation completes for a unit
    that mounted after the board was armed.
- **Initial board load must not clack.** Guards:
  - The gesture-gated `AudioContext` means nothing plays before first interaction.
  - Additionally, an "armed" flag (module-level in the audio layer, set true on
    the first user gesture / shortly after mount) gates spawn clacks so the
    initial roster placement is silent even if a gesture already happened.
  - The `initialized.current` first-set in `AnimatedUnit` already distinguishes
    the initial placement from real moves; only real move-arc completions clack.

### Turn cue — `src/components/pages/GameView.tsx`
- A `useEffect` beside the existing `document.title` "YOUR TURN" effect.
- Compute `needsMyAction = isMyInput || (isPlanning && canCommit)`.
- Rising-edge detector with a re-arm guard: chime when `needsMyAction` goes
  false→true, but ignore an off state shorter than ~400ms (prevents a double-ding
  if the flag flickers between back-to-back sub-prompts / server round-trips).
- Edge + guard logic lives in a small pure helper so it can be unit-tested.

### Mute control — HUD
- A small speaker-toggle button styled like the existing 3D HUD controls.
- Reads/writes `audioEngine` mute state; icon reflects muted/unmuted.

## Testing

- **Synth voices**: tuned by ear in the browser (matches the project's checkpoint
  rhythm — validate between commits). No assertions on Web Audio output.
- **Unit tests** (pure logic only):
  - Rising-edge + re-arm-guard detector: off→on fires once; sustained on does not
    re-fire; a sub-400ms off→on does not re-fire; a long off→on re-arms.
  - Mute persistence: `setMuted` writes localStorage; engine reads it on init;
    default is unmuted.

## Risk / open notes

- A synthesized clack can read as less "real" than a recorded wooden piece. The
  two-way door exists precisely to swap in samples if the synth can't be tuned to
  taste.
- Active-voice cap value (~6) and clack timing window (~80ms) are starting points
  to tune by ear.
- Chime volume must stay clearly below clack-storm peaks so a busy board never
  buries the cue, but the cue must not startle — tune by ear.
