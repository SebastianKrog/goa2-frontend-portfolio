import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  deleteBugReport,
  listBugReports,
  setBugReportStatus,
  type BugReport,
} from "../../api/bugReports";
import { ApiError } from "../../api/admin";
import { AdminTokenPrompt } from "../ui/AdminTokenPrompt";
import styles from "./BugReports.module.css";

function fmt(ts: number): string {
  return ts ? new Date(ts * 1000).toLocaleString() : "—";
}

export function BugReports() {
  const [rows, setRows] = useState<BugReport[] | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadReports = useCallback(() => {
    listBugReports()
      .then(setRows)
      .catch((e: Error) => setError(e));
  }, []);

  const refresh = useCallback(() => {
    setError(null);
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    document.title = "Bug Reports - Guards of Atlantis II";
  }, []);

  const toggleStatus = async (r: BugReport) => {
    setBusyId(r.id);
    try {
      await setBugReportStatus(r.id, r.status === "open" ? "resolved" : "open");
      refresh();
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (r: BugReport) => {
    if (!window.confirm(`Delete report "${r.title}"? This also unpins its replay.`)) return;
    setBusyId(r.id);
    try {
      await deleteBugReport(r.id);
      refresh();
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusyId(null);
    }
  };

  if (error) {
    const status = error instanceof ApiError ? error.status : null;
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Bug Reports</h1>
        {status === 401 ? (
          <AdminTokenPrompt onSaved={refresh} />
        ) : status === 404 ? (
          <p className={styles.hint}>
            The reports API is not enabled on this server. Start the backend with{" "}
            <code>GOA2_REPLAY_API=1</code> (dev) or set <code>GOA2_ADMIN_TOKEN</code> (production).
          </p>
        ) : (
          <p className={styles.error}>Couldn't load reports: {error.message}</p>
        )}
      </div>
    );
  }
  if (!rows) return <div className={styles.page}>Loading reports…</div>;
  if (rows.length === 0)
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Bug Reports</h1>
        <p className={styles.hint}>No bug reports yet.</p>
      </div>
    );

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Bug Reports</h1>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Title</th>
            <th>Game</th>
            <th>Moment</th>
            <th>Reporter</th>
            <th>Reported</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={r.status === "resolved" ? styles.resolvedRow : undefined}>
              <td className={styles.titleCell}>
                <div className={styles.reportTitle}>{r.title}</div>
                {r.description && <div className={styles.desc}>{r.description}</div>}
              </td>
              <td className={styles.mono}>{r.game_id}</td>
              <td>
                R{r.round} · T{r.turn}
                {r.decision_index != null && (
                  <span className={styles.decision}> · #{r.decision_index}</span>
                )}
              </td>
              <td>{r.reporter_hero ? r.reporter_hero.replace(/^hero_/, "") : "spectator"}</td>
              <td>{fmt(r.created_at)}</td>
              <td>
                <span className={r.status === "open" ? styles.open : styles.resolved}>
                  {r.status}
                </span>
              </td>
              <td className={styles.actions}>
                <Link
                  to={`/replay/${r.game_id}${r.decision_index != null ? `?decision=${r.decision_index}` : ""}`}
                  className={styles.link}
                >
                  Open replay
                </Link>
                <button
                  className={styles.actionBtn}
                  disabled={busyId === r.id}
                  onClick={() => toggleStatus(r)}
                >
                  {r.status === "open" ? "Resolve" : "Reopen"}
                </button>
                <button
                  className={`${styles.actionBtn} ${styles.danger}`}
                  disabled={busyId === r.id}
                  onClick={() => remove(r)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
