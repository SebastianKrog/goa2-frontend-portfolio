import { CardRow } from "./CardRow";
import type { CardView } from "../../types/game";
import styles from "./CardList.module.css";

interface Props {
  cards: CardView[];
  phase: string;
  canCommit: boolean;
  waitingForCommitNames?: string[];
  selectedId: string | null;
  onSelectCard: (cardId: string) => void;
  onCommit: (cardId: string) => void;
}

export function CardList({ cards, phase, canCommit, waitingForCommitNames = [], selectedId, onSelectCard, onCommit }: Props) {
  const isPlanning = phase === "PLANNING";
  const canAct = isPlanning && canCommit;
  const waitingLabel = waitingForCommitNames.length > 0
    ? `Waiting for ${waitingForCommitNames.join(", ")}`
    : "Waiting for round to resolve";

  return (
    <div>
      <div className={styles.label}>
        Hand
        {canAct && <span className={styles.hint}> (1-9 to select, Enter to commit)</span>}
      </div>
      <div className={styles.container}>
        {cards.map((card, index) => (
          <CardRow
            key={card.id}
            card={card}
            isSelected={selectedId === card.id}
            shortcutKey={canAct && index < 9 ? index + 1 : undefined}
            onClick={canAct ? () => onSelectCard(card.id) : undefined}
          />
        ))}
        {cards.length === 0 && (
          <div className={styles.empty}>No cards in hand</div>
        )}
      </div>
      {isPlanning && canCommit && (
        <div className={styles.actions}>
          <button
            className={`${styles.btn} ${styles.confirm}`}
            disabled={!selectedId}
            onClick={() => selectedId && onCommit(selectedId)}
          >
            Commit <span className={styles.shortcutHint}>Enter</span>
          </button>
        </div>
      )}
      {isPlanning && !canCommit && (
        <div className={styles.waiting}>
          <span className={styles.waitingKicker}>Card committed</span>
          <span>{waitingLabel}</span>
        </div>
      )}
    </div>
  );
}
