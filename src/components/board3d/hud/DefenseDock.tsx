import type { InputRequest } from "../../../types/game";
import type { DefenseOptionInfo } from "../../../utils/defense";
import hud from "./hud.module.css";
import styles from "./DefenseDock.module.css";

interface Props {
  inputRequest: InputRequest;
  attackerName: string | null;
  /** true if at least one card can block or is a primary defense worth reading */
  anyDefenseAvailable: boolean;
  onPass: () => void;
  /** Card picked from the hand, awaiting confirmation. */
  stagedCard?: { id: string; name: string; info: DefenseOptionInfo } | null;
  onConfirmStaged?: () => void;
  onClearStaged?: () => void;
  onRollback?: () => void;
  dimmed?: boolean;
}

/**
 * Glass readout + PASS for a SELECT_CARD_OR_PASS defense decision. Clicking a
 * glowing hand card (see HandRow defenseStates) only stages it; nothing is sent
 * until the player confirms it here, so a stray click on a raised card can't
 * discard it.
 */
export function DefenseDock({ inputRequest, attackerName, anyDefenseAvailable, onPass, stagedCard, onConfirmStaged, onClearStaged, onRollback, dimmed }: Props) {
  const need = inputRequest.defense_needed;
  const mod = inputRequest.minion_modifier;

  return (
    <div className={`${hud.glass} ${styles.dock} ${dimmed ? styles.dimmed : ""}`}>
      <div className={`${hud.parchment} ${styles.readout}`}>
        <img src="/icons/attack.png" alt="Attack" className={styles.atkIcon} />
        <span className={styles.line}>
          {attackerName ? <strong>{attackerName}</strong> : "Incoming attack"} attacks.
          {need !== undefined && need !== null && (
            <> Block <strong className={hud.accentText}>{need}</strong> to survive.</>
          )}
          {mod !== undefined && mod !== 0 && (
            <span className={styles.mod}> ({mod > 0 ? "+" : ""}{mod} minion)</span>
          )}
        </span>
      </div>

      {stagedCard ? (
        <div className={stagedCard.info.state === "FAILS" ? styles.noBlock : styles.staged}>
          {stagedCard.info.state === "FAILS"
            ? <>Defend with <strong>{stagedCard.name}</strong>? It won't block. You'll still take the hit and discard it.</>
            : <>Defend with <strong>{stagedCard.name}</strong>?</>}
        </div>
      ) : !anyDefenseAvailable ? (
        <div className={styles.noBlock}>No card fully blocks. You'll take the hit.</div>
      ) : (
        <div className={styles.hint}>Pick a card to defend with.</div>
      )}

      <div className={styles.actions}>
        {stagedCard && (
          <button
            type="button"
            className={`${hud.secondaryBtn} ${styles.pass} ${styles.confirm}`}
            onClick={onConfirmStaged}
          >
            Defend with {stagedCard.name}
          </button>
        )}
        {stagedCard && onClearStaged && (
          <button type="button" className={hud.secondaryBtn} onClick={onClearStaged}>
            Cancel
          </button>
        )}
        <button
          type="button"
          className={`${hud.dangerBtn} ${styles.pass} ${!anyDefenseAvailable && !stagedCard ? styles.passPrimary : ""}`}
          onClick={onPass}
        >
          Take the hit
        </button>
        {onRollback && (
          <button type="button" className={hud.secondaryBtn} onClick={onRollback}>
            Undo
          </button>
        )}
      </div>
    </div>
  );
}
