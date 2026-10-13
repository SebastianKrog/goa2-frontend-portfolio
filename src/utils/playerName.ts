/**
 * Longest player name a status plaque can render legibly. The backend caps
 * lobby and game-creation names at the same value; keeping every input on this
 * constant is what stops a name being accepted in one screen and truncated in
 * another.
 */
export const PLAYER_NAME_MAX_LENGTH = 20;
