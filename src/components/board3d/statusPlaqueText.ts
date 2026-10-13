import { PLAYER_NAME_MAX_LENGTH } from "../../utils/playerName";

export const PLAQUE_NAME_MAX = PLAYER_NAME_MAX_LENGTH;

/** The name as painted, or null when the plaque should render without one. */
export function plaqueNameText(name: string | undefined | null): string | null {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, PLAQUE_NAME_MAX);
}
