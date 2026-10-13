import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GameClockView, HeroView, PlayerClockView } from "../../types/game";
import { MatchClocks } from "./MatchClocks";

const heroes = [{ id: "hero_a", name: "Arien" }] as unknown as HeroView[];

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

function render(
  clockOverrides: Partial<GameClockView>,
  playerOverrides: Partial<PlayerClockView> = {},
  phase = "PLANNING",
) {
  const clock: GameClockView = {
    status: "RUNNING",
    enforce_timeouts: true,
    server_now_ms: 0,
    turn_key: { round: 1, turn: 1 },
    ready_hero_ids: [],
    pause: null,
    active: { kind: "PLANNING", request_id: null, hero_ids: ["hero_a"] },
    players: { hero_a: player(playerOverrides) },
    ...clockOverrides,
  };
  return renderToStaticMarkup(<MatchClocks heroes={heroes} clock={clock} phase={phase} />);
}

describe("MatchClocks", () => {
  it("shows the remaining bank", () => {
    expect(render({}, { time_bank_ms: 90_000 })).toContain("1:30");
  });

  it("shows an overrun as a negative bank", () => {
    const html = render({ enforce_timeouts: false }, { overrun_ms: 90_000 });
    expect(html).toContain("-1:30");
  });

  it("shows the Initiative Bonus only to the hero holding it", () => {
    const holder = render(
      { active: { kind: "RESOLUTION", request_id: "r1", hero_ids: ["hero_a"] } },
      { initiative_bonus_ms: 15_000, resolution_allowance_ms: 45_000 },
      "RESOLUTION",
    );
    expect(holder).toContain("<small>Bonus</small>");
    const other = render(
      { active: { kind: "RESOLUTION", request_id: "r1", hero_ids: ["hero_a"] } },
      { initiative_bonus_ms: 0, resolution_allowance_ms: 45_000 },
      "RESOLUTION",
    );
    expect(other).not.toContain("<small>Bonus</small>");
  });

  it("never shows an overrun as time remaining", () => {
    const html = render({ enforce_timeouts: false }, { overrun_ms: 4_000 });
    expect(html).toContain("-4.0s");
    expect(html).not.toContain(">4.0s<");
  });
});
