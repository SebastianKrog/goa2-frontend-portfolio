import { describe, expect, it } from "vitest";
import type { Hex } from "../../types/game";
import { buildHeroFacingTargets, lookAtHexDeg, type FacingPlacement } from "./facing";

const hex = (q: number, r: number, s: number): Hex => ({ q, r, s });

describe("board model facing", () => {
  it("keeps enemy heroes ahead of nearer enemy minions", () => {
    const trinkets: FacingPlacement = {
      id: "hero_trinkets",
      team: "red",
      hex: hex(0, 0, 0),
    };
    const enemyHero: FacingPlacement = {
      id: "hero_enemy",
      team: "blue",
      hex: hex(3, -3, 0),
    };
    const enemyMinion: FacingPlacement = {
      id: "blue_minion",
      team: "blue",
      hex: hex(1, -1, 0),
    };

    expect(buildHeroFacingTargets([trinkets, enemyHero], [enemyMinion]).get(trinkets.id))
      .toEqual(enemyHero.hex);
  });

  it("lets Trinkets and the turret face one target from different hexes", () => {
    const trinketsHex = hex(0, 0, 0);
    const turretHex = hex(-1, 0, 1);
    const targetHex = hex(2, -2, 0);

    const trinketsDeg = lookAtHexDeg(trinketsHex, targetHex, 0.5);
    const turretDeg = lookAtHexDeg(turretHex, targetHex, 0.5);

    expect(trinketsDeg).not.toBe(turretDeg);
    expect(trinketsDeg).toBeCloseTo(120);
    expect(turretDeg).toBeCloseTo(100.8934, 4);
  });
});
