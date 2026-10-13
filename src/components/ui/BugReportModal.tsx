import { useEffect, useState } from "react";
import { submitBugReport } from "../../api/bugReports";
import styles from "./BugReportModal.module.css";

interface BugReportModalProps {
  gameId: string;
  token: string;
  onClose: () => void;
}

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 4000;

/**
 * In-game bug report form. The server snapshots the replay position at the
 * moment of submission, so the player only describes what went wrong — no
 * game state is collected client-side.
 */
export function BugReportModal({ gameId, token, onClose }: BugReportModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canSubmit = title.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitBugReport(gameId, token, title.trim(), description.trim());
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.heading}>Report a bug</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {done ? (
          <div className={styles.thanks}>
            <p>Thanks — the report was saved along with this exact game moment.</p>
            <button className={styles.primaryBtn} onClick={onClose}>
              Back to the game
            </button>
          </div>
        ) : (
          <>
            <p className={styles.hint}>
              Describe what went wrong. The current game moment is attached
              automatically, so you can keep playing right after.
            </p>
            <input
              className={styles.input}
              placeholder="Short summary (e.g. Arien Silver did not block skill)"
              value={title}
              maxLength={TITLE_MAX}
              autoFocus
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className={styles.textarea}
              placeholder="What did you do, what did you expect, what happened instead? (optional)"
              value={description}
              maxLength={DESCRIPTION_MAX}
              rows={5}
              onChange={(e) => setDescription(e.target.value)}
            />
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.actions}>
              <button className={styles.secondaryBtn} onClick={onClose}>
                Cancel
              </button>
              <button className={styles.primaryBtn} disabled={!canSubmit} onClick={handleSubmit}>
                {submitting ? "Submitting…" : "Submit report"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
