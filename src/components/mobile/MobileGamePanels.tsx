import type { ReactNode } from "react";
import type { CardView, GameView } from "../../types/game";
import type { GameControllerModel } from "../../hooks/gameControllerModel";
import type { HeroNames } from "../../hooks/heroNames";
import type { TimestampedEvent } from "../../hooks/useGameSocket";
import { TEAM_COLORS } from "../../utils/colors";
import { HeroInfo } from "../ui/HeroInfo";
import { CardList } from "../ui/CardList";
import { DeckViewer } from "../ui/DeckViewer";
import { EventLog } from "../ui/EventLog";
import type { MobilePane } from "./useMobileNavigation";
import styles from "./MobileGameShell.module.css";

interface Props {
  pane: Exclude<MobilePane, "board">;
  view: GameView;
  model: Pick<GameControllerModel, "myHero" | "canCommit" | "waitingForCommitNames">;
  heroNames: HeroNames;
  selectedCardId: string | null;
  onSelectCard: (id: CardView["id"]) => void;
  onCommit: (id: CardView["id"]) => void;
  onViewDeck: () => void;
  onClose: () => void;
  eventLog: TimestampedEvent[];
  waitingForNames: string[];
  isMyInput: boolean;
  settings: ReactNode;
}

/** Reuse existing content for M1; richer mobile presentation follows in M2–M4. */
export function MobileGamePanels(props: Props) {
  const { pane, view, model: { myHero, canCommit, waitingForCommitNames } } = props;
  const heroes = Object.values(view.teams).flatMap((team) => team.heroes);
  switch (pane) {
    case "heroes":
      return <div className={styles.stack}>{heroes.map((hero) => (
        <HeroInfo key={hero.id} hero={hero} playerName={props.heroNames[hero.id]}
          isYou={hero.id === myHero?.id} phase={view.phase} turn={view.turn}
          onViewDeck={props.onViewDeck} />
      ))}</div>;
    case "hand":
      return myHero ? <CardList cards={myHero.hand} phase={view.phase} canCommit={canCommit}
        selectedId={props.selectedCardId} onSelectCard={props.onSelectCard} onCommit={props.onCommit}
        waitingForCommitNames={waitingForCommitNames} />
        : <p>Spectators do not have a hand.</p>;
    case "deck":
      return myHero && Array.isArray(myHero.deck)
        ? <DeckViewer hero={myHero} teamColor={TEAM_COLORS[myHero.team] ?? "#888"}
            onClose={props.onClose} embedded />
        : <p>Your deck is available when you are seated as a hero.</p>;
    case "log":
      return <EventLog eventLog={props.eventLog} view={view} waitingForNames={props.waitingForNames}
        isMyInput={props.isMyInput} embedded />;
    case "settings":
      return props.settings;
  }
}
