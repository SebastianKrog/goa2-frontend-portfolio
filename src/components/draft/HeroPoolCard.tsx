import { formatHeroName, heroImagePath } from "../../utils/heroDisplay";
import styles from "./Draft.module.css";

interface HeroPoolCardProps {
  hero: string;
  // Visual state. "banned"/"picked" dim the card; "picked" can carry a team tint.
  state?: "available" | "banned" | "picked" | "claimed";
  tone?: "red" | "blue";
  badge?: string;
  disabled?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

export function HeroPoolCard({
  hero,
  state = "available",
  tone,
  badge,
  disabled,
  selectable,
  selected,
  onClick,
}: HeroPoolCardProps) {
  const interactive = selectable && !disabled;
  const classes = [
    styles.heroCard,
    state === "banned" ? styles.heroBanned : "",
    state === "picked" || state === "claimed" ? styles.heroPicked : "",
    tone === "red" ? styles.toneRed : "",
    tone === "blue" ? styles.toneBlue : "",
    interactive ? styles.heroSelectable : "",
    selected ? styles.heroSelected : "",
    disabled ? styles.heroDisabled : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={classes}
      onClick={interactive ? onClick : undefined}
      disabled={!!disabled}
      aria-disabled={!interactive}
      title={formatHeroName(hero)}
      aria-pressed={selectable ? !!selected : undefined}
    >
      <div className={styles.heroPhotoFrame}>
        <img
          className={styles.heroPhoto}
          src={heroImagePath(hero)}
          alt=""
          draggable={false}
          loading="lazy"
        />
        <div className={styles.heroOverlay}>
          <span className={styles.heroName}>{formatHeroName(hero)}</span>
        </div>
        {badge && <span className={styles.heroBadge}>{badge}</span>}
      </div>
    </button>
  );
}
