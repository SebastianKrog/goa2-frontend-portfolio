import { describe, expect, it } from "vitest";
import type { CardView, GameView } from "../types/game";
import {
  cardGuessRevealFromView,
  guessSignature,
  hiddenGuessCard,
  isFullyRevealed,
} from "./useCardGuessReveal";

const revealedCard: CardView = {
  id: "red_card",
  name: "Red Card",
  image_id: "RedIA",
  tier: "I",
  color: "RED",
  primary_action: "ATTACK",
  primary_action_value: 3,
  secondary_actions: { HOLD: 0 },
  effect_id: "red_card",
  effect_text: "",
  initiative: 7,
  state: "HAND",
  is_facedown: false,
  is_ranged: false,
  range_value: 1,
  radius_value: null,
  item: null,
  is_active: false,
};

function viewWithGuess(guess: GameView["card_guess"]): GameView {
  return { card_guess: guess } as GameView;
}

describe("cardGuessRevealFromView", () => {
  it("returns null when no guess is in progress", () => {
    expect(cardGuessRevealFromView(viewWithGuess(null))).toBeNull();
    expect(cardGuessRevealFromView({} as GameView)).toBeNull();
  });

  it("keeps a revealed first attempt alongside a facedown repeat", () => {
    const reveal = cardGuessRevealFromView(
      viewWithGuess({
        guesser_id: "hero_bain",
        attempts: [
          {
            attempt: 1,
            victim_id: "hero_enemy",
            card: revealedCard,
            guessed_color: "BLUE",
            actual_color: "RED",
            correct: false,
          },
          {
            attempt: 2,
            victim_id: "hero_enemy",
            card: null,
            guessed_color: null,
            actual_color: null,
            correct: null,
          },
        ],
      }),
    );

    expect(reveal?.guesserId).toBe("hero_bain");
    expect(reveal?.attempts).toHaveLength(2);
    expect(reveal?.attempts[0]).toMatchObject({
      attempt: 1,
      guesserId: "hero_bain",
      victimId: "hero_enemy",
      card: revealedCard,
      guessedColor: "BLUE",
      actualColor: "RED",
      correct: false,
    });
    expect(reveal?.attempts[1].card).toBeNull();
  });
});

const pendingAttempt = {
  attempt: 1,
  guesserId: "hero_bain",
  victimId: "hero_enemy",
  card: null,
  guessedColor: null,
  actualColor: null,
  correct: null,
};
const revealedAttempt = {
  ...pendingAttempt,
  card: revealedCard,
  guessedColor: "BLUE",
  actualColor: "RED",
  correct: false,
};

describe("isFullyRevealed", () => {
  it("is false while any attempt is still facedown", () => {
    expect(isFullyRevealed(null)).toBe(false);
    expect(isFullyRevealed({ guesserId: "hero_bain", attempts: [] })).toBe(false);
    expect(
      isFullyRevealed({ guesserId: "hero_bain", attempts: [pendingAttempt] }),
    ).toBe(false);
    expect(
      isFullyRevealed({
        guesserId: "hero_bain",
        attempts: [revealedAttempt, { ...pendingAttempt, attempt: 2 }],
      }),
    ).toBe(false);
  });

  it("is true once every attempt is resolved", () => {
    expect(
      isFullyRevealed({ guesserId: "hero_bain", attempts: [revealedAttempt] }),
    ).toBe(true);
  });
});

describe("guessSignature", () => {
  it("ignores unrelated state churn so the dismissal timer is not restarted", () => {
    const state = { guesserId: "hero_bain", attempts: [revealedAttempt] };
    const rebuilt = { guesserId: "hero_bain", attempts: [{ ...revealedAttempt }] };

    expect(guessSignature(state)).toBe(guessSignature(rebuilt));
    expect(guessSignature(null)).toBe("");
  });

  it("changes when the guess actually progresses", () => {
    const pending = guessSignature({ guesserId: "hero_bain", attempts: [pendingAttempt] });
    const resolved = guessSignature({ guesserId: "hero_bain", attempts: [revealedAttempt] });
    const repeat = guessSignature({
      guesserId: "hero_bain",
      attempts: [revealedAttempt, { ...pendingAttempt, attempt: 2 }],
    });

    expect(new Set([pending, resolved, repeat]).size).toBe(3);
  });
});

describe("hiddenGuessCard", () => {
  it("gives each attempt a distinct facedown stand-in", () => {
    const base = {
      guesserId: "hero_bain",
      victimId: "hero_enemy",
      card: null,
      guessedColor: null,
      actualColor: null,
      correct: null,
    };
    const first = hiddenGuessCard({ ...base, attempt: 1 });
    const second = hiddenGuessCard({ ...base, attempt: 2 });

    expect(first.is_facedown).toBe(true);
    expect(first.id).not.toBe(second.id);
  });
});
