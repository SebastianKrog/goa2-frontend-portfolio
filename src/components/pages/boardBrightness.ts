export const BOARD_BRIGHTNESS_KEY = "goa2:board-brightness";

export const MIN_BOARD_BRIGHTNESS = 0.6;
export const MAX_BOARD_BRIGHTNESS = 2;
export const DEFAULT_BOARD_BRIGHTNESS = 1;

export function readBoardBrightness(storage: Pick<Storage, "getItem">): number {
  const raw = Number(storage.getItem(BOARD_BRIGHTNESS_KEY));
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_BOARD_BRIGHTNESS;
  return Math.min(MAX_BOARD_BRIGHTNESS, Math.max(MIN_BOARD_BRIGHTNESS, raw));
}
