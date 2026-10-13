export const HERO_DASHBOARD_KEY = "goa2:hero-dashboard";

/** The panel shows unless the player has explicitly collapsed it. */
export function readHeroDashboardHidden(storage: Pick<Storage, "getItem">): boolean {
  return storage.getItem(HERO_DASHBOARD_KEY) === "hidden";
}
