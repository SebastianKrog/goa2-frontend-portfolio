import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import type { GameView, InputRequest } from "../../../types/game";
import { resolveSelectableCards, unresolvedLabeledOptions, heroSlug } from "../../../utils/resolveCards";
import { isSpellCard } from "../cards/paintCard";
import { CardCanvas } from "./CardCanvas";
import { computeLift } from "./cardLift";
import hud from "./hud.module.css";
import styles from "./CardSelectOverlay.module.css";
import { FALLBACK_LOCALE, getLocale, subscribeLocale } from "../../../i18n/locale";

// Translated spell faces live beside the English ones under their locale. A
// locale ships a thumbnail only when its faces are large enough to be worth
// shrinking, so the face itself stands in, and English is the last resort.
function spellThumbSources(locale: string, imageId: string | undefined): string[] {
  const english = `/cards/spells/thumbs/${imageId}.webp`;
  if (locale === FALLBACK_LOCALE) return [english];
  return [
    `/cards/spells/${locale}/thumbs/${imageId}.webp`,
    `/cards/spells/${locale}/${imageId}.webp`,
    english,
  ];
}

interface Props {
  view: GameView;
  inputRequest: InputRequest;
  onSelect: (cardId: string) => void;
  onRollback?: () => void;
  onSkip?: () => void;
  /** Fade out + disable while the player holds Alt to read the board behind it. */
  dimmed?: boolean;
  onBoardViewChange?: (active: boolean) => void;
}

/**
 * Centered overlay for SELECT_CARD: paints every selectable card large
 * (whatever zone it lives in — your hand, any hero's active/board cards, a
 * discard, etc.) and lets the player click one. Replaces the hand-glow path so
 * options that aren't in hand are reachable. Number keys pick by position; Esc
 * undoes when a rollback is available.
 */
export function CardSelectOverlay({ view, inputRequest, onSelect, onRollback, onSkip, dimmed, onBoardViewChange }: Props) {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  // Cards masked in this viewer's view (a non-owner caster picking from a
  // hidden spellbook) can't be painted; the request carries display names for
  // them, rendered as labelled plaques after the paintable cards.
  const { cards, labeled } = useMemo(() => {
    const ids = inputRequest.valid_options ?? [];
    const cards = resolveSelectableCards(view, ids);
    return { cards, labeled: unresolvedLabeledOptions(cards, ids, inputRequest.options) };
  }, [view, inputRequest.valid_options, inputRequest.options]);
  const [lift, setLift] = useState(computeLift);
  // A toggle, not a hold: the Alt hold below never reached a phone, which left
  // the panel covering the board with no way to read it before choosing.
  const [peeking, setPeeking] = useState(false);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const optionCount = cards.length + labeled.length;
  const compact = optionCount > 6;
  const cardWidth = optionCount > 12 ? 190 : compact ? 220 : Math.min(lift.w, 330);
  const panelStyle = { "--choice-width": `${cardWidth}px` } as CSSProperties;

  /* The board is held open by a toggle, so the next prompt would otherwise
     arrive behind it with only the return button in sight. */
  const promptKey = inputRequest.request_id ?? "";
  const [lastPromptKey, setLastPromptKey] = useState(promptKey);
  if (lastPromptKey !== promptKey) {
    setLastPromptKey(promptKey);
    setPeeking(false);
  }

  useEffect(() => {
    onBoardViewChange?.(peeking);
    return () => onBoardViewChange?.(false);
  }, [peeking, onBoardViewChange]);

  useEffect(() => {
    const onResize = () => setLift(computeLift());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && peeking) {
        e.preventDefault();
        setPeeking(false);
        return;
      }
      if (peeking) return;
      if (e.key === "Escape" && onRollback) {
        e.preventDefault();
        onRollback();
        return;
      }
      const n = parseInt(e.key, 10);
      if (Number.isInteger(n) && n >= 1) {
        if (n <= cards.length) {
          e.preventDefault();
          onSelect(cards[n - 1].card.id);
        } else if (n <= cards.length + labeled.length) {
          e.preventDefault();
          onSelect(labeled[n - 1 - cards.length].id);
        }
        return;
      }

      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
      const active = optionRefs.current.indexOf(document.activeElement as HTMLButtonElement);
      const delta = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
      const next = e.key === "Home"
        ? 0
        : e.key === "End"
          ? optionCount - 1
          : Math.min(optionCount - 1, Math.max(0, (active < 0 ? 0 : active) + delta));
      const target = optionRefs.current[next];
      if (target) {
        e.preventDefault();
        target.focus();
        target.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cards, labeled, optionCount, onSelect, onRollback, peeking]);

  if (cards.length === 0 && labeled.length === 0) return null;

  if (peeking) {
    return (
      <div className={styles.peekBackdrop}>
        <button type="button" className={styles.returnBtn} onClick={() => setPeeking(false)}>
          Back to cards
        </button>
      </div>
    );
  }

  return (
    <div className={`${styles.backdrop} ${dimmed ? styles.dimmed : ""}`}>
      <section className={styles.panel} style={panelStyle} aria-label={inputRequest.prompt}>
        <header className={styles.header}>
          <div className={`${hud.accentText} ${styles.prompt}`}>{inputRequest.prompt}</div>
          <span className={styles.optionCount}>{optionCount}</span>
          <button
            type="button"
            className={styles.peekBtn}
            aria-label="View the board"
            aria-pressed={peeking}
            onClick={() => setPeeking(true)}
          >
            Board
          </button>
        </header>

        <div className={styles.scroller}>
          <div className={styles.grid}>
            {cards.map(({ card, ownerHeroId }, i) => {
              const useThumbnail = compact && isSpellCard(card) && Boolean(card.image_id);
              return (
                <button
                  key={card.id}
                  ref={(node) => { optionRefs.current[i] = node; }}
                  type="button"
                  className={styles.cardBtn}
                  aria-label={card.name}
                  onClick={() => onSelect(card.id)}
                >
                  {/* Large spellbooks use pre-sized assets rather than allocating
                      a full 1192x831 canvas for every visible choice. */}
                  {useThumbnail ? (
                    <img
                      className={styles.spellThumb}
                      src={spellThumbSources(locale, card.image_id)[0]}
                      data-next="1"
                      onError={(event) => {
                        const image = event.currentTarget;
                        const sources = spellThumbSources(locale, card.image_id);
                        const next = Number(image.dataset.next ?? sources.length);
                        if (next >= sources.length) return;
                        image.dataset.next = String(next + 1);
                        image.src = sources[next];
                      }}
                      alt=""
                      width={480}
                      height={335}
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                    />
                  ) : (
                    <CardCanvas
                      card={{ ...card, is_facedown: false }}
                      heroSlug={heroSlug(ownerHeroId)}
                      width={cardWidth}
                    />
                  )}
                  {i < 9 && <div className={styles.badge}>{i + 1}</div>}
                </button>
              );
            })}
            {labeled.map(({ id, text }, i) => {
              const n = cards.length + i;
              return (
                <button
                  key={id}
                  ref={(node) => { optionRefs.current[n] = node; }}
                  type="button"
                  className={styles.labelBtn}
                  onClick={() => onSelect(id)}
                >
                  {text}
                  {n < 9 && <div className={styles.badge}>{n + 1}</div>}
                </button>
              );
            })}
          </div>
        </div>

        {(onSkip || onRollback) && (
          <footer className={styles.footer}>
            {onSkip && (
              <button type="button" className={hud.secondaryBtn} onClick={onSkip}>
                Done
              </button>
            )}
            {onRollback && (
              <button type="button" className={hud.secondaryBtn} onClick={onRollback}>
                Undo
              </button>
            )}
          </footer>
        )}
      </section>
    </div>
  );
}
