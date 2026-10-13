import { describe, expect, it } from "vitest";
import { evaluateSetup } from "./gameSetup";

const setup = (over: Partial<Parameters<typeof evaluateSetup>[0]> = {}) => evaluateSetup({
  redCount: 2,
  blueCount: 2,
  validTimeControl: true,
  ...over,
});

describe("evaluateSetup", () => {
  it("accepts any team sizes once both teams have a hero", () => {
    expect(setup()).toEqual({ valid: true, hint: "Teams are ready." });
    expect(setup({ redCount: 4, blueCount: 4 }).valid).toBe(true);
    expect(setup({ redCount: 3, blueCount: 1 }).valid).toBe(true);
    expect(setup({ redCount: 5, blueCount: 5 }).valid).toBe(true);
  });

  it("needs both teams and a sane clock", () => {
    expect(setup({ blueCount: 0 }).hint).toBe("Add at least one hero to each team.");
    expect(setup({ validTimeControl: false }).hint)
      .toBe("Fix the match clock values before creating the game.");
  });
});
