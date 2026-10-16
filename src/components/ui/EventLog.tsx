import { useRef, useEffect, useState } from "react";
import type { GameView } from "../../types/game";
import type { TimestampedEvent } from "../../hooks/useGameSocket";
import { formatEvent } from "../../utils/eventLogText";
import { getCardText } from "../../i18n/cardText";
import styles from "./EventLog.module.css";
import { useLocalizedHeroNames } from "../../i18n/useLocalizedHeroNames";

interface Props {
  eventLog: TimestampedEvent[];
  view: GameView;
  waitingForNames: string[];
  isMyInput: boolean;
  immersive?: boolean;
  /** Expanded content in a pane, without the board's floating toggle. */
  embedded?: boolean;
}

export function EventLog({ eventLog, view, waitingForNames, isMyInput, immersive = false, embedded = false }: Props) {
  const localizedHeroName = useLocalizedHeroNames();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [eventLog.length]);

  const cardName = (id: string): string | null => {
    const translated = getCardText(id)?.name;
    if (translated) return translated;
    for (const team of Object.values(view.teams)) {
      for (const hero of team.heroes) {
        const cards = [
          ...hero.hand,
          ...(Array.isArray(hero.deck) ? hero.deck : []),
          ...hero.played_cards.filter((card): card is NonNullable<typeof card> => !!card),
          ...hero.discard_pile,
          ...(hero.cast_spells ?? []),
          ...(hero.current_turn_card ? [hero.current_turn_card] : []),
          ...(hero.extra_turn_card ? [hero.extra_turn_card] : []),
        ];
        const card = cards.find((candidate) => candidate.id === id);
        if (card) return card.name;
      }
    }
    return null;
  };

  return (
    <div className={embedded ? styles.embedded : `${styles.container} ${collapsed ? styles.collapsed : ""} ${immersive ? styles.immersive : ""}`}>
      {!embedded && <button
        className={styles.toggle}
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
      >
        <span aria-hidden="true">{collapsed ? "☰" : "×"}</span>
        {immersive ? "Battle log" : collapsed ? "Log ▲" : "Log ▼"}
      </button>}
      {(embedded || !collapsed) && (
        <>
          {!isMyInput && waitingForNames.length > 0 && (
            <div className={styles.status}>Waiting for {waitingForNames.join(", ")}...</div>
          )}
          <div className={styles.log} ref={scrollRef}>
            {eventLog.length === 0 && (
              <div className={styles.empty}>No events yet</div>
            )}
            {eventLog.map((entry) => {
              const line = formatEvent(entry.event, {
                names: entry.names,
                view,
                heroName: localizedHeroName,
                cardName,
              });
              if (!line) return null;
              return (
                <div key={entry.id} className={`${styles.entry} ${line.turnEnd ? styles.turnEnd : ""}`}>
                  {line.text}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
