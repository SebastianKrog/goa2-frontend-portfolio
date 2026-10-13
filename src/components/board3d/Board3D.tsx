import { Fragment, Suspense, useCallback, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Table } from "./Table";
import { CameraRig } from "./CameraRig";
import { MapPlane } from "./MapPlane";
import { HexOverlay } from "./HexOverlay";
import { DirectionOverlay } from "./DirectionOverlay";
import { isDirectionRequest } from "../../utils/direction";
import { RealitySplitOverlay } from "./RealitySplitOverlay";
import { RealityCrackEffect } from "./RealityCrackEffect";
import { activeSplitEffects, isRealitySplitRequest } from "../../utils/realitySplit";
import { CalibrationPanel } from "./CalibrationPanel";
import { ModelCalibrationPanel } from "./ModelCalibrationPanel";
import { CardSlotCalibrationPanel } from "./CardSlotCalibrationPanel";
import { UnitMesh } from "./UnitMesh";
import { HeroMesh } from "./HeroMesh";
import { AnimatedUnit } from "./anim/AnimatedUnit";
import { CombatEffects } from "./anim/CombatEffects";
import { usePresence } from "./anim/usePresence";
import { TEAM_BASE_COLORS, DEFAULT_TEAM_BASE } from "./anim/TeamBase";
import { TeamBaseCalibrationPanel } from "./TeamBaseCalibrationPanel";
import { UnitMarkers } from "./UnitMarkers";
import { NamedColorSigil } from "./NamedColorSigil";
import { TokenMesh } from "./TokenMesh";
import { PlayerMat } from "./PlayerMat";
import {
  DEFAULT_PLAYER_BOARD_LAYOUT,
  seatPlacements,
  tableHalfExtent,
  type PlayerBoardLayout,
} from "./seating";
import { TurnCardStrip } from "./TurnCardStrip";
import { CARD_H, CARD_W, SPELL_H, SPELL_W } from "./cards/paintCard";
import { DeckStack } from "./DeckStack";
import { SpellbookStack } from "./SpellbookStack";
import { SpellFaceMesh } from "./SpellFaceMesh";
import { WishPlaque } from "./WishPlaque";
import { StatusPlaque } from "./StatusPlaque";
import { OpponentHandFan } from "./OpponentHandFan";
import { ResolveSpotlight } from "./ResolveSpotlight";
import { PingMarker3D } from "./PingMarker3D";
import { PointerProjector, RemotePointers3D, type WorldPointerReport } from "./PointerPresence";
import { CameraReadoutProbe, CameraReadoutPanel, type CameraRead, type SeatInfo } from "./CameraReadout";
import { MatItemIcon } from "./MatItemIcon";
import { CardMesh } from "./cards/CardMesh";
import { CardCanvas } from "./hud/CardCanvas";
import { LanguageControls } from "./hud/LanguageControls";
import { SoundControls } from "./hud/SoundControls";
import { useAltHeld } from "../../hooks/useAltHeld";
import { mapConfigFor } from "./maps";
import { hexToLocal } from "./maps/geometry";
import { buildHeroFacingTargets, lookAtHexDeg } from "./facing";
import type { MapConfig } from "./maps/types";
import { ITEM_CONFIGS } from "../../utils/itemIcons";
import { CARD_ICONS } from "../../utils/cardIcons";
import { MINION_MODELS, minionModelKey, type ModelConfig } from "./models";
import {
  HERO_MODELS,
  LEGACY_HERO_MODELS,
  heroModelKey,
  trinketsTurretModelPath,
  type HeroConfig,
} from "./heroes";
import {
  buildCalibrationHeroUnits,
  buildHeroDisplayMap,
  heroSwapQueryValues,
  resolveHeroRenderConfig,
} from "./heroCalibration";
import type { ActivePing, GameView, HeroView, InputRequest, Hex, CardView, PingTarget, RemotePointer } from "../../types/game";
import { hexKey } from "../../utils/hex";
import { pingPresentation, pingTargetKey } from "../../utils/pings";
import {
  hiddenGuessCard,
  type CardGuessAttempt,
} from "../../hooks/useCardGuessReveal";

const HERO_PREFIX = "HERO_";

// Stand-in cast spells rendered on every mat in calibrate mode, so the spell
// zone sliders can be tuned without wiring up a real Gydion game.
const dummySpell = (id: string, name: string, imageId: string, rank: number): CardView => ({
  id: `dummy_${id}`,
  name,
  image_id: imageId,
  tier: "UNTIERED",
  color: null,
  primary_action: null,
  primary_action_value: null,
  secondary_actions: {},
  effect_id: null,
  effect_text: null,
  initiative: 0,
  state: "OUTSIDE_SPELLBOOK",
  is_facedown: false,
  is_ranged: false,
  range_value: null,
  radius_value: null,
  item: null,
  is_active: false,
  spell_rank: rank,
});

// Worst case: the whole 22-spell book spent, Wish included — every spell face
// we ship — to test the fan at its absolute maximum with the pile empty.
const DUMMY_CAST_SPELLS: CardView[] = [
  ["GoldI", 0], ["GoldII", 0], ["GoldIII", 0],
  ["RedIA", 1], ["GreenIA", 1], ["BlueIA", 1],
  ["RedIIA", 2], ["RedIIB", 2], ["RedIIB2", 2],
  ["BlueIIA", 2], ["BlueIIB", 2], ["BlueIIB2", 2],
  ["GreenIIA", 2], ["GreenIIB", 2], ["GreenIIB2", 2],
  ["RedIIIA", 3], ["RedIIIB", 3],
  ["BlueIIIA", 3], ["BlueIIIB", 3],
  ["GreenIIIA", 3], ["GreenIIIB", 3],
  ["Ultimate", 3],
].map(([imageId, rank], i) => dummySpell(`stress${i}`, `Spell ${i + 1}`, imageId as string, rank as number));

// The cast fan wraps into rows of this many spells so a late-game pile grows
// toward the table edge instead of running over the discard pile and wish
// plaque to its right.
const CAST_PER_ROW = 7;
/** Gydion's full spell list; the widest cast spread the table must hold. */
const MAX_SPELLS = 22;
const MAT_HALF_WIDTH = 2.25;
const MAT_HALF_HEIGHT = 1.125;
const ITEM_ICON_SPACING = 0.27;
const ITEM_ICON_MAX_SPAN = 0.54;

interface Props {
  view: GameView | null;
  inputRequest: InputRequest | null;
  onHexClick: (hex: Hex) => void;
  onUnitClick: (unitId: string) => void;
  /** Resolve an abstract option (used for on-board direction selection). */
  onSelect?: (value: string) => void;
  myHeroId?: string | null;
  calibrate?: boolean;
  modelCalibrationOnly?: boolean;
  heroSwap?: string[];
  onHeroSwapChange?: (models: string[]) => void;
  originalHeroUnits?: string[];
  onOriginalHeroUnitsChange?: (unitIds: string[]) => void;
  useLegacyHeroModels?: boolean;
  playerBoardLayout?: PlayerBoardLayout;
  /** Display name per hero id. Empty when the game was created without names. */
  heroNames?: Record<string, string>;
  /** Multiplier on every light's intensity. 1 is the authored lighting. */
  brightness?: number;
  onViewDeck?: () => void;
  onViewSpellbook?: () => void;
  previewHexes?: { path: Hex[]; mine_hexes: Hex[] } | null;
  /** Stop the continuous WebGL loop while a full-screen UI owns the game. */
  renderOnDemand?: boolean;
  pings?: ActivePing[];
  onPingTargetHover?: (target: PingTarget | null) => void;
  cardGuessAttempts?: CardGuessAttempt[];
  /** Reports this player's pointer projected onto the table; null when off-board. */
  onWorldPointer?: (point: WorldPointerReport) => void;
  /** Everyone else's last reported table position. */
  remotePointers?: Record<string, RemotePointer>;
}

export function Board3D({ view, inputRequest, onHexClick, onUnitClick, onSelect, myHeroId = null, calibrate = false, modelCalibrationOnly = false, heroSwap = [], onHeroSwapChange, originalHeroUnits = [], onOriginalHeroUnitsChange, useLegacyHeroModels = false, playerBoardLayout = DEFAULT_PLAYER_BOARD_LAYOUT, heroNames = {}, brightness = 1, onViewDeck, onViewSpellbook, previewHexes = null, renderOnDemand = false, pings = [], onPingTargetHover, cardGuessAttempts = [], onWorldPointer, remotePointers }: Props) {
  const mapConfig: MapConfig = useMemo(
    () => mapConfigFor(view?.board?.map),
    [view?.board?.map],
  );

  // Calibration numbers start from the map's authored values and may be nudged
  // live in calibration mode; switching maps discards the nudges. Tagging the
  // state with the map name lets the reset happen during render instead of an
  // effect, so a map switch never paints one frame of stale geometry.
  interface GridCalibration {
    mapName: string;
    hexSize: number;
    originX: number;
    originZ: number;
    rotationDeg: number;
  }
  const [gridCalibration, setGridCalibration] = useState<GridCalibration>(() => ({
    mapName: mapConfig.name,
    hexSize: mapConfig.hexSize,
    originX: mapConfig.origin.x,
    originZ: mapConfig.origin.z,
    rotationDeg: mapConfig.rotationDeg,
  }));
  if (gridCalibration.mapName !== mapConfig.name) {
    setGridCalibration({
      mapName: mapConfig.name,
      hexSize: mapConfig.hexSize,
      originX: mapConfig.origin.x,
      originZ: mapConfig.origin.z,
      rotationDeg: mapConfig.rotationDeg,
    });
  }
  const { hexSize, originX, originZ, rotationDeg } = gridCalibration;
  const setHexSize = useCallback(
    (n: number) => setGridCalibration((c) => ({ ...c, hexSize: n })),
    [],
  );
  const setOriginX = useCallback(
    (n: number) => setGridCalibration((c) => ({ ...c, originX: n })),
    [],
  );
  const setOriginZ = useCallback(
    (n: number) => setGridCalibration((c) => ({ ...c, originZ: n })),
    [],
  );
  const setRotationDeg = useCallback(
    (n: number) => setGridCalibration((c) => ({ ...c, rotationDeg: n })),
    [],
  );
  const [tokenY, setTokenY] = useState(-0.035);
  const [turretScale, setTurretScale] = useState(1.3);
  const [turretY, setTurretY] = useState(-0.05);
  const [turretRotationDeg, setTurretRotationDeg] = useState(91);

  const [cardWidth, setCardWidth] = useState(0.835);
  const [slotY, setSlotY] = useState(-0.110);
  const [slotFirstX, setSlotFirstX] = useState(-1.525);
  const [slotSpacing, setSlotSpacing] = useState(0.990);
  const [commitY, setCommitY] = useState(2.14);
  const [discardX, setDiscardX] = useState(2.505);
  const [discardStackY, setDiscardStackY] = useState(-0.100);
  const [discardStackLift, setDiscardStackLift] = useState(0.0005);
  const [ultimateX, setUltimateX] = useState(-3.000);
  const [ultimateY, setUltimateY] = useState(-0.110);
  const [deckX, setDeckX] = useState(-3.900);
  const [deckY, setDeckY] = useState(-0.600);
  const [statusX, setStatusX] = useState(0.000);
  const [statusY, setStatusY] = useState(-1.500);
  const [itemY, setItemY] = useState(1.320);
  const [runeY, setRuneY] = useState(-0.850);
  const [runeSize, setRuneSize] = useState(0.360);
  const [spellbookX, setSpellbookX] = useState(-3.865);
  const [spellbookY, setSpellbookY] = useState(-1.570);
  const [castFirstX, setCastFirstX] = useState(-2.890);
  const [castSpacing, setCastSpacing] = useState(0.200);
  const [spellWidth, setSpellWidth] = useState(1.000);
  const [wishX, setWishX] = useState(1.100);
  const [wishY, setWishY] = useState(-1.500);

  const [baseCfg, setBaseCfg] = useState(DEFAULT_TEAM_BASE);
  const [outlineWidth, setOutlineWidth] = useState(0);

  const [modelOverrides, setModelOverrides] = useState<Record<string, ModelConfig>>(MINION_MODELS);
  const [heroOverrides, setHeroOverrides] = useState<Record<string, HeroConfig>>(HERO_MODELS);
  const [selectedModelKey, setSelectedModelKey] = useState<string | null>(null);
  const [interactiveHeroSwaps, setInteractiveHeroSwaps] = useState<Record<string, string>>({});
  const [selectedHeroUnitId, setSelectedHeroUnitId] = useState("");

  const calibrationKeys = useMemo(
    () => [
      ...Object.keys(modelOverrides),
      ...Object.keys(heroOverrides).map((k) => `${HERO_PREFIX}${k}`),
    ],
    [modelOverrides, heroOverrides],
  );

  const rotationRad = (rotationDeg * Math.PI) / 180;

  const heroByHex = useMemo(() => {
    const map = new Map<string, HeroView>();
    if (!view) return map;
    const heroById = new Map<string, HeroView>();
    const heroByModelKey = new Map<string, HeroView>();
    for (const team of Object.values(view.teams ?? {})) {
      for (const hero of team.heroes) {
        heroById.set(hero.id, hero);
        heroByModelKey.set(heroModelKey(hero.id), hero);
      }
    }
    for (const tile of Object.values(view.board.tiles)) {
      const occ = tile.occupant_id;
      if (!occ) continue;
      const hero = heroById.get(occ) ?? heroByModelKey.get(heroModelKey(occ));
      if (hero) map.set(hexKey(tile.hex), hero);
    }
    return map;
  }, [view]);

  const [tooltipHero, setTooltipHero] = useState<HeroView | null>(null);
  const [cameraRead, setCameraRead] = useState<CameraRead | null>(null);

  const altHeld = useAltHeld();
  const [hoveredCard, setHoveredCard] = useState<{ card: CardView; heroSlug: string } | null>(null);
  const onCardHover = (card: CardView, heroSlug: string, target: PingTarget) => (hovered: boolean) => {
    setHoveredCard((prev) => {
      if (hovered && card.id) return { card, heroSlug };
      if (prev && prev.card.id === card.id) return null;
      return prev;
    });
    onPingTargetHover?.(hovered ? target : null);
  };

  const handleHoverHex = (hex: Hex | null) => {
    onPingTargetHover?.(hex ? { kind: "HEX", hex } : null);
    if (!hex) {
      setTooltipHero(null);
      return;
    }
    setTooltipHero(heroByHex.get(hexKey(hex)) ?? null);
  };

  const pingsByTarget = useMemo(() => {
    const byTarget = new Map<string, ActivePing[]>();
    for (const ping of pings) {
      const key = pingTargetKey(ping.target);
      const list = byTarget.get(key) ?? [];
      list.push(ping);
      byTarget.set(key, list);
    }
    return byTarget;
  }, [pings]);

  const { minionPlacements, heroPlacements, turretPlacements } = useMemo(() => {
    const minions: Array<{ id: string; hex: Hex; modelKey: string; team: string }> = [];
    const heroes: Array<{ id: string; hex: Hex; heroKey: string; team: string }> = [];
    const turrets: Array<{ id: string; hex: Hex; ownerId: string | null }> = [];
    if (!view) return { minionPlacements: minions, heroPlacements: heroes, turretPlacements: turrets };

    for (const ent of view.board_entities ?? []) {
      if (ent.entity_kind === "turret" && ent.hex) {
        turrets.push({ id: ent.id, hex: ent.hex, ownerId: ent.owner_id });
      }
    }

    const minionById = new Map<string, { team: string; type: string }>();
    const heroById = new Map<string, { id: string; team: string }>();
    const heroByModelKey = new Map<string, { id: string; team: string }>();
    for (const team of Object.values(view.teams ?? {})) {
      for (const m of team.minions) minionById.set(m.id, { team: m.team, type: m.type });
      for (const h of team.heroes) {
        const hero = { id: h.id, team: h.team };
        heroById.set(h.id, hero);
        heroByModelKey.set(heroModelKey(h.id), hero);
      }
    }

    for (const tile of Object.values(view.board.tiles)) {
      const occupantId = tile.occupant_id;
      if (!occupantId) continue;
      const minion = minionById.get(occupantId);
      if (minion) {
        minions.push({
          id: occupantId,
          hex: tile.hex,
          modelKey: minionModelKey(minion.team, minion.type),
          team: minion.team,
        });
        continue;
      }
      const hero = heroById.get(occupantId) ?? heroByModelKey.get(heroModelKey(occupantId));
      if (hero) {
        heroes.push({
          id: occupantId,
          hex: tile.hex,
          heroKey: heroModelKey(occupantId),
          team: hero.team,
        });
      }
    }
    return { minionPlacements: minions, heroPlacements: heroes, turretPlacements: turrets };
  }, [view]);

  const heroModelKeys = useMemo(() => Object.keys(heroOverrides).sort(), [heroOverrides]);
  const displayHeroKey = useMemo(
    () => buildHeroDisplayMap(
      heroPlacements,
      heroSwap,
      interactiveHeroSwaps,
      heroModelKeys,
    ),
    [heroPlacements, heroSwap, interactiveHeroSwaps, heroModelKeys],
  );
  const calibrationHeroUnits = useMemo(
    () => buildCalibrationHeroUnits(heroPlacements, displayHeroKey),
    [heroPlacements, displayHeroKey],
  );
  const selectedHeroUnit =
    calibrationHeroUnits.find((unit) => unit.id === selectedHeroUnitId)
    ?? calibrationHeroUnits[0];
  const originalHeroUnitIds = useMemo(
    () => new Set(originalHeroUnits),
    [originalHeroUnits],
  );
  const selectedHeroConfig = selectedHeroUnit
    ? heroOverrides[selectedHeroUnit.displayKey]
    : undefined;
  const selectedHeroUsesOriginal = Boolean(
    selectedHeroUnit
    && selectedHeroConfig?.originalGltfPath
    && originalHeroUnitIds.has(selectedHeroUnit.id),
  );
  const resolvedSelectedModelKey =
    selectedModelKey
    ?? (selectedHeroUnit ? `${HERO_PREFIX}${selectedHeroUnit.displayKey}` : "RED_HEAVY");
  const selectedTransform = resolvedSelectedModelKey.startsWith(HERO_PREFIX)
    ? heroOverrides[resolvedSelectedModelKey.slice(HERO_PREFIX.length)]
    : modelOverrides[resolvedSelectedModelKey];

  const updateSelectedModel = (partial: Partial<HeroConfig>) => {
    if (resolvedSelectedModelKey.startsWith(HERO_PREFIX)) {
      const heroKey = resolvedSelectedModelKey.slice(HERO_PREFIX.length);
      setHeroOverrides((prev) => ({
        ...prev,
        [heroKey]: { ...prev[heroKey], ...partial },
      }));
    } else {
      setModelOverrides((prev) => ({
        ...prev,
        [resolvedSelectedModelKey]: {
          ...prev[resolvedSelectedModelKey],
          ...partial,
        },
      }));
    }
  };

  const selectCalibrationHeroUnit = (unitId: string) => {
    const unit = calibrationHeroUnits.find((candidate) => candidate.id === unitId);
    if (!unit) return;
    setSelectedHeroUnitId(unit.id);
    setSelectedModelKey(`${HERO_PREFIX}${unit.displayKey}`);
  };

  const changeCalibrationHeroModel = (modelKey: string) => {
    if (!selectedHeroUnit || !heroOverrides[modelKey]) return;
    const nextInteractiveSwaps = {
      ...interactiveHeroSwaps,
      [selectedHeroUnit.id]: modelKey,
    };
    setInteractiveHeroSwaps(nextInteractiveSwaps);
    onHeroSwapChange?.(heroSwapQueryValues(
      heroPlacements,
      buildHeroDisplayMap(heroPlacements, heroSwap, nextInteractiveSwaps, heroModelKeys),
    ));
    setSelectedModelKey(`${HERO_PREFIX}${modelKey}`);
    if (!heroOverrides[modelKey].originalGltfPath && originalHeroUnitIds.has(selectedHeroUnit.id)) {
      const nextOriginalUnits = new Set(originalHeroUnitIds);
      nextOriginalUnits.delete(selectedHeroUnit.id);
      onOriginalHeroUnitsChange?.([...nextOriginalUnits].sort());
    }
  };

  const resetCalibrationHeroModel = () => {
    if (!selectedHeroUnit) return;
    const nextInteractiveSwaps = {
      ...interactiveHeroSwaps,
      [selectedHeroUnit.id]: selectedHeroUnit.heroKey,
    };
    setInteractiveHeroSwaps(nextInteractiveSwaps);
    onHeroSwapChange?.(heroSwapQueryValues(
      heroPlacements,
      buildHeroDisplayMap(heroPlacements, heroSwap, nextInteractiveSwaps, heroModelKeys),
    ));
    setSelectedModelKey(`${HERO_PREFIX}${selectedHeroUnit.heroKey}`);
    if (
      !heroOverrides[selectedHeroUnit.heroKey]?.originalGltfPath
      && originalHeroUnitIds.has(selectedHeroUnit.id)
    ) {
      const nextOriginalUnits = new Set(originalHeroUnitIds);
      nextOriginalUnits.delete(selectedHeroUnit.id);
      onOriginalHeroUnitsChange?.([...nextOriginalUnits].sort());
    }
  };

  const changeCalibrationHeroAssetVariant = (variant: "current" | "original") => {
    if (!selectedHeroUnit) return;
    const next = new Set(originalHeroUnitIds);
    if (variant === "original" && selectedHeroConfig?.originalGltfPath) {
      next.add(selectedHeroUnit.id);
    } else {
      next.delete(selectedHeroUnit.id);
    }
    onOriginalHeroUnitsChange?.([...next].sort());
  };

  const tokenPlacements = useMemo(() => {
    if (!view) return [] as Array<{ id: string; hex: Hex; iconPath: string; stackIndex: number }>;
    const byHex = new Map<string, number>();
    const result: Array<{ id: string; hex: Hex; iconPath: string; stackIndex: number }> = [];
    for (const tok of view.tokens ?? []) {
      if (!tok.hex) continue;
      const k = hexKey(tok.hex);
      const stackIndex = byHex.get(k) ?? 0;
      byHex.set(k, stackIndex + 1);
      result.push({
        id: tok.id,
        hex: tok.hex,
        iconPath: `/icons/token_${tok.token_type}.png`,
        stackIndex,
      });
    }
    return result;
  }, [view]);

  const matPlacements = useMemo(
    () => seatPlacements(view, myHeroId, playerBoardLayout),
    [view, myHeroId, playerBoardLayout],
  );

  // How far a board's furthest piece sits from its seat. Derived from the live
  // calibration offsets so the table keeps holding everything if they change.
  const boardReach = useMemo(() => {
    const cardHalfW = cardWidth / 2;
    const cardHalfH = (cardWidth * (CARD_H / CARD_W)) / 2;
    const spellHalfW = spellWidth / 2;
    const spellHalfH = (spellWidth * (SPELL_H / SPELL_W)) / 2;
    // Gydion's 22 spells wrap onto CAST_PER_ROW columns; the last row is the
    // furthest thing behind the mat.
    const castRows = Math.ceil(MAX_SPELLS / CAST_PER_ROW);
    const castBottom = Math.abs(spellbookY - (castRows - 1) * (spellWidth * 0.75)) + spellHalfH;
    return Math.max(
      MAT_HALF_WIDTH,
      MAT_HALF_HEIGHT,
      Math.abs(deckX) + cardHalfW,
      Math.abs(ultimateX) + cardHalfW,
      Math.abs(discardX) + cardHalfW,
      Math.abs(commitY) + cardHalfH,
      Math.abs(statusY),
      Math.abs(wishY),
      Math.abs(spellbookX) + spellHalfW,
      Math.abs(castFirstX) + spellHalfW,
      castBottom,
    );
  }, [cardWidth, spellWidth, deckX, ultimateX, discardX, commitY, statusY, wishY, spellbookX, spellbookY, castFirstX]);

  const tableExtent = useMemo(
    () => tableHalfExtent(matPlacements, boardReach),
    [matPlacements, boardReach],
  );

  const seats = useMemo<SeatInfo[]>(
    () =>
      matPlacements.map((mat) => ({
        id: mat.hero.id,
        position: mat.position,
        theta: mat.rotationY,
        isMine: mat.hero.id === myHeroId,
      })),
    [matPlacements, myHeroId],
  );

  const heroFacingTargets = useMemo(
    () => buildHeroFacingTargets(heroPlacements, minionPlacements),
    [heroPlacements, minionPlacements],
  );
  const heroLookAtDeg = useMemo(() => new Map(
    heroPlacements.flatMap((hero) => {
      const target = heroFacingTargets.get(hero.id);
      return target ? [[hero.id, lookAtHexDeg(hero.hex, target, hexSize)] as const] : [];
    }),
  ), [heroPlacements, heroFacingTargets, hexSize]);

  const markersByUnit = useMemo(() => {
    const map = new Map<string, { type: string; value: number }[]>();
    if (!view) return map;
    for (const [type, marker] of Object.entries(view.markers ?? {})) {
      const list = map.get(marker.target_id) ?? [];
      list.push({ type, value: marker.value });
      map.set(marker.target_id, list);
    }
    return map;
  }, [view]);

  // Colors publicly named by each hero (Imbue Doubt family) — shown as a
  // floating sigil above the hero while the effect is pending.
  const namedColorsByUnit = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!view) return map;
    for (const fx of view.effects) {
      if (!fx.is_active || fx.named_color == null || !fx.scope.origin_id) continue;
      const list = map.get(fx.scope.origin_id) ?? [];
      list.push(fx.named_color);
      map.set(fx.scope.origin_id, list);
    }
    return map;
  }, [view]);

  // Keep just-defeated units around briefly so they can play a sink/shrink exit
  // instead of popping out the instant the view drops them.
  const minionUnits = usePresence(minionPlacements);
  const heroUnits = usePresence(heroPlacements);
  const tokenUnits = usePresence(tokenPlacements);
  const turretUnits = usePresence(turretPlacements);

  return (
    <>
      <Canvas
        shadows
        dpr={[1, 2]}
        frameloop={renderOnDemand ? "demand" : "always"}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        style={{ width: "100%", height: "100%", background: "#08090c" }}
        camera={{ position: [0, 8.46, 10.58], fov: 45 }}
      >
        <color attach="background" args={["#08090c"]} />
        <fog attach="fog" args={["#08090c", 24, 58]} />
        <CameraRig tableHalfExtent={tableExtent} />
        {onWorldPointer && <PointerProjector onWorldPointer={onWorldPointer} placements={matPlacements} />}
        {calibrate && !modelCalibrationOnly && (
          <CameraReadoutProbe seats={seats} onRead={setCameraRead} />
        )}
        <hemisphereLight args={["#b8c7e8", "#22120a", 0.48]} intensity={0.48 * brightness} />
        <ambientLight intensity={0.22 * brightness} color="#fff1d6" />
        <directionalLight
          position={[4, 13, 7]}
          intensity={1.45 * brightness}
          color="#ffd9a0"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-bias={-0.0004}
        />
        <directionalLight position={[-7, 9, -5]} intensity={0.42 * brightness} color="#8db6ff" />
        <Table halfExtent={tableExtent} />
        <MapPlane config={mapConfig} />
        {playerBoardLayout === "rows" && (
          <Suspense fallback={null}>
            <TurnCardStrip placements={matPlacements} onCardHover={onCardHover} />
          </Suspense>
        )}
        {matPlacements.map((mat) => {
          const cos = Math.cos(mat.rotationY);
          const sin = Math.sin(mat.rotationY);
          const scaleOrigin: [number, number, number] = [
            mat.position[0] * (1 - mat.scale),
            mat.position[1] * (1 - mat.scale),
            mat.position[2] * (1 - mat.scale),
          ];
          return (
            <Suspense key={mat.hero.id} fallback={null}>
              <group position={scaleOrigin} scale={mat.scale}>
                <PlayerMat
                  imagePath={mat.imagePath}
                  position={mat.position}
                  rotationY={mat.rotationY}
                  width={4.5}
                  height={2.25}
                />
                {(() => {
                // Unify this hero's on-table cards into one id-keyed list so a
                // card keeps its identity — and thus eases — as it moves between
                // zones (commit → played slot → discard pile at cleanup).
                const toWorld = (lx: number, ly: number): [number, number] => [
                  mat.position[0] + lx * cos + ly * -sin,
                  mat.position[2] + lx * -sin + ly * -cos,
                ];
                const entries: Array<{ key: string; card: CardView; position: [number, number, number]; flip: boolean; pingTarget: PingTarget }> = [];
                const seen = new Set<string>();
                const add = (
                  card: CardView | null | undefined,
                  position: [number, number, number],
                  flip: boolean,
                  fallbackKey: string,
                  pingTarget: PingTarget,
                ) => {
                  if (!card) return;
                  // Opponents receive anonymous facedown cards without ids.
                  // Give each public table slot a stable identity so Emmitt's
                  // two hidden commits do not collapse into one entry.
                  const key = card.id || `${mat.hero.id}:${fallbackKey}`;
                  if (seen.has(key)) return;
                  seen.add(key);
                  entries.push({ key, card, position, flip, pingTarget });
                };

                // current_turn_card first so a card mid-transition stays at the
                // commit zone for the frame it is briefly in two zones at once.
                // Emmitt's two committed cards sit side by side from the second
                // commit through revelation and until the retrieve choice;
                // otherwise the single card stays centered.
                const hasTwoCommittedCards = Boolean(mat.hero.extra_turn_card);
                const commitOffset = hasTwoCommittedCards ? slotSpacing / 2 : 0;
                // Planning exposes the latest commit as current and the first
                // as extra; revelation uses current=first and extra=second.
                // Reverse the slots during Planning so each physical card stays
                // in place when the fields swap at revelation.
                const currentX = view?.phase === "PLANNING" ? commitOffset : -commitOffset;
                const extraX = view?.phase === "PLANNING" ? -commitOffset : commitOffset;
                if (mat.hero.current_turn_card) {
                  const [wx, wz] = toWorld(currentX, commitY);
                  add(mat.hero.current_turn_card, [wx, mat.position[1] + 0.05, wz], true, "current", {
                    kind: "CARD", hero_id: mat.hero.id, zone: "CURRENT",
                  });
                }
                if (mat.hero.extra_turn_card) {
                  const [wx, wz] = toWorld(extraX, commitY);
                  add(mat.hero.extra_turn_card, [wx, mat.position[1] + 0.05, wz], true, "extra", {
                    kind: "CARD", hero_id: mat.hero.id, zone: "EXTRA",
                  });
                }
                mat.hero.played_cards.forEach((card, idx) => {
                  if (!card || idx > 3) return;
                  const [wx, wz] = toWorld(slotFirstX + idx * slotSpacing, slotY);
                  add(card, [wx, mat.position[1] + 0.03, wz], false, `played:${idx}`, {
                    kind: "CARD", hero_id: mat.hero.id, zone: "PLAYED", index: idx,
                  });
                });
                mat.hero.discard_pile.forEach((card, idx) => {
                  const [wx, wz] = toWorld(discardX, slotY + idx * discardStackY);
                  add(card, [wx, mat.position[1] + 0.03 + idx * discardStackLift, wz], false, `discard:${idx}`, {
                    kind: "CARD", hero_id: mat.hero.id, zone: "DISCARD", index: idx,
                  });
                });
                if (mat.hero.ultimate_card && mat.hero.level >= 8) {
                  const [wx, wz] = toWorld(ultimateX, ultimateY);
                  add(mat.hero.ultimate_card, [wx, mat.position[1] + 0.03, wz], false, "ultimate", {
                    kind: "CARD", hero_id: mat.hero.id, zone: "ULTIMATE",
                  });
                }

                const guessEntries = cardGuessAttempts
                  .filter((attempt) => attempt.victimId === mat.hero.id)
                  .map((attempt, index, attempts) => {
                    // Match the physical game: the privately chosen card sits
                    // just above the victim's committed card, then the same
                    // mesh flips faceup when the guess resolves. A repeat is
                    // offset slightly so the first revealed card stays visible.
                    const localX = (index - (attempts.length - 1) / 2) * cardWidth * 0.28;
                    const [wx, wz] = toWorld(localX, commitY - index * cardWidth * 0.1);
                    return {
                      key: `card-guess:${attempt.guesserId}:${attempt.attempt}`,
                      card: attempt.card ?? hiddenGuessCard(attempt),
                      position: [
                        wx,
                        mat.position[1] + 0.082 + index * 0.006,
                        wz,
                      ] as [number, number, number],
                    };
                  });

                return (
                  <>
                    {entries.map(({ key, card, position, flip, pingTarget }) => {
                      const targetPings = pingsByTarget.get(pingTargetKey(pingTarget)) ?? [];
                      return (
                        <Fragment key={key}>
                          <CardMesh
                            card={card}
                            heroSlug={mat.heroSlug}
                            position={position}
                            rotation={[-Math.PI / 2, 0, mat.rotationY]}
                            width={cardWidth}
                            animateFlip={flip}
                            onHoverChange={onCardHover(card, mat.heroSlug, pingTarget)}
                          />
                          {view && targetPings.map((ping, pingIndex) => {
                            const presentation = pingPresentation(view, ping);
                            return (
                              <PingMarker3D
                                key={ping.ping_id}
                                position={position}
                                color={presentation.color}
                                label={presentation.label}
                                receivedAtMs={ping.received_at_ms}
                                stackIndex={pingIndex}
                              />
                            );
                          })}
                        </Fragment>
                      );
                    })}
                    {guessEntries.map(({ key, card, position }) => (
                      <CardMesh
                        key={key}
                        card={card}
                        heroSlug={mat.heroSlug}
                        position={position}
                        rotation={[-Math.PI / 2, 0, mat.rotationY]}
                        width={cardWidth * 0.92}
                        animateFlip
                      />
                    ))}
                  </>
                );
              })()}
              {mat.hero.current_turn_card && mat.hero.id === view?.current_actor_id && (() => {
                const wx = mat.position[0] + commitY * -sin;
                const wz = mat.position[2] + commitY * -cos;
                const cardHeight = cardWidth * (1664 / 1192);
                return (
                  <ResolveSpotlight
                    position={[wx, mat.position[1] + 0.04, wz]}
                    rotationY={mat.rotationY}
                    width={cardWidth * 1.9}
                    height={cardHeight * 1.5}
                  />
                );
              })()}
              {(() => {
                const deck = mat.hero.deck;
                const count = Array.isArray(deck) ? deck.length : deck.count;
                if (!count) return null;
                const lx = deckX;
                const ly = deckY;
                const wx = mat.position[0] + lx * cos + ly * -sin;
                const wz = mat.position[2] + lx * -sin + ly * -cos;
                return (
                  <DeckStack
                    key={`${mat.hero.id}-deck`}
                    heroSlug={mat.heroSlug}
                    count={count}
                    position={[wx, mat.position[1] + 0.02, wz]}
                    rotationY={mat.rotationY}
                    width={cardWidth}
                    onClick={mat.hero.id === myHeroId ? onViewDeck : undefined}
                  />
                );
              })()}
              {(() => {
                // Spell zones (Gydion): the facedown spellbook pile sits below
                // the deck, spent spells fan out faceup to its right, and the
                // Wish win-condition plaque sits next to the status plaque.
                // In calibrate mode every mat shows dummy zones so the sliders
                // have something to move even without a Gydion in the game.
                const spellbook = mat.hero.spellbook ?? (calibrate ? { count: 0 } : null);
                if (spellbook == null) return null;
                const toWorld = (lx: number, ly: number): [number, number] => [
                  mat.position[0] + lx * cos + ly * -sin,
                  mat.position[2] + lx * -sin + ly * -cos,
                ];
                const spellCount = Array.isArray(spellbook) ? spellbook.length : spellbook.count;
                const cast = mat.hero.cast_spells?.length
                  ? mat.hero.cast_spells
                  : calibrate
                    ? DUMMY_CAST_SPELLS
                    : [];
                const wishCount = mat.hero.wish_cast_count || (calibrate ? 2 : 0);
                const nodes = [];
                if (spellCount > 0) {
                  const [wx, wz] = toWorld(spellbookX, spellbookY);
                  nodes.push(
                    <SpellbookStack
                      key={`${mat.hero.id}-spellbook`}
                      heroSlug={mat.heroSlug}
                      count={spellCount}
                      position={[wx, mat.position[1] + 0.02, wz]}
                      rotationY={mat.rotationY}
                      width={spellWidth}
                      onClick={mat.hero.id === myHeroId ? onViewSpellbook : undefined}
                    />,
                  );
                }
                const castRowStep = spellWidth * 0.75;
                cast.forEach((spell, idx) => {
                  if (!spell.image_id) return;
                  const col = idx % CAST_PER_ROW;
                  const row = Math.floor(idx / CAST_PER_ROW);
                  const [wx, wz] = toWorld(castFirstX + col * castSpacing, spellbookY - row * castRowStep);
                  const pingTarget: PingTarget = {
                    kind: "CARD", hero_id: mat.hero.id, zone: "CAST", index: idx,
                  };
                  const targetPings = pingsByTarget.get(pingTargetKey(pingTarget)) ?? [];
                  nodes.push(
                    <Fragment key={spell.id}>
                      <SpellFaceMesh
                        imageId={spell.image_id}
                        position={[wx, mat.position[1] + 0.03 + idx * 0.004, wz]}
                        rotationY={mat.rotationY}
                        width={spellWidth}
                        onHoverChange={onCardHover(spell, mat.heroSlug, pingTarget)}
                      />
                      {view && targetPings.map((ping, pingIndex) => {
                        const presentation = pingPresentation(view, ping);
                        return (
                          <PingMarker3D
                            key={ping.ping_id}
                            position={[wx, mat.position[1] + 0.03 + idx * 0.004, wz]}
                            color={presentation.color}
                            label={presentation.label}
                            receivedAtMs={ping.received_at_ms}
                            stackIndex={pingIndex}
                          />
                        );
                      })}
                    </Fragment>,
                  );
                });
                if (wishCount > 0) {
                  const [wx, wz] = toWorld(wishX, wishY);
                  nodes.push(
                    <WishPlaque
                      key={`${mat.hero.id}-wish`}
                      count={wishCount}
                      position={[wx, mat.position[1], wz]}
                      rotationY={mat.rotationY}
                    />,
                  );
                }
                return nodes;
              })()}
              {(() => {
                const lx = statusX;
                const ly = statusY;
                const wx = mat.position[0] + lx * cos + ly * -sin;
                const wz = mat.position[2] + lx * -sin + ly * -cos;
                return (
                  <StatusPlaque
                    key={`${mat.hero.id}-status`}
                    level={mat.hero.level}
                    gold={mat.hero.gold}
                    playerName={heroNames[mat.hero.id]}
                    position={[wx, mat.position[1], wz]}
                    rotationY={mat.rotationY}
                  />
                );
              })()}
              {mat.hero.id !== myHeroId && (mat.hero.hand_size ?? 0) > 0 && (() => {
                const lx = statusX;
                const ly = statusY - 0.25;
                const wx = mat.position[0] + lx * cos + ly * -sin;
                const wz = mat.position[2] + lx * -sin + ly * -cos;
                return (
                  <OpponentHandFan
                    key={`${mat.hero.id}-hand`}
                    heroSlug={mat.heroSlug}
                    count={mat.hero.hand_size ?? 0}
                    position={[wx, mat.position[1] + 0.68, wz]}
                    rotationY={mat.rotationY}
                  />
                );
              })()}
              {(() => {
                const slotItems: Array<[number, string[]]> = [
                  [0, ["ATTACK"]],
                  [1, ["DEFENSE"]],
                  [2, ["INITIATIVE"]],
                  [3, ["RANGE", "MOVEMENT", "RADIUS"]],
                ];
                const items = mat.hero.items as Record<string, number>;
                return slotItems.flatMap(([slotIdx, itemKeys]) => {
                  const icons = itemKeys.flatMap((itemKey) => {
                    const value = Math.max(0, Math.floor(items?.[itemKey] ?? 0));
                    return Array.from({ length: value }, () => itemKey);
                  });
                  const iconSpacing = icons.length > 1
                    ? Math.min(ITEM_ICON_SPACING, ITEM_ICON_MAX_SPAN / (icons.length - 1))
                    : 0;

                  return icons.map((itemKey, iconIdx) => {
                    const slotLx = slotFirstX + slotIdx * slotSpacing;
                    const offsetX = (iconIdx - (icons.length - 1) / 2) * iconSpacing;
                    const lx = slotLx + offsetX;
                    const ly = itemY;
                    const wx = mat.position[0] + lx * cos + ly * -sin;
                    const wz = mat.position[2] + lx * -sin + ly * -cos;
                    return (
                      <MatItemIcon
                        key={`${mat.hero.id}-item-${itemKey}-${iconIdx}`}
                        iconPath={ITEM_CONFIGS[itemKey].icon}
                        value={0}
                        position={[wx, mat.position[1] + 0.04, wz]}
                        rotation={[-Math.PI / 2, 0, mat.rotationY]}
                      />
                    );
                  });
                });
              })()}
              {(() => {
                // Snorri's rune markers, one per filled slot, sitting just below
                // the played-card row and aligned to the four card columns.
                const runeSlots = mat.hero.rune_slots;
                if (!runeSlots) return null;
                return [1, 2, 3, 4].map((slot) => {
                  const rune = runeSlots[String(slot)];
                  if (!rune) return null;
                  const icon = CARD_ICONS[`rune_${rune}_marker`];
                  if (!icon) return null;
                  const lx = slotFirstX + (slot - 1) * slotSpacing;
                  const ly = runeY;
                  const wx = mat.position[0] + lx * cos + ly * -sin;
                  const wz = mat.position[2] + lx * -sin + ly * -cos;
                  return (
                    <MatItemIcon
                      key={`${mat.hero.id}-rune-${slot}`}
                      iconPath={icon.iconPath}
                      value={0}
                      size={runeSize}
                      position={[wx, mat.position[1] + 0.04, wz]}
                      rotation={[-Math.PI / 2, 0, mat.rotationY]}
                    />
                  );
                });
                })()}
              </group>
            </Suspense>
          );
        })}
        {view && (
          <HexOverlay
            view={view}
            inputRequest={inputRequest}
            hexSize={hexSize}
            originX={originX}
            originZ={originZ}
            rotationDeg={rotationDeg}
            onHexClick={onHexClick}
            onUnitClick={onUnitClick}
            onHoverHex={handleHoverHex}
            showAll={calibrate}
            previewHexes={previewHexes}
          />
        )}
        {view && remotePointers && (
          <RemotePointers3D pointers={remotePointers} view={view} placements={matPlacements} />
        )}
        {view && (
          <group position={[originX, 0, originZ]} rotation={[0, rotationRad, 0]}>
            {pings
              .filter((ping) => ping.target.kind === "HEX")
              .map((ping) => {
                if (ping.target.kind !== "HEX") return null;
                const [x, z] = hexToLocal(ping.target.hex, hexSize);
                const presentation = pingPresentation(view, ping);
                const sameTarget = pings.filter(
                  (candidate) => pingTargetKey(candidate.target) === pingTargetKey(ping.target),
                );
                return (
                  <PingMarker3D
                    key={ping.ping_id}
                    position={[x, 0, z]}
                    color={presentation.color}
                    label={presentation.label}
                    receivedAtMs={ping.received_at_ms}
                    stackIndex={sameTarget.findIndex((candidate) => candidate.ping_id === ping.ping_id)}
                  />
                );
              })}
          </group>
        )}
        {view && onSelect && isDirectionRequest(inputRequest) && (() => {
          const originTile = Object.values(view.board.tiles).find(
            (t) => t.occupant_id != null && t.occupant_id === view.current_actor_id,
          );
          if (!originTile) return null;
          return (
            <DirectionOverlay
              originHex={originTile.hex}
              hexSize={hexSize}
              originX={originX}
              originZ={originZ}
              rotationDeg={rotationDeg}
              onSelect={onSelect}
            />
          );
        })()}
        {view && onSelect && inputRequest && isRealitySplitRequest(inputRequest) && (() => {
          const originTile = Object.values(view.board.tiles).find(
            (t) => t.occupant_id != null && t.occupant_id === view.current_actor_id,
          );
          if (!originTile) return null;
          return (
            <RealitySplitOverlay
              request={inputRequest}
              tiles={view.board.tiles}
              originHex={originTile.hex}
              hexSize={hexSize}
              originX={originX}
              originZ={originZ}
              rotationDeg={rotationDeg}
              onSelect={onSelect}
            />
          );
        })()}
        {view && activeSplitEffects(view.effects).map((fx) => (
          <RealityCrackEffect
            key={fx.id}
            effect={fx}
            view={view}
            hexSize={hexSize}
            originX={originX}
            originZ={originZ}
            rotationDeg={rotationDeg}
          />
        ))}
        {tokenUnits.length > 0 && (
          <group position={[originX, 0, originZ]} rotation={[0, rotationRad, 0]}>
            {tokenUnits.map(({ id, hex, iconPath, stackIndex, leaving }) => {
              const [localX, localZ] = hexToLocal(hex, hexSize);
              const offset = stackIndex * 0.12;
              return (
                <AnimatedUnit
                  key={id}
                  unitId={id}
                  target={[localX + offset, tokenY, localZ + offset]}
                  leaving={leaving}
                >
                  <Suspense fallback={null}>
                    <TokenMesh iconPath={iconPath} position={[0, 0, 0]} />
                  </Suspense>
                </AnimatedUnit>
              );
            })}
          </group>
        )}
        {turretUnits.length > 0 && (
          <group position={[originX, 0, originZ]} rotation={[0, rotationRad, 0]}>
            {turretUnits.map(({ id, hex, ownerId, leaving }) => {
              const [localX, localZ] = hexToLocal(hex, hexSize);
              const trinkets = heroPlacements.find((hero) => (
                hero.id === ownerId || hero.heroKey === "trinkets"
              ));
              const sharedTarget = trinkets && heroFacingTargets.get(trinkets.id);
              const dynamicDeg = sharedTarget ? lookAtHexDeg(hex, sharedTarget, hexSize) : 0;
              return (
                <AnimatedUnit key={id} unitId={id} target={[localX, 0, localZ]} leaving={leaving}>
                  <Suspense fallback={null}>
                    <HeroMesh
                      gltfPath={trinketsTurretModelPath(useLegacyHeroModels)}
                      position={[0, 0, 0]}
                      scale={turretScale}
                      yOffset={turretY}
                      rotationDeg={dynamicDeg + turretRotationDeg}
                    />
                  </Suspense>
                </AnimatedUnit>
              );
            })}
          </group>
        )}
        {(minionUnits.length > 0 || heroUnits.length > 0) && (
          <group position={[originX, 0, originZ]} rotation={[0, rotationRad, 0]}>
            {minionUnits.map(({ id, hex, modelKey, leaving }) => {
              const model = modelOverrides[modelKey];
              if (!model) return null;
              const [localX, localZ] = hexToLocal(hex, hexSize);
              const markers = markersByUnit.get(id) ?? [];
              return (
                <AnimatedUnit key={id} unitId={id} target={[localX, 0, localZ]} leaving={leaving}>
                  <UnitMesh
                    objPath={model.objPath}
                    texturePath={model.texturePath}
                    position={[0, 0, 0]}
                    scale={model.scale}
                    xOffset={model.xOffset}
                    yOffset={model.yOffset}
                    zOffset={model.zOffset}
                    rotationDeg={model.rotationDeg}
                  />
                  {markers.length > 0 && (
                    <UnitMarkers markers={markers} position={[0, 0, 0]} />
                  )}
                </AnimatedUnit>
              );
            })}
            {heroUnits.map(({ id, hex, heroKey, team, leaving }) => {
              const displayKey = displayHeroKey.get(id) ?? heroKey;
              const currentHero = heroOverrides[displayKey];
              if (!currentHero) return null;
              const legacyHero = LEGACY_HERO_MODELS[displayKey];
              const { config: hero, gltfPath } = resolveHeroRenderConfig(
                currentHero,
                legacyHero,
                useLegacyHeroModels,
                calibrate,
                originalHeroUnitIds.has(id),
              );
              const [localX, localZ] = hexToLocal(hex, hexSize);
              const dynamicDeg = heroLookAtDeg.get(id) ?? 0;
              const markers = markersByUnit.get(id) ?? [];
              const namedColors = namedColorsByUnit.get(id) ?? [];
              return (
                <AnimatedUnit key={id} unitId={id} target={[localX, 0, localZ]} leaving={leaving} teamColor={TEAM_BASE_COLORS[team]} baseConfig={baseCfg}>
                  <Suspense fallback={null}>
                    <HeroMesh
                      gltfPath={gltfPath}
                      position={[0, 0, 0]}
                      scale={hero.scale}
                      xOffset={hero.xOffset}
                      yOffset={hero.yOffset}
                      zOffset={hero.zOffset}
                      rotationDeg={dynamicDeg + hero.rotationDeg}
                      brightness={hero.brightness}
                      outlineColor={TEAM_BASE_COLORS[team]}
                      outlineWidth={outlineWidth}
                    />
                  </Suspense>
                  {markers.length > 0 && (
                    <UnitMarkers markers={markers} position={[0, 0, 0]} />
                  )}
                  {namedColors.length > 0 && (
                    <NamedColorSigil colors={namedColors} position={[0, 0, 0]} />
                  )}
                </AnimatedUnit>
              );
            })}
          </group>
        )}
        <group position={[originX, 0, originZ]} rotation={[0, rotationRad, 0]}>
          <CombatEffects />
        </group>
      </Canvas>
      <SoundControls />
      <LanguageControls />
      {altHeld && hoveredCard && (
        <div style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 200,
          pointerEvents: "none",
          filter: "drop-shadow(0 8px 32px rgba(0, 0, 0, 0.6))",
        }}>
          <CardCanvas card={hoveredCard.card} heroSlug={hoveredCard.heroSlug} width={420} />
        </div>
      )}
      {altHeld && !hoveredCard && tooltipHero && (
        <div style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 200,
          pointerEvents: "none",
          filter: "drop-shadow(0 8px 32px rgba(0, 0, 0, 0.6))",
        }}>
          <img
            src={`/hero-cards/${tooltipHero.name.toLowerCase()}.png`}
            alt={tooltipHero.name}
            style={{ width: 420, maxWidth: "80vw", maxHeight: "80vh", objectFit: "contain", display: "block" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}
      {calibrate && (
        <>
          {!modelCalibrationOnly && (
            <>
              <CameraReadoutPanel read={cameraRead} />
              <CalibrationPanel
                hexSize={hexSize}
                originX={originX}
                originZ={originZ}
                rotationDeg={rotationDeg}
                tokenY={tokenY}
                turretScale={turretScale}
                turretY={turretY}
                turretRotationDeg={turretRotationDeg}
                onHexSize={setHexSize}
                onOriginX={setOriginX}
                onOriginZ={setOriginZ}
                onRotationDeg={setRotationDeg}
                onTokenY={setTokenY}
                onTurretScale={setTurretScale}
                onTurretY={setTurretY}
                onTurretRotationDeg={setTurretRotationDeg}
              />
            </>
          )}
          {selectedTransform && (
            <ModelCalibrationPanel
              modelKeys={calibrationKeys}
              selectedKey={resolvedSelectedModelKey}
              model={selectedTransform}
              onSelectKey={setSelectedModelKey}
              onChange={updateSelectedModel}
              heroUnits={calibrationHeroUnits}
              heroModelKeys={heroModelKeys}
              selectedHeroUnitId={selectedHeroUnit?.id}
              onSelectHeroUnit={selectCalibrationHeroUnit}
              onChangeHeroModel={changeCalibrationHeroModel}
              heroAssetVariant={selectedHeroUsesOriginal ? "original" : "current"}
              heroHasOriginalAsset={Boolean(selectedHeroConfig?.originalGltfPath)}
              onChangeHeroAssetVariant={changeCalibrationHeroAssetVariant}
              onResetHeroModel={resetCalibrationHeroModel}
              focused={modelCalibrationOnly}
            />
          )}
          {!modelCalibrationOnly && (
            <>
              <TeamBaseCalibrationPanel
                cfg={baseCfg}
                onChange={(partial) => setBaseCfg((c) => ({ ...c, ...partial }))}
                outlineWidth={outlineWidth}
                onOutlineWidth={setOutlineWidth}
              />
              <CardSlotCalibrationPanel
                cardWidth={cardWidth}
                slotY={slotY}
                slotFirstX={slotFirstX}
                slotSpacing={slotSpacing}
                commitY={commitY}
                discardX={discardX}
                discardStackY={discardStackY}
                discardStackLift={discardStackLift}
                ultimateX={ultimateX}
                ultimateY={ultimateY}
                deckX={deckX}
                deckY={deckY}
                statusX={statusX}
                statusY={statusY}
                itemY={itemY}
                runeY={runeY}
                runeSize={runeSize}
                spellbookX={spellbookX}
                spellbookY={spellbookY}
                castFirstX={castFirstX}
                castSpacing={castSpacing}
                spellWidth={spellWidth}
                wishX={wishX}
                wishY={wishY}
                onCardWidth={setCardWidth}
                onSlotY={setSlotY}
                onSlotFirstX={setSlotFirstX}
                onSlotSpacing={setSlotSpacing}
                onCommitY={setCommitY}
                onDiscardX={setDiscardX}
                onDiscardStackY={setDiscardStackY}
                onDiscardStackLift={setDiscardStackLift}
                onUltimateX={setUltimateX}
                onUltimateY={setUltimateY}
                onDeckX={setDeckX}
                onDeckY={setDeckY}
                onStatusX={setStatusX}
                onStatusY={setStatusY}
                onItemY={setItemY}
                onRuneY={setRuneY}
                onRuneSize={setRuneSize}
                onSpellbookX={setSpellbookX}
                onSpellbookY={setSpellbookY}
                onCastFirstX={setCastFirstX}
                onCastSpacing={setCastSpacing}
                onSpellWidth={setSpellWidth}
                onWishX={setWishX}
                onWishY={setWishY}
              />
            </>
          )}
        </>
      )}
    </>
  );
}
