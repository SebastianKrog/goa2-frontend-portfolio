import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ensurePrintSignsReady,
  getPrintSign,
  resetPrintSigns,
  type PrintSign,
} from "./printSigns";

// Mirrors the shape of public/goa2-translations/print-signs.json. The shipped
// file is validated where it is generated, in scripts/sync-translations.mjs.
const shipped: Record<string, PrintSign> = {
  brynn_high_ground: { primary: "PLUS" },
  close_call: { primary: "EXCLAMATION" },
  long_thrust: { modifier: "PLUS" },
  dimension_door: { modifier: "PLUS" },
  sunburst: { primary: "PLUS", modifier: "PLUS" },
};

function stubFetch(response: Partial<Response>): void {
  vi.stubGlobal("fetch", vi.fn(async () => response as Response));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetPrintSigns();
});

describe("printed value signs", () => {
  it("resolves the sign a card prints", async () => {
    stubFetch({ ok: true, json: async () => shipped });
    await ensurePrintSignsReady();

    expect(getPrintSign("brynn_high_ground")).toEqual({ primary: "PLUS" });
    expect(getPrintSign("close_call")).toEqual({ primary: "EXCLAMATION" });
    expect(getPrintSign("long_thrust")).toEqual({ modifier: "PLUS" });
  });

  it("returns null for a card that prints no sign", async () => {
    stubFetch({ ok: true, json: async () => shipped });
    await ensurePrintSignsReady();

    expect(getPrintSign("noble_blade")).toBeNull();
    expect(getPrintSign("no_such_card")).toBeNull();
  });

  it("loads once however many callers ask", async () => {
    const json = vi.fn(async () => shipped);
    stubFetch({ ok: true, json });
    await Promise.all([ensurePrintSignsReady(), ensurePrintSignsReady()]);
    await ensurePrintSignsReady();

    expect(json).toHaveBeenCalledTimes(1);
  });

  it("degrades to unsigned values when the catalog cannot be fetched", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    stubFetch({ ok: false, status: 404 });

    await expect(ensurePrintSignsReady()).resolves.toBeUndefined();
    expect(getPrintSign("brynn_high_ground")).toBeNull();
  });

  it("degrades when the response is not JSON", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));

    await expect(ensurePrintSignsReady()).resolves.toBeUndefined();
    expect(getPrintSign("brynn_high_ground")).toBeNull();
  });

  it("reads a modifier sign and a primary sign off the same card", async () => {
    stubFetch({ ok: true, json: async () => shipped });
    await ensurePrintSignsReady();

    expect(getPrintSign("sunburst")).toEqual({ primary: "PLUS", modifier: "PLUS" });
  });
});
