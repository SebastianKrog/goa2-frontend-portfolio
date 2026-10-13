import { describe, expect, it } from "vitest";
import { asItem } from "./paintCard";

// Asserts against literals rather than importing the painter's Item enum, so
// these survive the vendored painter moving between directories.
describe("asItem", () => {
  it("maps the server's RADIUS item onto the painter's AREA sprite", () => {
    expect(asItem("RADIUS")).toBe("AREA");
  });

  it("passes through the items both sides name identically", () => {
    for (const name of ["ATTACK", "DEFENSE", "INITIATIVE", "RANGE", "MOVEMENT"]) {
      expect(asItem(name)).toBe(name);
    }
  });

  it("falls back to ATTACK for a missing or unknown item", () => {
    expect(asItem(null)).toBe("ATTACK");
    expect(asItem("NONSENSE")).toBe("ATTACK");
  });
});
