import { useCallback, useEffect, useState } from "react";
import type {
  ReplayDecision,
  ReplayPosition,
  ReplaySetup,
  ReplaySource,
  ReplayTarget,
} from "../api/replay";
import type { GameView } from "../types/game";
import { ApiError } from "../api/admin";

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(n, hi));
}

/**
 * Drives a recorded replay: fetches the decision list once, then the omniscient
 * board view for whatever position the user navigates to. The REST analog of
 * useGameSocket — read-only, no input is ever submitted.
 *
 * Navigation is expressed as a `target` (a decision index or a round/turn).
 * Setting the target (from a click handler) triggers the fetch effect; all
 * state updates happen inside the async callbacks, never synchronously in an
 * effect body.
 *
 * `initialDecision` positions the replay on load (deep link from a bug
 * report); the backend clamps out-of-range values.
 *
 * `source` decides where the data comes from — the admin debugger (bearer
 * token, reconstructed per request) or a public share link (pre-baked). Pass a
 * memoized source: it is an effect dependency, so a fresh object every render
 * would refetch forever.
 */
export function useReplay(source: ReplaySource | null, initialDecision?: number) {
  const [decisions, setDecisions] = useState<ReplayDecision[]>([]);
  const [setup, setSetup] = useState<ReplaySetup | null>(null);
  const [target, setTarget] = useState<ReplayTarget>({ decision: initialDecision ?? 0 });
  const [view, setView] = useState<GameView | null>(null);
  const [position, setPosition] = useState<ReplayPosition | null>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);

  // Decision list (and total) — fetched once per game.
  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    source
      .fetchMeta()
      .then((meta) => {
        if (cancelled) return;
        setDecisions(meta.decisions);
        setSetup(meta.setup);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          setAuthRequired(true);
        } else {
          setNotFound(true);
        }
        setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [source]);

  // Fetch the board view whenever the target position changes. Keeps the last
  // good view on error so a reconstruction failure (engine drift) stays
  // inspectable rather than blanking the page.
  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    source
      .fetchState(target)
      .then((state) => {
        if (cancelled) return;
        setView(state.view);
        setPosition(state.position);
        setWinner(state.winner);
        setError(null);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [source, target]);

  const total = position?.total_decisions ?? decisions.length;
  const idx = position?.decision_index ?? 0;

  // Navigation actions run from click handlers, so setting state here is fine.
  const go = useCallback((t: ReplayTarget) => {
    setLoading(true);
    setTarget(t);
  }, []);

  const first = useCallback(() => go({ decision: 0 }), [go]);
  const last = useCallback(() => go({ decision: total }), [go, total]);
  const next = useCallback(() => go({ decision: clamp(idx + 1, 0, total) }), [go, idx, total]);
  const prev = useCallback(() => go({ decision: clamp(idx - 1, 0, total) }), [go, idx, total]);
  const jumpToDecision = useCallback((n: number) => go({ decision: clamp(n, 0, total) }), [go, total]);
  const jumpToRoundTurn = useCallback(
    (round: number, turn?: number) => go(turn != null ? { round, turn } : { round }),
    [go]
  );

  return {
    decisions,
    setup,
    view,
    position,
    winner,
    error,
    loading,
    notFound,
    authRequired,
    total,
    idx,
    first,
    last,
    next,
    prev,
    jumpToDecision,
    jumpToRoundTurn,
  };
}
