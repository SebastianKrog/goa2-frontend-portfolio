export interface SetupInput {
  redCount: number;
  blueCount: number;
  validTimeControl: boolean;
}

/** Whether the teams can start a game, plus the hint shown under the roster. */
export function evaluateSetup({
  redCount,
  blueCount,
  validTimeControl,
}: SetupInput): { valid: boolean; hint: string } {
  const valid = redCount > 0 && blueCount > 0 && validTimeControl;

  const hint = !redCount || !blueCount
    ? "Add at least one hero to each team."
    : !validTimeControl
      ? "Fix the match clock values before creating the game."
      : "Teams are ready.";

  return { valid, hint };
}
