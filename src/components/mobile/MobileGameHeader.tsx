import type { GameView } from "../../types/game";
import type { PlayerGameStatus } from "../../utils/gameStatus";
import { resolveWinnerDisplay } from "../../utils/winner";
import { useLocalizedHeroNames } from "../../i18n/useLocalizedHeroNames";
import styles from "./MobileGameShell.module.css";

interface Props {
  view: GameView;
  winner: string | null;
  status?: PlayerGameStatus;
  connected: boolean;
}

export function MobileGameHeader({ view, winner, status, connected }: Props) {
  const heroName = useLocalizedHeroNames();
  const winnerDisplay = resolveWinnerDisplay(view, winner, heroName);
  return <header className={styles.header}>
    <span>Red: {view.teams.RED?.life_counters ?? 0} life</span>
    <span>Round {view.round} · Turn {view.turn}</span>
    <span>Blue: {view.teams.BLUE?.life_counters ?? 0} life</span>
    <div className={styles.status} role="status">
      <strong>{!connected ? "Disconnected — reconnecting" : winnerDisplay
        ? `${winnerDisplay.label} wins` : status?.title ?? "Watching the game"}</strong>
      <small>{view.phase.replace(/_/g, " ")}{status?.detail ? ` · ${status.detail}` : ""}</small>
    </div>
  </header>;
}
