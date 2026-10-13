import { useEffect, useRef } from "react";
import type { ReplayDecision } from "../../api/replay";
import type { Hex } from "../../types/game";
import styles from "./DecisionTimeline.module.css";

interface Props {
  decisions: ReplayDecision[];
  /** Number of decisions applied. The just-applied decision is index-1. */
  currentIndex: number;
  onJump: (decisionIndex: number) => void;
}

function shortHero(heroId: string): string {
  return heroId.replace(/^hero_/, "");
}

function describe(d: ReplayDecision): string {
  if (d.type === "starting_position") {
    const sel = d.sel as { destination?: Hex; swap_with?: string } | undefined;
    return sel?.swap_with
      ? `swap starts with ${shortHero(sel.swap_with)}`
      : `starting position (${sel?.destination?.q}, ${sel?.destination?.r}, ${sel?.destination?.s})`;
  }
  if (d.type === "commit") return `commit ${d.card ?? ""}`.trim();
  if (d.type === "uncommit") return "take back card";
  if (d.type === "pass") return "pass";
  if (d.type === "input") return `input ${JSON.stringify(d.sel ?? "")}`;
  return d.type;
}

export function DecisionTimeline({ decisions, currentIndex, onJump }: Props) {
  const activeRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [currentIndex]);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        Decisions <span className={styles.count}>{decisions.length}</span>
      </div>
      <ul className={styles.list}>
        <li
          className={`${styles.row} ${currentIndex === 0 ? styles.active : ""}`}
          onClick={() => onJump(0)}
          ref={currentIndex === 0 ? activeRef : null}
        >
          <span className={styles.start}>— start —</span>
        </li>
        {decisions.map((d) => {
          const isCurrent = d.index === currentIndex - 1;
          const applied = d.index < currentIndex;
          return (
            <li
              key={d.index}
              ref={isCurrent ? activeRef : null}
              className={[
                styles.row,
                applied ? styles.applied : "",
                isCurrent ? styles.active : "",
              ].join(" ")}
              // Click jumps so this decision is the last applied one.
              onClick={() => onJump(d.index + 1)}
            >
              <span className={styles.rt}>R{d.r}·T{d.t}</span>
              <span className={styles.hero}>{shortHero(d.hero)}</span>
              <span className={styles.desc}>{describe(d)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
