import { CardList } from "./CardList";
import { HeroInfo } from "./HeroInfo";
import { CheatPanel } from "./CheatPanel";
import type { ActivePing, GameView, HeroView, PingTarget } from "../../types/game";
import type { HeroNames } from "../../hooks/heroNames";
import { CHEATS_AVAILABLE } from "../../config/features";
import styles from "./Sidebar.module.css";
import { presentPings } from "../../utils/pings";
import { useLocalizedHeroNames } from "../../i18n/useLocalizedHeroNames";

interface Props {
  view: GameView;
  myHeroId: string | null;
  heroNames?: HeroNames;
  isMyTurn?: boolean;
  selectedCardId: string | null;
  onSelectCard: (cardId: string) => void;
  onCommit: (cardId: string) => void;
  onGiveGold?: (heroId: string, amount: number) => void;
  pings?: ActivePing[];
  onPingTargetHover?: (target: PingTarget | null) => void;
}

export function Sidebar({ view, myHeroId, heroNames = {}, isMyTurn, selectedCardId, onSelectCard, onCommit, onGiveGold, pings = [], onPingTargetHover }: Props) {
  const localizedHeroName = useLocalizedHeroNames();
  let myHero: HeroView | null = null;
  const otherHeroes: HeroView[] = [];

  for (const team of Object.values(view.teams)) {
    for (const hero of team.heroes) {
      if (hero.id === myHeroId) {
        myHero = hero;
      } else {
        otherHeroes.push(hero);
      }
    }
  }

  // Also open while Emmitt's Alternative Timelines allows a second card.
  const canCommit = myHero?.current_turn_card === null || (myHero?.can_commit_second_card ?? false);
  const waitingForCommitNames = otherHeroes
    .filter((hero) => hero.current_turn_card === null)
    .map((hero) => localizedHeroName(hero.id, hero.name));
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
