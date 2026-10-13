import { adminGetJson } from "./admin";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export interface BugReport {
  id: string;
  game_id: string;
  title: string;
  description: string;
  reporter_hero: string | null;
  decision_index: number | null;
  round: number;
  turn: number;
  status: "open" | "resolved";
  created_at: number;
  resolved_at: number | null;
}

// Public in-game submission — authenticated with the player's own game token.
// The server links the report to the replay moment; only title + description
// are sent.
export async function submitBugReport(
  gameId: string,
  gameToken: string,
  title: string,
  description: string
): Promise<BugReport> {
  const res = await fetch(`${API_BASE}/games/${encodeURIComponent(gameId)}/bug-reports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${gameToken}`,
    },
    body: JSON.stringify({ title, description }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    const detail = typeof body.detail === "string" ? body.detail : `Failed to submit report (${res.status})`;
    throw new Error(detail);
  }
  return res.json();
}

// Triage endpoints — admin-gated, used by the /reports page.

export function listBugReports(): Promise<BugReport[]> {
  return adminGetJson(`${API_BASE}/bug-reports`);
}

export function setBugReportStatus(id: string, status: "open" | "resolved"): Promise<BugReport> {
  return adminGetJson(`${API_BASE}/bug-reports/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export function deleteBugReport(id: string): Promise<void> {
  return adminGetJson(`${API_BASE}/bug-reports/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
