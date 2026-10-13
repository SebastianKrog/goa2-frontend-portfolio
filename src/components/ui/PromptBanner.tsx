import type { InputRequest } from "../../types/game";
import styles from "./PromptBanner.module.css";

interface Props {
  inputRequest: InputRequest;
  onSkip?: () => void;
  onRollback?: () => void;
  /** Render with the 3D glass aesthetic. */
  glass?: boolean;
}

export function PromptBanner({ inputRequest, onSkip, onRollback, glass }: Props) {
  return (
    <div className={`${styles.banner} ${glass ? styles.bannerGlass : ""}`}>
      <span className={styles.marker} aria-hidden="true" />
      <span className={styles.copy}>
        <strong>{inputRequest.prompt}</strong>
      </span>
      {(inputRequest.can_skip || onRollback) && (
        <span className={styles.actions}>
          {inputRequest.can_skip && onSkip && (
            <button className={styles.skipBtn} onClick={onSkip}>Skip</button>
          )}
          {onRollback && (
            <button className={styles.undoBtn} onClick={onRollback}>Undo <kbd>U</kbd></button>
          )}
        </span>
      )}
    </div>
  );
}
