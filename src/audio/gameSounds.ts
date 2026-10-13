// src/audio/gameSounds.ts
//
// The semantic layer trigger sites import. Maps game moments to the active bank
// and owns play-time policy (mute/arm gating, per-clack variation). Overlapping
// voices are kept under the ceiling by the master limiter in audioEngine, so
// every clack plays — none are dropped.
// To swap synth for samples later, change the `bank` import below — nothing else.

import { isArmed, isMuted } from "./audioEngine";
import { synthBank as bank } from "./soundBank";

/** A unit set down on the board (after a move) or popped in (a spawn). */
export function piecePlaced(): void {
  if (isMuted() || !isArmed()) return;
  // Per-hit variation so several pieces settling sound like several pieces.
  const detune = (Math.random() * 2 - 1) * 120; // cents
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

/** Another player pointed at a table location. */
export function pingCue(): void {
  // Like the turn cue, this is an explicit low-frequency interaction rather
  // than a load-time sound, so it does not need spawn arming.
  if (isMuted()) return;
  try {
    bank.playPing();
  } catch {
    // A locked or unavailable AudioContext must never prevent the visual ping
    // from reaching a receiving player.
  }
}
