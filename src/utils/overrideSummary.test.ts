import { describe, expect, it } from "vitest";
import { summarizeProposal } from "./overrideSummary";

describe("summarizeProposal", () => {
  it("names a pause without an op", () => {
    expect(summarizeProposal({ family: "pause" })).toBe("Pause the match");
  });

  it("names a rewind by target decision", () => {
    expect(summarizeProposal({ family: "rewind", to: 47 })).toBe(
      "Rewind the game to decision 47",
    );
  });

  it("renders op arguments for a patch", () => {
    expect(summarizeProposal({ family: "patch", op: "add_marker", args: { value: 9 } })).toBe(
      "add_marker (value: 9)",
    );
  });
});
