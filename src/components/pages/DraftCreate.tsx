import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createDraft } from "../../api/draft";
import styles from "./DraftCreate.module.css";
import { PLAYER_NAME_MAX_LENGTH } from "../../utils/playerName";

export function DraftCreate() {
  const navigate = useNavigate();
  const [hostName, setHostName] = useState(() => localStorage.getItem("goa2-display-name") ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Create Draft - Guards of Atlantis II";
  }, []);

  const canSubmit = hostName.trim().length > 0 && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      // Match settings (map, game type, draft mode, cheats) and team sizes are all
      // chosen inside the lobby — creating only needs the host's name.
      const res = await createDraft({ host_name: hostName.trim() });
      localStorage.setItem("goa2-display-name", hostName.trim());
      navigate(`/draft/${res.draft_id}?token=${res.player_token}`, {
        state: { spectatorToken: res.spectator_token },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create draft");
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Link to="/" className={styles.back}>← Home</Link>
        <div className={styles.kicker}>Group draft</div>
        <h1 className={styles.title}>Open a table</h1>
        <p className={styles.intro}>You only need a name. Everything else is decided together in the lobby.</p>

        <form className={styles.form} autoComplete="off" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>How should your group see you?</span>
            <input
              className={styles.input}
              type="text"
              name="displayName"
              autoComplete="off"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="Your name"
              maxLength={PLAYER_NAME_MAX_LENGTH}
              autoFocus
            />
          </label>

          <div className={styles.nextSteps} aria-label="What happens next">
            <span><b>1</b> Share the lobby link</span>
            <span><b>2</b> Form teams and choose captains</span>
            <span><b>3</b> Ban, pick and play</span>
          </div>

          <button type="submit" className={styles.submit} disabled={!canSubmit}>
            {loading ? "Opening the table…" : "Create draft lobby"}
          </button>

          {error && <div className={styles.error} role="alert">{error}</div>}
        </form>
      </div>
    </div>
  );
}
