export type HeroNames = Record<string, string>;

/**
 * Hero display names are static for a match, and STATE_UPDATE omits the key
 * when empty. Replacing the held map on every message would blank every
 * nameplate on the first update that leaves it out.
 */
export function mergeHeroNames(
  previous: HeroNames,
  incoming: HeroNames | undefined,
): HeroNames {
  if (!incoming || Object.keys(incoming).length === 0) return previous;
  return incoming;
}
