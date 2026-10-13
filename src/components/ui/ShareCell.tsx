import { useState } from "react";
import { createShare, revokeShare, shareUrl, type ShareSummary } from "../../api/replay";
import { copyText } from "../../utils/clipboard";
import styles from "./ShareCell.module.css";

interface Props {
  gameId: string;
  share: ShareSummary | undefined;
  /** Called after a successful mint or revoke so the list can refresh. */
  onChanged: () => void;
}

function fmtSize(bytes: number): string {
  if (!bytes) return "";
  return bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1e3)} KB`;
}

/**
 * Share controls for one replay row: mint, copy the link, or revoke it.
 *
 * Minting re-simulates the whole game server-side, so it can take seconds on a
 * slow host — hence the explicit busy state rather than an optimistic update.
 */
export function ShareCell({ gameId, share, onChanged }: Props) {
  const [busy, setBusy] = useState<"share" | "revoke" | null>(null);
  const [copied, setCopied] = useState(false);
  // Set when the clipboard is unavailable (insecure context): show the URL so
  // the link is still reachable by hand.
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const url = share ? shareUrl(share.token) : null;

  const doShare = async () => {
    setBusy("share");
    setError(null);
    try {
      const res = await createShare(gameId);
      const full = `${window.location.origin}${res.url}`;
      if (await copyText(full)) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        setFallbackUrl(full);
      }
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to share");
    } finally {
      setBusy(null);
    }
  };

  const doCopy = async () => {
    if (!url) return;
    if (await copyText(url)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setFallbackUrl(url);
    }
  };

  const doRevoke = async () => {
    if (!share) return;
    setBusy("revoke");
    setError(null);
    try {
      await revokeShare(share.token);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke");
    } finally {
      setBusy(null);
    }
  };

  if (error) {
    return (
      <span className={styles.error} title={error}>
        {error}
      </span>
    );
  }

  if (!share) {
    return (
      <button className={styles.button} onClick={doShare} disabled={busy !== null}>
        {busy === "share" ? "Preparing…" : "Share"}
      </button>
    );
  }

  return (
    <span className={styles.wrap}>
      <span className={styles.badge} title={`${fmtSize(share.size_bytes)} baked`}>
        shared
      </span>
      <button className={styles.button} onClick={doCopy}>
        {copied ? "copied ✓" : "copy link"}
      </button>
      <button
        className={styles.danger}
        onClick={doRevoke}
        disabled={busy !== null}
        title="Delete the baked artifact and kill the link"
      >
        {busy === "revoke" ? "…" : "revoke"}
      </button>
      {fallbackUrl && <input className={styles.fallback} readOnly value={fallbackUrl} />}
    </span>
  );
}
