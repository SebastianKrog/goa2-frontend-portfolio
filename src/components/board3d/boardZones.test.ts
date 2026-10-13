import { describe, expect, it } from "vitest";
import type { HeroView } from "../../types/game";
import { zoneAnchor } from "./boardZones";
import type { SeatPlacement } from "./seating";

const placement = (scale = 1): SeatPlacement => ({
  hero: { id: "hero_brogan" } as HeroView,
  heroSlug: "brogan",
  imagePath: "/mats/brogan_front.webp",
  position: [3, 0.02, 5],
  rotationY: 0,
  scale,
});

describe("zoneAnchor", () => {
  it("places a hand pointer on the raised opponent hand fan", () => {
    const anchor = zoneAnchor("hero_brogan", "HAND", [placement()]);
    expect(anchor?.x).toBeCloseTo(3);
    expect(anchor?.y).toBeCloseTo(0.7);
    expect(anchor?.z).toBeCloseTo(6.75);
  });

  it("scales the hand anchor with crowded-table seating", () => {
    const anchor = zoneAnchor("hero_brogan", "HAND", [placement(0.5)]);
    expect(anchor?.y).toBeCloseTo(0.36);
    expect(anchor?.z).toBeCloseTo(5.875);
  });
});
