import { describe, expect, it } from "vitest";
import { HERO_DASHBOARD_KEY, readHeroDashboardHidden } from "./heroDashboardPreference";

describe("hero dashboard preference", () => {
  it("shows the panel by default", () => {
    expect(readHeroDashboardHidden({ getItem: () => null })).toBe(false);
  });

  it("restores an explicitly hidden panel", () => {
    expect(
      readHeroDashboardHidden({ getItem: (key) => (key === HERO_DASHBOARD_KEY ? "hidden" : null) }),
    ).toBe(true);
  });

  it("ignores unrecognised values", () => {
    expect(readHeroDashboardHidden({ getItem: () => "shown" })).toBe(false);
    expect(readHeroDashboardHidden({ getItem: () => "unexpected" })).toBe(false);
  });
});
