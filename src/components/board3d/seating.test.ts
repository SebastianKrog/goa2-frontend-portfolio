import { describe, expect, it } from "vitest";
import {
  BOARD_HALF_DEPTH,
  MAP_HALF_WIDTH,
  MIN_TABLE_HALF_EXTENT,
  TURN_CARD_WIDTH,
  heroesByTeam,
  nextPlayerBoardLayout,
  parsePlayerBoardLayout,
  seatPlacements,
  tableHalfExtent,
  turnCardStripSlots,
} from "./seating";
import type { GameView, HeroView } from "../../types/game";

const hero = (id: string, team: string): HeroView =>
  ({
    id,
    name: id,
    title: "",
    team,
    level: 1,
    gold: 0,
    items: {},
    hand: [],
    deck: { count: 0 },
    played_cards: [],
    current_turn_card: null,
    extra_turn_card: null,
    can_commit_second_card: false,
    discard_pile: [],
    ultimate_card: null,
  });

/** A view with `red` heroes r0..r{n-1} and `blue` heroes b0..b{m-1}. */
const view = (reds: number, blues: number): GameView =>
  ({
    teams: {
      red: {
        color: "red",
        life_counters: 0,
        minions: [],
        heroes: Array.from({ length: reds }, (_, i) => hero(`r${i}`, "red")),
      },
      blue: {
        color: "blue",
        life_counters: 0,
        minions: [],
        heroes: Array.from({ length: blues }, (_, i) => hero(`b${i}`, "blue")),
      },
    },
  }) as unknown as GameView;

const ids = (placements: ReturnType<typeof seatPlacements>) =>
  placements.map((p) => p.hero.id);

describe("seatPlacements — shared behaviour", () => {
  it("returns nothing without a view", () => {
    expect(seatPlacements(null, "r0", "interleaved")).toEqual([]);
  });

  it("seats every hero exactly once", () => {
    for (const layout of ["interleaved", "grouped", "rows"] as const) {
      const seated = ids(seatPlacements(view(5, 5), "r0", layout));
      expect(new Set(seated).size, layout).toBe(10);
    }
  });

  it("puts your hero first so it takes the near seat", () => {
    for (const layout of ["interleaved", "grouped", "rows"] as const) {
      expect(ids(seatPlacements(view(3, 3), "r2", layout))[0], layout).toBe("r2");
    }
  });
});

describe("seatPlacements — ring layouts", () => {
  it("alternates teams around the ring when interleaved", () => {
    const seated = ids(seatPlacements(view(3, 3), "r0", "interleaved"));
    expect(seated).toEqual(["r0", "b0", "r1", "b1", "r2", "b2"]);
  });

  it("keeps your team contiguous when grouped", () => {
    const seated = ids(seatPlacements(view(3, 3), "r0", "grouped"));
    expect(seated).toEqual(["r0", "r1", "b0", "b1", "b2", "r2"]);
  });

  it("places ring seats on a circle facing the centre", () => {
    const placements = seatPlacements(view(2, 2), "r0", "interleaved");
    for (const p of placements) {
      const radius = Math.hypot(p.position[0], p.position[2]);
      expect(radius).toBeCloseTo(8, 6);
      expect(p.position[0]).toBeCloseTo(radius * Math.sin(p.rotationY), 6);
      expect(p.position[2]).toBeCloseTo(radius * Math.cos(p.rotationY), 6);
    }
  });

  it("shrinks the boards once the ring holds more than six", () => {
    expect(seatPlacements(view(3, 3), "r0", "interleaved")[0].scale).toBe(1);
    expect(seatPlacements(view(5, 5), "r0", "interleaved")[0].scale).toBeLessThan(1);
  });
});

describe("seatPlacements — rows layout", () => {
  const near = (v: GameView) =>
    seatPlacements(v, "r0", "rows").filter((p) => p.hero.team === "red");
  const far = (v: GameView) =>
    seatPlacements(v, "r0", "rows").filter((p) => p.hero.team === "blue");

  it("puts your team on the near half and the enemy on the far half", () => {
    const placements = seatPlacements(view(5, 5), "r0", "rows");
    for (const p of placements) {
      expect(p.position[2] > 0, p.hero.id).toBe(p.hero.team === "red");
    }
  });

  it("seats your hero at the centre of the near row", () => {
    const you = seatPlacements(view(5, 5), "r0", "rows")[0];
    expect(you.hero.id).toBe("r0");
    expect(you.position[0]).toBeCloseTo(0, 6);
    expect(you.rotationY).toBeCloseTo(0, 6);
  });

  it("fills a row outward from the centre", () => {
    expect(near(view(1, 1)).map((p) => p.position[0])).toEqual([0]);
    const three = near(view(3, 3)).map((p) => p.position[0]);
    expect(three[0]).toBeCloseTo(0, 6);
    expect(three[1]).toBeCloseTo(-three[2], 6);
    expect(Math.abs(three[1])).toBeGreaterThan(0);
  });

  it("centres a two-seat row around the map", () => {
    const two = near(view(2, 2)).map((p) => p.position[0]).sort((a, b) => a - b);
    expect(two[0]).toBeLessThan(0);
    expect(two[1]).toBeGreaterThan(0);
    expect(two[0]).toBeCloseTo(-two[1], 6);
  });

  it("keeps both teams on opposite rows for a spectator or replay", () => {
    for (const count of [2, 3, 4, 5]) {
      const placements = seatPlacements(view(count, count), null, "rows");
      const red = placements.filter((p) => p.hero.team === "red");
      const blue = placements.filter((p) => p.hero.team === "blue");
      expect(red).toHaveLength(count);
      expect(blue).toHaveLength(count);
      expect(new Set(red.map((p) => Math.sign(p.position[2]))).size).toBe(1);
      expect(new Set(blue.map((p) => Math.sign(p.position[2]))).size).toBe(1);
      expect(Math.sign(red[0].position[2])).not.toBe(Math.sign(blue[0].position[2]));
    }
  });

  it("holds a row at one depth and mirrors it across the map", () => {
    const nearZ = near(view(3, 3)).map((p) => p.position[2]);
    const farZ = far(view(3, 3)).map((p) => p.position[2]);
    expect(new Set(nearZ.map((z) => z.toFixed(6))).size).toBe(1);
    expect(farZ[0]).toBeCloseTo(-nearZ[0], 6);
  });

  it("turns the far row to face back across the map", () => {
    for (const p of far(view(3, 3))) expect(p.rotationY).toBeCloseTo(Math.PI, 6);
  });

  it("moves the fourth and fifth of a team onto the flanks", () => {
    const flanks = near(view(5, 5)).slice(3);
    expect(flanks).toHaveLength(2);
    expect(Math.abs(flanks[0].position[0])).toBeCloseTo(Math.abs(flanks[1].position[0]), 6);
    expect(flanks[0].position[0]).toBeCloseTo(-flanks[1].position[0], 6);
    for (const p of flanks) {
      expect(Math.abs(p.rotationY)).toBeCloseTo(Math.PI / 2, 6);
      expect(Math.abs(p.position[2])).toBeLessThan(Math.abs(near(view(5, 5))[0].position[2]));
    }
  });

  it("faces each flank toward the map", () => {
    for (const p of near(view(5, 5)).slice(3)) {
      // A mat's local -y axis points where it faces; rotationY spins it about y.
      const facingX = -Math.sin(p.rotationY);
      expect(Math.sign(facingX), `${p.hero.id} faces inward`).toBe(-Math.sign(p.position[0]));
    }
  });

  it("keeps boards full size — rows fit ten without shrinking", () => {
    for (const p of seatPlacements(view(5, 5), "r0", "rows")) expect(p.scale).toBe(1);
  });

  it("leaves room between neighbours for each board's satellites", () => {
    const xs = near(view(3, 3))
      .map((p) => p.position[0])
      .sort((a, b) => a - b);
    expect(xs[1] - xs[0]).toBeGreaterThanOrEqual(7.4);
  });
});

describe("nextPlayerBoardLayout", () => {
  it("cycles through every layout and back", () => {
    expect(nextPlayerBoardLayout("interleaved")).toBe("grouped");
    expect(nextPlayerBoardLayout("grouped")).toBe("rows");
    expect(nextPlayerBoardLayout("rows")).toBe("interleaved");
  });
});

describe("parsePlayerBoardLayout", () => {
  it("accepts every layout it can store", () => {
    expect(parsePlayerBoardLayout("grouped")).toBe("grouped");
    expect(parsePlayerBoardLayout("rows")).toBe("rows");
    expect(parsePlayerBoardLayout("interleaved")).toBe("interleaved");
  });

  it("falls back to the tabletop layout for anything it does not recognise", () => {
    expect(parsePlayerBoardLayout(null)).toBe("rows");
    expect(parsePlayerBoardLayout("rows")).toBe("rows");
  });
});

describe("turnCardStripSlots", () => {
  const slots = (reds: number, blues: number) =>
    turnCardStripSlots(seatPlacements(view(reds, blues), "r0", "rows"));

  it("holds a slot for every hero, committed or not", () => {
    expect(slots(5, 5).map((s) => s.hero.id)).toEqual([
      "r0", "r1", "r2", "r3", "r4", "b0", "b1", "b2", "b3", "b4",
    ]);
  });

  it("splits the teams into two columns", () => {
    const xs = slots(3, 3).map((s) => s.position[0]);
    expect(new Set(xs.slice(0, 3)).size).toBe(1);
    expect(new Set(xs.slice(3)).size).toBe(1);
    expect(xs[0]).not.toBe(xs[3]);
  });

  it("gives your team the column further from the map", () => {
    const xs = slots(3, 3).map((s) => s.position[0]);
    expect(Math.abs(xs[0])).toBeGreaterThan(Math.abs(xs[3]));
  });

  it("stacks a column along z, centred on the map", () => {
    const zs = slots(5, 5).slice(0, 5).map((s) => s.position[2]);
    expect(zs.reduce((a, b) => a + b, 0)).toBeCloseTo(0, 6);
    for (let i = 1; i < zs.length; i++) {
      expect(zs[i] - zs[i - 1]).toBeCloseTo(zs[1] - zs[0], 6);
    }
  });

  it("sits clear of the map so it never covers the board", () => {
    for (const s of slots(5, 5)) {
      expect(Math.abs(s.position[0])).toBeGreaterThan(MAP_HALF_WIDTH);
    }
  });

  it("sits clear of the flank boards it is wedged between", () => {
    const flanks = seatPlacements(view(5, 5), "r0", "rows").filter(
      (p) => Math.abs(p.rotationY) === Math.PI / 2,
    );
    expect(flanks.length).toBeGreaterThan(0);
    const nearestFlankEdge = Math.min(
      ...flanks.map((p) => Math.abs(p.position[0]) - BOARD_HALF_DEPTH),
    );
    for (const s of slots(5, 5)) {
      expect(Math.abs(s.position[0]) + TURN_CARD_WIDTH / 2).toBeLessThan(nearestFlankEdge);
    }
  });
});

describe("heroesByTeam", () => {
  it("puts your team first, with you at its head", () => {
    const { own, other } = heroesByTeam(view(3, 3), "r2");
    expect(own.map((h) => h.id)).toEqual(["r2", "r0", "r1"]);
    expect(other.map((h) => h.id)).toEqual(["b0", "b1", "b2"]);
  });

  it("leaves everyone on the far side for a spectator", () => {
    const { own, other } = heroesByTeam(view(2, 2), null);
    expect(own).toEqual([]);
    expect(other.map((h) => h.id)).toEqual(["b0", "b1", "r0", "r1"]);
  });
});

describe("tableHalfExtent", () => {
  it("never shrinks below the table the small games already use", () => {
    const placements = seatPlacements(view(1, 1), "r0", "rows");
    expect(tableHalfExtent(placements, 1)).toBe(MIN_TABLE_HALF_EXTENT);
  });

  it("grows to clear the furthest seat and everything laid out around it", () => {
    const placements = seatPlacements(view(5, 5), "r0", "rows");
    const furthest = Math.max(
      ...placements.map((p) => Math.max(Math.abs(p.position[0]), Math.abs(p.position[2]))),
    );
    expect(tableHalfExtent(placements, 4.4)).toBeCloseTo(furthest + 4.4, 6);
  });

  it("shrinks a scaled-down board's reach along with the board", () => {
    const placements = seatPlacements(view(5, 5), "r0", "interleaved");
    const scale = placements[0].scale;
    expect(scale).toBeLessThan(1);
    const furthest = Math.max(
      ...placements.map((p) => Math.max(Math.abs(p.position[0]), Math.abs(p.position[2]))),
    );
    expect(tableHalfExtent(placements, 8)).toBeCloseTo(furthest + 8 * scale, 6);
  });

  it("keeps an empty table at its normal size", () => {
    expect(tableHalfExtent([], 4.4)).toBe(MIN_TABLE_HALF_EXTENT);
  });
});
