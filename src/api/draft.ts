import type {
  CreateDraftRequest,
  CreateDraftResponse,
  DraftModeInfo,
  DraftView,
  JoinDraftResponse,
  TeamColor,
  UpdateDraftSettingsRequest,
} from "../types/draft";
import { CHEATS_AVAILABLE } from "../config/features";

// Same-origin "/api" prefix proxied to the backend by the Worker, matching rest.ts.
const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Request failed: ${res.status}` }));
    throw new Error(err.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export function listDraftModes(): Promise<DraftModeInfo[]> {
  return fetch(`${API_BASE}/drafts/modes`).then((r) => parse<DraftModeInfo[]>(r));
}

export function listMaps(): Promise<string[]> {
  return fetch(`${API_BASE}/drafts/maps`).then((r) => parse<string[]>(r));
}

export function createDraft(body: CreateDraftRequest): Promise<CreateDraftResponse> {
  return fetch(`${API_BASE}/drafts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(CHEATS_AVAILABLE ? body : { ...body, cheats_enabled: false }),
  }).then((r) => parse<CreateDraftResponse>(r));
}

export function joinDraft(draftId: string, displayName: string): Promise<JoinDraftResponse> {
  return fetch(`${API_BASE}/drafts/${draftId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_name: displayName }),
  }).then((r) => parse<JoinDraftResponse>(r));
}

export function getDraft(draftId: string, token: string): Promise<DraftView> {
  return fetch(`${API_BASE}/drafts/${draftId}`, {
    headers: authHeaders(token),
  }).then((r) => parse<DraftView>(r));
}

function post(draftId: string, path: string, token: string, body?: unknown): Promise<DraftView> {
  return fetch(`${API_BASE}/drafts/${draftId}/${path}`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).then((r) => parse<DraftView>(r));
}

export function updateDraftSettings(
  draftId: string,
  token: string,
  settings: UpdateDraftSettingsRequest
): Promise<DraftView> {
  return fetch(`${API_BASE}/drafts/${draftId}/settings`, {
    method: "PATCH",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(
      CHEATS_AVAILABLE ? settings : { ...settings, cheats_enabled: false },
    ),
  }).then((r) => parse<DraftView>(r));
}

export const setTeam = (draftId: string, token: string, team: TeamColor) =>
  post(draftId, "team", token, { team });

export const leaveTeam = (draftId: string, token: string) =>
  post(draftId, "leave-team", token);

export const randomizeTeams = (draftId: string, token: string) =>
  post(draftId, "randomize-teams", token);

export const setCaptain = (draftId: string, token: string, playerId: string) =>
  post(draftId, "captain", token, { player_id: playerId });

export async function startDraft(draftId: string, token: string): Promise<DraftView> {
  if (!CHEATS_AVAILABLE) {
    await updateDraftSettings(draftId, token, { cheats_enabled: false });
  }
  return post(draftId, "start", token);
}

export const submitDraftAction = (draftId: string, token: string, hero: string) =>
  post(draftId, "action", token, { hero });

export const claimHero = (draftId: string, token: string, hero: string) =>
  post(draftId, "claim", token, { hero });
