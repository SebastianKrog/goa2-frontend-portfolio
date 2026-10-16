import { useEffect, useState } from "react";
import {
  DEFAULT_BOARD_BRIGHTNESS,
  MAX_BOARD_BRIGHTNESS,
  MIN_BOARD_BRIGHTNESS,
} from "../../pages/boardBrightness";
import styles from "./GameTools.module.css";
import {
  DEFAULT_PLAYER_BOARD_LAYOUT,
  nextPlayerBoardLayout,
  type PlayerBoardLayout,
} from "../seating";

interface Props {
  onReportBug: () => void;
  /** Open the consensus-override panel. Absent for spectators. */
  onFixGameState?: () => void;
  /** Propose a table pause. Absent for spectators and untimed matches. */
  onRequestPause?: () => void;
  /** Open the spectator/seat link panel. */
  onShareLinks: () => void;
  onMobileView?: () => void;
  useLegacyHeroModels: boolean;
  onLegacyHeroModelsChange: (enabled: boolean) => void;
  playerBoardLayout: PlayerBoardLayout;
  onPlayerBoardLayoutChange: (layout: PlayerBoardLayout) => void;
  brightness: number;
  onBrightnessChange: (value: number) => void;
  showRemotePointers: boolean;
  onShowRemotePointersChange: (visible: boolean) => void;
}

const LAYOUT_LABELS: Record<PlayerBoardLayout, string> = {
  interleaved: "Mix",
  grouped: "Group",
  rows: "Rows",
};

const LAYOUT_NAMES: Record<PlayerBoardLayout, string> = {
  interleaved: "teams mixed",
  grouped: "teams grouped",
  rows: "tabletop rows",
};

const LAYOUT_HINTS: Record<PlayerBoardLayout, string> = {
  interleaved: "Teams alternate around the table",
  grouped: "Your team sits together",
  rows: "Each team in a row on its own side, with every committed card copied beside the map",
};

const CAMERA_RESET_EVENT = "goa2:camera-reset";

export function GameTools({
  onReportBug,
  onFixGameState,
  onRequestPause,
  onShareLinks,
  onMobileView,
  useLegacyHeroModels,
  onLegacyHeroModelsChange,
  playerBoardLayout,
  onPlayerBoardLayoutChange,
  brightness,
  onBrightnessChange,
  showRemotePointers,
  onShowRemotePointersChange,
}: Props) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [lightOpen, setLightOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select") || target?.isContentEditable) return;
      if (event.key === "?" || (event.key === "/" && event.shiftKey)) {
        event.preventDefault();
        setHelpOpen((open) => !open);
      }
      if (event.key === "Escape") {
        setHelpOpen(false);
        setLightOpen(false);
      }
    };
    document.addEventListener("fullscreenchange", onFullscreen);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const resetCamera = () => {
    window.dispatchEvent(new Event(CAMERA_RESET_EVENT));
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (document.fullscreenEnabled) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Fullscreen can be denied by browser or embedded-window policy. The
      // table stays fully usable, so no disruptive error toast is necessary.
    }
  };

  return (
    <div className={styles.root}>
      {helpOpen && (
        <div className={styles.help} role="dialog" aria-label="Table controls">
          <div className={styles.helpHeader}>
            <div>
              <span className={styles.eyebrow}>Table controls</span>
              <h2>Move around the battle</h2>
            </div>
            <button type="button" className={styles.close} onClick={() => setHelpOpen(false)} aria-label="Close controls help">
              ×
            </button>
          </div>
          <div className={styles.controlGrid}>
            <span className={styles.gesture}>Drag</span><span>Pan across the table</span>
            <span className={styles.gesture}>Right drag</span><span>Orbit the camera</span>
            <span className={styles.gesture}>Scroll</span><span>Zoom in and out</span>
            <span className={styles.gesture}>W A S D</span><span>Move the camera</span>
            <span className={styles.gesture}>R</span><span>Return to your seat</span>
            <span className={styles.gesture}>Alt</span><span>Inspect a hovered card or hero</span>
            <span className={styles.gesture}>1–9</span><span>Select a card from your hand</span>
            <span className={styles.gesture}>U</span><span>Undo when available</span>
          </div>
          {onMobileView && <button type="button" onClick={onMobileView}>Switch to mobile 2D</button>}
          <p className={styles.helpTip}>Green hexes are valid choices. Gold marks the hero currently resolving.</p>
        </div>
      )}

      <div className={styles.rail} aria-label="Table tools">
        <button type="button" onClick={resetCamera} aria-label="Reset camera" title="Return to your seat (R)">
          <span aria-hidden="true">⌂</span>
          <small>Reset</small>
        </button>
        <button
          type="button"
          className={playerBoardLayout === DEFAULT_PLAYER_BOARD_LAYOUT ? "" : styles.active}
          onClick={() => onPlayerBoardLayoutChange(nextPlayerBoardLayout(playerBoardLayout))}
          aria-label={`Table layout: ${LAYOUT_NAMES[playerBoardLayout]}. Next: ${LAYOUT_NAMES[nextPlayerBoardLayout(playerBoardLayout)]}`}
          title={LAYOUT_HINTS[playerBoardLayout]}
        >
          <span aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              {playerBoardLayout === "rows" ? (
                <>
                  <path d="M3 4h5v3H3zM9.5 4h5v3h-5zM16 4h5v3h-5z" />
                  <path d="M3 17h5v3H3zM9.5 17h5v3h-5zM16 17h5v3h-5z" />
                  <path d="M8 10h8v4H8z" />
                </>
              ) : (
                <>
                  <path d="M4 7h6v4H4zM14 7h6v4h-6zM4 15h6v4H4zM14 15h6v4h-6z" />
                  <path d="M10 9h4M10 17h4" />
                </>
              )}
            </svg>
          </span>
          <small>{LAYOUT_LABELS[playerBoardLayout]}</small>
        </button>
        <button
          type="button"
          className={helpOpen ? styles.active : ""}
          onClick={() => setHelpOpen((open) => !open)}
          aria-expanded={helpOpen}
          aria-label="Show table controls"
          title="Table controls (?)"
        >
          <span aria-hidden="true">?</span>
          <small>Help</small>
        </button>
        <button type="button" onClick={() => void toggleFullscreen()} aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"} title="Toggle fullscreen">
          <span aria-hidden="true">{isFullscreen ? "↙" : "↗"}</span>
          <small>{isFullscreen ? "Exit" : "Focus"}</small>
        </button>
        <button
          type="button"
          className={showRemotePointers ? styles.active : ""}
          onClick={() => onShowRemotePointersChange(!showRemotePointers)}
          aria-pressed={showRemotePointers}
          aria-label={showRemotePointers ? "Hide other players' cursors" : "Show other players' cursors"}
          title={showRemotePointers ? "Hide other players' cursors" : "Show other players' cursors"}
        >
          <span aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M4 3.5 18.5 14l-6 .8 3.2 5.2-2.7 1.5-3-5.3L6 20 4 3.5Z" />
            </svg>
          </span>
          <small>Cursors</small>
        </button>
        <div className={styles.railItem}>
          {lightOpen && (
            <div className={styles.lightPopover} role="dialog" aria-label="Board brightness">
              <label htmlFor="board-brightness">Brightness</label>
              <input
                id="board-brightness"
                type="range"
                min={MIN_BOARD_BRIGHTNESS}
                max={MAX_BOARD_BRIGHTNESS}
                step={0.05}
                value={brightness}
                onChange={(event) => onBrightnessChange(Number(event.target.value))}
              />
              <div className={styles.lightPopoverFooter}>
                <span>{Math.round(brightness * 100)}%</span>
                <button type="button" onClick={() => onBrightnessChange(DEFAULT_BOARD_BRIGHTNESS)}>
                  Reset
                </button>
              </div>
            </div>
          )}
          <button
            type="button"
            className={lightOpen ? styles.active : ""}
            onClick={() => setLightOpen((open) => !open)}
            aria-expanded={lightOpen}
            aria-label="Adjust board brightness"
            title="Adjust board brightness"
          >
            <span aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
              </svg>
            </span>
            <small>Light</small>
          </button>
        </div>
        <button
          type="button"
          className={useLegacyHeroModels ? styles.active : ""}
          onClick={() => onLegacyHeroModelsChange(!useLegacyHeroModels)}
          aria-pressed={useLegacyHeroModels}
          aria-label={useLegacyHeroModels ? "Use painted hero models" : "Use legacy hero models"}
          title={useLegacyHeroModels ? "Switch to painted hero models" : "Switch to legacy hero models"}
        >
          <span aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M12 3 5.5 6.5v7L12 17l6.5-3.5v-7L12 3Z" />
              <path d="m5.5 6.5 6.5 3.6 6.5-3.6M12 10.1V17M8 19h8" />
            </svg>
          </span>
          <small>{useLegacyHeroModels ? "Painted" : "Legacy"}</small>
        </button>
        <button
          type="button"
          onClick={onShareLinks}
          aria-label="Share this match"
          title="Get the watch link, or ask the table for a seat link"
        >
          <span aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.3 1.3" />
              <path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.3-1.3" />
            </svg>
          </span>
          <small>Share</small>
        </button>
        {onRequestPause && (
          <button
            type="button"
            onClick={onRequestPause}
            aria-label="Request a pause"
            title="Ask the table to pause (majority vote)"
          >
            <span aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M8 5h3v14H8V5Zm5 0h3v14h-3V5Z" />
              </svg>
            </span>
            <small>Pause</small>
          </button>
        )}
        {onFixGameState && (
          <button
            type="button"
            onClick={onFixGameState}
            aria-label="Fix game state"
            title="Propose a table override (majority vote)"
          >
            <span aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M14.5 6.5a4 4 0 0 0-5.6 5L4 16.4V20h3.6l4.9-4.9a4 4 0 0 0 5-5.6l-2.7 2.7-2.1-.4-.4-2.1 2.2-3.2Z" />
              </svg>
            </span>
            <small>Fix</small>
          </button>
        )}
        <button type="button" onClick={onReportBug} aria-label="Report a bug" title="Report a bug">
          <span aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M8 9h8v7a4 4 0 0 1-8 0V9Z" />
              <path d="M9.5 9V7.5a2.5 2.5 0 0 1 5 0V9M12 9v11M5 13h3m8 0h3M6 8l2.5 2M18 8l-2.5 2M5 18l3-2m11 2-3-2" />
            </svg>
          </span>
          <small>Report</small>
        </button>
      </div>
    </div>
  );
}
