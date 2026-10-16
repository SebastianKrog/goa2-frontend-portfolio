import { describe, expect, it } from "vitest";
import type { InputRequest } from "../types/game";
import { buildGameControllerModel } from "./gameControllerModel";
import { card, clock, game } from "./__fixtures__/gameController";

function model(overrides: Partial<Parameters<typeof buildGameControllerModel>[0]> = {}) {
  return buildGameControllerModel({
    view: game(), myHeroId: "hero_own", inputRequest: null,
    awaitingInput: [], connected: true, heroName: (_id, name) => `Local ${name}`,
    ...overrides,
  });
}
const request = (player_id: string): InputRequest => ({
  request_id: "request-one", type: "SELECT_HEX", player_id, prompt: "Choose",
});

describe("shared game controller model", () => {
  it("handles loading and spectator views without manufacturing an owned hero or cards", () => {
    const loading = model({ view: null, myHeroId: null });
    expect(loading.myHero).toBeNull();
    expect(loading.isMyInput).toBe(false);
    expect(loading.canCommit).toBe(false);
    const view = game();
    const original = JSON.stringify(view);
    const spectator = model({ view, myHeroId: null });
    expect(spectator.myTeam).toBeNull();
    expect(spectator.committedCards).toEqual([]);
    expect(spectator.playerStatus).toBeUndefined();
    expect(view.teams.BLUE.heroes[0].deck).toEqual({ count: 5 });
    expect(JSON.stringify(view)).toBe(original);
  });

  it.each([
    ["hero_own", true], ["hero_ally", false], ["hero_other", false],
    ["team:RED", true], ["team:BLUE", false],
  ])("assigns ownership for %s independently of the renderer", (id, expected) => {
    expect(model({ inputRequest: request(id) }).isMyInput).toBe(expected);
    expect(model({ inputRequest: request(id), myHeroId: null }).isMyInput).toBe(false);
  });

  it.each(["PAUSED", "WAITING_FOR_PLAYERS", "SUSPENDED_FOR_INACTIVITY"] as const)("suppresses decisions and starting moves during %s", (status) => {
    const view = game();
    view.clock = clock(status);
    view.starting_position = { destinations: [], swap_targets: [], requests: [] };
    const result = model({ view, inputRequest: request("hero_own") });
    expect(result.frozen).toBe(true);
    expect(result.isMyInput).toBe(false);
    expect(result.startingPosition).toBeNull();
    expect(result.canRequestPause).toBe(false);
    expect(model({ view, inputRequest: { ...request("hero_own"), type: "UPGRADE_PHASE", players: {} } }).isMyUpgradePhase).toBe(false);
  });

  it("uses scoped simultaneous upgrade requests and public waiting IDs", () => {
    const view = game();
    view.phase = "LEVEL_UP";
    const result = model({ view, inputRequest: {
      ...request("simultaneous"), type: "UPGRADE_PHASE",
      players: { hero_own: { remaining: 2, options: [] } },
    }, awaitingInput: ["hero_own", "hero_other"] });
    expect(result.isMyInput).toBe(false);
    expect(result.isMyUpgradePhase).toBe(true);
    expect(result.waitingForNames).toEqual(["Local hero_other"]);
    expect(result.waitingTitle).toBe("Local hero_other is choosing");
    expect(model({ view, myHeroId: null, inputRequest: null }).isMyUpgradePhase).toBe(false);
  });

  it("adapts off-board options without changing the original request or request identity", () => {
    const input = { ...request("hero_own"), type: "SELECT_UNIT", valid_options: ["limbo"], can_rollback: true };
    const result = model({ inputRequest: input });
    expect(result.effectiveInputRequest).toMatchObject({
      request_id: "request-one", type: "SELECT_OPTION", options: [{ id: "limbo", text: "limbo" }], can_rollback: true,
    });
    expect(input.type).toBe("SELECT_UNIT");
    expect(input).not.toHaveProperty("options");
  });

  it("preserves two-card ordering, second-commit availability, and timeout restrictions", () => {
    const view = game();
    const own = view.teams.RED.heroes[0];
    own.extra_turn_card = card("first");
    own.current_turn_card = card("second");
    own.can_commit_second_card = true;
    const result = model({ view });
    expect(result.committedCardNames).toEqual(["first", "second"]);
    expect(result.canCommitSecond).toBe(true);
    expect(result.canCommit).toBe(true);
    expect(result.canUncommit).toBe(true);
    view.clock = clock("RUNNING", true);
    expect(model({ view })).toMatchObject({ planningLocked: true, canCommit: false, canUncommit: false });
  });

  it("shares starting-position and pause availability without coupling to layout", () => {
    const view = game();
    view.clock = clock();
    view.starting_position = { destinations: [{ q: 0, r: 0, s: 0 }], swap_targets: [], requests: [] };
    expect(model({ view }).startingPosition).toBe(view.starting_position);
    expect(model({ view }).canRequestPause).toBe(true);
    expect(model({ view, connected: false }).startingPosition).toBeNull();
    expect(model({ view, myHeroId: null }).canRequestPause).toBe(false);
  });
});
