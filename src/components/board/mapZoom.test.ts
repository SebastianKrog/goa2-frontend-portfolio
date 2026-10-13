import { describe, expect, it } from "vitest";
import { MAX_ZOOM, NO_ZOOM, clampPan, zoomTo } from "./mapZoom";

const SIZE = { width: 400, height: 300 };

describe("map zoom", () => {
  it("keeps the anchored point under the pointer", () => {
    const anchor = { x: 100, y: -60 };
    const zoomed = zoomTo(NO_ZOOM, 2, anchor, SIZE);
    // Content point under the anchor before and after must be the same.
    const before = (anchor.x - NO_ZOOM.x) / NO_ZOOM.k;
    const after = (anchor.x - zoomed.x) / zoomed.k;
    expect(after).toBeCloseTo(before);
    expect((anchor.y - zoomed.y) / zoomed.k).toBeCloseTo(anchor.y);
  });

  it("recentres when zoomed back out to fit", () => {
    const zoomed = zoomTo(NO_ZOOM, 3, { x: 150, y: 100 }, SIZE);
    expect(zoomed.x).not.toBe(0);
    const reset = zoomTo(zoomed, 1, { x: 150, y: 100 }, SIZE);
    expect(reset).toEqual({ k: 1, x: 0, y: 0 });
  });

  it("clamps the zoom range", () => {
    expect(zoomTo(NO_ZOOM, 0.2, { x: 0, y: 0 }, SIZE).k).toBe(1);
    expect(zoomTo(NO_ZOOM, 99, { x: 0, y: 0 }, SIZE).k).toBe(MAX_ZOOM);
  });

  it("never lets the map be panned off its container", () => {
    const panned = clampPan({ k: 2, x: 9999, y: -9999 }, SIZE);
    expect(panned.x).toBe(SIZE.width / 2);
    expect(panned.y).toBe(-SIZE.height / 2);
  });
});
