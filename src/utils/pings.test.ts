import { describe, expect, it } from "vitest";
import { canPingInPhase, pingTargetKey } from "./pings";

describe("pingTargetKey", () => {
  it("keys a hex by all three cube coordinates", () => {
    expect(pingTargetKey({ kind: "HEX", hex: { q: 2, r: -5, s: 3 } }))
      .toBe("HEX:2,-5,3");
  });

  it("distinguishes public card table locations without needing card IDs", () => {
    expect(pingTargetKey({
      kind: "CARD",
      hero_id: "hero_emmitt",
      zone: "PLAYED",
      index: 2,
    })).toBe("CARD:hero_emmitt:PLAYED:2");
    expect(pingTargetKey({
      kind: "CARD",
      hero_id: "hero_emmitt",
      zone: "CURRENT",
    })).toBe("CARD:hero_emmitt:CURRENT:");
  });
});

describe("canPingInPhase", () => {
  it("stays quiet while a turn or an upgrade is resolving", () => {
    expect(canPingInPhase("RESOLUTION")).toBe(false);
    expect(canPingInPhase("LEVEL_UP")).toBe(false);
  });

  it("allows pings in every other phase", () => {
    for (const phase of ["SETUP", "PLANNING", "REVELATION", "CLEANUP", "GAME_OVER"]) {
      expect(canPingInPhase(phase)).toBe(true);
    }
  });

  it("allows pings when the phase is not known yet", () => {
    expect(canPingInPhase(undefined)).toBe(true);
  });
});
