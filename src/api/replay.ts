import type { GameView } from "../types/game";
import { applyPatches, type PatchOp } from "../utils/jsonPatch";
import { adminGetJson, getJson } from "./admin";

// Replay-debugger API client. Talks to the backend's read-only /replays
// endpoints (mounted when GOA2_REPLAY_API is enabled — local dev, no auth —
// or when GOA2_ADMIN_TOKEN is configured — production, bearer auth added by
// adminGetJson).
const API_BASE = import.meta.env.VITE_API_URL || "/api";

export interface ReplaySummary {
  /** Empty for replays recorded before player identity existed. */
  player_names?: Record<string, string>;
  game_id: string;
  map: string;
  red: string[];
  blue: string[];
  game_type: string;
  cheats: boolean;
  seed: number;
  engine: string;
  created_at: number;
  num_decisions: number;
}

export interface ReplayDecision {
  index: number;
  type: string; // "commit" | "uncommit" | "pass" | "input"
  r: number;
  t: number;
  hero: string;
  card?: string | null;
  sel?: unknown;
}

export interface ReplaySetup {
  /** Absent in logs written before player identity existed. */
  player_names?: Record<string, string>;
  v: number;
  type: string;
  game_id: string;
  map: string;
  red: string[];
  blue: string[];
  game_type: string;
  cheats: boolean;
  seed: number;
  engine: string;
  created_at: number;
}

export interface ReplayMeta {
  setup: ReplaySetup;
  decisions: ReplayDecision[];
}

export interface ReplayPosition {
  decision_index: number;
  round: number;
  turn: number;
  total_decisions: number;
}

export interface ReplayState {
  view: GameView;
  position: ReplayPosition;
  winner: string | null;
}

// Position to reconstruct to: either an absolute decision index, or the start
// of a round (optionally a specific turn within it).
export type ReplayTarget = { decision: number } | { round: number; turn?: number };

export interface ShareResponse {
  token: string;
  url: string;
}

export interface ShareSummary {
  token: string;
  game_id: string;
  total_decisions: number;
  created_at: number;
  engine: string;
  size_bytes: number;
}

// Where a replay's data comes from. The admin debugger reconstructs on demand
// behind a bearer token; a share link reads a pre-baked artifact with no auth.
// useReplay talks to this interface so ReplayViewer is identical in both modes.
export interface ReplaySource {
  fetchMeta: () => Promise<ReplayMeta>;
  fetchState: (target: ReplayTarget) => Promise<ReplayState>;
}

function targetParams(target: ReplayTarget): string {
  const params = new URLSearchParams();
  if ("decision" in target) {
    params.set("decision", String(target.decision));
  } else {
    params.set("round", String(target.round));
    if (target.turn != null) params.set("turn", String(target.turn));
  }
  return params.toString();
}

export function listReplays(): Promise<ReplaySummary[]> {
  return adminGetJson(`${API_BASE}/replays`);
}

export function fetchReplayMeta(gameId: string): Promise<ReplayMeta> {
  return adminGetJson(`${API_BASE}/replays/${encodeURIComponent(gameId)}`);
}

export function fetchReplayState(gameId: string, target: ReplayTarget): Promise<ReplayState> {
  return adminGetJson(
    `${API_BASE}/replays/${encodeURIComponent(gameId)}/state?${targetParams(target)}`
  );
}

export function createShare(gameId: string): Promise<ShareResponse> {
  return adminGetJson(`${API_BASE}/replays/${encodeURIComponent(gameId)}/share`, {
    method: "POST",
  });
}

export function listShares(): Promise<ShareSummary[]> {
  return adminGetJson(`${API_BASE}/shares`);
}

export function revokeShare(token: string): Promise<void> {
  return adminGetJson(`${API_BASE}/shares/${encodeURIComponent(token)}`, { method: "DELETE" });
}

/** Absolute URL a recipient opens. Shares are same-origin with the app. */
export function shareUrl(token: string): string {
  return `${window.location.origin}/shared/${token}`;
}

export function adminReplaySource(gameId: string): ReplaySource {
  return {
    fetchMeta: () => fetchReplayMeta(gameId),
    fetchState: (target) => fetchReplayState(gameId, target),
  };
}

/**
 * One baked group: a full snapshot plus a patch per following position.
 *
 * `patches[n]` advances position `start + n` to `start + n + 1`, so position P
 * is `keyframe` with `patches[0 .. P - start - 1]` applied.
 */
interface ReplayGroup {
  start: number;
  keyframe: ReplayState;
  patches: PatchOp[][];
}

/**
 * Index of the position a target names, given the decision list.
 *
 * Mirrors `index_for_round_turn` on the server: the first decision at *or
 * after* the requested moment, so jumping to a round/turn that never occurred
 * lands on the next one rather than at the end of the game.
 */
function resolveTarget(target: ReplayTarget, decisions: ReplayDecision[]): number {
  const total = decisions.length;
  if ("decision" in target) return Math.max(0, Math.min(target.decision, total));
  const atOrAfter = (d: ReplayDecision) => {
    const r = d.r ?? 0;
    if (r !== target.round) return r > target.round;
    if (target.turn == null) return true;
    return (d.t ?? 0) >= target.turn;
  };
  const index = decisions.findIndex(atOrAfter);
  return index === -1 ? total : index;
}

// Shared replays are public: no admin header, and a 401 can never come back.
//
// Reads are group-at-a-time: one fetch covers ~175 consecutive positions, so
// scrubbing inside a group costs no request at all. That is why this source
// holds state while `adminReplaySource` does not — and why `ReplayViewer` must
// keep memoizing it, since dropping the instance drops the cache.
export function sharedReplaySource(token: string): ReplaySource {
  const base = `${API_BASE}/shared/${encodeURIComponent(token)}`;

  // Both fetchMeta and fetchState need the decision list, and useReplay fires
  // them concurrently on mount — sharing one promise keeps that to one request.
  let meta: Promise<ReplayMeta> | null = null;
  const loadMeta = () => (meta ??= getJson<ReplayMeta>(`${base}`));

  let group: ReplayGroup | null = null;

  function has(index: number): boolean {
    return group != null && index >= group.start && index - group.start <= group.patches.length;
  }

  function reconstruct(index: number): ReplayState {
    const held = group as ReplayGroup;
    // The keyframe is cloned because applying patches mutates, and the group is
    // kept for the next position the user asks for.
    return applyPatches(structuredClone(held.keyframe), held.patches.slice(0, index - held.start));
  }

  return {
    fetchMeta: loadMeta,
    fetchState: async (target) => {
      const { decisions } = await loadMeta();
      const index = resolveTarget(target, decisions);
      if (!has(index)) {
        // A server that still serves single positions (a share baked before
        // groups existed) answers with a bare state; treat it as a group of one.
        const body = await getJson<ReplayGroup | ReplayState>(`${base}/state?decision=${index}`);
        group =
          "keyframe" in body
            ? body
            : { start: index, keyframe: body as ReplayState, patches: [] };
      }
      return reconstruct(index);
    },
  };
}
