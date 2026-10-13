export const HERO_MODEL_STYLE_KEY = "goa2:hero-model-style";

/** Legacy models are the default unless the player explicitly chose painted models. */
export function readLegacyHeroModelPreference(storage: Pick<Storage, "getItem">): boolean {
  return storage.getItem(HERO_MODEL_STYLE_KEY) !== "painted";
}
