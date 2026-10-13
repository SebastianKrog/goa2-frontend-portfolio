import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/replayPatches.json";
import { applyPatch, applyPatches, type PatchOp } from "./jsonPatch";

/**
 * Mirrors the generator the fixture was built from, so the expected document at
 * every step is computed here rather than stored. The patches in the fixture are
 * real output from the Python `jsonpatch` the bake uses — this is what proves
 * the two sides agree.
 */
function body(i: number): unknown {
  const tiles: Record<string, unknown> = {};
  for (let q = 0; q < 6; q++) {
    for (let r = 0; r < 6; r++) {
      tiles[`${q},${r}`] = { hex: [q, r], zone: "mid", occupant: null };
    }
  }
  (tiles[`${i % 6},${(i * 2) % 6}`] as Record<string, unknown>).occupant = `minion_${i}`;
  if (i % 3 === 0) delete tiles[`${i % 6},${(i * 5) % 6}`];
  const effects = Array.from({ length: i % 5 }, (_, n) => ({ id: `e${n}`, turns: (i + n) % 4 }));
  const markers = Array.from({ length: i % 7 }, (_, n) => n);
  if (i % 4 === 0) markers.reverse();
  return {
    view: {
      board: { tiles },
      effects,
      markers,
      round: Math.floor(i / 10),
      turn: i % 10,
      actor: i % 2 ? `hero_${i % 3}` : null,
    },
    position: { decision_index: i, total_decisions: 60 },
    winner: i === 60 ? "RED" : null,
  };
}

const patches = fixture.patches as unknown as PatchOp[][];

describe("applying patches baked by the Python pipeline", () => {
  it("reaches every position by chaining from the keyframe", () => {
    let doc = body(0);
    for (let i = 0; i < fixture.count; i++) {
      doc = applyPatch(doc, patches[i]);
      expect(doc, `position ${i + 1} does not reconstruct`).toEqual(body(i + 1));
    }
  });

  it("reaches a position directly, the way a deep link does", () => {
    for (const target of [1, 7, 24, 41, 60]) {
      const doc = applyPatches(body(0), patches.slice(0, target));
      expect(doc, `direct jump to ${target}`).toEqual(body(target));
    }
  });
});

describe("pointer and operation handling", () => {
  it("unescapes ~1 and ~0 in keys", () => {
    const doc = { "a/b": 1, "c~d": 2 };
    expect(applyPatch(doc, [{ op: "replace", path: "/a~1b", value: 9 }])).toEqual({
      "a/b": 9,
      "c~d": 2,
    });
    expect(applyPatch(doc, [{ op: "replace", path: "/c~0d", value: 8 }])["c~d"]).toBe(8);
  });

  it("inserts into an array rather than overwriting", () => {
    expect(applyPatch({ xs: [1, 3] }, [{ op: "add", path: "/xs/1", value: 2 }])).toEqual({
      xs: [1, 2, 3],
    });
  });

  it("appends with the - token", () => {
    expect(applyPatch({ xs: [1] }, [{ op: "add", path: "/xs/-", value: 2 }])).toEqual({ xs: [1, 2] });
  });

  it("removes array elements by index and object keys by name", () => {
    expect(applyPatch({ xs: [1, 2, 3] }, [{ op: "remove", path: "/xs/1" }])).toEqual({ xs: [1, 3] });
    expect(applyPatch({ a: 1, b: 2 }, [{ op: "remove", path: "/b" }])).toEqual({ a: 1 });
  });

  it("moves a value, removing it from its old location first", () => {
    expect(applyPatch({ xs: [1, 2, 3] }, [{ op: "move", from: "/xs/0", path: "/xs/2" }])).toEqual({
      xs: [2, 3, 1],
    });
  });

  it("copies without aliasing the source", () => {
    const out = applyPatch({ a: { n: 1 }, b: {} }, [{ op: "copy", from: "/a", path: "/b/x" }]);
    (out.a as { n: number }).n = 99;
    expect((out.b as { x: { n: number } }).x.n).toBe(1);
  });

  it("replaces the whole document for an empty path", () => {
    expect(applyPatch({ a: 1 }, [{ op: "replace", path: "", value: { b: 2 } }])).toEqual({ b: 2 });
  });

  it("throws rather than silently corrupting when a path does not resolve", () => {
    expect(() => applyPatch({ a: 1 }, [{ op: "replace", path: "/x/y", value: 1 }])).toThrow();
  });
});

describe("replaying a cached group", () => {
  it("gives the same result every time the same patches are reused", () => {
    // The source caches one group and re-walks it from the keyframe per
    // position, so a patch list must survive being applied more than once.
    const first = applyPatches(body(0), patches.slice(0, 24));
    const second = applyPatches(body(0), patches.slice(0, 24));
    expect(second).toEqual(first);
    expect(second).toEqual(body(24));
  });

  it("does not let the document alias values held by the patch", () => {
    const patch: PatchOp[] = [{ op: "add", path: "/a", value: { n: 1 } }];
    const doc = applyPatch({} as Record<string, unknown>, patch);
    (doc.a as { n: number }).n = 99;
    expect(applyPatch({} as Record<string, unknown>, patch)).toEqual({ a: { n: 1 } });
  });
});
