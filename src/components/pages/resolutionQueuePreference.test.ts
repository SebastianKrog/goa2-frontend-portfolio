import { describe, expect, it } from "vitest";
import { RESOLUTION_QUEUE_KEY, readResolutionQueueCollapsed } from "./resolutionQueuePreference";

describe("resolution queue preference", () => {
  it("shows the queue when nothing is stored", () => {
    expect(readResolutionQueueCollapsed({ getItem: () => null })).toBe(false);
  });

  it("collapses only on the explicit value", () => {
    expect(readResolutionQueueCollapsed({ getItem: (key) => key === RESOLUTION_QUEUE_KEY ? "collapsed" : null })).toBe(true);
    expect(readResolutionQueueCollapsed({ getItem: () => "shown" })).toBe(false);
    expect(readResolutionQueueCollapsed({ getItem: () => "unexpected" })).toBe(false);
  });
});
