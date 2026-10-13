import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  isMuted,
  setMuted,
  getVolume,
  setVolume,
  subscribeSettings,
} from "../../../audio/audioEngine";
import styles from "./SoundControls.module.css";

/**
 * Collapsed sound control: a small, dim speaker icon in the corner that opens a
 * volume popover on click (and closes on click-outside). Sound settings are a
 * set-once-or-twice affair over a long game, so the slider stays tucked away
 * until summoned rather than occupying the HUD permanently.
 */
export function SoundControls() {
  const muted = useSyncExternalStore(subscribeSettings, isMuted, isMuted);
  const volume = useSyncExternalStore(subscribeSettings, getVolume, getVolume);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pct = muted ? 0 : Math.round(volume * 100);
  const silent = muted || pct === 0;
  const icon = silent ? "\u{1F507}" : "\u{1F50A}";

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    <div ref={ref} className={styles.root}>
      {open && (
        <div className={styles.popover}>
          <button
            type="button"
            onClick={() => setMuted(!muted)}
            aria-label={muted ? "Unmute sound" : "Mute sound"}
            title={muted ? "Unmute sound" : "Mute sound"}
            className={styles.muteBtn}
          >
            {icon}
          </button>
          <input
            type="range"
            min={0}
            max={150}
            step={5}
            value={pct}
            onChange={(e) => {
              const v = Number(e.target.value) / 100;
              if (muted && v > 0) setMuted(false);
              setVolume(v);
            }}
            aria-label="Sound volume"
            className={styles.slider}
          />
          <span className={styles.volume}>{pct}%</span>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Sound settings"
        title="Sound settings"
        className={`${styles.trigger} ${open ? styles.open : ""}`}
      >
        {icon}
      </button>
    </div>
  );
}
