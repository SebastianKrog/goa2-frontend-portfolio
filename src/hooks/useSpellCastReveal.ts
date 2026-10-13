import { useEffect, useMemo, useState } from "react";
import type { CardView, GameView, HeroView } from "../types/game";
import type { TimestampedEvent } from "./useGameSocket";

const SPELL_CAST_HOLD_MS = 6_000;

export interface SpellCastRevealState {
  /** Event-log id of the SPELL_CAST this reveal shows. */
  key: number;
  spell: CardView;
  casterId: string;
  ownerId: string;
}

function findHero(view: GameView, heroId: string): HeroView | undefined {
  for (const team of Object.values(view.teams)) {
    const hero = team.heroes.find((candidate) => candidate.id === heroId);
    if (hero) return hero;
  }
  return undefined;
}

/**
 * The latest SPELL_CAST in the live event log, paired with the spell's public
 * card. Cast spells sit faceup in their owner's `cast_spells`, which is how
 * every viewer, opponents included, gets the full card.
 */
export function spellCastRevealFromLog(
  eventLog: TimestampedEvent[],
  view: GameView | null,
): SpellCastRevealState | null {
  if (!view) return null;
  for (let i = eventLog.length - 1; i >= 0; i--) {
    const { id, event } = eventLog[i];
    if (event.event_type !== "SPELL_CAST") continue;
    const spellId = String(event.metadata.spell_id ?? "");
    const ownerId = String(event.metadata.owner_id ?? "");
    const casterId = String(event.metadata.caster_id ?? event.actor_id ?? ownerId);
    const spell = findHero(view, ownerId)?.cast_spells?.find((card) => card.id === spellId);
    return spell ? { key: id, spell, casterId, ownerId } : null;
  }
  return null;
}

/**
 * Shows each new spell cast to every viewer, then dismisses it after
 * SPELL_CAST_HOLD_MS. The countdown waits while `held` (the viewer is hovering
 * the card) and restarts in full once they let go.
 */
export function useSpellCastReveal(
  eventLog: TimestampedEvent[],
  view: GameView | null,
  held = false,
): SpellCastRevealState | null {
  const live = useMemo(() => spellCastRevealFromLog(eventLog, view), [eventLog, view]);
  const key = live?.key ?? null;
  const [dismissed, setDismissed] = useState<number | null>(null);

  useEffect(() => {
    if (key === null || held) return;
    const timer = window.setTimeout(() => setDismissed(key), SPELL_CAST_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [key, held]);

  return live && live.key !== dismissed ? live : null;
}
