import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { adminReplaySource, createShare, sharedReplaySource } from "../../api/replay";
import { copyText } from "../../utils/clipboard";
import { Board3D } from "../board3d/Board3D";
import { useReplay } from "../../hooks/useReplay";
import { ReplayControls } from "../ui/ReplayControls";
import { DecisionTimeline } from "../ui/DecisionTimeline";
import { ReplayRosterPanel } from "../ui/ReplayRosterPanel";
import { AdminTokenPrompt } from "../ui/AdminTokenPrompt";
import { ErrorToast } from "../ui/ErrorToast";
import { resolveWinnerDisplay } from "../../utils/winner";
import styles from "./ReplayViewer.module.css";
import { useLocalizedHeroNames } from "../../i18n/useLocalizedHeroNames";

// Read-only viewer: Board3D never submits input, so the click handlers are no-ops.
const noopHex = () => {};
const noopUnit = () => {};

/**
 * The replay debugger. Serves two routes with one component:
 * `/replay/:gameId` (admin, reconstructed on demand) and `/shared/:token`
 * (public, pre-baked). Only the data source and the share affordance differ.
 */
export function ReplayViewer() {
  const localizedHeroName = useLocalizedHeroNames();
  const { gameId, token } = useParams<{ gameId?: string; token?: string }>();
  const shared = token != null;
  // Memoized: useReplay takes this as an effect dependency.
  const source = useMemo(
    () => (token ? sharedReplaySource(token) : gameId ? adminReplaySource(gameId) : null),
    [gameId, token]
  );
  const [searchParams, setSearchParams] = useSearchParams();
  // Deep link from a bug report: open positioned at the reported moment.
  const decisionParam = searchParams.get("decision");
  const calibrationMode = searchParams.get("calibrate");
  const calibrate = calibrationMode === "1" || calibrationMode === "models";
  const modelCalibrationOnly = calibrationMode === "models";
  const heroSwapParam = searchParams.get("swap") ?? "";
  const heroSwap = useMemo(
    () => heroSwapParam
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
    [heroSwapParam],
  );
  const originalHeroParam = searchParams.get("original") ?? "";
  const originalHeroUnits = useMemo(
    () => originalHeroParam
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
    [originalHeroParam],
  );
  const initialDecision = decisionParam != null ? parseInt(decisionParam, 10) : undefined;
  const r = useReplay(
    source,
    initialDecision != null && Number.isFinite(initialDecision) ? initialDecision : undefined
  );
  const [shareState, setShareState] = useState<"idle" | "baking" | "copied" | "failed">("idle");
  const [shareError, setShareError] = useState<string | null>(null);

  // Baking walks the whole game once, so this takes seconds on a slow host.
  const handleShare = useCallback(async () => {
    if (!gameId) return;
    setShareState("baking");
    setShareError(null);
    try {
      const { url } = await createShare(gameId);
      const full = `${window.location.origin}${url}`;
      // Only claim "copied" if it actually was; otherwise surface the URL.
      if (await copyText(full)) {
        setShareState("copied");
      } else {
        setShareState("idle");
        setShareError(`Share link (copy manually): ${full}`);
      }
    } catch (e) {
      setShareState("failed");
      setShareError(e instanceof Error ? e.message : "Failed to create share link");
    }
  }, [gameId]);
  const winnerDisplay = r.view
    ? resolveWinnerDisplay(r.view, r.winner, localizedHeroName)
    : null;
  const tieBreakerTeam = r.view?.tie_breaker_team;
  const tieBreakerIcon = tieBreakerTeam === "RED"
    ? "/icons/tiebreaker_orange.png"
    : "/icons/tiebreaker_blue.png";

  const updateSearchParams = useCallback((mutate: (next: URLSearchParams) => void) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      mutate(next);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const toggleCalibration = useCallback(() => {
    updateSearchParams((next) => {
      if (calibrate) next.delete("calibrate");
      else next.set("calibrate", "models");
    });
  }, [calibrate, updateSearchParams]);

  const handleHeroSwapChange = useCallback((models: string[]) => {
    updateSearchParams((next) => {
      if (models.length > 0) next.set("swap", models.join(","));
      else next.delete("swap");
    });
  }, [updateSearchParams]);
  const handleOriginalHeroUnitsChange = useCallback((unitIds: string[]) => {
    updateSearchParams((next) => {
      if (unitIds.length > 0) next.set("original", unitIds.join(","));
      else next.delete("original");
    });
  }, [updateSearchParams]);

  useEffect(() => {
    document.title = "Replay Viewer - Guards of Atlantis II";
  }, []);

  // A share link is public, so a 401 cannot happen and there is no token to ask for.
  if (r.authRequired && !shared) {
    return (
      <div className={styles.loading}>
        <AdminTokenPrompt onSaved={() => window.location.reload()} />
      </div>
    );
  }

  if (r.notFound) {
    return (
      <div className={styles.loading}>
        {shared ? (
          "This share link is no longer valid."
        ) : (
          <>
            Replay not found. <Link to="/replays">← Back to replays</Link>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <div className={styles.topbar}>
        {shared ? (
          <span className={styles.back}>Shared replay</span>
        ) : (
          <Link to="/replays" className={styles.back}>← Replays</Link>
        )}
        {!shared && <span className={styles.gid}>{gameId}</span>}
        {r.view && (
          <span className={styles.phase}>
            {r.view.phase} · R{r.view.round} · T{r.view.turn}
          </span>
        )}
        {tieBreakerTeam && (
          <span
            className={styles.tieBreaker}
            title={`${tieBreakerTeam} team wins ties during combat`}
            aria-label={`Tie-breaker: ${tieBreakerTeam} team wins ties during combat`}
          >
            <img src={tieBreakerIcon} alt="" />
            <span>{tieBreakerTeam} ties</span>
          </span>
        )}
        {winnerDisplay && (
          <span className={styles.winner}>
            WINNER: {winnerDisplay.label}
          </span>
        )}
        <button
          type="button"
          className={styles.calibrateButton}
          onClick={toggleCalibration}
        >
          {calibrate ? "Exit model calibration" : "Model calibration"}
        </button>
        {!shared && (
          <button
            type="button"
            className={styles.calibrateButton}
            onClick={handleShare}
            disabled={shareState === "baking"}
            title="Bake this finished game into a link anyone can open"
          >
            {shareState === "baking"
              ? "Preparing…"
              : shareState === "copied"
                ? "Link copied ✓"
                : "Share"}
          </button>
        )}
      </div>

      <div className={styles.main}>
        <div className={styles.boardArea}>
          <Board3D
            view={r.view}
            inputRequest={null}
            onHexClick={noopHex}
            onUnitClick={noopUnit}
            myHeroId={null}
            calibrate={calibrate}
            modelCalibrationOnly={modelCalibrationOnly}
            heroSwap={heroSwap}
            onHeroSwapChange={handleHeroSwapChange}
            originalHeroUnits={originalHeroUnits}
            onOriginalHeroUnitsChange={handleOriginalHeroUnitsChange}
            heroNames={r.setup?.player_names ?? {}}
          />
          {r.view && (
            <ReplayRosterPanel view={r.view} heroNames={r.setup?.player_names ?? {}} />
          )}
        </div>

        <DecisionTimeline
          decisions={r.decisions}
          currentIndex={r.idx}
          onJump={r.jumpToDecision}
        />
      </div>

      <ReplayControls
        idx={r.idx}
        total={r.total}
        round={r.position?.round ?? 0}
        turn={r.position?.turn ?? 0}
        loading={r.loading}
        onFirst={r.first}
        onPrev={r.prev}
        onNext={r.next}
        onLast={r.last}
        onJumpDecision={r.jumpToDecision}
        onJumpRoundTurn={r.jumpToRoundTurn}
      />

      {(r.error || shareError) && <ErrorToast message={shareError ?? r.error ?? ""} />}
    </div>
  );
}
