import { useEffect, useState } from "react";
import { fetchSpectatorToken } from "../../api/rest";
import type { GameView } from "../../types/game";
import styles from "./ShareLinksPanel.module.css";
import { useLocalizedHeroNames } from "../../i18n/useLocalizedHeroNames";

interface Props {
  gameId: string;
  /** Link origin, e.g. `window.location.origin`. */
  origin: string;
  /** The viewer's own token, used to authenticate the spectator-link fetch. */
  token: string;
  view: GameView;
  heroNames: Record<string, string>;
  /** null for spectators, who may read the watch link but call no vote. */
  myHeroId: string | null;
  /** hero_id -> seat token, for reveals the table has already approved. */
  revealedPlayerTokens: Record<string, string>;
  /** A proposal is already open; the server allows only one at a time. */
  proposalOpen: boolean;
  onRequestPlayerLink: (heroId: string) => void;
  onClose: () => void;
  /** Test seam — production fetches lazily. */
  preloadedSpectatorToken?: string;
}

function gameUrl(origin: string, gameId: string, token: string): string {
  return `${origin}/game/${gameId}?token=${token}`;
}

function CopyRow({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => setCopied(false));
  };

  return (
    <div className={styles.linkRow}>
      <input readOnly value={url} aria-label={label} onFocus={(e) => e.target.select()} />
      <button type="button" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function ShareLinksPanel({
  gameId,
  origin,
  token,
  view,
  heroNames,
  myHeroId,
  revealedPlayerTokens,
  proposalOpen,
  onRequestPlayerLink,
  onClose,
  preloadedSpectatorToken,
}: Props) {
  const localizedHeroName = useLocalizedHeroNames();
  const [spectatorToken, setSpectatorToken] = useState<string | null>(
    preloadedSpectatorToken ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (spectatorToken) return;
    let cancelled = false;
    fetchSpectatorToken(gameId, token)
      .then((data) => {
        if (!cancelled) setSpectatorToken(data.spectator_token);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [gameId, token, spectatorToken]);

  const heroes = Object.values(view.teams).flatMap((team) =>
    team.heroes.map((hero) => ({
      id: hero.id,
      name: localizedHeroName(hero.id, hero.name),
    })),
  );

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.panel}
        role="dialog"
        aria-label="Share this match"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.titleRow}>
          <h2>Share this match</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <section className={styles.section}>
          <h3>Watch link</h3>
          <p className={styles.hint}>
            Anyone with this link can watch, and sees only what a spectator sees.
            Share it freely — no vote needed.
          </p>
          {error && <p className={styles.warning}>{error}</p>}
          {!error &&
            (spectatorToken ? (
              <CopyRow url={gameUrl(origin, gameId, spectatorToken)} label="Spectator link" />
            ) : (
              <p className={styles.hint}>Loading the watch link…</p>
            ))}
        </section>

        <section className={styles.section}>
          <h3>Seat links</h3>
          <p className={styles.hint}>
            A seat link hands over a player's hand and their turns, so the table
            votes on it. Use it when someone drops out and a substitute steps in.
          </p>
          <ul className={styles.heroList}>
            {heroes.map((hero) => {
              const revealed = revealedPlayerTokens[hero.id];
              const label = heroNames[hero.id] || hero.name;
              return (
                <li key={hero.id} className={styles.heroRow}>
                  <div className={styles.heroHeader}>
                    <span className={styles.heroName}>
                      {label}
                      {hero.id === myHeroId && <em className={styles.you}> — you</em>}
                    </span>
                    {!revealed && myHeroId && (
                      <button
                        type="button"
                        className={styles.ask}
                        disabled={proposalOpen}
                        onClick={() => onRequestPlayerLink(hero.id)}
                        title={
                          proposalOpen
                            ? "Another proposal is already open"
                            : "Ask the table to release this seat link (majority vote)"
                        }
                      >
                        Ask the table
                      </button>
                    )}
                  </div>
                  {revealed && (
                    <CopyRow url={gameUrl(origin, gameId, revealed)} label={`${label} seat link`} />
                  )}
                </li>
              );
            })}
          </ul>
          {!myHeroId && (
            <p className={styles.hint}>Only players at the table can call this vote.</p>
          )}
          <p className={styles.hint}>
            A released seat link keeps working for whoever already had it — the
            departing player is not locked out.
          </p>
        </section>
      </div>
    </div>
  );
}
