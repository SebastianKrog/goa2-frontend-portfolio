const STORAGE_KEY = "goa2.locale";

export const FALLBACK_LOCALE = "en";

// Locales with a vendored file under public/goa2-translations/locales/.
export const SUPPORTED_LOCALES = ["en", "pt-BR", "zh-Hans"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function isSupported(value: string | null): value is SupportedLocale {
  return value !== null && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

function readStoredLocale(): SupportedLocale | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isSupported(stored) ? stored : null;
  } catch {
    return null;
  }
}

// English until the player picks otherwise — never inferred from the browser.
let current: SupportedLocale = readStoredLocale() ?? FALLBACK_LOCALE;

export function getLocale(): SupportedLocale {
  return current;
}

export function setLocale(locale: SupportedLocale): void {
  if (locale === current) return;
  current = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Preference is best-effort; the session still uses the new locale.
  }
  for (const listener of listeners) listener();
}

const listeners = new Set<() => void>();

/** Subscribe to locale changes, for useSyncExternalStore. */
export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
