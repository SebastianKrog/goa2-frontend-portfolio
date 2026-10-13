import { describe, expect, it } from "vitest";
import type { GameClockView, PlayerClockView } from "../types/game";
import { bankMs, formatClock, projectClock } from "./useSynchronizedClock";

function player(overrides: Partial<PlayerClockView> = {}): PlayerClockView {
  return {
    planning_allowance_ms: 0,
    resolution_allowance_ms: 0,
    initiative_bonus_ms: 0,
    response_time_ms: 0,
    upgrade_allowance_ms: 0,
    time_bank_ms: 0,
    overrun_ms: 0,
    planning_complete: false,
    planning_locked_by_timeout: false,
    running: true,
    ...overrides,
  };
}

function clock(overrides: Partial<GameClockView> = {}): GameClockView {
  return {
    status: "RUNNING",
    enforce_timeouts: true,
    server_now_ms: 0,
    turn_key: { round: 1, turn: 1 },
    ready_hero_ids: [],
    pause: null,
    active: { kind: "PLANNING", request_id: null, hero_ids: ["hero_a"] },
    players: { hero_a: player() },
    ...overrides,
  };
}

describe("formatClock", () => {
  it("renders sub-ten-second values with a decimal", () => {
    expect(formatClock(4_200)).toBe("4.2s");
  });

  it("renders longer values as minutes and seconds", () => {
    expect(formatClock(90_000)).toBe("1:30");
  });

  it("signs an overrun instead of clamping it at zero", () => {
    expect(formatClock(-4_200)).toBe("-4.2s");
    expect(formatClock(-90_000)).toBe("-1:30");
  });
});

describe("bankMs", () => {
  it("is the bank while a hero still has time", () => {
    expect(bankMs(player({ time_bank_ms: 30_000 }))).toBe(30_000);
  });

  it("goes negative by the overrun", () => {
    expect(bankMs(player({ time_bank_ms: 0, overrun_ms: 12_000 }))).toBe(-12_000);
  });
});

describe("projectClock", () => {
  it("drains the pools in order and stops at zero when enforcing", () => {
    const projected = projectClock(
      clock({ players: { hero_a: player({ planning_allowance_ms: 5_000, time_bank_ms: 2_000 }) } }),
      20_000,
    );
    const result = projected.players.hero_a;
    expect(result.planning_allowance_ms).toBe(0);
    expect(result.time_bank_ms).toBe(0);
    expect(result.overrun_ms).toBe(0);
    expect(bankMs(result)).toBe(0);
  });

  it("banks the excess as an overrun when the clocks are advisory", () => {
    const projected = projectClock(
      clock({
        enforce_timeouts: false,
        players: { hero_a: player({ planning_allowance_ms: 5_000, time_bank_ms: 2_000 }) },
      }),
      20_000,
    );
    const result = projected.players.hero_a;
    expect(result.time_bank_ms).toBe(0);
    expect(result.overrun_ms).toBe(13_000);
    expect(bankMs(result)).toBe(-13_000);
  });

  it("leaves the authoritative snapshot untouched", () => {
    const original = clock({
      enforce_timeouts: false,
      players: { hero_a: player({ planning_allowance_ms: 5_000 }) },
    });
    projectClock(original, 20_000);
    expect(original.players.hero_a.planning_allowance_ms).toBe(5_000);
    expect(original.players.hero_a.overrun_ms).toBe(0);
  });

  it("spends the Initiative Bonus before the Resolution allowance", () => {
    const projected = projectClock(
      clock({
        active: { kind: "RESOLUTION", request_id: "r1", hero_ids: ["hero_a"] },
        players: {
          hero_a: player({
            initiative_bonus_ms: 15_000,
            resolution_allowance_ms: 45_000,
            time_bank_ms: 10_000,
          }),
        },
      }),
      20_000,
    );
    const result = projected.players.hero_a;
    expect(result.initiative_bonus_ms).toBe(0);
    expect(result.resolution_allowance_ms).toBe(40_000); // only 5s of it
    expect(result.time_bank_ms).toBe(10_000); // untouched
  });

  it("keeps the Initiative Bonus out of a Response prompt", () => {
    const projected = projectClock(
      clock({
        active: { kind: "RESPONSE", request_id: "r1", hero_ids: ["hero_a"] },
        players: {
          hero_a: player({
            initiative_bonus_ms: 15_000,
            response_time_ms: 5_000,
            resolution_allowance_ms: 45_000,
          }),
        },
      }),
      20_000,
    );
    const result = projected.players.hero_a;
    expect(result.initiative_bonus_ms).toBe(15_000); // not spendable here
    expect(result.response_time_ms).toBe(0);
    expect(result.resolution_allowance_ms).toBe(30_000);
  });

  it("charges nobody while the match is paused", () => {
    const paused = clock({ status: "PAUSED", enforce_timeouts: false });
    expect(projectClock(paused, 20_000)).toBe(paused);
  });
});
