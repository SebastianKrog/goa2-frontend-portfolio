import { describe, expect, it } from "vitest";
import type { GameView, InputRequest } from "../types/game";
import { offBoardUnitOptions } from "./offBoardUnitChoice";

function makeView(occupants: Record<string, string | null>): GameView {
  const tiles = Object.fromEntries(
    Object.entries(occupants).map(([id, occupant_id], i) => [
      id,
      { hex: { q: i, r: -i, s: 0 }, zone_id: "z1", is_terrain: false, occupant_id, spawn_point: null },
    ]),
  );
  return {
    board: { map: "forgotten_island", tiles, zones: {}, entity_locations: {} },
    tokens: [],
    teams: {
      BLUE: {
        color: "BLUE",
        life_counters: 5,
        heroes: [],
        minions: [
          { id: "minion_blue_melee_1", type: "MELEE", team: "BLUE", value: 2, is_heavy: false },
          { id: "minion_blue_melee_2", type: "MELEE", team: "BLUE", value: 2, is_heavy: false },
          { id: "minion_blue_heavy_1", type: "HEAVY", team: "BLUE", value: 4, is_heavy: true },
        ],
      },
    },
  } as unknown as GameView;
}

const request = (valid_options: string[]): InputRequest =>
  ({
    type: "SELECT_UNIT",
    player_id: "hero_blue_1",
    prompt: "Team BLUE, choose which displaced unit to place first.",
    valid_options,
  }) as unknown as InputRequest;

describe("offBoardUnitOptions", () => {
  it("offers options when every displaced unit is off the board", () => {
    const view = makeView({ a: null, b: null });
    const opts = offBoardUnitOptions(view, request(["minion_blue_melee_1", "minion_blue_heavy_1"]));
    expect(opts).toEqual([
      { id: "minion_blue_melee_1", text: "Melee (2)" },
      { id: "minion_blue_heavy_1", text: "Heavy (4)" },
    ]);
  });

  it("disambiguates identical minions so the two options are distinguishable", () => {
    const view = makeView({ a: null });
    const opts = offBoardUnitOptions(view, request(["minion_blue_melee_1", "minion_blue_melee_2"]));
    expect(opts?.map((o) => o.text)).toEqual(["Melee (2)", "Melee (2) #2"]);
  });

  it("defers to the board when any candidate is on it", () => {
    const view = makeView({ a: "minion_blue_melee_1", b: null });
    expect(offBoardUnitOptions(view, request(["minion_blue_melee_1", "minion_blue_heavy_1"]))).toBeNull();
  });

  it("ignores requests that are not unit selections", () => {
    const view = makeView({ a: null });
    const hexRequest = { ...request(["minion_blue_melee_1"]), type: "SELECT_HEX" } as InputRequest;
    expect(offBoardUnitOptions(view, hexRequest)).toBeNull();
  });

  it("falls back to the raw id for a unit missing from the view", () => {
    const view = makeView({ a: null });
    expect(offBoardUnitOptions(view, request(["minion_ghost"]))).toEqual([
      { id: "minion_ghost", text: "minion_ghost" },
    ]);
  });
});
