import type { ActivePing, GameView, PingTarget } from "../types/game";

// Three.js colors cannot resolve CSS custom properties, so use the concrete
// values behind --team-red / --team-blue. DOM ping markers share these too.
const PING_TEAM_COLORS: Record<string, string> = {
  RED: "#ff625c",
  BLUE: "#58a6ff",
};

// Mirrors the server's own gate; this only hides the affordance.
export const PING_BLOCKED_PHASES = new Set(["RESOLUTION", "LEVEL_UP"]);

export function canPingInPhase(phase: string | undefined): boolean {
  return phase === undefined || !PING_BLOCKED_PHASES.has(phase);
}

export interface PresentedPing {
  id: string;
  target: PingTarget;
  label: string;
  color: string;
}

export function pingTargetKey(target: PingTarget): string {
  if (target.kind === "HEX") {
    return `HEX:${target.hex.q},${target.hex.r},${target.hex.s}`;
  }
  return `CARD:${target.hero_id}:${target.zone}:${target.index ?? ""}`;
}

export function heroPresentation(
  view: GameView,
  heroId: string,
): { label: string; color: string } {
  for (const team of Object.values(view.teams)) {
    const hero = team.heroes.find((candidate) => candidate.id === heroId);
    if (hero) {
      return {
        label: hero.name,
        color: PING_TEAM_COLORS[hero.team] ?? "#f6c86f",
      };
    }
  }
  return { label: heroId.replace(/^hero_/, ""), color: "#f6c86f" };
}

export function pingPresentation(
  view: GameView,
  ping: ActivePing,
): { label: string; color: string } {
  return heroPresentation(view, ping.hero_id);
}

export function presentPings(view: GameView, pings: ActivePing[]): PresentedPing[] {
  return pings.map((ping) => ({
    id: ping.ping_id,
    target: ping.target,
    ...pingPresentation(view, ping),
  }));
}
