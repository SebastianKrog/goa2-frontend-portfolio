import { describe, expect, it } from "vitest";
import { heroIdFromName } from "./heroDisplay";

describe("heroIdFromName", () => {
  it("maps a hero name to the id the backend keys by", () => {
    expect(heroIdFromName("Arien")).toBe("hero_arien");
    expect(heroIdFromName("Tigerclaw")).toBe("hero_tigerclaw");
  });

  it("leaves an id that is already prefixed alone", () => {
    expect(heroIdFromName("hero_arien")).toBe("hero_arien");
  });
});
