// Consensus-overrides REST client: the static op catalogue and the
// player-scoped decision history (see backend CLIENT_INTEGRATION_GUIDE
// § Consensus Overrides).
const API_BASE = import.meta.env.VITE_API_URL || "/api";

export interface OverrideOpSchema {
  name: string;
  family: "patch" | "unstick";
  label: string;
  description: string;
  /** JSON Schema for the op's args object. */
  args_schema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
    $defs?: Record<string, unknown>;
  };
}

export interface OverrideSchemaResponse {
  ops: OverrideOpSchema[];
}

export interface OverrideHistoryEntry {
  /** Raw decision index — the space rewind targets ("to") live in. */
  index: number;
  type: string;
  round: number | null;
  turn: number | null;
  hero_id: string | null;
  /** Human-readable, viewer-scoped (opponents' facedown cards are masked). */
  label: string;
  /** Dead segment behind a rewind — grey it out, don't hide it. */
  superseded: boolean;
}

export interface OverrideHistoryResponse {
  total: number;
  decisions: OverrideHistoryEntry[];
}

// The catalogue is static and game-independent: fetch once per session.
let schemaCache: Promise<OverrideSchemaResponse> | null = null;

export function fetchOverrideSchema(): Promise<OverrideSchemaResponse> {
  if (!schemaCache) {
    schemaCache = fetch(`${API_BASE}/overrides/schema`).then((res) => {
      if (!res.ok) {
        schemaCache = null; // allow retry after a failure
        throw new Error(`Failed to fetch override schema: ${res.status}`);
      }
      return res.json();
    });
  }
  return schemaCache;
}

export async function fetchOverrideHistory(
  gameId: string,
  token: string,
): Promise<OverrideHistoryResponse> {
  const res = await fetch(`${API_BASE}/games/${gameId}/overrides/history`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch decision history: ${res.status}`);
  }
  return res.json();
}
