import { describe, expect, it } from "vitest";
import { mergeHeroNames } from "./heroNames";

describe("mergeHeroNames", () => {
  it("adopts an incoming map", () => {
    expect(mergeHeroNames({}, { hero_arien: "Tuck" })).toEqual({ hero_arien: "Tuck" });
  });

  it("keeps the existing map when an update omits names", () => {
    // STATE_UPDATE drops falsy keys, so an omitted map must not blank the table.
    expect(mergeHeroNames({ hero_arien: "Tuck" }, undefined)).toEqual({
      hero_arien: "Tuck",
    });
  });

  it("keeps the existing map when an update carries an empty one", () => {
    expect(mergeHeroNames({ hero_arien: "Tuck" }, {})).toEqual({ hero_arien: "Tuck" });
  });

  it("replaces the map when a non-empty update arrives", () => {
    expect(mergeHeroNames({ hero_arien: "Tuck" }, { hero_wasp: "Wisdom" })).toEqual({
      hero_wasp: "Wisdom",
    });
  });
});
