import styles from "./ConnectionClosedNotice.module.css";

const MESSAGES: Record<number, string> = {
  4001: "This game link is not valid.",
  4002: "This game is open in another tab or device.",
  4003: "This link belongs to a different game.",
  4004: "This game no longer exists.",
};

interface Props {
  code: number;
  onReconnect: () => void;
}

export function ConnectionClosedNotice({ code, onReconnect }: Props) {
  return (
    <span className={styles.notice} role="alert">
      {MESSAGES[code] ?? "Connection closed."}
      <button type="button" className={styles.button} onClick={onReconnect}>
        {code === 4002 ? "Use this tab" : "Try again"}
      </button>
    </span>
  );
}
