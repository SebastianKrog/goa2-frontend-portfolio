import { useState } from "react";
import { createPlayerShare } from "../../api/rest";
import { copyText } from "../../utils/clipboard";
import styles from "./ReplayShareButton.module.css";

interface Props {
  gameId: string;
  /** The viewer's own player token; spectators cannot mint a share. */
  token: string;
}

/**
 * Mint the durable replay link for a finished match and copy it.
 *
 * Minting re-simulates and bakes the whole game server-side, so it can take
 * seconds; the busy state is explicit rather than optimistic. The server is
 * idempotent, so pressing it again returns the same link.
 */
export function ReplayShareButton({ gameId, token }: Props) {
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Set when the clipboard is unavailable (insecure context): show the URL so
  // the link is still reachable by hand.
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const flashCopied = async (full: string) => {
    if (await copyText(full)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      setFallbackUrl(full);
    }
  };

  const share = async () => {
    if (url) {
      await flashCopied(url);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await createPlayerShare(gameId, token);
      const full = `${window.location.origin}${res.url}`;
      setUrl(full);
      await flashCopied(full);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create the replay link");
    } finally {
      setBusy(false);
    }
  };

  const label = busy ? "Preparing…" : copied ? "Link copied" : url ? "Copy replay link" : "Share replay";

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.button}
        onClick={() => void share()}
        disabled={busy}
        title="Create a public replay link for this finished match"
      >
        <span aria-hidden="true" className={styles.icon}>
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.3 1.3" />
            <path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.3-1.3" />
          </svg>
        </span>
        {label}
      </button>
      {error && <span className={styles.error}>{error}</span>}
      {fallbackUrl && (
        <input
          className={styles.fallback}
          readOnly
          value={fallbackUrl}
          aria-label="Replay link"
          onFocus={(event) => event.target.select()}
        />
      )}
    </div>
  );
}
