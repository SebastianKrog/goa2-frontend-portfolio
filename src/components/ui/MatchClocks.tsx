import type { GameClockView, HeroView, PlayerClockView } from "../../types/game";
import { bankMs, formatClock } from "../../hooks/useSynchronizedClock";
import styles from "./MatchClocks.module.css";
import { useLocalizedHeroNames } from "../../i18n/useLocalizedHeroNames";

interface Props {
  heroes: HeroView[];
  clock: GameClockView;
  phase: string;
  align?: "left" | "right";
}

function activeTotal(player: PlayerClockView, clock: GameClockView): number {
  switch (clock.active?.kind) {
    case "PLANNING": return player.planning_allowance_ms + player.time_bank_ms;
    case "RESOLUTION": return player.initiative_bonus_ms + player.resolution_allowance_ms + player.time_bank_ms;
    case "RESPONSE": return player.response_time_ms + player.resolution_allowance_ms + player.time_bank_ms;
    case "LEVEL_UP": return player.upgrade_allowance_ms + player.time_bank_ms;
    default: return player.time_bank_ms;
  }
}

function phasePools(player: PlayerClockView, phase: string) {
  if (phase === "PLANNING") {
    return player.planning_complete
      ? [{ label: "Plan", value: null, text: "Locked" }]
      : [{ label: "Plan", value: player.planning_allowance_ms }];
  }
  if (phase === "RESOLUTION") {
    return [
      ...(player.initiative_bonus_ms > 0
        ? [{ label: "Bonus", value: player.initiative_bonus_ms }]
        : []),
      ...(player.response_time_ms > 0 ? [{ label: "Resp", value: player.response_time_ms }] : []),
      { label: "Resolve", value: player.resolution_allowance_ms },
    ];
  }
  if (phase === "LEVEL_UP") return [{ label: "Upgrade", value: player.upgrade_allowance_ms }];
  return [];
}

export function MatchClocks({ heroes, clock, phase, align = "left" }: Props) {
  const localizedHeroName = useLocalizedHeroNames();
  return (
    <div className={`${styles.list} ${align === "right" ? styles.right : ""}`}>
      {heroes.map((hero) => {
        const player = clock.players[hero.id];
        if (!player) return null;
        const total = activeTotal(player, clock);
        const bank = bankMs(player);
        const eligible = clock.active?.hero_ids.includes(hero.id) ?? false;
        // Advisory clocks have no deadline to dread, so they never go red.
        // An overrun is still worth marking — quietly.
        const urgency = !clock.enforce_timeouts
          ? bank < 0
            ? styles.over
            : ""
          : player.running
            ? total < 10_000
              ? styles.critical
              : total < 30_000
                ? styles.warning
                : styles.running
            : "";
        return (
          <div
            key={hero.id}
            className={`${styles.clock} ${eligible ? styles.eligible : ""} ${urgency}`}
            title={`Planning ${formatClock(player.planning_allowance_ms)} · Resolution ${formatClock(player.resolution_allowance_ms)} · Initiative Bonus ${formatClock(player.initiative_bonus_ms)} · Response ${formatClock(player.response_time_ms)} · Upgrade ${formatClock(player.upgrade_allowance_ms)} · Time Bank ${formatClock(bank)}`}
          >
            <span className={styles.hero}>{localizedHeroName(hero.id, hero.name)}</span>
            <span className={styles.pools}>
              {phasePools(player, phase).map((pool) => (
                <span key={pool.label}>
                  <small>{pool.label}</small>
                  <strong>{pool.value === null ? pool.text : formatClock(pool.value)}</strong>
                </span>
              ))}
              <span className={styles.bank}>
                <small>Bank</small>
                <strong>{formatClock(bank)}</strong>
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
