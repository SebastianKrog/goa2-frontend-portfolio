import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  getLocale,
  setLocale,
  subscribeLocale,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "../../../i18n/locale";
import styles from "./LanguageControls.module.css";

// Endonyms: a player looking for their own language recognises it written the
// way they write it, not translated into the language they cannot read.
const LOCALE_NAMES: Record<SupportedLocale, string> = {
  en: "English",
  "pt-BR": "Português (BR)",
  "zh-Hans": "简体中文",
};

const LOCALE_ABBREVIATIONS: Record<SupportedLocale, string> = {
  en: "EN",
  "pt-BR": "PT",
  "zh-Hans": "简中",
};

/**
 * Card language picker, sitting above the sound control and sharing its
 * collapsed-until-summoned shape. Card text is viewer-scoped display data, so
 * switching mid-game only repaints — players in one game may read different
 * languages.
 */
export function LanguageControls() {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    <div ref={ref} className={styles.root}>
      {open && (
        <div className={styles.popover} role="listbox" aria-label="Card language">
          {SUPPORTED_LOCALES.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={option === locale}
              onClick={() => {
                setLocale(option);
                setOpen(false);
              }}
              className={`${styles.option} ${option === locale ? styles.selected : ""}`}
            >
              {LOCALE_NAMES[option]}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Card language"
        title="Card language"
        className={`${styles.trigger} ${open ? styles.open : ""}`}
      >
        {LOCALE_ABBREVIATIONS[locale]}
      </button>
    </div>
  );
}
