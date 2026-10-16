import { CardList } from "./CardList";
import { HeroInfo } from "./HeroInfo";
import { CheatPanel } from "./CheatPanel";
import type { ActivePing, GameView, PingTarget } from "../../types/game";
import type { GameControllerModel } from "../../hooks/gameControllerModel";
import type { HeroNames } from "../../hooks/heroNames";
import { CHEATS_AVAILABLE } from "../../config/features";
import styles from "./Sidebar.module.css";
import { presentPings } from "../../utils/pings";

interface Props {
  view: GameView;
  myHeroId: string | null;
  model: Pick<GameControllerModel, "myHero" | "canCommit" | "waitingForCommitNames">;
  heroNames?: HeroNames;
  isMyTurn?: boolean;
  selectedCardId: string | null;
  onSelectCard: (cardId: string) => void;
  onCommit: (cardId: string) => void;
  onGiveGold?: (heroId: string, amount: number) => void;
  pings?: ActivePing[];
  onPingTargetHover?: (target: PingTarget | null) => void;
}

export function Sidebar({ view, myHeroId, model, heroNames = {}, isMyTurn, selectedCardId, onSelectCard, onCommit, onGiveGold, pings = [], onPingTargetHover }: Props) {
  const { myHero, canCommit, waitingForCommitNames } = model;
  const otherHeroes = Object.values(view.teams).flatMap((team) => team.heroes)
    .filter((hero) => hero.id !== myHeroId);
  const presentedPings = presentPings(view, pings);

  return (
    <div className={styles.sidebar}>
      {CHEATS_AVAILABLE && view.cheats_enabled && onGiveGold && (
        <CheatPanel view={view} myHeroId={myHeroId} onGiveGold={onGiveGold} />
      )}
      {myHero && (
        <div className={isMyTurn ? styles.turnActive : undefined}>
          <HeroInfo hero={myHero} playerName={heroNames[myHero.id]} isYou phase={view.phase} turn={view.turn} pings={presentedPings} onPingTargetHover={onPingTargetHover} />
          <CardList
            cards={myHero.hand}
            phase={view.phase}
            canCommit={canCommit}
            waitingForCommitNames={waitingForCommitNames}
            selectedId={selectedCardId}
            onSelectCard={onSelectCard}
            onCommit={onCommit}
          />
        </div>
      )}
      {otherHeroes.map((hero) => (
        <HeroInfo key={hero.id} hero={hero} playerName={heroNames[hero.id]} turn={view.turn} pings={presentedPings} onPingTargetHover={onPingTargetHover} />
      ))}
    </div>
  );
}
