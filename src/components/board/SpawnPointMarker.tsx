import { TEAM_COLORS } from "../../utils/colors";
import type { SpawnPointView } from "../../types/game";

interface Props {
  spawnPoint: SpawnPointView;
}

export function SpawnPointMarker({ spawnPoint }: Props) {
  const { team, type, minion_type } = spawnPoint;
  const fillColor = TEAM_COLORS[team] || "#888";
  const size = 10;
  const height = size * Math.sqrt(3) / 2;

  const getSpawnTypeLabel = (spawnType: string, minionType: string | null): string => {
    if (spawnType === "HERO") return "H";
    if (spawnType === "MINION" && minionType) {
      switch (minionType.toUpperCase()) {
        case "HEAVY":
          return "V";
        case "MELEE":
          return "M";
        case "RANGED":
          return "R";
        default:
          return "?";
      }
    }
    return "?";
  };

  const label = getSpawnTypeLabel(type, minion_type);

  const minionImage = type === "MINION" && minion_type
    ? `/hero-images/minion_${minion_type.toLowerCase()}_${team.toLowerCase()}.png`
    : null;

  const imgSize = 22;
  const patternId = `spawn-pattern-${minion_type}-${team}`;

  return (
    <g opacity={0.5}>
      {minionImage ? (
        <>
          <defs>
            <pattern
              id={patternId}
              patternUnits="objectBoundingBox"
              width="1"
              height="1"
            >
              <image
                href={minionImage}
                x="0"
                y="0"
                width={imgSize}
                height={imgSize}
                preserveAspectRatio="xMidYMid slice"
              />
            </pattern>
          </defs>
          <circle r={imgSize / 2} fill={`url(#${patternId})`} />
        </>
      ) : (
        <>
          <polygon
            points={`0,${-height} ${-size / 2},${height / 2} ${size / 2},${height / 2}`}
            fill={fillColor}
            opacity={0.8}
            stroke="#fff"
            strokeWidth={1.5}
          />
          <text
            x={0}
            y={height / 3}
            textAnchor="middle"
            fill="#fff"
            fontSize={9}
            fontWeight="bold"
            pointerEvents="none"
          >
            {label}
          </text>
        </>
      )}
    </g>
  );
}
