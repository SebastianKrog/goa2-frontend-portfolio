import { useState } from "react";
import styles from "./ReplayControls.module.css";

interface Props {
  idx: number;
  total: number;
  round: number;
  turn: number;
  loading: boolean;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  onJumpDecision: (n: number) => void;
  onJumpRoundTurn: (round: number, turn?: number) => void;
}

export function ReplayControls({
  idx,
  total,
  round,
  turn,
  loading,
  onFirst,
  onPrev,
  onNext,
  onLast,
  onJumpDecision,
  onJumpRoundTurn,
}: Props) {
  const [decInput, setDecInput] = useState("");
  const [roundInput, setRoundInput] = useState("");
  const [turnInput, setTurnInput] = useState("");

  const jumpDecision = () => {
    const n = parseInt(decInput, 10);
    if (!Number.isNaN(n)) onJumpDecision(n);
  };
  const jumpRound = () => {
    const r = parseInt(roundInput, 10);
    if (Number.isNaN(r)) return;
    const t = parseInt(turnInput, 10);
    onJumpRoundTurn(r, Number.isNaN(t) ? undefined : t);
  };

  return (
    <div className={styles.bar}>
      <div className={styles.transport}>
        <button onClick={onFirst} disabled={idx <= 0} title="First">⏮</button>
        <button onClick={onPrev} disabled={idx <= 0} title="Previous decision">◀</button>
        <span className={styles.position}>
          {loading ? "…" : `decision ${idx} / ${total}`}
          <span className={styles.rt}>R{round} · T{turn}</span>
        </span>
        <button onClick={onNext} disabled={idx >= total} title="Next decision">▶</button>
        <button onClick={onLast} disabled={idx >= total} title="Last">⏭</button>
      </div>

      <div className={styles.jump}>
        <label>
          decision
          <input
            type="number"
            value={decInput}
            onChange={(e) => setDecInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && jumpDecision()}
            placeholder={String(idx)}
          />
        </label>
        <button onClick={jumpDecision}>go</button>

        <label>
          round
          <input
            type="number"
            value={roundInput}
            onChange={(e) => setRoundInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && jumpRound()}
            placeholder={String(round)}
          />
        </label>
        <label>
          turn
          <input
            type="number"
            value={turnInput}
            onChange={(e) => setTurnInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && jumpRound()}
            placeholder="any"
          />
        </label>
        <button onClick={jumpRound}>go</button>
      </div>
    </div>
  );
}
