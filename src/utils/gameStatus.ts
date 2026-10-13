import type { GameView } from "../types/game";

/**
 * A frozen match accepts no gameplay input — the server rejects every
 * submission until the clock runs again, so no decision UI may be offered.
 */
export function isMatchFrozen(view: GameView | null): boolean {
  const status = view?.clock?.status;
  return (
    status === "PAUSED" ||
    status === "SUSPENDED_FOR_INACTIVITY" ||
    status === "WAITING_FOR_PLAYERS"
  );
}

export type GameStatusTone = "active" | "locked" | "waiting";

export interface PlayerGameStatus {
  title: string;
  detail?: string;
  tone: GameStatusTone;
}

interface BuildPlayerGameStatusArgs {
  phase: string;
  isPlayer: boolean;
  isMyInput: boolean;
  planningLocked: boolean;
  waitingForNames: string[];
  committedCardNames: string[];
  canCommitSecond: boolean;
  waitingForCommitNames: string[];
}

export function buildPlayerGameStatus({
  phase,
  isPlayer,
  isMyInput,
  planningLocked,
  waitingForNames,
  committedCardNames,
  canCommitSecond,
  waitingForCommitNames,
}: BuildPlayerGameStatusArgs): PlayerGameStatus | undefined {
  if (phase === "PLANNING") {
    if (!isPlayer) return undefined;

    if (committedCardNames.length === 0) {
      if (planningLocked) {
        return {
          title: "Planning locked",
          detail: "Waiting for resolution",
          tone: "waiting",
        };
      }
      return {
        title: "Choose a card",
        detail: "Select from your hand, then commit",
        tone: "active",
      };
    }

    const cards = committedCardNames.join(" + ");
    if (canCommitSecond) {
      return {
        title: "First card locked in",
        detail: `${cards} · Choose a second card or play one card`,
        tone: "active",
      };
    }

    const waiting = waitingForCommitNames.length > 0
      ? `Waiting for ${waitingForCommitNames.join(", ")}`
      : "Waiting for resolution";
    return {
      title: committedCardNames.length > 1
        ? `${committedCardNames.length} cards locked in`
        : "Card locked in",
      detail: `${cards} · ${waiting}`,
      tone: "locked",
    };
  }

  if (isMyInput) {
    return { title: "Your turn", tone: "active" };
  }

  const waitingTitle = formatWaitingTitle(waitingForNames);
  if (waitingTitle) {
    return {
      title: waitingTitle,
      detail: "Waiting for their decision",
      tone: "waiting",
    };
  }

  return undefined;
}

/** Headline for the players a pending decision is waiting on, or null for none. */
export function formatWaitingTitle(names: string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return `${names[0]} is choosing`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are choosing`;
  return `${names.length} players are choosing`;
}

interface ResolveWaitingForNamesArgs {
  view: GameView | null;
  awaitingInput: string[];
  myHeroId: string;
  heroName?: (heroId: string, fallback: string) => string;
}

/**
 * Display names of the players a pending decision is waiting on, minus the
 * viewer (who is prompted directly rather than told to wait).
 *
 * `current_actor_id` is only a fallback for having no pending request: during a
 * defense reaction the current actor is the attacker while the defender is the
 * one being waited on, so preferring it there names the wrong hero.
 */
export function resolveWaitingForNames({
  view,
  awaitingInput,
  myHeroId,
  heroName = (_heroId, fallback) => fallback,
}: ResolveWaitingForNamesArgs): string[] {
  if (!view) return [];

  const ids = awaitingInput.length > 0
    ? awaitingInput
    : view.current_actor_id
      ? [view.current_actor_id]
      : [];

  const names = new Map<string, string>();
  for (const team of Object.values(view.teams)) {
    for (const hero of team.heroes) {
      names.set(hero.id, heroName(hero.id, hero.name));
    }
  }

  return ids
    .filter((id) => id !== myHeroId)
    .map((id) => names.get(id))
    .filter((name): name is string => !!name);
}
