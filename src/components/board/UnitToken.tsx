import { TEAM_COLORS } from "../../utils/colors";
import type { HeroView, MinionView } from "../../types/game";
import { useLocalizedHeroNames } from "../../i18n/useLocalizedHeroNames";

const MARKER_ICONS: Record<string, string> = {
  poison: "/icons/marker_poison.png",
  bounty: "/icons/marker_bounty.png",
};

interface Props {
  team: string;
  hero?: HeroView;
  minion?: MinionView;
  markers?: { type: string; value: number }[];
  isCurrentActor?: boolean;
  onHeroHover?: (heroName: string | null, e: React.MouseEvent) => void;
}

export function UnitToken({ team, hero, minion, markers, isCurrentActor, onHeroHover }: Props) {
  const localizedHeroName = useLocalizedHeroNames();
  const heroName = hero ? localizedHeroName(hero.id, hero.name) : null;
  const color = TEAM_COLORS[team] || "#888";
  let label = "?";

  if (hero) {
    label = heroName?.slice(0, 3) ?? hero.name.slice(0, 3);
  } else if (minion) {
    switch (minion.type) {
      case "HEAVY": label = "H"; break;
      case "RANGED": label = "r"; break;
      default: label = "m"; break;
    }
  }

  const heroImage = hero ? `/hero-images/${hero.name.toLowerCase()}.webp` : null;

  const minionImage = minion
    ? `/hero-images/minion_${minion.type.toLowerCase()}_${team.toLowerCase()}.png`
    : null;

  const tokenImage = heroImage || minionImage;
  const patternId = hero
    ? `hero-pattern-${hero.name}`
    : minion
      ? `minion-pattern-${minion.type}-${team}`
      : "";

  return (
    <g
      onMouseEnter={heroName ? (e) => onHeroHover?.(heroName, e) : undefined}
      onMouseLeave={hero ? () => onHeroHover?.(null, null as unknown as React.MouseEvent) : undefined}
    >
      {tokenImage && (
        <defs>
          <pattern
            id={patternId}
            patternUnits="objectBoundingBox"
            width="1"
            height="1"
          >
            <image
              href={tokenImage}
              x="0"
              y="0"
              width="28"
              height="28"
              preserveAspectRatio="xMidYMid slice"
            />
          </pattern>
        </defs>
      )}
      {/* Team color halo behind the token */}
      <circle r={17} fill={color} stroke="rgba(0,0,0,0.45)" strokeWidth={1.2} />
      {/* Gold outer ring when current actor */}
      {isCurrentActor && (
        <circle r={18.5} fill="none" stroke="#ffd700" strokeWidth={1.4} />
      )}
      {/* Main token */}
      <circle
        r={14}
        fill={tokenImage ? `url(#${patternId})` : color}
        opacity={0.9}
      />
      {!tokenImage && (
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff"
          fontSize={11}
          fontWeight="normal"
        >
          {label}
        </text>
      )}
      {hero && (
        <text
          textAnchor="middle"
          y={22}
          fill="#fff"
          fontSize={7}
          opacity={0.7}
          style={{ pointerEvents: "none" }}
        >
          {heroName}
        </text>
      )}
      {hero && markers?.map((marker, i) => {
        const icon = MARKER_ICONS[marker.type];
        if (!icon) return null;
        const size = 12;
        const xOffset = 10 + i * 14;
        return (
          <image
            key={marker.type}
            href={icon}
            x={xOffset - size / 2}
            y={-10 - size / 2}
            width={size}
            height={size}
          />
        );
      })}
    </g>
  );
}
