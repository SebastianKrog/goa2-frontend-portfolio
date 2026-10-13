import type { GameView } from "../types/game";

export interface WinnerDisplay {
  label: string;
  team: string | null;
  type: "TEAM" | "HERO";
}

/**
 * Resolve the backend's winner value into player-facing text and a team color.
 * Team victories arrive as RED/BLUE; individual victories arrive as a hero ID.
 */
export function resolveWinnerDisplay(
  view: GameView,
  winner: string | null,
  heroName: (heroId: string, fallback: string) => string = (_heroId, fallback) => fallback,
): WinnerDisplay | null {
  if (!winner) return null;

  if (winner === "RED" || winner === "BLUE") {
    return { label: winner, team: winner, type: "TEAM" };
  }

  for (const [team, teamView] of Object.entries(view.teams)) {
    const hero = teamView.heroes.find((candidate) => candidate.id === winner);
    if (hero) {
      return { label: heroName(hero.id, hero.name), team, type: "HERO" };
    }
  }

  // Keep future/unknown individual winners readable even if their hero is not
  // present in an older or partially reconstructed view.
  const label = winner
    .replace(/^hero_/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

  return { label, team: null, type: "HERO" };
}
