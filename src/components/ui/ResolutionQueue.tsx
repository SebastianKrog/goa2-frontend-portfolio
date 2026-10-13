import type { GameView } from "../../types/game";
import { TEAM_COLORS, CARD_COLORS } from "../../utils/colors";
import { heroSlug } from "../../utils/resolveCards";
import { CardCanvas } from "../board3d/hud/CardCanvas";
import { Tooltip } from "./Tooltip";
import { CardTooltipContent } from "./CardTooltipContent";
import styles from "./ResolutionQueue.module.css";
import { useLocalizedHeroNames } from "../../i18n/useLocalizedHeroNames";

const IMMERSIVE_VISIBLE_CARD_LIMIT = 10;

interface Props {
  view: GameView;
  immersive?: boolean;
  /** Collapsed to its header. Only wired up for the 2D board, where the queue
      sits on top of a map that is already short on a phone. */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function ResolutionQueue({ view, immersive = false, collapsed = false, onCollapsedChange }: Props) {
  const localizedHeroName = useLocalizedHeroNames();
  if (view.phase !== "RESOLUTION" || view.unresolved_cards.length === 0) {
    return null;
  }

  const heroTeamMap: Record<string, string> = {};
  for (const [teamColor, team] of Object.entries(view.teams)) {
    for (const hero of team.heroes) {
      heroTeamMap[hero.id] = teamColor;
    }
  }

  const heroNameMap: Record<string, string> = {};
  for (const team of Object.values(view.teams)) {
    for (const hero of team.heroes) {
      heroNameMap[hero.id] = localizedHeroName(hero.id, hero.name);
    }
  }

  const total = view.unresolved_cards.length;
  const visibleCards = immersive
    ? view.unresolved_cards.slice(0, IMMERSIVE_VISIBLE_CARD_LIMIT)
    : view.unresolved_cards;
  const hiddenCount = total - visibleCards.length;

  const titleRow = (
    <>
      <span className={styles.title}>
        {onCollapsedChange && <span aria-hidden="true">{collapsed ? "\u25B8" : "\u25BE"}</span>}
        {immersive ? "Up next" : "Resolution Queue"}
      </span>
      {(immersive || collapsed) && <span className={styles.count}>{total}</span>}
    </>
  );

  return (
    <div className={`${styles.container} ${immersive ? styles.immersive : ""} ${collapsed ? styles.collapsed : ""}`}>
      {onCollapsedChange ? (
        <button
          type="button"
          className={styles.titleRow}
          onClick={() => onCollapsedChange(!collapsed)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Show the resolution queue, ${total} cards` : "Collapse the resolution queue"}
        >
          {titleRow}
        </button>
      ) : (
        <div className={styles.titleRow}>{titleRow}</div>
      )}
      {!collapsed && visibleCards.map((entry, i) => {
        const teamColor = heroTeamMap[entry.hero_id];
        const heroName = heroNameMap[entry.hero_id] ?? entry.hero_id;
        const preview = immersive ? (
          <div className={styles.cardPreview}>
            <CardCanvas
              card={{ ...entry.card, is_facedown: false }}
              heroSlug={heroSlug(entry.hero_id)}
              width="min(310px, 42vw)"
            />
          </div>
        ) : (
          <CardTooltipContent card={entry.card} />
        );

        return (
          <Tooltip
            key={entry.hero_id}
            content={preview}
            delay={immersive ? 100 : 200}
            position={immersive ? "right" : "top"}
            bare={immersive}
          >
            <div className={`${styles.entry} ${i === 0 ? styles.nextEntry : ""}`}>
              <span className={styles.order}>{i === 0 ? "Now" : i + 1}</span>
              <span className={styles.initiative}>{entry.initiative}</span>
              <span className={styles.heroName} style={{ color: TEAM_COLORS[teamColor] }}>
                {heroName}
              </span>
              <span className={styles.separator}>·</span>
              <span className={styles.cardName} style={{ color: CARD_COLORS[entry.card.color ?? ""] || undefined }}>
                {entry.card.name}
              </span>
            </div>
          </Tooltip>
        );
      })}
      {!collapsed && hiddenCount > 0 && <div className={styles.more}>+{hiddenCount} more</div>}
    </div>
  );
}
