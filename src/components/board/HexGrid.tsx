import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { hexToPixel, hexKey } from "../../utils/hex";
import { svgToWorld, worldToSvg } from "../../utils/boardSpace";
import { CURSOR_PATH } from "../board3d/PointerPresence";
import { HexTile } from "./HexTile";
import type { ActivePing, GameView, InputRequest, Hex, HeroView, MinionView, TokenView, BoardEntityView, PingTarget, RemotePointer } from "../../types/game";
import type { MapConfig } from "../board3d/maps/types";
import styles from "./HexGrid.module.css";
import { toCss } from "./mapZoom";
import { useMapZoom } from "./useMapZoom";
import { heroPresentation, pingPresentation, pingTargetKey } from "../../utils/pings";

interface Props {
  view: GameView;
  inputRequest: InputRequest | null;
  myHeroId?: string | null;
  onHexClick: (hex: Hex) => void;
  onUnitClick: (unitId: string) => void;
  isMyInput?: boolean;
  previewHexes?: { path: Hex[]; mine_hexes: Hex[] } | null;
  pings?: ActivePing[];
  onPingTargetHover?: (target: PingTarget | null) => void;
  /** Reports this player's pointer in table world space; null when off the grid. */
  onWorldPointer?: (point: { x: number; z: number } | null) => void;
  /** Everyone else's last reported table position. */
  remotePointers?: Record<string, RemotePointer>;
  mapConfig?: MapConfig | null;
}

export function HexGrid({ view, inputRequest, onHexClick, onUnitClick, isMyInput = false, previewHexes, pings = [], onPingTargetHover, onWorldPointer, remotePointers, mapConfig }: Props) {
  const [hoveredCard, setHoveredCard] = useState<{ name: string; x: number; y: number } | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const pendingHeroRef = useRef<string | null>(null);

  const handleHeroHover = useCallback((heroName: string | null, e: React.MouseEvent) => {
    if (heroName && heroName === pendingHeroRef.current) return;
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingHeroRef.current = heroName;
    if (heroName && e) {
      const id = window.setTimeout(() => {
        setHoveredCard({ name: heroName, x: e.clientX, y: e.clientY });
      }, 500);
      timeoutRef.current = id;
    } else {
      setHoveredCard(null);
    }
  }, []);
  // Preload hero card images for heroes in this match
  useEffect(() => {
    for (const team of Object.values(view.teams)) {
      for (const hero of team.heroes) {
        const img = new Image();
        img.src = `/hero-cards/${hero.name.toLowerCase()}.png`;
      }
    }
  }, [view.teams]);

  const unitLookup = useMemo(() => {
    const heroes = new Map<string, HeroView>();
    const minions = new Map<string, MinionView>();
    for (const team of Object.values(view.teams)) {
      for (const hero of team.heroes) heroes.set(hero.id, hero);
      for (const minion of team.minions) minions.set(minion.id, minion);
    }
    return { heroes, minions };
  }, [view.teams]);

  // Tiles carry piece ids for multi-piece heroes (Razzle); map each back to its
  // hero so every piece renders, not just the ones whose id is the hero id.
  const heroIdByPiece = useMemo(() => {
    const map = new Map<string, string>();
    for (const [pieceId, piece] of Object.entries(view.hero_pieces ?? {})) {
      map.set(pieceId, piece.owner_hero_id);
    }
    return map;
  }, [view.hero_pieces]);

  const markersByUnit = useMemo(() => {
    const map = new Map<string, { type: string; value: number }[]>();
    for (const [type, marker] of Object.entries(view.markers)) {
      // A marker may name a piece or the hero; key both on the hero so it
      // shows on every piece of them.
      const key = heroIdByPiece.get(marker.target_id) ?? marker.target_id;
      const list = map.get(key) || [];
      list.push({ type, value: marker.value });
      map.set(key, list);
    }
    return map;
  }, [view.markers, heroIdByPiece]);

  const tokensByHex = useMemo(() => {
    const map = new Map<string, TokenView[]>();
    for (const token of view.tokens ?? []) {
      if (!token.hex) continue;
      const key = hexKey(token.hex);
      const list = map.get(key) || [];
      list.push(token);
      map.set(key, list);
    }
    return map;
  }, [view.tokens]);

  const tokenLookup = useMemo(() => {
    const map = new Map<string, TokenView>();
    for (const token of view.tokens ?? []) {
      map.set(token.id, token);
    }
    return map;
  }, [view.tokens]);

  const boardEntityLookup = useMemo(() => {
    const map = new Map<string, BoardEntityView>();
    for (const entity of view.board_entities ?? []) {
      map.set(entity.id, entity);
    }
    return map;
  }, [view.board_entities]);

  const validHexes = useMemo((): Hex[] => {
    if (!inputRequest || !isMyInput) return [];
    return inputRequest.valid_hexes ?? inputRequest.valid_options?.filter(isHex) as Hex[] ?? [];
  }, [inputRequest, isMyInput]);

  const validUnitIds = useMemo((): string[] => {
    if (!inputRequest || !isMyInput) return [];
    if (inputRequest.type === "SELECT_UNIT" || inputRequest.type === "SELECT_UNIT_OR_TOKEN") {
      return (inputRequest.valid_options as string[]) ?? [];
    }
    return [];
  }, [inputRequest, isMyInput]);

  const validTokenIds = useMemo((): Set<string> => {
    if (!inputRequest || !isMyInput || inputRequest.type !== "SELECT_UNIT_OR_TOKEN") {
      return new Set();
    }
    const options = (inputRequest.valid_options as string[]) ?? [];
    const tokenIds = new Set((view.tokens ?? []).map((t) => t.id));
    return new Set(options.filter((id) => tokenIds.has(id)));
  }, [inputRequest, isMyInput, view.tokens]);

  // A tap on a valid target submits the choice, so double-tap zoom stands down
  // while the engine is waiting for one.
  const awaitingSelection = validHexes.length > 0 || validUnitIds.length > 0 || validTokenIds.size > 0;
  const { containerRef, transform, handlers, reset } = useMapZoom({ allowDoubleTap: !awaitingSelection });

  const previewPathSet = useMemo((): Set<string> => {
    if (!previewHexes) return new Set();
    return new Set(previewHexes.path.map((h) => hexKey(h)));
  }, [previewHexes]);

  const previewMineSet = useMemo((): Set<string> => {
    if (!previewHexes) return new Set();
    return new Set(previewHexes.mine_hexes.map((h) => hexKey(h)));
  }, [previewHexes]);

  const { tiles, viewBox } = useMemo(() => {
    const validHexKeys = new Set(validHexes.map(hexKey));
    const tileEntries = Object.values(view.board.tiles).filter((t) => !t.is_terrain || validHexKeys.has(hexKey(t.hex)));
    const positions = tileEntries.map((t) => ({
      tile: t,
      ...hexToPixel(t.hex),
    }));

    if (positions.length === 0) return { tiles: [], viewBox: "0 0 100 100" };

    const xs = positions.map((p) => p.x);
    const ys = positions.map((p) => p.y);
    const pad = 50;
    const minX = Math.min(...xs) - pad;
    const minY = Math.min(...ys) - pad;
    const maxX = Math.max(...xs) + pad;
    const maxY = Math.max(...ys) + pad;

    return {
      tiles: positions,
      viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
    };
  }, [validHexes, view.board.tiles]);

  const handleSvgPointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (!onWorldPointer || !mapConfig || e.pointerType === "touch") return;
      const rect = e.currentTarget.getBoundingClientRect();
      const [, vbX, vbY, vbW, vbH] = viewBox.split(" ").map(Number);
      // preserveAspectRatio="xMidYMid meet": fit the viewBox inside the rect.
      const scale = Math.min(rect.width / vbW, rect.height / vbH);
      const offsetX = (rect.width - vbW * scale) / 2;
      const offsetY = (rect.height - vbH * scale) / 2;
      const sx = vbX + (e.clientX - rect.left - offsetX) / scale;
      const sy = vbY + (e.clientY - rect.top - offsetY) / scale;
      onWorldPointer(svgToWorld(sx, sy, mapConfig));
    },
    [onWorldPointer, mapConfig, viewBox],
  );

  const handleSvgPointerLeave = useCallback(() => {
    onWorldPointer?.(null);
  }, [onWorldPointer]);

  const remoteMarkerEntries = useMemo(() => {
    if (!remotePointers || !mapConfig) return [];
    // Zone targets point at hero boards, which only exist in the 3D table;
    // the 2D grid renders just the shared map.
    return Object.entries(remotePointers).flatMap(([heroId, pointer]) => {
      if (pointer.kind !== "point") return [];
      const presentation = heroPresentation(view, heroId);
      return [{
        heroId,
        ...worldToSvg(pointer.x, pointer.z, mapConfig),
        color: presentation.color,
        label: presentation.label,
      }];
    });
  }, [remotePointers, mapConfig, view]);

  return (
    <div
      className={`${styles.container} ${transform.k > 1 ? styles.pannable : ""}`}
      ref={containerRef}
      {...handlers}
    >
      <svg
        className={styles.svg}
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        style={transform.k === 1 ? undefined : { transform: toCss(transform) }}
        onPointerMove={handleSvgPointerMove}
        onPointerLeave={handleSvgPointerLeave}
      >
        {tiles.map(({ tile, x, y }) => {
          const occupantId = tile.occupant_id;
          const heroId = occupantId ? heroIdByPiece.get(occupantId) ?? occupantId : null;
          const hero = heroId ? unitLookup.heroes.get(heroId) : undefined;
          const minion = occupantId ? unitLookup.minions.get(occupantId) : undefined;
          const occupantToken = occupantId ? tokenLookup.get(occupantId) : undefined;
          const occupantEntity = occupantId ? boardEntityLookup.get(occupantId) : undefined;
          const tileTokens = tokensByHex.get(hexKey(tile.hex)) ?? [];
          const nonOccupantTokens = occupantToken
            ? tileTokens.filter((t) => t.id !== occupantToken.id)
            : tileTokens;

          const isValidHex = validHexes.some(
            (h) => h.q === tile.hex.q && h.r === tile.hex.r && h.s === tile.hex.s
          );
          const isValidUnit = occupantId ? validUnitIds.includes(occupantId) : false;
          const hasValidToken = nonOccupantTokens.some((t) => validTokenIds.has(t.id));
          const isOccupantTokenValid = occupantToken ? validTokenIds.has(occupantToken.id) || validUnitIds.includes(occupantToken.id) : false;
          const isValid = isValidHex || isValidUnit || hasValidToken || isOccupantTokenValid;
          const tileKey = hexKey(tile.hex);
          const isPreviewPath = previewPathSet.has(tileKey);
          const isPreviewMine = previewMineSet.has(tileKey);
          const tilePings = pings
            .filter((ping) => pingTargetKey(ping.target) === pingTargetKey({ kind: "HEX", hex: tile.hex }))
            .map((ping) => ({ ...pingPresentation(view, ping), id: ping.ping_id }));

          return (
            <HexTile
              key={tileKey}
              hex={tile.hex}
              cx={x}
              cy={y}
              zoneId={tile.zone_id}
              occupantId={occupantId}
              hero={hero}
              minion={minion}
              occupantToken={occupantToken}
              occupantEntity={occupantEntity}
              tokens={nonOccupantTokens}
              spawnPoint={tile.spawn_point}
              isValidTarget={isValid}
              isValidToken={hasValidToken || isOccupantTokenValid}
              isPreviewPath={isPreviewPath}
              isPreviewMine={isPreviewMine}
              markers={heroId ? markersByUnit.get(heroId) : undefined}
              isCurrentActor={heroId === view.current_actor_id}
              onHeroHover={handleHeroHover}
              pings={tilePings}
              onPingHover={(hovered) => onPingTargetHover?.(hovered ? { kind: "HEX", hex: tile.hex } : null)}
              onTokenClick={(hasValidToken || isOccupantTokenValid) ? onUnitClick : undefined}
              onClick={() => {
                if ((isValidUnit || isOccupantTokenValid) && occupantId) {
                  onUnitClick(occupantId);
                } else if (isValidHex) {
                  onHexClick(tile.hex);
                }
              }}
            />
          );
        })}

        {remoteMarkerEntries.map(({ heroId, x, y, color, label }) => (
          <g
            key={heroId}
            className={styles.remoteCursor}
            style={{ transform: `translate(${x}px, ${y}px)` }}
          >
            <g transform="scale(0.85)" opacity={0.7}>
              <path
                d={CURSOR_PATH}
                fill={color}
                fillOpacity={0.14}
                stroke={color}
                strokeOpacity={0.5}
                strokeWidth={1.6}
                strokeLinejoin="round"
              />
            </g>
            <text x={11} y={20} fontSize={10} fontWeight={700} fill="#fff" opacity={0.5}>
              {label}
            </text>
          </g>
        ))}
      </svg>
      {transform.k > 1 && (
        <button type="button" className={styles.zoomReset} onClick={reset}>
          {Math.round(transform.k * 100)}% · Reset
        </button>
      )}
      {hoveredCard && (
        <img
          src={`/hero-cards/${hoveredCard.name.toLowerCase()}.png`}
          alt={hoveredCard.name}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          style={{
            position: "fixed",
            left: hoveredCard.x + 20,
            top: hoveredCard.y - 130,
            maxWidth: 372,
            pointerEvents: "none",
            zIndex: 9999,
            borderRadius: 6,
            boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
          }}
          className={styles.heroCard}
        />
      )}
    </div>
  );
}

function isHex(value: unknown): value is Hex {
  return (
    typeof value === "object" &&
    value !== null &&
    "q" in value &&
    "r" in value &&
    "s" in value
  );
}
