import type { TimeControlConfig } from "../../types/game";
import {
  STANDARD_TIME_CONTROL,
  isStandardTimeControl,
  isValidTimeControl,
  maximumFor,
  type NumericTimeControlKey,
} from "../../utils/timeControl";
import styles from "./TimeControlSettings.module.css";

const FIELDS: Array<{
  key: NumericTimeControlKey;
  label: string;
  hint: string;
  unit?: string;
}> = [
  { key: "planning_allowance_seconds", label: "Planning Allowance", hint: "Fresh time each Planning phase" },
  { key: "resolution_allowance_seconds", label: "Resolution Allowance", hint: "Fresh once per shared turn" },
  { key: "initiative_bonus_seconds", label: "Initiative Bonus", hint: "One-shot extra for the turn's first Resolution actor" },
  { key: "response_grant_seconds", label: "Response Time grant", hint: "Added for each out-of-turn prompt" },
  { key: "initial_time_bank_seconds", label: "Starting Time Bank", hint: "Personal reserve at match start" },
  { key: "time_bank_increment_seconds", label: "Time Bank increment", hint: "Added at each later shared turn" },
  { key: "max_time_bank_seconds", label: "Maximum Time Bank", hint: "Reserve cannot exceed this cap" },
  { key: "upgrade_allowance_seconds", label: "Upgrade Allowance", hint: "Fresh once per Level Up phase" },
  {
    key: "automatic_turn_limit",
    label: "Automatic Turn Limit",
    hint: "Suspend after this many fully automatic turns; 0 disables suspension",
    unit: "turns",
  },
];

interface Props {
  value: TimeControlConfig | null;
  onChange?: (value: TimeControlConfig | null) => void;
  onCommit?: (value: TimeControlConfig | null) => void;
  disabled?: boolean;
  readOnly?: boolean;
}

export function TimeControlSettings({
  value,
  onChange,
  onCommit,
  disabled = false,
  readOnly = false,
}: Props) {
  const enabled = value !== null;

  const commit = (next: TimeControlConfig | null) => {
    onChange?.(next);
    onCommit?.(next);
  };

  if (readOnly) {
    return (
      <div className={styles.readOnly}>
        <span className={styles.readOnlyTitle}>{enabled ? "Timed match" : "Untimed match"}</span>
        {value && (
          <span>
            Planning {value.planning_allowance_seconds}s · Resolution {value.resolution_allowance_seconds}s · Bank {value.initial_time_bank_seconds}s · Auto limit {value.automatic_turn_limit || "off"} · {value.enforce_timeouts ? "Enforced" : "Advisory"}
          </span>
        )}
      </div>
    );
  }

  return (
    <section className={styles.root} aria-label="Match time controls">
      <div className={styles.header}>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={enabled}
            disabled={disabled}
            onChange={(event) => commit(event.target.checked ? { ...STANDARD_TIME_CONTROL } : null)}
          />
          <span>
            <strong>Use match clocks</strong>
            <small>All players must ready up before a timed match starts.</small>
          </span>
        </label>
        {value && (
          <div className={styles.preset}>
            <span>{isStandardTimeControl(value) ? "Standard preset" : "Custom values"}</span>
            {!isStandardTimeControl(value) && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => commit({ ...STANDARD_TIME_CONTROL })}
              >
                Reset to Standard
              </button>
            )}
          </div>
        )}
      </div>

      {value && (
        <>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={value.enforce_timeouts}
              disabled={disabled}
              onChange={(event) =>
                commit({ ...value, enforce_timeouts: event.target.checked })
              }
            />
            <span>
              <strong>Enforce timeouts</strong>
              <small>
                When off the clocks only keep score: they count past zero into a
                negative Time Bank, and nobody's turn is ever played for them.
              </small>
            </span>
          </label>
          <div className={styles.grid}>
            {FIELDS.map(({ key, label, hint, unit = "sec" }) => (
              <label className={styles.field} key={key} title={hint}>
                <span>{label}</span>
                <span className={styles.inputWrap}>
                  <input
                    type="number"
                    min={0}
                    max={maximumFor(key)}
                    step={1}
                    inputMode="numeric"
                    value={value[key]}
                    disabled={disabled}
                    onChange={(event) => {
                      const parsed = event.target.value === "" ? 0 : Number(event.target.value);
                      const maximum = maximumFor(key);
                      onChange?.({ ...value, [key]: Math.max(0, Math.min(maximum, parsed)) });
                    }}
                    onBlur={() => {
                      if (isValidTimeControl(value)) onCommit?.(value);
                    }}
                  />
                  <small>{unit}</small>
                </span>
                <small>{hint}</small>
              </label>
            ))}
          </div>
          {!isValidTimeControl(value) && (
            <p className={styles.error} role="alert">
              Maximum Time Bank must be at least the Starting Time Bank; time values must be whole seconds from 0 to 86,400 and the Automatic Turn Limit must be from 0 to 100.
            </p>
          )}
        </>
      )}
    </section>
  );
}
