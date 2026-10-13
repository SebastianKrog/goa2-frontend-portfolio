import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getDraft } from "../../api/draft";
import { useDraftSocket } from "../../hooks/useDraftSocket";
import type { DraftView } from "../../types/draft";
import { ClaimingPhase } from "../draft/ClaimingPhase";
import { DraftingPhase } from "../draft/DraftingPhase";
import { JoinScreen } from "../draft/JoinScreen";
import { LobbyPhase } from "../draft/LobbyPhase";
import styles from "../draft/Draft.module.css";

export function DraftLobby() {
  const { draftId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const location = useLocation();
  const navigate = useNavigate();

  // The host's spectator token is handed over via navigation state from DraftCreate.
  const navigationSpectatorToken = (location.state as { spectatorToken?: string } | null)?.spectatorToken;
  const spectatorStorageKey = `goa2-draft-spectator-${draftId}`;
  const spectatorToken = navigationSpectatorToken ?? sessionStorage.getItem(spectatorStorageKey);

  useEffect(() => {
    if (navigationSpectatorToken) sessionStorage.setItem(spectatorStorageKey, navigationSpectatorToken);
  }, [navigationSpectatorToken, spectatorStorageKey]);

  const { view: liveView, connected, error: wsError } = useDraftSocket(draftId, token);
  const [localView, setLocalView] = useState<DraftView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const errorTimer = useRef<number | null>(null);

  // Seed initial state over REST (also surfaces invalid/expired token + 404).
  useEffect(() => {
    if (!draftId || !token) return;
    let cancelled = false;
    getDraft(draftId, token)
      .then((v) => !cancelled && setLocalView(v))
      .catch((e) => !cancelled && setLoadError(e instanceof Error ? e.message : "Failed to load draft"));
    return () => {
      cancelled = true;
    };
  }, [draftId, token]);

  // Live broadcasts are freshest once connected; fall back to the REST seed.
  const view = liveView ?? localView;

  useEffect(() => {
    const currentStep = view?.draft.sequence[view.draft.current_index];
    const isMyTurn = !!view?.you?.is_captain && currentStep?.team === view.you.team;
    document.title = isMyTurn
      ? `Your turn · ${currentStep.action === "BAN" ? "Ban" : "Pick"} a hero`
      : "Draft Lobby - Guards of Atlantis II";
  }, [view]);

  const onUpdate = useCallback((v: DraftView) => setLocalView(v), []);
  const onError = useCallback((msg: string) => {
    setActionError(msg);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = window.setTimeout(() => setActionError(null), 5000);
  }, []);

  const handleJoined = useCallback(
    (newToken: string) => {
      setSearchParams({ token: newToken }, { replace: true });
    },
    [setSearchParams]
  );

  // Once the game exists, players hand off to the normal game flow.
  const gameId = view?.game_id;
  const gameToken = view?.game_token;
  useEffect(() => {
    if (gameId && gameToken) {
      navigate(`/game/${gameId}?token=${gameToken}`);
    }
  }, [gameId, gameToken, navigate]);

  if (!draftId) {
    return <ErrorPanel title="Missing draft" message="No draft id in the URL." />;
  }

  // No token: this is a shared join link — let the visitor join.
  if (!token) {
    return (
      <div className={styles.page}>
        <div className={styles.panel}>
          <JoinScreen draftId={draftId} onJoined={handleJoined} />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <ErrorPanel
        title="Can't open this draft"
        message={`${loadError}. The link may be invalid or expired.`}
      />
    );
  }

  if (!view) {
    return (
      <div className={styles.page}>
        <div className={styles.panel}>
          <div className={styles.loading}>Loading draft…</div>
        </div>
      </div>
    );
  }

  const { draft } = view;
  const status = draft.status;

  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.topBar}>
          <Link to="/" className={styles.back}>
            ← Home
          </Link>
          <div className={styles.topMeta}>
            <span className={styles.statusPill}>{status === "LOBBY" ? "Lobby" : status === "DRAFTING" ? "Drafting" : status === "CLAIMING" ? "Choose heroes" : "Ready"}</span>
            <span className={styles.metaText}>
              {draft.game_type === "LONG" ? "Long game" : "Quick game"} · {draft.draft_mode}
            </span>
          </div>
          <span className={`${styles.connDot} ${connected ? styles.connOn : styles.connOff}`} aria-live="polite">
            {connected ? "Live" : "Reconnecting…"}
          </span>
        </div>

        <div className={styles.phaseBody}>
          {status === "LOBBY" && (
            <LobbyPhase
              view={view}
              draftId={draftId}
              token={token}
              spectatorToken={spectatorToken}
              onUpdate={onUpdate}
              onError={onError}
            />
          )}
          {status === "DRAFTING" && (
            <DraftingPhase
              view={view}
              draftId={draftId}
              token={token}
              onUpdate={onUpdate}
              onError={onError}
            />
          )}
          {status === "CLAIMING" && (
            <ClaimingPhase
              view={view}
              draftId={draftId}
              token={token}
              onUpdate={onUpdate}
              onError={onError}
            />
          )}
          {status === "COMPLETE" && (
            <div className={styles.centerCard}>
              <div className={styles.joinTitle}>Game ready</div>
              {gameId && gameToken ? (
                <>
                  <div className={styles.joinSub}>Taking you to the game…</div>
                  <Link className={styles.primaryBtn} to={`/game/${gameId}?token=${gameToken}`}>
                    Open game
                  </Link>
                </>
              ) : (
                <div className={styles.joinSub}>
                  The game has started. Spectators can watch from the game link shared by a player.
                </div>
              )}
            </div>
          )}
        </div>

        {(actionError || wsError) && (
          <div className={styles.toast} role="alert">{actionError || wsError}</div>
        )}
      </div>
    </div>
  );
}

function ErrorPanel({ title, message }: { title: string; message: string }) {
  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.centerCard}>
          <div className={styles.joinTitle}>{title}</div>
          <div className={styles.joinSub}>{message}</div>
          <Link className={styles.primaryBtn} to="/">
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
