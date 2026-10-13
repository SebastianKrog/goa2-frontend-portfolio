import { describe, expect, it } from "vitest";
import { COMMITTED_CARDS_KEY, readCommittedCardsHidden } from "./committedCardsPreference";

describe("committed cards preference", () => {
  it("shows the panel when nothing is stored", () => {
    expect(readCommittedCardsHidden({ getItem: () => null })).toBe(false);
  });

  it("keeps the panel hidden once it has been dismissed", () => {
    expect(
      readCommittedCardsHidden({ getItem: (key) => (key === COMMITTED_CARDS_KEY ? "hidden" : null) }),
    ).toBe(true);
  });

  it("shows the panel for any value it does not recognise", () => {
    expect(readCommittedCardsHidden({ getItem: () => "shown" })).toBe(false);
    expect(readCommittedCardsHidden({ getItem: () => "unexpected" })).toBe(false);
  });
});
