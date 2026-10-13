import { useEffect, useMemo, useState } from "react";
import type { CardView, GameView } from "../types/game";

export interface CardGuessAttempt {
  attempt: number;
  guesserId: string;
  victimId: string;
  card: CardView | null;
  guessedColor: string | null;
  actualColor: string | null;
  correct: boolean | null;
}

export interface CardGuessRevealState {
  guesserId: string | null;
  attempts: CardGuessAttempt[];
}

export const EMPTY_CARD_GUESS_REVEAL: CardGuessRevealState = {
  guesserId: null,
  attempts: [],
};

/** How long a fully revealed guess stays on screen before it is dismissed. */
const FINAL_REVEAL_HOLD_MS = 8_000;

/**
 * Identity of the guess *content*, so an unrelated STATE_UPDATE (a unit
 * moving, a clock tick) does not look like new guess activity and restart the
 * dismissal timer.
 */
export function guessSignature(state: CardGuessRevealState | null): string {
  if (!state || state.attempts.length === 0) return "";
  return [
    state.guesserId,
    ...state.attempts.map((a) => `${a.attempt}:${a.card?.id ?? "?"}:${a.correct ?? "?"}`),
  ].join("|");
}

/** True once every recorded attempt has been flipped and resolved. */
export function isFullyRevealed(state: CardGuessRevealState | null): boolean {
  return (
    state !== null
    && state.attempts.length > 0
    && state.attempts.every((attempt) => attempt.correct !== null)
  );
}

/** Stand-in face for an attempt whose card is still facedown. */
export function hiddenGuessCard(attempt: CardGuessAttempt): CardView {
  return {
    id: `card_guess_hidden_${attempt.guesserId}_${attempt.victimId}_${attempt.attempt}`,
    name: "Chosen card",
    image_id: "",
    tier: "UNTIERED",
    color: null,
    primary_action: null,
    primary_action_value: null,
    secondary_actions: {},
    effect_id: null,
    effect_text: null,
    initiative: 0,
    state: "HAND",
    is_facedown: true,
    is_ranged: false,
    range_value: null,
    radius_value: null,
    item: null,
    is_active: false,
  };
}

/**
 * Project the server's guess state onto the shape the tray and the board
 * renderer consume. `view.card_guess` is the single source of truth: it is
 * republished with every mutation and is what a reconnecting client or a
 * late-joining spectator receives, so there is no event-derived copy to keep
 * in sync with it.
 */
export function cardGuessRevealFromView(view: GameView): CardGuessRevealState | null {
  const guess = view.card_guess;
  if (!guess) return null;
  return {
    guesserId: guess.guesser_id,
    attempts: guess.attempts.map((attempt) => ({
      attempt: attempt.attempt,
      guesserId: guess.guesser_id,
      victimId: attempt.victim_id,
      card: attempt.card,
      guessedColor: attempt.guessed_color,
      actualColor: attempt.actual_color,
      correct: attempt.correct,
    })),
  };
}

/**
 * The guess state to render.
 *
 * A guess waiting on a player stays up as long as the server publishes it —
 * it marks a live decision point. Once every attempt is revealed the tray is
 * dismissed after FINAL_REVEAL_HOLD_MS, without waiting for the server to drop
 * it: `view.card_guess` survives into the following hero's turn, which is
 * unbounded, so the client owns this window. Further guess activity produces a
 * new signature and starts a fresh one.
 */
export function useCardGuessReveal(view: GameView | null): CardGuessRevealState {
  const live = useMemo(() => (view ? cardGuessRevealFromView(view) : null), [view]);
  const signature = guessSignature(live);
  const revealed = isFullyRevealed(live);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    if (!revealed) return; // still waiting on a player — no expiry
    const timer = window.setTimeout(() => setDismissed(signature), FINAL_REVEAL_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [signature, revealed]);

  if (!live || dismissed === signature) return EMPTY_CARD_GUESS_REVEAL;
  return live;
}
