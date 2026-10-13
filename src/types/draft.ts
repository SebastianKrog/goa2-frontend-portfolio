// Types for the pre-game Character Draft Lobby.
// Mirrors goa2-backend draft models + the CLIENT_INTEGRATION_GUIDE.

import type { TimeControlConfig } from "./game";

export type TeamColor = "RED" | "BLUE";

export type DraftStatus = "LOBBY" | "DRAFTING" | "CLAIMING" | "COMPLETE";

export type DraftActionType = "BAN" | "PICK";

export interface DraftPlayer {
  id: string;
  display_name: string;
  team: TeamColor | null;
  is_host: boolean;
  is_captain: boolean;
  claimed_hero: string | null;
}

export interface DraftStep {
  index: number;
  action: DraftActionType;
  team: TeamColor;
}

export interface DraftState {
  draft_id: string;
  status: DraftStatus;
  map_name: string;
  game_type: string;
  draft_mode: string;
  cheats: boolean;
  // Max hero difficulty (stars, 1..4) allowed into the pool. 4 = all heroes.
  max_hero_stars: number;
  time_control: TimeControlConfig | null;
  // 0 during LOBBY (sizes emerge from membership); set at start.
  red_size: number;
  blue_size: number;
  players: DraftPlayer[];
  hero_pool: string[];
  sequence: DraftStep[];
  current_index: number;
  bans: Record<TeamColor, string[]>;
  picks: Record<TeamColor, string[]>;
  first_team: TeamColor | null;
  game_id: string | null;
  created_at?: number;
}

// Returned by GET /drafts/:id, every mutation, and the WS STATE_UPDATE.
export interface DraftView {
  draft: DraftState;
  you: DraftPlayer | null;
  game_id: string | null;
  game_token: string | null;
}

export interface DraftModeInfo {
  name: string;
  description: string;
}

export interface CreateDraftRequest {
  host_name: string;
  map_name?: string;
  game_type?: string;
  draft_mode?: string;
  cheats_enabled?: boolean;
  max_hero_stars?: number;
  time_control?: TimeControlConfig | null;
}

// All fields optional — host edits any subset of settings inside the lobby.
export interface UpdateDraftSettingsRequest {
  map_name?: string;
  game_type?: string;
  draft_mode?: string;
  cheats_enabled?: boolean;
  max_hero_stars?: number;
  time_control?: TimeControlConfig | null;
}

export interface CreateDraftResponse {
  draft_id: string;
  player_id: string;
  player_token: string;
  spectator_token: string;
}

export interface JoinDraftResponse {
  draft_id: string;
  player_id: string;
  player_token: string;
}

// WS message: { type: "STATE_UPDATE", ...DraftView } or { type: "ERROR", detail }
export type DraftSocketMessage =
  | ({ type: "STATE_UPDATE" } & DraftView)
  | { type: "ERROR"; detail: string };
