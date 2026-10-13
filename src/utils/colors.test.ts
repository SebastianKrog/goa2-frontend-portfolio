import { describe, expect, it } from "vitest";
import { UNKNOWN_ZONE_COLOR, zoneColor } from "./colors";

// Zone ids and their adjacency, derived from the backend map data
// (goa2-backend/src/goa2/data/maps/*.json). Two rules hold on every map:
// every zone gets a real colour, and no two touching zones share one — the fill
// is the only thing drawing a zone boundary, so a repeat merges them visually.
const MAP_ADJACENCY: Record<string, Array<[string, string]>> = {
  forgotten_island: [
    ["BlueBase", "BlueBeach"], ["BlueBase", "BlueJungle"], ["BlueBeach", "Mid"],
    ["BlueJungle", "Mid"], ["Mid", "RedBeach"], ["Mid", "RedJungle"],
    ["RedBase", "RedBeach"], ["RedBase", "RedJungle"],
  ],
  narrow_passages: [
    ["BlueBase", "BlueBeach"], ["BlueBeach", "BlueJungle"], ["BlueBeach", "Mid"],
    ["BlueJungle", "Mid"], ["Mid", "RedBeach"], ["Mid", "RedJungle"],
    ["RedBase", "RedBeach"], ["RedBeach", "RedJungle"],
  ],
  vexing_cliffs: [
    ["BlueBase", "BlueBeach"], ["BlueBase", "BlueJungle2"], ["BlueBeach", "BlueJungle1"],
    ["BlueBeach", "BlueJungle2"], ["BlueBeach", "Mid"], ["BlueJungle1", "RedJungle2"],
    ["BlueJungle2", "Mid"], ["BlueJungle2", "RedJungle1"], ["Mid", "RedBeach"],
    ["Mid", "RedJungle2"], ["RedBase", "RedBeach"], ["RedBase", "RedJungle2"],
    ["RedBeach", "RedJungle1"], ["RedBeach", "RedJungle2"],
  ],
  vexing_cliffs_v2: [
    ["BlueBase", "BlueBeach"], ["BlueBase", "BlueJungle1"], ["BlueBeach", "BlueJungle1"],
    ["BlueBeach", "BlueJungle2"], ["BlueBeach", "Mid"], ["BlueJungle1", "Mid"],
    ["BlueJungle1", "RedJungle2"], ["BlueJungle2", "RedJungle1"], ["Mid", "RedBeach"],
    ["Mid", "RedJungle1"], ["RedBase", "RedBeach"], ["RedBase", "RedJungle1"],
    ["RedBeach", "RedJungle1"], ["RedBeach", "RedJungle2"],
  ],
  magma_and_ice: [
    ["RedBase", "RedABeach"], ["RedBase", "RedBBeach"], ["RedABeach", "RedBBeach"],
    ["RedABeach", "MidA"], ["MidA", "BlueABeach"], ["MidA", "Jungle"],
    ["BlueABeach", "BlueBase"], ["BlueABeach", "BlueBBeach"], ["BlueABeach", "Jungle"],
    ["RedBBeach", "MidB"], ["RedBBeach", "Jungle"], ["MidB", "BlueBBeach"],
    ["MidB", "Jungle"], ["BlueBBeach", "BlueBase"],
  ],
  across_the_river: [
    ["BlueABeach", "BlueBBeach"], ["BlueABeach", "BlueBase"], ["BlueABeach", "BlueJungle"],
    ["BlueABeach", "MidA2"], ["BlueBBeach", "BlueBase"], ["BlueBBeach", "BlueJungle"],
    ["BlueBBeach", "MidB1"], ["BlueJungle", "MidB1"], ["BlueJungle", "River"],
    ["MidA1", "MidA2"], ["MidA1", "RedABeach"], ["MidA1", "RedJungle"],
    ["MidA2", "River"], ["MidB1", "MidB2"], ["MidB2", "RedBBeach"], ["MidB2", "River"],
    ["RedABeach", "RedBBeach"], ["RedABeach", "RedBase"], ["RedABeach", "RedJungle"],
    ["RedBBeach", "RedBase"], ["RedBBeach", "RedJungle"], ["RedJungle", "River"],
  ],
};

describe("zoneColor", () => {
  for (const [mapName, pairs] of Object.entries(MAP_ADJACENCY)) {
    it(`colours every zone of ${mapName}`, () => {
      for (const zoneId of new Set(pairs.flat())) {
        expect(zoneColor(zoneId), zoneId).not.toBe(UNKNOWN_ZONE_COLOR);
      }
    });

    it(`keeps touching zones of ${mapName} apart`, () => {
      for (const [a, b] of pairs) {
        expect(zoneColor(a), `${a} vs ${b}`).not.toBe(zoneColor(b));
      }
    });
  }

  it("keeps a lane reading red -> blue in both lanes", () => {
    // The red half of each lane shares a tone, and so does the blue half,
    // even though the lanes number their zones in mirrored order.
    expect(zoneColor("MidA1")).toBe(zoneColor("MidB2"));
    expect(zoneColor("MidA2")).toBe(zoneColor("MidB1"));
    expect(zoneColor("RedABeach")).not.toBe(zoneColor("BlueABeach"));
  });

  it("leaves a map's single pair of jungles the same green", () => {
    // Only Vexing Cliffs splits its jungles, and only there do two of them
    // touch. The other three maps have one jungle per side, far apart;
    // differentiating those would change maps that already read correctly.
    expect(zoneColor("RedJungle")).toBe(zoneColor("BlueJungle"));
  });

  it("falls back for an unknown zone", () => {
    expect(zoneColor("Nonsense")).toBe(UNKNOWN_ZONE_COLOR);
  });
});
