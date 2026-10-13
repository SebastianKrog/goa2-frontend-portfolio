// Admin bearer token for the replay debugger + bug-report triage endpoints.
//
// In local dev the backend runs with GOA2_REPLAY_API=1 and needs no auth. In
// production those routes are gated behind GOA2_ADMIN_TOKEN instead: every
// request must carry `Authorization: Bearer <token>`. The token is entered
// once (the pages prompt on a 401) and kept in localStorage.

const STORAGE_KEY = "goa2_admin_token";

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, token.trim());
}

export function clearAdminToken(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function adminHeaders(): Record<string, string> {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Fetch + JSON + ApiError, with no credentials attached. */
export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new ApiError(body.detail || `Request failed: ${res.status}`, res.status);
  }
  // DELETE returns 204 with no body.
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function adminGetJson<T>(url: string, init?: RequestInit): Promise<T> {
  return getJson<T>(url, {
    ...init,
    headers: { ...adminHeaders(), ...(init?.headers ?? {}) },
  });
}
