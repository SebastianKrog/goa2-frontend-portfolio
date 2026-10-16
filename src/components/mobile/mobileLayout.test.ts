import { describe, expect, it } from "vitest";
import { readGameLayout, withGameLayout } from "./mobileLayout";

describe("explicit game layout", () => {
  it("keeps existing desktop defaults, including legacy 2D links", () => {
    expect(readGameLayout(new URLSearchParams())).toBe("desktop3d");
    expect(readGameLayout(new URLSearchParams("3d=0"))).toBe("desktop2d");
    expect(readGameLayout(new URLSearchParams("ui=unknown"))).toBe("desktop3d");
  });

  it("uses 2D for explicit mobile selection regardless of the 3d parameter", () => {
    for (const suffix of ["", "&3d=0", "&3d=1"]) {
      expect(readGameLayout(new URLSearchParams(`ui=mobile${suffix}`))).toBe("mobile");
    }
  });

  it("changes only layout parameters and leaves the supplied query untouched", () => {
    const original = new URLSearchParams("token=seat%2Bsecret&swap=a&swap=b&calibrate=1&ui=mobile");
    for (const layout of ["mobile", "desktop2d", "desktop3d"] as const) {
      const next = withGameLayout(original, layout);
      expect(readGameLayout(next)).toBe(layout);
      expect(next.get("token")).toBe("seat+secret");
      expect(next.getAll("swap")).toEqual(["a", "b"]);
      expect(next.get("calibrate")).toBe("1");
    }
    expect(original.has("3d")).toBe(false);
  });
});
