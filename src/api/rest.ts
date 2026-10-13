import type { CreateGameResponse, TimeControlConfig } from "../types/game";
import { CHEATS_AVAILABLE } from "../config/features";

// Default to the same-origin "/api" prefix, which the Worker proxies to the
// backend. Set VITE_API_URL to an absolute URL only to bypass the proxy.
const API_BASE = import.meta.env.VITE_API_URL || "/api";

export interface HeroMetadata {
  id: string;
  difficulty_stars: number;
}

export interface HeroListOptions {
  includePlaytest?: boolean;
}

function heroListUrl(path: string, { includePlaytest = false }: HeroListOptions = {}): string {
  return `${API_BASE}${path}${includePlaytest ? "?include_playtest=true" : ""}`;
}

export type GameType = "QUICK" | "LONG";

export async function fetchHeroes(options?: HeroListOptions): Promise<string[]> {
  const res = await fetch(heroListUrl("/heroes", options));
  if (!res.ok) throw new Error(`Failed to fetch heroes: ${res.status}`);
  return res.json();
}

export async function fetchHeroMetadata(options?: HeroListOptions): Promise<HeroMetadata[]> {
  const res = await fetch(heroListUrl("/heroes/metadata", options));
  if (!res.ok) throw new Error(`Failed to fetch hero metadata: ${res.status}`);
  return res.json();
}

export async function createGame(
  redHeroes: string[],
  blueHeroes: string[],
  mapName: string = "forgotten_island",
  cheatsEnabled: boolean = false,
  gameType: GameType = "LONG",
  timeControl: TimeControlConfig | null = null,
  playerNames: Record<string, string> = {},
): Promise<CreateGameResponse> {
  const res = await fetch(`${API_BASE}/games`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      map_name: mapName,
      red_heroes: redHeroes,
      blue_heroes: blueHeroes,
      cheats_enabled: CHEATS_AVAILABLE && cheatsEnabled,
      game_type: gameType,
      time_control: timeControl,
      player_names: playerNames,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `Failed to create game: ${res.status}`);
  }
  return res.json();
}

export interface SpectatorLinkResponse {
  game_id: string;
  spectator_token: string;
}

export async function fetchSpectatorToken(
  gameId: string,
  token: string,
): Promise<SpectatorLinkResponse> {
  const res = await fetch(`${API_BASE}/games/${gameId}/spectator-token`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch the spectator link: ${res.status}`);
  return res.json();
}

export interface ReplayShareResponse {
  token: string;
  /** Path of the viewer page on this frontend, e.g. `/shared/L9w2…`. Resolve it
   * against window.location, never against API_BASE — that path serves the
   * replay as JSON rather than the page a recipient should open. */
  url: string;
}

export async function createPlayerShare(
  gameId: string,
  token: string,
): Promise<ReplayShareResponse> {
  const res = await fetch(`${API_BASE}/games/${gameId}/share`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to create the replay link: ${res.status}`);
  }
  return res.json();
}
