import { describe, expect, it } from "vitest";
import type { GameView } from "../types/game";
import {
  advancePick,
  describePick,
  overridePickRequest,
  startPick,
  type OverridePick,
} from "./overridePick";

const view = {
  teams: {},
  tokens: [],
  board: {
    map: "forgotten_island",
    tiles: {
      "0,0,0": { hex: { q: 0, r: 0, s: 0 }, zone_id: "z1", is_terrain: false, occupant_id: "hero_arien", spawn_point: null },
      "1,-1,0": { hex: { q: 1, r: -1, s: 0 }, zone_id: "z1", is_terrain: false, occupant_id: null, spawn_point: null },
    },
    zones: {},
    entity_locations: {
      hero_arien: { q: 0, r: 0, s: 0 },
    },
  },
} as unknown as GameView;

describe("overridePickRequest", () => {
  it("entity stage offers every on-board entity as selectable", () => {
    const pick: OverridePick = { op: "move_entity", stage: "entity" };
    const req = overridePickRequest(pick, view);
    expect(req?.type).toBe("SELECT_UNIT_OR_TOKEN");
    expect(req?.valid_options).toEqual(["hero_arien"]);
    expect(req?.player_id).toBe("override");
  });

  it("hex stage offers every tile", () => {
    const pick: OverridePick = { op: "move_entity", stage: "hex", entityId: "hero_arien" };
    const req = overridePickRequest(pick, view);
    expect(req?.type).toBe("SELECT_HEX");
    expect(req?.valid_hexes).toHaveLength(2);
  });

  it("remove_entity has no hex stage", () => {
    const done = advancePick({ op: "remove_entity", stage: "entity" }, "minion_3");
    expect(done).toEqual({ op: "remove_entity", proposal: { entity_id: "minion_3" } });
  });

  it("move_entity chains entity -> hex -> proposal", () => {
    const afterEntity = advancePick(startPick("move_entity"), "hero_arien");
    expect(afterEntity).toEqual({ op: "move_entity", stage: "hex", entityId: "hero_arien" });
    const done = advancePick(afterEntity as OverridePick, { q: 1, r: -1, s: 0 });
    expect(done).toEqual({
      op: "move_entity",
      proposal: { entity_id: "hero_arien", hex: { q: 1, r: -1, s: 0 } },
    });
  });

  it("place_entity starts at the hex stage with a preselected entity", () => {
    const pick = startPick("place_entity", "minion_9");
    expect(pick).toEqual({ op: "place_entity", stage: "hex", entityId: "minion_9" });
    const done = advancePick(pick, { q: 1, r: -1, s: 0 });
    expect(done).toEqual({
      op: "place_entity",
      proposal: { entity_id: "minion_9", hex: { q: 1, r: -1, s: 0 } },
    });
  });

  it("describePick names the stage", () => {
    expect(describePick({ op: "move_entity", stage: "entity" })).toMatch(/unit|entity/i);
    expect(describePick({ op: "move_entity", stage: "hex", entityId: "x" })).toMatch(/hex|destination/i);
  });
});
