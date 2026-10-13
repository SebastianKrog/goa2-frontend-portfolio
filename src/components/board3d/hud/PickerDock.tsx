import type { InputRequest, Hex } from "../../../types/game";
import { ACTION_COLORS, formatActionName } from "../../../utils/actionLabels";
import hud from "./hud.module.css";
import styles from "./PickerDock.module.css";

const ACTION_ICONS: Record<string, string> = {
  MOVEMENT: "/icons/movement.png",
  ATTACK: "/icons/attack.png",
  DEFENSE: "/icons/defense.png",
  SKILL: "/icons/skill.png",
  DEFENSE_SKILL: "/icons/defense-skill.png",
};

interface Props {
  inputRequest: InputRequest;
  onSelect: (value: string | number | null) => void;
  onRollback?: () => void;
  onPreviewHexes?: (hexes: { path: Hex[]; mine_hexes: Hex[] } | null) => void;
  /** Fade out + disable while the player holds Alt to read a card behind it. */
  dimmed?: boolean;
}

type DockOption = { id: string; text: string; metadata?: { path?: Hex[]; mine_hexes?: Hex[] } };

/**
 * Glass dock for ABSTRACT (non-board, non-card) decisions in the 3D view:
 * CHOOSE_ACTION, SELECT_OPTION, SELECT_NUMBER, CONFIRM_PASSIVE, CHOOSE_ACTOR,
 * CHOOSE_RESPAWN, FAST_TRAVEL. Card decisions and UPGRADE_PHASE are routed
 * elsewhere. Option derivation mirrors the 2D OptionPicker.
 */
export function PickerDock({ inputRequest, onSelect, onRollback, onPreviewHexes, dimmed }: Props) {
  const type = inputRequest.type;
  const isNumber = type === "SELECT_NUMBER";

  let options: DockOption[] = [];
  if (type === "CHOOSE_ACTION" || type === "SELECT_OPTION") {
    options = (inputRequest.options ?? [])
      .map((opt) => {
        if (typeof opt === "string") return { id: opt, text: opt };
        const o = opt as DockOption;
        return { id: o.id, text: o.text, metadata: o.metadata };
      })
      .filter((opt) => !(onRollback && opt.id === "ROLLBACK"));
  } else if (type === "CONFIRM_PASSIVE" || type === "CHOOSE_RESPAWN") {
    const opts = (inputRequest.options as string[]) ?? ["YES", "NO"];
    options = opts.map((o) => ({ id: o, text: o }));
  } else if (type === "CHOOSE_ACTOR") {
    options = (inputRequest.player_ids ?? []).map((id) => ({ id, text: id }));
  } else if (isNumber) {
    const opts = inputRequest.options as Array<{ id: string; text: string }> | undefined;
    if (opts && opts.length > 0) {
      options = opts.map((o) => ({ id: o.id, text: o.text }));
    } else {
      options = (inputRequest.valid_options ?? []).map((n) => ({ id: String(n), text: String(n) }));
    }
  }

  const previewEnter = (opt: DockOption) => {
    if (onPreviewHexes && opt.metadata) {
      onPreviewHexes({ path: opt.metadata.path ?? [], mine_hexes: opt.metadata.mine_hexes ?? [] });
    }
  };
  const previewLeave = () => onPreviewHexes?.(null);

  return (
    <div className={`${hud.glass} ${styles.dock} ${dimmed ? styles.dimmed : ""}`}>
      <div className={`${hud.accentText} ${styles.prompt}`}>{inputRequest.prompt}</div>

      {options.length > 0 && (
        <div className={isNumber ? styles.numberRow : styles.optionRow}>
          {options.map((opt) => {
            const actionColor = ACTION_COLORS[opt.id];
            return (
              <button
                key={opt.id}
                type="button"
                className={isNumber ? styles.numberChip : styles.option}
                style={actionColor ? { borderColor: actionColor, color: actionColor } : undefined}
                onClick={() => onSelect(opt.id)}
                onMouseEnter={() => previewEnter(opt)}
                onMouseLeave={previewLeave}
              >
                {!isNumber && ACTION_ICONS[opt.id] && (
                  <img src={ACTION_ICONS[opt.id]} alt="" className={styles.optionIcon} />
                )}
                <span>{isNumber ? opt.text : formatActionName(opt.text)}</span>
              </button>
            );
          })}
        </div>
      )}

      {(inputRequest.can_skip || onRollback) && (
        <div className={styles.footerRow}>
          {inputRequest.can_skip && (
            <button type="button" className={hud.secondaryBtn} onClick={() => onSelect("SKIP")}>
              Skip
            </button>
          )}
          {onRollback && (
            <button type="button" className={hud.secondaryBtn} onClick={onRollback}>
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
