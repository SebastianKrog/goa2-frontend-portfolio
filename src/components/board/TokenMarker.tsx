import type { TokenView } from "../../types/game";

interface Props {
  tokens: TokenView[];
  hasUnit: boolean;
  isValidTarget: boolean;
  onTokenClick?: (tokenId: string) => void;
}

export function TokenMarker({ tokens, hasUnit, isValidTarget, onTokenClick }: Props) {
  if (tokens.length === 0) return null;

  const iconSize = hasUnit ? 14 : 18;
  const yBase = hasUnit ? 20 : 0;
  const spacing = iconSize + 2;
  const totalWidth = tokens.length * spacing - 2;
  const xStart = -totalWidth / 2;

  return (
    <g>
      {tokens.map((token, i) => {
        const x = xStart + i * spacing + iconSize / 2;
        const y = yBase;
        const icon = `/icons/token_${token.token_type}.png`;
        const isValid = isValidTarget;

        return (
          <g
            key={token.id}
            onClick={isValid ? (e) => { e.stopPropagation(); onTokenClick?.(token.id); } : undefined}
            style={{ cursor: isValid ? "pointer" : "default" }}
          >
            <circle
              cx={x}
              cy={y}
              r={iconSize / 2 + 1}
              fill="rgba(0,0,0,0.5)"
              stroke={isValid ? "#4caf50" : "rgba(255,255,255,0.3)"}
              strokeWidth={isValid ? 1.5 : 0.5}
            />
            <image
              href={icon}
              x={x - iconSize / 2}
              y={y - iconSize / 2}
              width={iconSize}
              height={iconSize}
            />
          </g>
        );
      })}
    </g>
  );
}
