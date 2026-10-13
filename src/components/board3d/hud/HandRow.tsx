import { useEffect, useState, type CSSProperties } from "react";
import type { CardView } from "../../../types/game";
import type { DefenseOptionInfo } from "../../../utils/defense";
import { CardCanvas } from "./CardCanvas";
import { computeLift } from "./cardLift";
import styles from "./HandRow.module.css";

interface Props {
  hand: CardView[];
  heroSlug: string;
  selectedCardId: string | null;
  onSelectCard: (id: string | null) => void;
  isPlanning?: boolean;
  canCommit?: boolean;
  onCommitCard?: (id: string) => void;
  /** When set, the hand is in "pick a card" mode for a SELECT_CARD decision:
      these ids glow and are clickable, the rest dim. */
  selectableCardIds?: Set<string>;
  /** Defense mode: per-card block verdict. Cards in the map are the pickable
      options; styling differs by state (BLOCKS / FAILS / PRIMARY). */
  defenseStates?: Map<string, DefenseOptionInfo>;
  /** Cards shown in the fan that aren't really in hand — they're offered by an
      active effect (e.g. Rock Solid). They get an "effect" cue and no hotkey. */
  grantedCardIds?: Set<string>;
  onPickCard?: (cardId: string) => void;
  /** Notifies when a hand card is hovered (lifted), so overlays can fade out
      to let the enlarged card be read — same idea as holding Alt. */
  onHoverChange?: (hovered: boolean) => void;
}

export function HandRow({ hand, heroSlug, selectedCardId, onSelectCard, isPlanning, canCommit, onCommitCard, selectableCardIds, defenseStates, grantedCardIds, onPickCard, onHoverChange }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [lift, setLift] = useState(computeLift);
  const activeHoveredId = hoveredId && hand.some((card) => card.id === hoveredId)
    ? hoveredId
    : null;

  useEffect(() => {
    const onResize = () => setLift(computeLift());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Notify parent whenever hover changes — including the programmatic reset
  // caused by a hovered card leaving the hand without firing mouseleave.
  useEffect(() => {
    onHoverChange?.(activeHoveredId !== null);
  }, [activeHoveredId, onHoverChange]);

  if (hand.length === 0) return null;

  const n = hand.length;
  const angleStep = n > 1 ? Math.min(5, 40 / (n - 1)) : 0;
  const angleStart = -(angleStep * (n - 1)) / 2;
  // Virtual arc radius. Each card drops by R*(1-cos(θ)) so the bottoms lie on
  // a true circular arc instead of a straight line.
  const ARC_R = 1400;

  const handStyle: CSSProperties = {
    ["--lifted-card-w" as string]: `${lift.w}px`,
    ["--lifted-card-h" as string]: `${lift.h}px`,
    ["--lift-y" as string]: `${lift.liftY}px`,
    ["--lift-scale" as string]: `${lift.scale}`,
    ["--rest-scale" as string]: `${1 / lift.scale}`,
    ["--rest-overlay-offset" as string]: `${-10 * lift.scale}px`,
  };

  return (
    <div className={styles.hand} style={handStyle}>
      <div className={styles.track}>
        {hand.map((card, i) => {
          const rot = angleStart + i * angleStep;
          const rotRad = (rot * Math.PI) / 180;
          const yArc = ARC_R * (1 - Math.cos(rotRad));
          const isHovered = card.id === activeHoveredId;
          const isSelected = card.id === selectedCardId;
          // A staged defense card stays in the fan so the DefenseDock never sits on it.
          const lifted = isHovered || (isSelected && !defenseStates);
          const defenseState = defenseStates?.get(card.id);
          const isGranted = grantedCardIds?.has(card.id) ?? false;
          const selectMode = !!selectableCardIds || !!defenseStates;
          const isSelectable = defenseStates
            ? defenseStates.has(card.id)
            : (selectableCardIds?.has(card.id) ?? false);
          const visualClasses = [
            styles.cardVisual,
            lifted ? styles.lifted : "",
            isSelected ? styles.selected : "",
            // SELECT_CARD gold glow
            selectableCardIds && isSelectable ? styles.selectable : "",
            // defense per-state treatment
            defenseState?.state === "BLOCKS" ? styles.blockCard : "",
            defenseState?.state === "PRIMARY" ? styles.primaryCard : "",
            defenseState?.state === "FAILS" ? styles.failCard : "",
            // anything non-pickable in a select/defense decision recedes
            selectMode && !isSelectable ? styles.dimmedCard : "",
          ].filter(Boolean).join(" ");
          const slotStyle: CSSProperties = {
            ["--rot" as string]: `${rot}deg`,
            ["--y-arc" as string]: `${yArc}px`,
            zIndex: lifted ? 1000 : i + 1,
          };
          return (
            <div
              key={card.id}
              className={`${styles.cardSlot} ${isGranted ? styles.grantedSlot : ""}`}
              style={slotStyle}
              role="button"
              tabIndex={isSelectable || !selectMode ? 0 : -1}
              aria-label={`${card.name}${isSelectable ? ", selectable" : ""}${isSelected ? ", selected" : ""}`}
              aria-pressed={isSelected}
              onMouseEnter={() => setHoveredId(card.id)}
              onMouseLeave={() => setHoveredId(null)}
              onFocus={() => setHoveredId(card.id)}
              onBlur={() => setHoveredId(null)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                if (selectMode) {
                  if (isSelectable) onPickCard?.(card.id);
                  return;
                }
                onSelectCard(isSelected ? null : card.id);
              }}
              onClick={() => {
                if (selectMode) {
                  if (isSelectable) onPickCard?.(card.id);
                  return;
                }
                onSelectCard(isSelected ? null : card.id);
              }}
            >
              {isGranted && <div className={styles.grantedAura} aria-hidden="true" />}
              <div className={visualClasses}>
                <CardCanvas card={card} heroSlug={heroSlug} width="var(--lifted-card-w)" />
                {i < 9 && !isGranted && <div className={styles.badge}>{i + 1}</div>}
                {(() => {
                  const defBadge = defenseState ? (
                    <div
                      className={[
                        styles.defBadge,
                        defenseState.state === "BLOCKS" ? styles.defBlock : "",
                        defenseState.state === "PRIMARY" ? styles.defPrimary : "",
                        defenseState.state === "FAILS" ? styles.defFail : "",
                      ].filter(Boolean).join(" ")}
                    >
                      {defenseState.state === "BLOCKS" ? (
                        `✓ ${defenseState.defenseValue ?? ""}`.trim()
                      ) : defenseState.state === "PRIMARY" ? (
                        <>
                          <img src="/icons/defense.png" alt="" className={styles.defIcon} /> read
                        </>
                      ) : (
                        "✗"
                      )}
                    </div>
                  ) : null;
                  // Granted cards group the "From effect" ribbon and the verdict
                  // badge in a centred flex row so the pair stays centred together.
                  return isGranted ? (
                    <div className={styles.grantedTopRow}>
                      <span className={styles.ribbon}>✦ From effect</span>
                      {defBadge}
                    </div>
                  ) : (
                    defBadge
                  );
                })()}
                {isSelected && isPlanning && canCommit && onCommitCard && (
                  <button
                    className={styles.commitBtn}
                    aria-label={`Commit ${card.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCommitCard(card.id);
                    }}
                  >
                    Commit card
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
