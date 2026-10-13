import type { CSSProperties } from "react";
import styles from "./PingMarker2D.module.css";

interface Props {
  label: string;
  color: string;
  stackIndex?: number;
  compact?: boolean;
}

export function PingMarker2D({ label, color, stackIndex = 0, compact = false }: Props) {
  return (
    <span
      className={`${styles.marker} ${compact ? styles.compact : ""}`}
      style={{
        "--ping-color": color,
        "--ping-offset": `${stackIndex * 24}px`,
      } as CSSProperties}
      aria-hidden="true"
    >
      <span className={styles.label}>{label}</span>
      <span className={styles.arrow}>↓</span>
    </span>
  );
}
