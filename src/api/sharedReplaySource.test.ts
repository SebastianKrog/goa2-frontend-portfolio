import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedReplaySource } from "./replay";

const TOKEN = "tok";
const META = `/api/shared/${TOKEN}`;

/** A position body shaped like the real one, with a field that changes per index. */
function state(index: number) {
  return {
    view: { board: { tiles: { "0,0": { occupant: `minion_${index}` } } } },
    position: { decision_index: index, round: Math.floor(index / 10) + 1, turn: (index % 10) + 1, total_decisions: 40 },
    winner: null,
  };
}

/** Groups of 20, patching only the field that moves. */
function group(start: number, count: number) {
  return {
    start,
    keyframe: state(start),
    patches: Array.from({ length: count - 1 }, (_, n) => [
      { op: "replace", path: "/view/board/tiles/0,0/occupant", value: `minion_${start + n + 1}` },
      { op: "replace", path: "/position/decision_index", value: start + n + 1 },
      { op: "replace", path: "/position/round", value: Math.floor((start + n + 1) / 10) + 1 },
      { op: "replace", path: "/position/turn", value: ((start + n + 1) % 10) + 1 },
    ]),
  };
}

const decisions = Array.from({ length: 40 }, (_, i) => ({
  index: i,
  type: "commit",
  r: Math.floor(i / 10) + 1,
  t: (i % 10) + 1,
  hero: "hero_a",
}));

const fetchMock = vi.fn<typeof fetch>();

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    if (url === META) return json({ setup: {}, decisions });
    const index = Number(new URL(url, "http://x").searchParams.get("decision"));
    return json(index < 20 ? group(0, 20) : group(20, 21));
  });
  vi.stubGlobal("fetch", fetchMock);
});

const stateCalls = () => fetchMock.mock.calls.filter(([u]) => String(u).includes("/state")).length;

describe("reading positions from a shared replay", () => {
  it("returns the requested position, reconstructed from the group", async () => {
    const source = sharedReplaySource(TOKEN);
    expect(await source.fetchState({ decision: 7 })).toEqual(state(7));
  });

  it("serves every position in a group from one request", async () => {
    const source = sharedReplaySource(TOKEN);
    for (let i = 0; i < 20; i++) {
      expect((await source.fetchState({ decision: i })).position.decision_index).toBe(i);
    }
    expect(stateCalls()).toBe(1);
  });

  it("scrubs backwards without refetching", async () => {
    const source = sharedReplaySource(TOKEN);
    await source.fetchState({ decision: 19 });
    await source.fetchState({ decision: 3 });
    expect(stateCalls()).toBe(1);
  });

  it("fetches again only when the target leaves the cached group", async () => {
    const source = sharedReplaySource(TOKEN);
    await source.fetchState({ decision: 5 });
    await source.fetchState({ decision: 25 });
    expect(stateCalls()).toBe(2);
    expect((await source.fetchState({ decision: 25 })).position.decision_index).toBe(25);
    expect(stateCalls()).toBe(2);
  });

  it("resolves round and turn without asking the server to", async () => {
    const source = sharedReplaySource(TOKEN);
    const body = await source.fetchState({ round: 2, turn: 4 });
    expect(body.position.round).toBe(2);
    expect(body.position.turn).toBe(4);
  });

  it("lands on the next moment when the exact round and turn never occurred", async () => {
    // Decisions run t=1..10 per round; the server resolves at-or-after, so a
    // client that matched exactly would wrongly fall through to the end.
    const source = sharedReplaySource(TOKEN);
    const sparse = decisions.filter((d) => d.t % 2 === 1);
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url === META) return json({ setup: {}, decisions: sparse });
      return json(group(0, sparse.length + 1));
    });
    const body = await source.fetchState({ round: 1, turn: 4 });
    expect(body.position.decision_index).toBe(sparse.findIndex((d) => d.r === 1 && d.t >= 4));
  });

  it("jumps to the end when the requested round is past the last one", async () => {
    const source = sharedReplaySource(TOKEN);
    expect((await source.fetchState({ round: 99 })).position.decision_index).toBe(40);
  });

  it("clamps past the end of the game", async () => {
    const source = sharedReplaySource(TOKEN);
    expect((await source.fetchState({ decision: 999 })).position.decision_index).toBe(40);
  });

  it("fetches the decision list once even when asked concurrently", async () => {
    const source = sharedReplaySource(TOKEN);
    await Promise.all([source.fetchMeta(), source.fetchState({ decision: 1 })]);
    expect(fetchMock.mock.calls.filter(([u]) => String(u) === META)).toHaveLength(1);
  });

  it("reads a share baked before groups existed", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url === META) return json({ setup: {}, decisions });
      return json(state(Number(new URL(url, "http://x").searchParams.get("decision"))));
    });
    const source = sharedReplaySource(TOKEN);
    expect(await source.fetchState({ decision: 12 })).toEqual(state(12));
    // No patches to reuse, so each position is its own request — as before.
    await source.fetchState({ decision: 13 });
    expect(stateCalls()).toBe(2);
  });
});
