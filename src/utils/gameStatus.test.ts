import { describe, expect, it } from "vitest";
import type { GameView } from "../types/game";
import { buildPlayerGameStatus, isMatchFrozen, resolveWaitingForNames } from "./gameStatus";

const base = {
  phase: "PLANNING",
  isPlayer: true,
  isMyInput: false,
  planningLocked: false,
  waitingForNames: [] as string[],
  committedCardNames: [] as string[],
  canCommitSecond: false,
  waitingForCommitNames: [] as string[],
};

const view = {
  current_actor_id: "hero_arien",
  teams: {
    RED: { heroes: [{ id: "hero_arien", name: "Arien" }, { id: "hero_bain", name: "Bain" }] },
    BLUE: { heroes: [{ id: "hero_wasp", name: "Wasp" }] },
  },
} as unknown as GameView;

describe("buildPlayerGameStatus", () => {
  it("guides an uncommitted player during planning", () => {
    expect(buildPlayerGameStatus(base)).toEqual({
      title: "Choose a card",
      detail: "Select from your hand, then commit",
      tone: "active",
    });
  });

  it("names the committed card and players still choosing", () => {
    expect(buildPlayerGameStatus({
      ...base,
      committedCardNames: ["Death Trap"],
      waitingForCommitNames: ["Garrus", "Bain"],
    })).toEqual({
      title: "Card locked in",
      detail: "Death Trap · Waiting for Garrus, Bain",
      tone: "locked",
    });
  });

  it("keeps Emmitt's second-card choice actionable", () => {
    expect(buildPlayerGameStatus({
      ...base,
      committedCardNames: ["Unstable Timeline"],
      canCommitSecond: true,
    })).toEqual({
      title: "First card locked in",
      detail: "Unstable Timeline · Choose a second card or play one card",
      tone: "active",
    });
  });

  it("makes the active resolver explicit to other players", () => {
    expect(buildPlayerGameStatus({
      ...base,
      phase: "RESOLUTION",
      waitingForNames: ["Dodger"],
    })).toEqual({
      title: "Dodger is choosing",
      detail: "Waiting for their decision",
      tone: "waiting",
    });
  });

  it("reads as plural when a decision is owed by several players", () => {
    expect(buildPlayerGameStatus({
      ...base,
      phase: "LEVEL_UP",
      waitingForNames: ["Dodger", "Bain"],
    })?.title).toBe("Dodger and Bain are choosing");
  });

  it("counts rather than lists once the group grows", () => {
    expect(buildPlayerGameStatus({
      ...base,
      phase: "LEVEL_UP",
      waitingForNames: ["Dodger", "Bain", "Wasp"],
    })?.title).toBe("3 players are choosing");
  });

  it("does not give planning instructions to spectators", () => {
    expect(buildPlayerGameStatus({
      ...base,
      isPlayer: false,
    })).toBeUndefined();
  });
});

describe("resolveWaitingForNames", () => {
  it("names the awaited player even when the current actor is someone else", () => {
    expect(resolveWaitingForNames({
      view,
      awaitingInput: ["hero_wasp"],
      myHeroId: "hero_bain",
    })).toEqual(["Wasp"]);
  });

  it("omits the viewer, who is prompted directly instead", () => {
    expect(resolveWaitingForNames({
      view,
      awaitingInput: ["hero_bain", "hero_wasp"],
      myHeroId: "hero_bain",
    })).toEqual(["Wasp"]);
  });

  it("falls back to the current actor when nothing is pending", () => {
    expect(resolveWaitingForNames({
      view,
      awaitingInput: [],
      myHeroId: "hero_bain",
    })).toEqual(["Arien"]);
  });

  it("ignores ids that name no hero, such as a team delegate", () => {
    expect(resolveWaitingForNames({
      view,
      awaitingInput: ["team:RED"],
      myHeroId: "hero_bain",
    })).toEqual([]);
  });
});

describe("isMatchFrozen", () => {
  const withStatus = (status: string | null) =>
    ({ clock: status ? { status } : null }) as unknown as GameView;

  it("freezes a consensus-paused match", () => {
    expect(isMatchFrozen(withStatus("PAUSED"))).toBe(true);
  });

  it("freezes a match suspended for inactivity", () => {
    expect(isMatchFrozen(withStatus("SUSPENDED_FOR_INACTIVITY"))).toBe(true);
  });

  it("freezes a timed match still waiting on its ready check", () => {
    expect(isMatchFrozen(withStatus("WAITING_FOR_PLAYERS"))).toBe(true);
  });

  it("does not freeze a running match", () => {
    expect(isMatchFrozen(withStatus("RUNNING"))).toBe(false);
  });

  it("does not freeze an untimed match, which has no clock", () => {
    expect(isMatchFrozen(withStatus(null))).toBe(false);
    expect(isMatchFrozen(null)).toBe(false);
  });
});
