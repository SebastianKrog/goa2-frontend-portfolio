import { describe, expect, it } from "vitest";
import { handFanPlacements } from "./opponentHandFanLayout";

describe("handFanPlacements", () => {
  it("normalizes empty and fractional counts", () => {
    expect(handFanPlacements(-1)).toEqual([]);
    expect(handFanPlacements(0.9)).toEqual([]);
    expect(handFanPlacements(2.9)).toHaveLength(2);
  });

  it("centres a single card", () => {
    expect(handFanPlacements(1)).toEqual([{ x: 0, y: 0, rotationZ: 0 }]);
  });

  it("builds a symmetric fan with a gentle fourteen-degree spread", () => {
    const cards = handFanPlacements(12);
    expect(cards).toHaveLength(12);
    expect(cards[0].x).toBeCloseTo(-cards.at(-1)!.x);
    expect(cards[0].y).toBeCloseTo(cards.at(-1)!.y);
    expect(cards[0].rotationZ).toBeCloseTo(-cards.at(-1)!.rotationZ);
    expect(Math.abs(cards[0].rotationZ - cards.at(-1)!.rotationZ)).toBeCloseTo(14 * Math.PI / 180);
  });
});
