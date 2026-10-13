import { hexCorners } from "../../utils/hex";
import { zoneColor } from "../../utils/colors";
import { UnitToken } from "./UnitToken";
import { SpawnPointMarker } from "./SpawnPointMarker";
import { TokenMarker } from "./TokenMarker";
import type { BoardEntityView, Hex, HeroView, MinionView, SpawnPointView, TokenView } from "../../types/game";
import styles from "./HexTile.module.css";

interface Props {
  hex: Hex;
  cx: number;
  cy: number;
  zoneId: string;
  occupantId: string | null;
  hero?: HeroView;
  minion?: MinionView;
  occupantToken?: TokenView;
  occupantEntity?: BoardEntityView;
  tokens?: TokenView[];
  spawnPoint?: SpawnPointView | null;
  markers?: { type: string; value: number }[];
  isValidTarget: boolean;
  isValidToken?: boolean;
  isPreviewPath?: boolean;
  isPreviewMine?: boolean;
  isCurrentActor: boolean;
  onClick?: () => void;
  onHeroHover?: (heroName: string | null, e: React.MouseEvent) => void;
  onTokenClick?: (tokenId: string) => void;
  pings?: Array<{ id: string; label: string; color: string }>;
  onPingHover?: (hovered: boolean) => void;
}

export function HexTile({
  cx,
  cy,
  zoneId,
  occupantId,
  hero,
  minion,
  occupantToken,
  occupantEntity,
  tokens,
  spawnPoint,
  markers,
  isValidTarget,
  isValidToken,
  isPreviewPath,
  isPreviewMine,
  isCurrentActor,
  onClick,
  onHeroHover,
  onTokenClick,
  pings = [],
  onPingHover,
}: Props) {
  const points = hexCorners(0, 0);
  const fillColor = zoneColor(zoneId);
  const team = hero?.team || minion?.team || "";

  return (
    <g
      transform={`translate(${cx}, ${cy})`}
      onClick={isValidTarget ? onClick : undefined}
      onPointerEnter={() => onPingHover?.(true)}
      onPointerLeave={() => onPingHover?.(false)}
      style={{ cursor: isValidTarget ? "pointer" : "default" }}
    >
      <polygon
        points={points}
        fill={fillColor}
        stroke={isValidTarget ? "#4caf50" : "#222"}
        strokeWidth={isValidTarget ? 2.5 : 1}
        opacity={0.85}
      />
      {isValidTarget && (
        <polygon
          points={points}
          fill="rgba(76, 175, 80, 0.25)"
          stroke="none"
        />
      )}
      {isPreviewPath && !isValidTarget && (
        <polygon
          points={points}
          fill="none"
          stroke="rgba(80, 160, 255, 0.9)"
          strokeWidth={3}
        />
      )}
      {isPreviewMine && !isValidTarget && (
        <polygon
          points={points}
          fill="none"
          stroke="rgba(255, 80, 80, 0.9)"
          strokeWidth={3}
        />
      )}
      {occupantId && (hero || minion) && (
        <UnitToken
          team={team}
          hero={hero}
          minion={minion}
          markers={markers}
          isCurrentActor={isCurrentActor}
          onHeroHover={onHeroHover}
        />
      )}
      {occupantId && !hero && occupantToken && (
        <g
          onClick={isValidToken ? (e) => { e.stopPropagation(); onTokenClick?.(occupantToken.id); } : undefined}
          style={{ cursor: isValidToken ? "pointer" : "default" }}
        >
          {isCurrentActor && (
            <circle r={18.5} fill="none" stroke="#ffd700" strokeWidth={1.4} />
          )}
          <image
            href={`/icons/token_${occupantToken.token_type}.png`}
            x={-16}
            y={-16}
            width={32}
            height={32}
          />
          <text
            textAnchor="middle"
            y={20}
            fill="#fff"
            fontSize={6}
            opacity={0.7}
            style={{ pointerEvents: "none" }}
          >
            {occupantToken.name}
          </text>
        </g>
      )}
      {occupantId && !hero && !minion && !occupantToken && occupantEntity && (
        <g>
          <image
            href={`/icons/entity_${occupantEntity.entity_kind}.png`}
            x={-24}
            y={-24}
            width={48}
            height={48}
          />
          <text
            textAnchor="middle"
            y={20}
            fill="#fff"
            fontSize={6}
            opacity={0.7}
            style={{ pointerEvents: "none" }}
          >
            {occupantEntity.name}
          </text>
        </g>
      )}
      {tokens && tokens.length > 0 && (
        <TokenMarker
          tokens={tokens}
          hasUnit={!!occupantId}
          isValidTarget={!!isValidToken}
          onTokenClick={onTokenClick}
        />
      )}
      {spawnPoint && !occupantId && (
        <SpawnPointMarker spawnPoint={spawnPoint} />
      )}
      {pings.map((ping, index) => (
        <g
          key={ping.id}
          className={styles.ping}
          transform={`translate(${(index - (pings.length - 1) / 2) * 18}, 0)`}
          style={{ pointerEvents: "none" }}
          aria-hidden="true"
        >
          <path d="M -3 -30 L 3 -30 L 3 -19 L 8 -19 L 0 -10 L -8 -19 L -3 -19 Z" fill={ping.color} stroke="#08090c" strokeWidth={1.2} />
          <text
            y={-35}
            textAnchor="middle"
            fill="#fff"
            stroke="#08090c"
            strokeWidth={3}
            paintOrder="stroke"
            fontSize={7}
            fontWeight={800}
          >
            {ping.label}
          </text>
        </g>
      ))}
    </g>
  );
}
