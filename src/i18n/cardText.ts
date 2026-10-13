import type { LocaleCatalog, PainterLabels } from "../vendor/goa2-translations/types";
import { ENGLISH_PAINTER_LABELS } from "../vendor/goa2-translations/types";
import {
  FALLBACK_LOCALE,
  getLocale,
  subscribeLocale,
  type SupportedLocale,
} from "./locale";

/**
 * Which markup the text is written in. Translated text uses the Stats-of-
 * Atlantis conventions the vendored painter parses (`::icon::`, `**bold**`,
 * `~note`, `>>bullet`, `---`); backend effect_text uses the older `:icon:` and
 * `•` forms. Renderers must switch on this rather than sniffing the string.
 */
export type TextDialect = "translated" | "backend";

export interface CardText {
  name: string;
  description: string;
  dialect: TextDialect;
}

const catalogs = new Map<SupportedLocale, LocaleCatalog | null>();

function localeUrl(locale: SupportedLocale): string {
  return `${import.meta.env.BASE_URL}goa2-translations/locales/${locale}.json`;
}

async function loadCatalog(locale: SupportedLocale): Promise<LocaleCatalog | null> {
  try {
    const response = await fetch(localeUrl(locale));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const catalog = (await response.json()) as LocaleCatalog;
    if (catalog.schemaVersion !== 1) {
      throw new Error(`Unsupported schemaVersion ${catalog.schemaVersion}`);
    }
    return catalog;
  } catch (reason) {
    // Every lookup falls through to backend effect_text, so a failed load
    // degrades to English rather than breaking the board.
    console.warn(`Card text for ${locale} unavailable; using backend text.`, reason);
    return null;
  }
}

let ready: Promise<void> | null = null;

// Picking a new language must refetch; catalogs already loaded stay cached
// because they are keyed by locale.
subscribeLocale(() => {
  ready = null;
});

/** Loads the active locale and the English fallback. Safe to call repeatedly. */
export function ensureCardTextReady(): Promise<void> {
  if (ready) return ready;
  const locale = getLocale();
  const wanted: SupportedLocale[] =
    locale === FALLBACK_LOCALE ? [FALLBACK_LOCALE] : [locale, FALLBACK_LOCALE];
  ready = Promise.all(
    wanted
      .filter((l) => !catalogs.has(l))
      .map(async (l) => catalogs.set(l, await loadCatalog(l))),
  ).then(() => undefined);
  return ready;
}

/** Discards loaded catalogs so the next ensureCardTextReady() refetches. */
export function resetCardText(): void {
  catalogs.clear();
  ready = null;
}

/**
 * Resolves per card, not per hero: active locale, then English, then null so
 * the caller can fall back to the card's backend effect_text. Heroes still in
 * development (Cordelia) are absent from every catalog by design.
 */
export function getCardText(cardId: string): CardText | null {
  const locale = getLocale();
  for (const candidate of [locale, FALLBACK_LOCALE] as SupportedLocale[]) {
    const entry = catalogs.get(candidate)?.cards[cardId];
    if (entry !== undefined) {
      return { name: entry.name, description: entry.description, dialect: "translated" };
    }
  }
  return null;
}

export function getHeroName(heroId: string): string | null {
  const locale = getLocale();
  const catalogId = heroId.replace(/^hero_/i, "").toLowerCase();
  for (const candidate of [locale, FALLBACK_LOCALE] as SupportedLocale[]) {
    const name = catalogs.get(candidate)?.heroNames[catalogId];
    if (name !== undefined) return name;
  }
  return null;
}

/** Card-type captions ("Basic Attack", "Ranged") printed by the painter. */
export function getPainterLabels(): PainterLabels {
  return catalogs.get(getLocale())?.painterLabels ?? ENGLISH_PAINTER_LABELS;
}
