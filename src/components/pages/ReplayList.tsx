import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  listReplays,
  listShares,
  type ReplaySummary,
  type ShareSummary,
} from "../../api/replay";
import { ApiError } from "../../api/admin";
import { AdminTokenPrompt } from "../ui/AdminTokenPrompt";
import { ShareCell } from "../ui/ShareCell";
import { heroIdFromName } from "../../utils/heroDisplay";
import styles from "./ReplayList.module.css";

function fmt(ts: number): string {
  return ts ? new Date(ts * 1000).toLocaleString() : "—";
}

// "Hanu (Player 1), Xargatha" — heroes nobody claimed stay bare, so replays
// recorded before player identity read exactly as they did before.
function rosterLabel(row: ReplaySummary, heroes: string[]): string {
  return heroes
    .map((hero) => {
      const player = row.player_names?.[heroIdFromName(hero)];
      return player ? `${hero} (${player})` : hero;
    })
    .join(", ");
}

export function ReplayList() {
  const [rows, setRows] = useState<ReplaySummary[] | null>(null);
  const [shares, setShares] = useState<ShareSummary[]>([]);
  const [sharedOnly, setSharedOnly] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);

  const loadReplays = useCallback(() => {
    listReplays()
      .then(setRows)
      .catch((e: Error) => setError(e));
    // A share listing failure must not blank the page: the replays are still
    // usable, they just won't show share state.
    listShares()
      .then(setShares)
      .catch(() => setShares([]));
  }, []);

  // One share per game — minting is idempotent server-side.
  const sharesByGame = useMemo(
    () => new Map(shares.map((s) => [s.game_id, s])),
    [shares]
  );

  const refresh = useCallback(() => {
    setError(null);
    loadReplays();
  }, [loadReplays]);

  useEffect(() => {
    loadReplays();
  }, [loadReplays]);

  useEffect(() => {
    document.title = "Replays - Guards of Atlantis II";
  }, []);

  if (error) {
    const status = error instanceof ApiError ? error.status : null;
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Replays</h1>
        {status === 401 ? (
          <AdminTokenPrompt onSaved={refresh} />
        ) : (
          <>
            <p className={styles.error}>Couldn't load replays: {error.message}</p>
            <p className={styles.hint}>
              The replay API is off by default. Start the backend with{" "}
              <code>GOA2_REPLAY_API=1</code> (dev) or set <code>GOA2_ADMIN_TOKEN</code>{" "}
              (production) to enable it.
            </p>
          </>
        )}
      </div>
    );
  }
  if (!rows) return <div className={styles.page}>Loading replays…</div>;
  if (rows.length === 0)
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Replays</h1>
        <p className={styles.hint}>No replays recorded yet. Play a game to record one.</p>
      </div>
    );

  const visible = sharedOnly ? rows.filter((r) => sharesByGame.has(r.game_id)) : rows;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Replays</h1>
        <label className={styles.filter}>
          <input
            type="checkbox"
            checked={sharedOnly}
            onChange={(e) => setSharedOnly(e.target.checked)}
          />
          shared only ({shares.length})
        </label>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Map</th>
            <th>Red</th>
            <th>Blue</th>
            <th>Type</th>
            <th>Decisions</th>
            <th>Recorded</th>
            <th>Share</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <tr key={r.game_id}>
              <td>
                <Link to={`/replay/${r.game_id}`} className={styles.link}>
                  {r.map}
                </Link>
              </td>
              <td>{rosterLabel(r, r.red)}</td>
              <td>{rosterLabel(r, r.blue)}</td>
              <td>{r.game_type}</td>
              <td>{r.num_decisions}</td>
              <td>{fmt(r.created_at)}</td>
              <td>
                <ShareCell
                  gameId={r.game_id}
                  share={sharesByGame.get(r.game_id)}
                  onChanged={loadReplays}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sharedOnly && visible.length === 0 && (
        <p className={styles.hint}>No shared replays yet.</p>
      )}
    </div>
  );
}
