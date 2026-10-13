import { describe, expect, it } from "vitest";
import type { UpgradeOption } from "../types/game";
import { upgradeOfferKey } from "./upgradeOffer";

const option = (...ids: string[]): UpgradeOption =>
  ({ color: "RED", tier: "II", pair: ids, card_details: ids.map((id) => ({ id, name: id })) }) as unknown as UpgradeOption;

const offer = (remaining: number, ...options: UpgradeOption[]) => ({ remaining, options });

describe("upgrade offer key", () => {
  it("is stable while the same offer stands", () => {
    expect(upgradeOfferKey(offer(1, option("a", "b")))).toBe(
      upgradeOfferKey(offer(1, option("a", "b"))),
    );
  });

  it("changes once one of the hero's upgrades is spent", () => {
    expect(upgradeOfferKey(offer(2, option("a", "b")))).not.toBe(
      upgradeOfferKey(offer(1, option("a", "b"))),
    );
  });

  it("changes when different cards are offered", () => {
    expect(upgradeOfferKey(offer(1, option("a", "b")))).not.toBe(
      upgradeOfferKey(offer(1, option("c", "d"))),
    );
  });

  it("is empty for a hero with nothing to pick", () => {
    expect(upgradeOfferKey(undefined)).toBe("");
  });
});
