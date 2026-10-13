import { useEffect, useState } from "react";
import type {
  ClockKind,
  GameClockView,
  PlayerClockView,
} from "../types/game";

const SPENDING_FIELDS: Record<ClockKind, Array<keyof PlayerClockView>> = {
  PLANNING: ["planning_allowance_ms", "time_bank_ms"],
  // The Initiative Bonus is spent first, and only here: a Response prompt
  // cannot draw on it. Mirrors _spending_fields() on the server.
  RESOLUTION: ["initiative_bonus_ms", "resolution_allowance_ms", "time_bank_ms"],
  RESPONSE: ["response_time_ms", "resolution_allowance_ms", "time_bank_ms"],
  LEVEL_UP: ["upgrade_allowance_ms", "time_bank_ms"],
};

function spend(
  player: PlayerClockView,
  kind: ClockKind,
  elapsedMs: number,
  allowOverrun: boolean,
) {
  let remaining = Math.max(0, elapsedMs);
  for (const field of SPENDING_FIELDS[kind]) {
    const available = Number(player[field]);
    const used = Math.min(available, remaining);
    (player[field] as number | boolean) = available - used;
    remaining -= used;
    if (remaining <= 0) break;
  }
  if (remaining > 0 && allowOverrun) player.overrun_ms += remaining;
}

export function projectClock(clock: GameClockView, elapsedMs: number): GameClockView {
  if (clock.status !== "RUNNING" || !clock.active || elapsedMs <= 0) return clock;
  const players = Object.fromEntries(
    Object.entries(clock.players).map(([heroId, player]) => [heroId, { ...player }]),
  );
  for (const heroId of clock.active.hero_ids) {
    const player = players[heroId];
    if (player?.running) {
      spend(player, clock.active.kind, elapsedMs, !clock.enforce_timeouts);
    }
  }
  return {
    ...clock,
    server_now_ms: clock.server_now_ms + elapsedMs,
    players,
  };
}

/**
 * Locally extrapolate a server snapshot. The offset is anchored when the
 * snapshot arrives; authoritative values are never decremented in React state.
 */
export function useSynchronizedClock(clock: GameClockView | null): GameClockView | null {
  const [localNow, setLocalNow] = useState(() => Date.now());

  useEffect(() => {
    if (clock?.status !== "RUNNING" || !clock.active) return;
    const timer = window.setInterval(() => setLocalNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [clock?.status, clock?.active]);

  if (!clock) return null;
  const receivedAt = clock.client_received_at_ms ?? localNow;
  const estimatedServerNow = clock.server_now_ms + Math.max(0, localNow - receivedAt);
  return projectClock(clock, estimatedServerNow - clock.server_now_ms);
}

export function formatClock(milliseconds: number): string {
  const sign = milliseconds < 0 ? "-" : "";
  const safe = Math.abs(milliseconds);
  if (safe < 10_000) return `${sign}${(safe / 1000).toFixed(1)}s`;
  const totalSeconds = Math.ceil(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${sign}${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** The Time Bank as players read it: negative once a hero has overrun. */
export function bankMs(player: PlayerClockView): number {
  return player.time_bank_ms - player.overrun_ms;
}
