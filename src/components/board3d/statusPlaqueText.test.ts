import { describe, expect, it } from "vitest";
import { PLAQUE_NAME_MAX, plaqueNameText } from "./statusPlaqueText";

describe("plaqueNameText", () => {
  it("returns null when there is no name", () => {
    expect(plaqueNameText(undefined)).toBeNull();
    expect(plaqueNameText(null)).toBeNull();
    expect(plaqueNameText("   ")).toBeNull();
  });

  it("trims surrounding whitespace", () => {
    expect(plaqueNameText("  Tuck  ")).toBe("Tuck");
  });

  it("truncates a name longer than the plaque can hold", () => {
    const result = plaqueNameText("x".repeat(40));
    expect(result).toHaveLength(PLAQUE_NAME_MAX);
  });
});
