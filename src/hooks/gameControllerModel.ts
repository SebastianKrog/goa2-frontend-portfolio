import type { CardView, GameView, HeroView, InputOption, InputRequest, StartingPositionView } from "../types/game";
import type { HeroNameResolver } from "../i18n/useLocalizedHeroNames";
import { buildPlayerGameStatus, formatWaitingTitle, isMatchFrozen, resolveWaitingForNames, type PlayerGameStatus } from "../utils/gameStatus";
import { offBoardUnitOptions } from "../utils/offBoardUnitChoice";
import { canPingInPhase } from "../utils/pings";

export interface GameControllerModel {
  myTeam: string | null;
  myHero: HeroView | null;
  frozen: boolean;
  isMyInput: boolean;
  isMyUpgradePhase: boolean;
  offBoardUnitChoice: InputOption[] | null;
  effectiveInputRequest: InputRequest | null;
  startingPosition: StartingPositionView | null;
  isPlanning: boolean;
  canPing: boolean;
  canRequestPause: boolean;
  canCommitSecond: boolean;
  planningLocked: boolean;
  canCommit: boolean;
  canUncommit: boolean;
  committedCards: CardView[];
  committedCardNames: string[];
  waitingForCommitNames: string[];
  waitingForNames: string[];
  waitingTitle: string | null;
  playerStatus: PlayerGameStatus | undefined;
}

interface ModelInput {
  view: GameView | null;
  inputRequest: InputRequest | null;
  myHeroId: string | null;
  awaitingInput: string[];
  connected: boolean;
  heroName: HeroNameResolver;
}

/** Renderer-independent derivations from the already player-scoped server view.
 * These describe existing client behavior; the server remains the legality authority.
 */
export function buildGameControllerModel({ view, inputRequest, myHeroId, awaitingInput, connected, heroName }: ModelInput): GameControllerModel {
  const teams = Object.entries(view?.teams ?? {});
  const ownTeam = myHeroId ? teams.find(([, team]) => team.heroes.some((hero) => hero.id === myHeroId)) : undefined;
  const myTeam = ownTeam?.[0] ?? null;
  const myHero = ownTeam?.[1].heroes.find((hero) => hero.id === myHeroId) ?? null;
  const frozen = isMatchFrozen(view);
  const isMyInput = !!view && !frozen && !!myHeroId && (
    inputRequest?.player_id === myHeroId ||
    (!!myTeam && inputRequest?.player_id === `team:${myTeam}`)
  );
  const isMyUpgradePhase = !!view && !frozen && !!myHeroId &&
    inputRequest?.type === "UPGRADE_PHASE" && !!inputRequest.players;
  const offBoardUnitChoice = offBoardUnitOptions(view, inputRequest);
  const effectiveInputRequest = offBoardUnitChoice && inputRequest
    ? { ...inputRequest, type: "SELECT_OPTION", options: offBoardUnitChoice }
    : inputRequest;
  const waitingForNames = resolveWaitingForNames({ view, awaitingInput, myHeroId: myHeroId ?? "", heroName });
  const isPlanning = view?.phase === "PLANNING";
  const canCommitSecond = myHero?.can_commit_second_card ?? false;
  const planningLocked = !!(myHeroId && view?.clock?.players[myHeroId]?.planning_locked_by_timeout);
  const committedCards = [myHero?.extra_turn_card, myHero?.current_turn_card]
    .filter((card): card is CardView => !!card);
  const committedCardNames = committedCards.map((card) => card.name || "Selected card");
  const waitingForCommitNames = isPlanning ? teams.flatMap(([, team]) => team.heroes)
    .filter((hero) => hero.id !== myHeroId && hero.current_turn_card === null)
    .map((hero) => heroName(hero.id, hero.name)) : [];

  return {
    myTeam, myHero, frozen, isMyInput, isMyUpgradePhase, offBoardUnitChoice, effectiveInputRequest,
    startingPosition: !frozen && connected ? view?.starting_position ?? null : null,
    isPlanning, canPing: canPingInPhase(view?.phase),
    canRequestPause: !!myHeroId && view?.clock?.status === "RUNNING",
    canCommitSecond, planningLocked,
    // Preserve existing presentation flags. Phase/connection/frozen handling is
    // still composed by the caller and transport; do not introduce new rules here.
    canCommit: !planningLocked && (myHero?.current_turn_card === null || canCommitSecond),
    canUncommit: isPlanning && !planningLocked && !!myHero?.current_turn_card,
    committedCards, committedCardNames, waitingForCommitNames, waitingForNames,
    waitingTitle: formatWaitingTitle(waitingForNames),
    playerStatus: view ? buildPlayerGameStatus({
      phase: view.phase, isPlayer: !!myHero, isMyInput, planningLocked,
      waitingForNames, committedCardNames, canCommitSecond, waitingForCommitNames,
    }) : undefined,
  };
}
