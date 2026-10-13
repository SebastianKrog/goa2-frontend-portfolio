import type { TimeControlConfig } from "../types/game";

export const STANDARD_TIME_CONTROL: TimeControlConfig = {
  planning_allowance_seconds: 90,
  resolution_allowance_seconds: 25,
  initiative_bonus_seconds: 10,
  response_grant_seconds: 10,
  initial_time_bank_seconds: 120,
  time_bank_increment_seconds: 10,
  max_time_bank_seconds: 440,
  upgrade_allowance_seconds: 120,
  automatic_turn_limit: 2,
  enforce_timeouts: false,
};

const NUMERIC_KEYS = [
  "planning_allowance_seconds",
  "resolution_allowance_seconds",
  "initiative_bonus_seconds",
  "response_grant_seconds",
  "initial_time_bank_seconds",
  "time_bank_increment_seconds",
  "max_time_bank_seconds",
  "upgrade_allowance_seconds",
  "automatic_turn_limit",
] as const;

export type NumericTimeControlKey = (typeof NUMERIC_KEYS)[number];

export const TIME_CONTROL_KEYS: readonly NumericTimeControlKey[] = NUMERIC_KEYS;

export function maximumFor(key: NumericTimeControlKey): number {
  return key === "automatic_turn_limit" ? 100 : 86_400;
}

export function isValidTimeControl(value: TimeControlConfig | null): boolean {
  if (value === null) return true;
  return (
    NUMERIC_KEYS.every(
      (key) =>
        Number.isInteger(value[key]) && value[key] >= 0 && value[key] <= maximumFor(key),
    ) && value.max_time_bank_seconds >= value.initial_time_bank_seconds
  );
}

export function isStandardTimeControl(value: TimeControlConfig): boolean {
  return (
    NUMERIC_KEYS.every((key) => value[key] === STANDARD_TIME_CONTROL[key]) &&
    value.enforce_timeouts === STANDARD_TIME_CONTROL.enforce_timeouts
  );
}
