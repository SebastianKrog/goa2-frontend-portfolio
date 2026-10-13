import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { ensureCardTextReady, getHeroName } from "./cardText";
import {
  getLocale,
  subscribeLocale,
  type SupportedLocale,
} from "./locale";

export type HeroNameResolver = (heroId: string, fallback: string) => string;

/**
 * Resolves catalog hero names and repaints consumers after a locale catalog
 * finishes loading. IDs remain untouched; this is display text only.
 */
export function useLocalizedHeroNames(): HeroNameResolver {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  const [readyLocale, setReadyLocale] = useState<SupportedLocale | null>(null);

  useEffect(() => {
    let cancelled = false;
    void ensureCardTextReady().then(() => {
      if (!cancelled) setReadyLocale(locale);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  return useCallback(
    (heroId, fallback) =>
      readyLocale === locale ? getHeroName(heroId) ?? fallback : fallback,
    [locale, readyLocale],
  );
}
