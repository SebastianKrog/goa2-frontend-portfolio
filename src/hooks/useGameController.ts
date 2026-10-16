import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useGameSocket } from "./useGameSocket";
import { buildGameControllerModel, type GameControllerModel } from "./gameControllerModel";
import { useLocalizedHeroNames } from "../i18n/useLocalizedHeroNames";

type GameSession = ReturnType<typeof useGameSocket>;

export type GameControllerSession = Pick<GameSession,
  | "view" | "inputRequest" | "awaitingInput" | "eventLog" | "error" | "connected"
  | "closeCode" | "myHeroId" | "winner" | "heroNames" | "pings" | "pointers"
  | "overrideProposal" | "overrideResolution" | "revealedPlayerTokens"
>;

export type GameControllerActions = Pick<GameSession,
  | "reconnect" | "changeStartingPosition" | "finishPlanning" | "rollback" | "submitInput"
  | "cheatsGold" | "setReady" | "sendPing" | "sendPointer" | "sendPointerZone" | "hidePointer"
  | "proposeOverride" | "voteOverride" | "cancelOverride" | "requestPlayerLink"
> & {
  commitOrSwap: (cardId: string) => void;
  takeBack: () => void;
};

/** Public boundary shared by desktop and mobile. No router, renderer, or CSS dependencies. */
export interface GameController {
  session: GameControllerSession;
  model: GameControllerModel;
  actions: GameControllerActions;
  selection: {
    selectedCardId: string | null;
    setSelectedCardId: Dispatch<SetStateAction<string | null>>;
  };
  lockedNotice: boolean;
}

/** Mount once in a game/credential-keyed owner; pass its data/actions to presentations. */
export function useGameController(gameId: string, token: string): GameController {
  const socket = useGameSocket(gameId, token);
  const heroName = useLocalizedHeroNames();
  const { view, inputRequest, myHeroId, awaitingInput, connected, error, commitCard, uncommitCard } = socket;
  const model = useMemo(() => buildGameControllerModel({
    view, inputRequest, myHeroId, awaitingInput, connected, heroName,
  }), [view, inputRequest, myHeroId, awaitingInput, connected, heroName]);
  const { myHero, isPlanning, canCommit, canUncommit } = model;
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [pendingSwapId, setPendingSwapId] = useState<string | null>(null);
  const [uncommitPending, setUncommitPending] = useState(false);
  const [lastError, setLastError] = useState(error);
  const [lockedNotice, setLockedNotice] = useState(false);

  const takeBack = useCallback(() => {
    setUncommitPending(true);
    uncommitCard();
  }, [uncommitCard]);

  const commitOrSwap = useCallback((id: string) => {
    if (canCommit) commitCard(id);
    else if (canUncommit) {
      setPendingSwapId(id);
      takeBack();
    }
    setSelectedCardId(null);
  }, [canCommit, canUncommit, commitCard, takeBack]);

  // Match the existing render-time invalidation convention: neither a phase
  // change nor a rejected take-back may let the commit effect send a stale swap.
  if (!isPlanning && pendingSwapId !== null) setPendingSwapId(null);
  if (lastError !== error) {
    setLastError(error);
    if (error && uncommitPending) {
      setUncommitPending(false);
      setPendingSwapId(null);
      setLockedNotice(true);
    }
  }

  useEffect(() => {
    if (!pendingSwapId || !canCommit || !myHero?.hand.some((card) => card.id === pendingSwapId)) return;
    commitCard(pendingSwapId);
    // Synchronize the local pending command with this external send. Clearing
    // now prevents unrelated STATE_UPDATEs from sending the same commit twice.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingSwapId(null);
    setUncommitPending(false);
  }, [pendingSwapId, canCommit, myHero, commitCard]);

  useEffect(() => {
    if (!lockedNotice) return;
    const timer = window.setTimeout(() => setLockedNotice(false), 4000);
    return () => window.clearTimeout(timer);
  }, [lockedNotice]);

  const {
    reconnect, changeStartingPosition, finishPlanning, rollback, submitInput,
    cheatsGold, setReady, sendPing, sendPointer, sendPointerZone, hidePointer,
    proposeOverride, voteOverride, cancelOverride, requestPlayerLink,
    eventLog, closeCode, winner, heroNames, pings, pointers,
    overrideProposal, overrideResolution, revealedPlayerTokens,
  } = socket;

  return {
    session: {
      view, inputRequest, awaitingInput, eventLog, error, connected, closeCode,
      myHeroId, winner, heroNames, pings, pointers, overrideProposal, overrideResolution, revealedPlayerTokens,
    },
    model,
    actions: {
      reconnect, changeStartingPosition, finishPlanning, rollback, submitInput,
      cheatsGold, setReady, sendPing, sendPointer, sendPointerZone, hidePointer,
      proposeOverride, voteOverride, cancelOverride, requestPlayerLink, commitOrSwap, takeBack,
    },
    selection: { selectedCardId, setSelectedCardId },
    lockedNotice,
  };
}
