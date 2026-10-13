import type { GameEvent } from "../types/game";

/**
 * Minimal pub/sub for animation event batches.
 *
 * The socket layer pumps each post-mutation `STATE_UPDATE.events` batch in here
 * via {@link emitAnimationEvents}; transient 3D effects (combat lunges, floating
 * numbers, mine flashes) subscribe and fire on the events they care about.
 *
 * Why a global bus rather than React state: these effects are fire-and-forget
 * overlays that should NOT trigger a re-render of the board, and "play this once
 * when a batch arrives" maps awkwardly onto declarative state (a re-delivered
 * identical batch would look like no change). A push channel is the natural fit.
 *
 * Animation is driven off `STATE_UPDATE` events only — never `ACTION_RESULT` —
 * so the acting player and every observer run one identical code path. (Since
 * the backend now broadcasts events to all, the actor would otherwise receive
 * each batch twice.)
 */
type Handler = (events: GameEvent[]) => void;

const handlers = new Set<Handler>();

export function emitAnimationEvents(events: GameEvent[]): void {
  if (!events || events.length === 0) return;
  for (const handler of handlers) handler(events);
}

export function subscribeAnimationEvents(handler: Handler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}
