// Shared helpers for rendering hero identity in pre-game screens.

export const heroImagePath = (heroId: string) => `/hero/${heroId.toLowerCase()}.png`;

export const formatHeroName = (heroId: string) =>
  heroId.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

/**
 * Replay setup headers list heroes by name ("Arien") while player names are
 * keyed by hero id ("hero_arien"). Every hero name is plain alphabetic, so the
 * prefix is the whole of the difference.
 */
export const heroIdFromName = (heroName: string) =>
  heroName.startsWith("hero_") ? heroName : `hero_${heroName.toLowerCase()}`;
