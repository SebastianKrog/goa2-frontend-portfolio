import { useState } from "react";
import { joinDraft } from "../../api/draft";
import styles from "./Draft.module.css";
import { PLAYER_NAME_MAX_LENGTH } from "../../utils/playerName";

interface JoinScreenProps {
  draftId: string;
  onJoined: (token: string) => void;
}

export function JoinScreen({ draftId, onJoined }: JoinScreenProps) {
  const [name, setName] = useState(() => localStorage.getItem("goa2-display-name") ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await joinDraft(draftId, name.trim());
      localStorage.setItem("goa2-display-name", name.trim());
      onJoined(res.player_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join");
      setLoading(false);
    }
  };

  return (
    <form className={styles.centerCard} autoComplete="off" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <div className={styles.joinKicker}>You’ve been invited</div>
      <h1 className={styles.joinTitle}>Join the draft</h1>
      <div className={styles.joinSub}>Choose the name your group will see at the table.</div>
      <input
        className={styles.joinInput}
        type="text"
        name="displayName"
        autoComplete="off"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        aria-label="Your name"
        maxLength={PLAYER_NAME_MAX_LENGTH}
        autoFocus
      />
      <button type="submit" className={styles.primaryBtn} disabled={!name.trim() || loading}>
        {loading ? "Taking your seat…" : "Join lobby"}
      </button>
      {error && <div className={styles.errorText} role="alert">{error}</div>}
    </form>
  );
}
