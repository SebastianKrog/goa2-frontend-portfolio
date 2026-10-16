export type GameLayout = "mobile" | "desktop2d" | "desktop3d";

/** Explicit mobile selection wins over 3d, including old links with 3d=1. */
export function readGameLayout(params: URLSearchParams): GameLayout {
  if (params.get("ui") === "mobile") return "mobile";
  return params.get("3d") === "0" ? "desktop2d" : "desktop3d";
}

export function withGameLayout(params: URLSearchParams, layout: GameLayout): URLSearchParams {
  const next = new URLSearchParams(params);
  next.set("ui", layout === "mobile" ? "mobile" : "desktop");
  next.set("3d", layout === "desktop3d" ? "1" : "0");
  return next;
}
