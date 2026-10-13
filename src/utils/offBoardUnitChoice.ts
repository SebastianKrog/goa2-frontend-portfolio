import type { GameView, InputOption, InputRequest } from "../types/game";

/**
 * Options for a unit selection whose candidates are all off the board, or null
 * when the request is answerable on the board as usual.
 *
 * Displaced units awaiting placement are held in limbo — the engine drops them
 * from `unit_locations` before asking which to place first — so no tile carries
 * their id and the board renders no affordance for them.
 */
export function offBoardUnitOptions(
  view: GameView | null,
  inputRequest: InputRequest | null,
): InputOption[] | null {
  if (!view || !inputRequest) return null;
  if (inputRequest.type !== "SELECT_UNIT" && inputRequest.type !== "SELECT_UNIT_OR_TOKEN") {
    return null;
  }
  const optionIds = (inputRequest.valid_options as string[] | undefined) ?? [];
  if (optionIds.length === 0) return null;

  const onBoard = new Set<string>();
  for (const tile of Object.values(view.board.tiles)) {
    if (tile.occupant_id) onBoard.add(tile.occupant_id);
  }
  for (const token of view.tokens ?? []) {
    if (token.hex) onBoard.add(token.id);
  }
  if (optionIds.some((id) => onBoard.has(id))) return null;

  const units = new Map<string, { type: string; value: number }>();
  for (const team of Object.values(view.teams)) {
    for (const minion of team.minions) units.set(minion.id, minion);
  }

  const seen = new Map<string, number>();
  return optionIds.map((id) => {
    const unit = units.get(id);
    if (!unit) return { id, text: id };
    const label = `${unit.type.charAt(0)}${unit.type.slice(1).toLowerCase()} (${unit.value})`;
    const n = (seen.get(label) ?? 0) + 1;
    seen.set(label, n);
    return { id, text: n > 1 ? `${label} #${n}` : label };
  });
}
