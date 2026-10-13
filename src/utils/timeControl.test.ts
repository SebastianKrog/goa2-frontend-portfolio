import { describe, expect, it } from "vitest";
import {
  STANDARD_TIME_CONTROL,
  isStandardTimeControl,
  isValidTimeControl,
  maximumFor,
} from "./timeControl";

describe("time control validation", () => {
  it("accepts the standard preset and an untimed match", () => {
    expect(isValidTimeControl(STANDARD_TIME_CONTROL)).toBe(true);
    expect(isValidTimeControl(null)).toBe(true);
  });

  it("rejects a bank cap below the starting bank", () => {
    expect(
      isValidTimeControl({
        ...STANDARD_TIME_CONTROL,
        initial_time_bank_seconds: 200,
        max_time_bank_seconds: 100,
      }),
    ).toBe(false);
  });

  it("rejects fractional and out-of-range values", () => {
    expect(
      isValidTimeControl({ ...STANDARD_TIME_CONTROL, planning_allowance_seconds: 1.5 }),
    ).toBe(false);
    expect(
      isValidTimeControl({ ...STANDARD_TIME_CONTROL, automatic_turn_limit: 101 }),
    ).toBe(false);
  });

  it("ignores the enforcement flag, which has no range to violate", () => {
    expect(
      isValidTimeControl({ ...STANDARD_TIME_CONTROL, enforce_timeouts: false }),
    ).toBe(true);
  });

  it("caps the automatic turn limit lower than the time fields", () => {
    expect(maximumFor("automatic_turn_limit")).toBe(100);
    expect(maximumFor("planning_allowance_seconds")).toBe(86_400);
  });
});

describe("standard preset detection", () => {
  it("recognises the preset", () => {
    expect(isStandardTimeControl({ ...STANDARD_TIME_CONTROL })).toBe(true);
  });

  it("treats enforced clocks as a custom setup", () => {
    expect(
      isStandardTimeControl({ ...STANDARD_TIME_CONTROL, enforce_timeouts: true }),
    ).toBe(false);
  });

  it("treats a changed time value as a custom setup", () => {
    expect(
      isStandardTimeControl({ ...STANDARD_TIME_CONTROL, planning_allowance_seconds: 30 }),
    ).toBe(false);
  });
});
