import { useParams, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StartingPositionControls } from "../ui/StartingPositionControls";
import { useGameController } from "../../hooks/useGameController";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { useAltHeld } from "../../hooks/useAltHeld";
import { HexGrid } from "../board/HexGrid";
import { PhaseBar } from "../ui/PhaseBar";
import { Sidebar } from "../ui/Sidebar";
import { PromptBanner } from "../ui/PromptBanner";
import { OptionPicker } from "../ui/OptionPicker";
import { EventLog } from "../ui/EventLog";
import { CardGuessReveal } from "../ui/CardGuessReveal";
import { SpellCastReveal } from "../ui/SpellCastReveal";
import { ResolutionQueue } from "../ui/ResolutionQueue";
import { CommittedCards } from "../ui/CommittedCards";
import { HeroDashboardSummary } from "../ui/HeroDashboardSummary";
import { COMMITTED_CARDS_KEY, readCommittedCardsHidden } from "./committedCardsPreference";
import { RESOLUTION_QUEUE_KEY, readResolutionQueueCollapsed } from "./resolutionQueuePreference";
import { HERO_DASHBOARD_KEY, readHeroDashboardHidden } from "./heroDashboardPreference";
import { ConnectionClosedNotice } from "../ui/ConnectionClosedNotice";
import { ErrorToast } from "../ui/ErrorToast";
import { Board3D } from "../board3d/Board3D";
import type { WorldPointerReport } from "../board3d/PointerPresence";
import { mapConfigFor } from "../board3d/maps";
import {
  DEFAULT_PLAYER_BOARD_LAYOUT,
  parsePlayerBoardLayout,
  type PlayerBoardLayout,
} from "../board3d/seating";
import { HandRow } from "../board3d/hud/HandRow";
import { PickerDock } from "../board3d/hud/PickerDock";
import { DefenseDock } from "../board3d/hud/DefenseDock";
import { CardSelectOverlay } from "../board3d/hud/CardSelectOverlay";
import { GameTools } from "../board3d/hud/GameTools";
import { classifyDefenseOption, type DefenseOptionInfo } from "../../utils/defense";
import { isDirectionRequest } from "../../utils/direction";
import { isRealitySplitRequest } from "../../utils/realitySplit";
import { installAudioUnlock, armSounds } from "../../audio/audioEngine";
import { turnCue } from "../../audio/gameSounds";
import { DeckViewer } from "../ui/DeckViewer";
import { SpellbookViewer } from "../ui/SpellbookViewer";
import { BugReportModal } from "../ui/BugReportModal";
import { OverridePanel } from "../ui/OverridePanel";
import { ShareLinksPanel } from "../ui/ShareLinksPanel";
import { summarizeProposal, type OverrideProposalPayload } from "../../utils/overrideSummary";
import { OverrideVoteBanner } from "../ui/OverrideVoteBanner";
import {
  advancePick,
  describePick,
  isCompletedPick,
  overridePickRequest,
  type CompletedPick,
  type OverridePick,
} from "../../utils/overridePick";
import { ReadyOverlay } from "../ui/ReadyOverlay";
import { TEAM_COLORS } from "../../utils/colors";
import { pingPresentation } from "../../utils/pings";
import { useCardGuessReveal } from "../../hooks/useCardGuessReveal";
import { useSpellCastReveal } from "../../hooks/useSpellCastReveal";
import type { Hex, CardView, PingTarget } from "../../types/game";
import { HERO_MODEL_STYLE_KEY, readLegacyHeroModelPreference } from "./heroModelPreference";
import { BOARD_BRIGHTNESS_KEY, readBoardBrightness } from "./boardBrightness";
import styles from "./GameView.module.css";
import { useLocalizedHeroNames } from "../../i18n/useLocalizedHeroNames";
import { readGameLayout, withGameLayout, type GameLayout } from "../mobile/mobileLayout";
import { useMobileNavigation } from "../mobile/useMobileNavigation";
import { MobileGameShell } from "../mobile/MobileGameShell";
import { MobileGamePanels } from "../mobile/MobileGamePanels";
import { MobileGameHeader } from "../mobile/MobileGameHeader";
import { MobileGameSettings } from "../mobile/MobileGameSettings";
import mobileStyles from "../mobile/MobileGameShell.module.css";

const BOARD_INPUT_TYPES = new Set([
  "SELECT_HEX",
  "SELECT_UNIT",
  "SELECT_UNIT_OR_TOKEN",
  "CHOOSE_RESPAWN_HEX",
]);

// Abstract (non-board, non-card) decisions — routed to the 3D glass PickerDock.
const ABSTRACT_INPUT_TYPES = new Set([
  "CHOOSE_ACTION",
  "SELECT_OPTION",
  "SELECT_NUMBER",
  "CONFIRM_PASSIVE",
  "CHOOSE_ACTOR",
  "CHOOSE_RESPAWN",
  "FAST_TRAVEL",
]);

// Bumped when tabletop rows became the default: the unsuffixed key holds ring
// choices made when a ring was the default, so it is left behind rather than
// read. Choices made from here on persist normally.
const PLAYER_BOARD_LAYOUT_KEY = "goa2:player-board-layout:v2";
const REMOTE_POINTERS_KEY = "goa2:remote-pointers-visible";

function loadLegacyHeroModelPreference(): boolean {
  try {
    return readLegacyHeroModelPreference(window.localStorage);
  } catch {
    return true;
  }
}

function loadBoardBrightnessPreference(): number {
  try {
    return readBoardBrightness(window.localStorage);
  } catch {
    return 1;
  }
}

function loadCommittedCardsHiddenPreference(): boolean {
  try {
    return readCommittedCardsHidden(window.localStorage);
  } catch {
    return false;
  }
}

function loadResolutionQueueCollapsedPreference(): boolean {
  try {
    return readResolutionQueueCollapsed(window.localStorage);
  } catch {
    return false;
  }
}

function loadHeroDashboardHiddenPreference(): boolean {
  try {
    return readHeroDashboardHidden(window.localStorage);
  } catch {
    return false;
  }
}

function loadPlayerBoardLayoutPreference(): PlayerBoardLayout {
  try {
    return parsePlayerBoardLayout(window.localStorage.getItem(PLAYER_BOARD_LAYOUT_KEY));
  } catch {
    return DEFAULT_PLAYER_BOARD_LAYOUT;
  }
}

function loadRemotePointersPreference(): boolean {
  try {
    return window.localStorage.getItem(REMOTE_POINTERS_KEY) !== "hidden";
  } catch {
    return true;
  }
}

export function GameView() {
  const { gameId } = useParams<{ gameId: string }>();
  const [params] = useSearchParams();
  // Route changes can reuse this component. Reset all presentation state when
  // the game or credential changes, while pane/layout changes retain the session.
  return <GameSession key={JSON.stringify([gameId, params.get("token") ?? ""])} />;
}

function GameSession() {
  const localizedHeroName = useLocalizedHeroNames();
  const { gameId } = useParams<{ gameId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  // Mobile is explicit and always uses 2D, even if an old link includes 3d=1.
  const layout = readGameLayout(searchParams);
  const mobile = layout === "mobile";
  const use3D = layout === "desktop3d";
  const mobileNavigation = useMobileNavigation(mobile);
  const changeLayout = (next: GameLayout) => {
    // Replace rather than push so Back cannot resurrect a stale mobile dialog.
    setSearchParams(withGameLayout(searchParams, next), { replace: true });
  };
  const calibrationMode = searchParams.get("calibrate");
  const calibrate = calibrationMode === "1" || calibrationMode === "models";
  const modelCalibrationOnly = calibrationMode === "models";
  const heroSwapParam = searchParams.get("swap") ?? "";
  const heroSwap = useMemo(
    () => heroSwapParam
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
    [heroSwapParam],
  );
  const originalHeroParam = searchParams.get("original") ?? "";
  const originalHeroUnits = useMemo(
    () => originalHeroParam
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
    [originalHeroParam],
  );
  const handleHeroSwapChange = useCallback((models: string[]) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (models.length > 0) next.set("swap", models.join(","));
      else next.delete("swap");
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const handleOriginalHeroUnitsChange = useCallback((unitIds: string[]) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (unitIds.length > 0) next.set("original", unitIds.join(","));
      else next.delete("original");
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const controller = useGameController(gameId ?? "", token);
  const {
    view, inputRequest, eventLog, error, connected, closeCode, myHeroId, winner,
    heroNames, pings, pointers, overrideProposal, overrideResolution, revealedPlayerTokens,
  } = controller.session;
  const {
    myTeam, myHero, isMyInput, isMyUpgradePhase, offBoardUnitChoice, effectiveInputRequest,
    startingPosition, isPlanning, canPing, canRequestPause, canCommitSecond, canCommit,
    canUncommit, committedCards, committedCardNames, waitingForNames, waitingTitle, playerStatus,
  } = controller.model;
  const {
    reconnect, changeStartingPosition, finishPlanning, rollback, submitInput, cheatsGold,
    setReady, sendPing, sendPointer, sendPointerZone, hidePointer, proposeOverride, voteOverride,
    cancelOverride, requestPlayerLink, commitOrSwap, takeBack,
  } = controller.actions;
  const { selectedCardId, setSelectedCardId } = controller.selection;
  const { lockedNotice } = controller;
  const cardGuessReveal = useCardGuessReveal(view);
  const [spellCastHovered, setSpellCastHovered] = useState(false);
  const spellCastReveal = useSpellCastReveal(eventLog, view, spellCastHovered);
  const [choosingStart, setChoosingStart] = useState(false);
  const choosingStartingPosition = choosingStart && !!startingPosition;

  const mapConfig = useMemo(
    () => (view ? mapConfigFor(view.board.map) : null),
    [view],
  );

  // Broadcast this player's pointer projected onto the table so everyone else
  // sees the "hand moving" presence signal that TTS players get for free.
  const handleWorldPointer = useCallback(
    (report: WorldPointerReport) => {
      if (!report) {
        hidePointer();
      } else if ("target_hero_id" in report) {
        sendPointerZone(report.target_hero_id, report.zone);
      } else {
        sendPointer(report.x, report.z);
      }
    },
    [hidePointer, sendPointer, sendPointerZone],
  );

  const [showDeck, setShowDeck] = useState(false);
  const [showSpellbook, setShowSpellbook] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  // Consensus overrides: the referee modal, an active board pick (entity/hex
  // chosen by clicking the real board), and a completed pick awaiting confirm.
  const [showOverridePanel, setShowOverridePanel] = useState(false);
  const [showShareLinks, setShowShareLinks] = useState(false);
  const [overridePick, setOverridePick] = useState<OverridePick | null>(null);
  const [pendingBoardProposal, setPendingBoardProposal] = useState<CompletedPick | null>(null);
  const [useLegacyHeroModels, setUseLegacyHeroModels] = useState(
    loadLegacyHeroModelPreference,
  );
  const [playerBoardLayout, setPlayerBoardLayout] = useState(
    loadPlayerBoardLayoutPreference,
  );
  const [boardBrightness, setBoardBrightness] = useState(loadBoardBrightnessPreference);
  const [showRemotePointers, setShowRemotePointers] = useState(loadRemotePointersPreference);
  const [committedCardsHidden, setCommittedCardsHidden] = useState(
    loadCommittedCardsHiddenPreference,
  );
  const [heroDashboardHidden, setHeroDashboardHidden] = useState(
    loadHeroDashboardHiddenPreference,
  );
  const [resolutionQueueCollapsed, setResolutionQueueCollapsed] = useState(
    loadResolutionQueueCollapsedPreference,
  );
  const [phaseBanner, setPhaseBanner] = useState<string | null>(null);
  const [previewHexes, setPreviewHexes] = useState<{ path: Hex[]; mine_hexes: Hex[] } | null>(null);
  const prevPhaseRef = useRef<string | null>(null);
  const altHeld = useAltHeld();
  const [handHovered, setHandHovered] = useState(false);
  const [upgradeBoardView, setUpgradeBoardView] = useState(false);
  const [cardSelectBoardView, setCardSelectBoardView] = useState(false);
  const [hoveredPingTarget, setHoveredPingTarget] = useState<PingTarget | null>(null);

  const handleHandHoverChange = useCallback((hovered: boolean) => {
    setHandHovered(hovered);
    if (!myHeroId) return;
    if (hovered) sendPointerZone(myHeroId, "HAND");
    else hidePointer();
  }, [hidePointer, myHeroId, sendPointerZone]);

  useEffect(() => {
    if (!handHovered || !myHeroId) return;
    // A one-shot zone update can arrive inside the server's pointer throttle
    // window. Retry once after it, then keep a stationary hover alive past the
    // remote cursor's stale timeout until the mouse actually leaves the hand.
    const retry = window.setTimeout(
      () => sendPointerZone(myHeroId, "HAND"),
      120,
    );
    const heartbeat = window.setInterval(
      () => sendPointerZone(myHeroId, "HAND"),
      1500,
    );
    return () => {
      window.clearTimeout(retry);
      window.clearInterval(heartbeat);
    };
  }, [handHovered, myHeroId, sendPointerZone]);

  const handleLegacyHeroModelsChange = useCallback((enabled: boolean) => {
    setUseLegacyHeroModels(enabled);
    try {
      window.localStorage.setItem(HERO_MODEL_STYLE_KEY, enabled ? "legacy" : "painted");
    } catch {
      // Storage can be unavailable in hardened/private browser contexts. The
      // setting still applies for the current game session.
    }
  }, []);

  const handleBoardBrightnessChange = useCallback((value: number) => {
    setBoardBrightness(value);
    try {
      window.localStorage.setItem(BOARD_BRIGHTNESS_KEY, String(value));
    } catch {
      // The setting still applies for this game session if storage is unavailable.
    }
  }, []);

  const handleCommittedCardsHiddenChange = useCallback((hidden: boolean) => {
    setCommittedCardsHidden(hidden);
    try {
      window.localStorage.setItem(COMMITTED_CARDS_KEY, hidden ? "hidden" : "shown");
    } catch {
      // The setting still applies for this game session if storage is unavailable.
    }
  }, []);

  const handleResolutionQueueCollapsedChange = useCallback((collapsed: boolean) => {
    setResolutionQueueCollapsed(collapsed);
    try {
      window.localStorage.setItem(RESOLUTION_QUEUE_KEY, collapsed ? "collapsed" : "shown");
    } catch {
      // The setting still applies for this game session if storage is unavailable.
    }
  }, []);

  const handleHeroDashboardHiddenChange = useCallback((hidden: boolean) => {
    setHeroDashboardHidden(hidden);
    try {
      window.localStorage.setItem(HERO_DASHBOARD_KEY, hidden ? "hidden" : "shown");
    } catch {
      // The setting still applies for this game session if storage is unavailable.
    }
  }, []);

  const handlePlayerBoardLayoutChange = useCallback((layout: PlayerBoardLayout) => {
    setPlayerBoardLayout(layout);
    try {
      window.localStorage.setItem(PLAYER_BOARD_LAYOUT_KEY, layout);
    } catch {
      // The setting still applies for this game session if storage is unavailable.
    }
  }, []);

  const handleShowRemotePointersChange = useCallback((visible: boolean) => {
    setShowRemotePointers(visible);
    try {
      window.localStorage.setItem(REMOTE_POINTERS_KEY, visible ? "shown" : "hidden");
    } catch {
      // The preference still applies for the current session if storage is unavailable.
    }
  }, []);

  const advanceOverridePick = useCallback((selection: string | Hex) => {
    setOverridePick((pick) => {
      if (!pick) return pick;
      const next = advancePick(pick, selection);
      if (isCompletedPick(next)) {
        setPendingBoardProposal(next);
        return null;
      }
      return next;
    });
  }, []);

  const handleHexClick = useCallback((hex: Hex) => {
    if (overridePick) {
      if (overridePick.stage === "hex") advanceOverridePick(hex);
      return;
    }
    if (choosingStartingPosition) {
      if (startingPosition?.destinations.some((h) => h.q === hex.q && h.r === hex.r && h.s === hex.s)) {
        changeStartingPosition({ op: "move", destination: hex });
        setChoosingStart(false);
      }
      return;
    }
    submitInput(hex);
  }, [submitInput, overridePick, advanceOverridePick, choosingStartingPosition, startingPosition, changeStartingPosition]);

  const handleUnitClick = useCallback((unitId: string) => {
    if (overridePick) {
      if (overridePick.stage === "entity") advanceOverridePick(unitId);
      return;
    }
    if (choosingStartingPosition) return;
    submitInput(unitId);
  }, [submitInput, overridePick, advanceOverridePick, choosingStartingPosition]);

  const handleOptionSelect = useCallback((value: string | number | "SKIP" | null | { hero_id: string; card_id: string }) => {
    submitInput(value);
  }, [submitInput]);

  const handleSkip = useCallback(() => {
    submitInput("SKIP");
  }, [submitInput]);

  // Direction and reality-split requests are answered on the board (arrows /
  // candidate lines around the actor) in 3D, so they behave like a hex
  // selection: prompt up top, no bottom dock.
  const isOnBoardChoice = use3D && (isDirectionRequest(inputRequest) || isRealitySplitRequest(inputRequest));

  const needsPicker = view ?
    (isMyInput || isMyUpgradePhase) && inputRequest && (!BOARD_INPUT_TYPES.has(inputRequest.type) || !!offBoardUnitChoice) && !isOnBoardChoice : false;
  const needsBanner = view ?
    isMyInput && inputRequest && !offBoardUnitChoice && (BOARD_INPUT_TYPES.has(inputRequest.type) || isOnBoardChoice) : false;

  // In 3D, SELECT_CARD is answered through a centered overlay that paints every
  // selectable card large — wherever it lives (hand, any hero's active/board
  // cards, a discard) — rather than only glowing hand cards.
  const cardSelectActive = use3D && isMyInput && inputRequest?.type === "SELECT_CARD";

  // Decision types that have a dedicated 3D home (so the 2D OptionPicker is not
  // rendered for them in the 3D view). UPGRADE_PHASE is migrated later (Task 7).
  const handledIn3D = use3D && !!inputRequest && (
    !!offBoardUnitChoice ||
    ABSTRACT_INPUT_TYPES.has(inputRequest.type) ||
    inputRequest.type === "SELECT_CARD" ||
    inputRequest.type === "SELECT_CARD_OR_PASS"
  );

  // Install the first-gesture context unlock, and arm spawn clacks after a beat
  // so the initial roster popping in stays silent.
  useEffect(() => {
    installAudioUnlock();
    const id = window.setTimeout(armSounds, 1200);
    return () => window.clearTimeout(id);
  }, []);

  // Chime once when this player's move opens — a targeted resolution prompt
  // (isMyInput) or the start of the planning phase (still needs to commit).
  // Silent through follow-up sub-prompts; a re-arm guard ignores sub-400ms
  // off→on flicker so back-to-back prompts cannot double-ding.
  const needsMyAction = !!isMyInput || (isPlanning && canCommit);
  const prevNeedsRef = useRef(false);
  const lastOffAtRef = useRef(0);
  useEffect(() => {
    const REARM_MS = 400;
    if (needsMyAction && !prevNeedsRef.current) {
      const offDur = performance.now() - lastOffAtRef.current;
      if (lastOffAtRef.current === 0 || offDur >= REARM_MS) turnCue();
    }
    if (!needsMyAction && prevNeedsRef.current) {
      lastOffAtRef.current = performance.now();
    }
    prevNeedsRef.current = needsMyAction;
  }, [needsMyAction]);

  // Defense decision (3D): classify each candidate card and frame the threat.
  // The card choice happens on the glowing hand cards; DefenseDock shows the
  // readout + PASS. Reuses the same correct logic as the 2D OptionPicker.
  const defenseInfo = useMemo(() => {
    if (!(use3D && isMyInput && inputRequest?.type === "SELECT_CARD_OR_PASS")) return null;
    const opts = (inputRequest.options ?? []) as Array<{ id: string; text: string; defense_value?: number; base_defense?: number }>;
    // An offered defense card can live outside the hand: Rock Solid's active
    // effect (and Stone Carapace's) lets you defend with an already-played card
    // "as if it was in your hand". Resolve options against every zone, not just
    // the hand, so those cards classify correctly and can be surfaced.
    const handIds = new Set((myHero?.hand ?? []).map((c) => c.id));
    const pool = new Map<string, CardView>();
    if (myHero) {
      const add = (c: CardView | null) => { if (c) pool.set(c.id, c); };
      myHero.hand.forEach(add);
      myHero.played_cards.forEach(add);
      if (Array.isArray(myHero.deck)) myHero.deck.forEach(add);
      myHero.discard_pile.forEach(add);
      add(myHero.ultimate_card);
    }
    const states = new Map<string, DefenseOptionInfo>();
    // Offered cards that aren't in hand — rendered into the fan with an
    // "effect" cue so it's clear why they're pickable.
    const grantedCards: CardView[] = [];
    const grantedIds = new Set<string>();
    for (const opt of opts) {
      if (opt.id === "PASS") continue;
      const card = pool.get(opt.id);
      states.set(opt.id, classifyDefenseOption(opt, card, inputRequest.defense_needed));
      if (card && !handIds.has(opt.id)) {
        grantedCards.push(card);
        grantedIds.add(opt.id);
      }
    }
    let attackerName: string | null = null;
    const actorId = view?.current_actor_id;
    if (actorId && view) {
      for (const team of Object.values(view.teams)) {
        const h = team.heroes.find((x) => x.id === actorId);
        if (h) { attackerName = localizedHeroName(h.id, h.name); break; }
      }
    }
    const anyDefenseAvailable = Array.from(states.values()).some((s) => s.state === "BLOCKS" || s.state === "PRIMARY");
    return { states, attackerName, anyDefenseAvailable, grantedCards, grantedIds };
  }, [use3D, isMyInput, inputRequest, myHero, view, localizedHeroName]);

  // Picking a defense card only stages it; the DefenseDock submits it. A staged
  // pick is tied to its request so it never carries over to the next attack.
  const [stagedDefense, setStagedDefense] = useState<{ requestKey: string; cardId: string } | null>(null);
  const defenseRequestKey = defenseInfo && inputRequest ? (inputRequest.request_id ?? inputRequest.prompt) : null;
  const stagedDefenseId = defenseRequestKey && stagedDefense?.requestKey === defenseRequestKey
    && defenseInfo?.states.has(stagedDefense.cardId) ? stagedDefense.cardId : null;
  const stageDefenseCard = useCallback((cardId: string | null) => {
    setStagedDefense(defenseRequestKey && cardId ? { requestKey: defenseRequestKey, cardId } : null);
  }, [defenseRequestKey]);
  const stagedDefenseCard = useMemo(() => {
    if (!stagedDefenseId || !defenseInfo) return null;
    const card = myHero?.hand.find((c) => c.id === stagedDefenseId)
      ?? defenseInfo.grantedCards.find((c) => c.id === stagedDefenseId);
    return {
      id: stagedDefenseId,
      name: card?.name ?? stagedDefenseId,
      info: defenseInfo.states.get(stagedDefenseId)!,
    };
  }, [stagedDefenseId, defenseInfo, myHero?.hand]);

  // While an override pick is active, the board runs on a locally synthesized
  // request (all entities / all hexes selectable); real input requests are
  // visually suppressed and restored when the pick ends.
  const pickRequest = useMemo(
    () => (overridePick ? overridePickRequest(overridePick, view) : null),
    [overridePick, view],
  );
  const startingRequest = choosingStartingPosition && myHeroId ? {
    type: "SELECT_HEX", player_id: myHeroId, prompt: "Choose a starting space",
    valid_hexes: startingPosition?.destinations ?? [],
  } : null;
  const boardInputRequest = pickRequest ?? startingRequest ?? (isMyInput ? inputRequest : null);

  const startBoardPick = useCallback((pick: OverridePick) => {
    setShowOverridePanel(false);
    setPendingBoardProposal(null);
    setOverridePick(pick);
  }, []);

  const cancelOverridePick = useCallback(() => {
    setOverridePick(null);
    setPendingBoardProposal(null);
  }, []);

  const proposeBoardFix = useCallback(() => {
    if (!pendingBoardProposal) return;
    proposeOverride({
      family: "patch",
      op: pendingBoardProposal.op,
      args: pendingBoardProposal.proposal,
    });
    setPendingBoardProposal(null);
  }, [pendingBoardProposal, proposeOverride]);

  const handlePropose = useCallback((payload: OverrideProposalPayload) => {
    proposeOverride(payload);
  }, [proposeOverride]);

  // Only a running timed match can be paused, and only by a seated player.
  const requestPause = useCallback(() => {
    proposeOverride({ family: "pause" });
  }, [proposeOverride]);

  // The vote banner is the whole story once a request is out; close the panel
  // so it is not hidden behind the modal.
  const askForPlayerLink = useCallback(
    (heroId: string) => {
      requestPlayerLink(heroId);
      setShowShareLinks(false);
    },
    [requestPlayerLink],
  );

  const keyBindings = useMemo(() => {
    const bindings: Record<string, () => void> = {};
    const hand = myHero?.hand ?? [];

    // While the SELECT_CARD overlay is up it owns the number keys (pick by
    // position) and Escape (undo), so don't also bind them to hand selection.
    if (!cardSelectActive) {
      for (let i = 0; i < Math.min(hand.length, 9); i++) {
        const card = hand[i];
        bindings[String(i + 1)] = defenseInfo
          ? () => { if (defenseInfo.states.has(card.id)) stageDefenseCard(card.id === stagedDefenseId ? null : card.id); }
          : () => setSelectedCardId((prev) => (prev === card.id ? null : card.id));
      }

      if (defenseInfo && stagedDefenseId) {
        bindings["Enter"] = () => handleOptionSelect(stagedDefenseId);
      }

      if (isPlanning && (canCommit || canUncommit) && selectedCardId) {
        bindings["Enter"] = () => {
          commitOrSwap(selectedCardId);
        };
      }

      bindings["Escape"] = () => {
        if (overridePick || pendingBoardProposal) {
          cancelOverridePick();
        } else if (stagedDefenseId) {
          stageDefenseCard(null);
        } else {
          setSelectedCardId(null);
        }
      };
    }

    if (inputRequest?.can_rollback) {
      bindings["u"] = () => rollback();
    }

    return bindings;
  }, [myHero?.hand, isPlanning, canCommit, canUncommit, selectedCardId, setSelectedCardId, commitOrSwap, inputRequest, rollback, cardSelectActive, overridePick, pendingBoardProposal, cancelOverridePick, defenseInfo, stagedDefenseId, stageDefenseCard, handleOptionSelect]);

  useKeyboardShortcuts(keyBindings, !mobile || (mobileNavigation.pane === "board" && !mobileNavigation.dialog));

  useEffect(() => {
    // Mobile panes use ordinary Tab focus traversal.
    if (mobile) return;
    const onPingKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;

      // Tab is a tabletop shortcut for the whole game screen. Intercept it in
      // the capture phase so browser focus traversal cannot move through the
      // hand, settings, or table controls when there is no pingable hover.
      event.preventDefault();
      event.stopPropagation();

      if (
        event.repeat ||
        event.shiftKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        !hoveredPingTarget ||
        !myHeroId ||
        !canPing
      ) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      sendPing(hoveredPingTarget);
    };
    window.addEventListener("keydown", onPingKey, true);
    return () => window.removeEventListener("keydown", onPingKey, true);
  }, [canPing, hoveredPingTarget, myHeroId, sendPing, mobile]);

  useEffect(() => {
    document.title = isMyInput ? "YOUR TURN - Guards of Atlantis II" : "Guards of Atlantis II";
    return () => { document.title = "Guards of Atlantis II"; };
  }, [isMyInput]);

  // Phase transition banner
  useEffect(() => {
    const phase = view?.phase;
    if (phase && phase !== prevPhaseRef.current) {
      if (prevPhaseRef.current !== null) {
        prevPhaseRef.current = phase;
        const showTimer = window.setTimeout(() => setPhaseBanner(phase), 0);
        const hideTimer = window.setTimeout(() => setPhaseBanner(null), 1500);
        return () => {
          window.clearTimeout(showTimer);
          window.clearTimeout(hideTimer);
        };
      }
      prevPhaseRef.current = phase;
    }
  }, [view?.phase]);

  const startingControls = view && startingPosition && myHeroId && !overridePick && (
    <StartingPositionControls
      inRail={use3D}
      position={startingPosition}
      heroId={myHeroId}
      choosing={choosingStartingPosition}
      onChoosing={setChoosingStart}
      onAction={changeStartingPosition}
      heroName={(id) => {
        const hero = Object.values(view.teams).flatMap((team) => team.heroes).find((h) => h.id === id);
        return localizedHeroName(id, hero?.name ?? id);
      }}
    />
  );

  if (!view) {
    if (use3D) {
      return (
        <div className={`${styles.layout} ${styles.immersive}`}>
          <div className={styles.main}>
            <div className={styles.boardArea}>
              <Board3D
                view={view}
                inputRequest={isMyInput ? inputRequest : null}
                onHexClick={handleHexClick}
                onUnitClick={handleUnitClick}
                myHeroId={myHeroId}
                calibrate={calibrate}
                modelCalibrationOnly={modelCalibrationOnly}
                heroSwap={heroSwap}
                pings={pings}
                onPingTargetHover={myHeroId ? setHoveredPingTarget : undefined}
                cardGuessAttempts={cardGuessReveal.attempts}
                onHeroSwapChange={handleHeroSwapChange}
                originalHeroUnits={originalHeroUnits}
                onOriginalHeroUnitsChange={handleOriginalHeroUnitsChange}
                useLegacyHeroModels={useLegacyHeroModels}
                playerBoardLayout={playerBoardLayout}
                heroNames={heroNames}
                brightness={boardBrightness}
              />
              <div className={styles.loadingOverlay} role="status">
                <span className={styles.loadingSigil}>GOA II</span>
                <div className={styles.loadingOrb} aria-hidden="true" />
                <strong>Preparing the tabletop</strong>
                {closeCode !== null
                  ? <small><ConnectionClosedNotice code={closeCode} onReconnect={reconnect} /></small>
                  : <small>Connecting to the game…</small>}
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className={styles.loading}>
        {closeCode !== null ? <ConnectionClosedNotice code={closeCode} onReconnect={reconnect} /> : "Connecting..."}
      </div>
    );
  }

  return (
    <div className={mobile ? mobileStyles.layout : `${styles.layout} ${use3D ? styles.immersive : ""}`}>
      {mobile ? <MobileGameHeader view={view} winner={winner} status={playerStatus} connected={connected} /> : <PhaseBar
        view={view}
        winner={winner}
        isMyInput={!!isMyInput}
        waitingTitle={waitingTitle}
        playerStatus={playerStatus}
        immersive={use3D}
        replayShare={gameId && myHeroId ? { gameId, token } : undefined}
      />}

      {(view.clock?.status === "WAITING_FOR_PLAYERS" ||
        view.clock?.status === "SUSPENDED_FOR_INACTIVITY" ||
        view.clock?.status === "PAUSED") && (
        <ReadyOverlay
          view={view}
          clock={view.clock}
          myHeroId={myHeroId}
          connected={connected}
          onReady={setReady}
        />
      )}

      <MobileGameShell
        mobile={mobile}
        desktopClassName={styles.main}
        pane={mobileNavigation.pane}
        onTogglePane={mobileNavigation.togglePane}
        onClose={mobileNavigation.close}
        sidebar={!use3D && !mobile && (
          <Sidebar
            view={view}
            myHeroId={myHeroId}
            model={controller.model}
            heroNames={heroNames}
            isMyTurn={!!isMyInput}
            selectedCardId={selectedCardId}
            onSelectCard={setSelectedCardId}
            onCommit={commitOrSwap}
            onGiveGold={cheatsGold}
            pings={pings}
            onPingTargetHover={myHeroId ? setHoveredPingTarget : undefined}
          />
        )}
        renderPane={(pane) => (
          <MobileGamePanels pane={pane} view={view} model={controller.model} heroNames={heroNames}
            selectedCardId={selectedCardId}
            onSelectCard={setSelectedCardId} onCommit={commitOrSwap}
            onViewDeck={() => mobileNavigation.showPane("deck")} onClose={mobileNavigation.close}
            eventLog={eventLog} waitingForNames={waitingForNames} isMyInput={!!isMyInput}
            settings={(
              <MobileGameSettings onLayoutChange={changeLayout} showRemotePointers={showRemotePointers}
                onShowRemotePointersChange={handleShowRemotePointersChange}
                onOpenDialog={mobileNavigation.openDialog} canFixState={!!myHeroId}
                onRequestPause={canRequestPause ? requestPause : undefined} />
            )} />
        )}
      >
        <div className={styles.boardArea}>
          {use3D ? (
            <>
              <Board3D
                view={view}
                inputRequest={boardInputRequest}
                onHexClick={handleHexClick}
                onUnitClick={handleUnitClick}
                onSelect={handleOptionSelect}
                myHeroId={myHeroId}
                calibrate={calibrate}
                modelCalibrationOnly={modelCalibrationOnly}
                heroSwap={heroSwap}
                onHeroSwapChange={handleHeroSwapChange}
                originalHeroUnits={originalHeroUnits}
                onOriginalHeroUnitsChange={handleOriginalHeroUnitsChange}
                useLegacyHeroModels={useLegacyHeroModels}
                playerBoardLayout={playerBoardLayout}
                heroNames={heroNames}
                brightness={boardBrightness}
                onViewDeck={() => setShowDeck(true)}
                onViewSpellbook={() => setShowSpellbook(true)}
                previewHexes={previewHexes}
                renderOnDemand={
                  (inputRequest?.type === "UPGRADE_PHASE" && !upgradeBoardView) ||
                  (cardSelectActive && !altHeld && !cardSelectBoardView)
                }
                pings={pings}
                onPingTargetHover={myHeroId ? setHoveredPingTarget : undefined}
                cardGuessAttempts={cardGuessReveal.attempts}
                onWorldPointer={myHeroId ? handleWorldPointer : undefined}
                remotePointers={showRemotePointers ? pointers : undefined}
              />
              {myHero && (
                <HandRow
                  hand={defenseInfo?.grantedCards.length ? [...myHero.hand, ...defenseInfo.grantedCards] : myHero.hand}
                  grantedCardIds={defenseInfo?.grantedIds}
                  heroSlug={myHero.id.toLowerCase().replace(/^hero_/, "")}
                  selectedCardId={defenseInfo ? stagedDefenseId : selectedCardId}
                  onSelectCard={setSelectedCardId}
                  isPlanning={isPlanning}
                  canCommit={canCommit || canUncommit}
                  onCommitCard={commitOrSwap}
                  defenseStates={defenseInfo?.states}
                  onPickCard={(id) => stageDefenseCard(id === stagedDefenseId ? null : id)}
                  onHoverChange={handleHandHoverChange}
                />
              )}
              <div className={styles.immersiveRail}>
                {startingControls}
                <ResolutionQueue view={view} immersive />
                <CommittedCards
                  view={view}
                  myHeroId={myHeroId}
                  hidden={committedCardsHidden}
                  onHiddenChange={handleCommittedCardsHiddenChange}
                />
                <HeroDashboardSummary
                  view={view}
                  myHeroId={myHeroId}
                  hidden={heroDashboardHidden}
                  onHiddenChange={handleHeroDashboardHiddenChange}
                />
              </div>
              <EventLog
                eventLog={eventLog}
                view={view}
                waitingForNames={waitingForNames}
                isMyInput={!!isMyInput}
                immersive
              />
            </>
          ) : (
            <>
              <HexGrid
                view={view}
                inputRequest={boardInputRequest}
                myHeroId={myHeroId}
                onHexClick={handleHexClick}
                onUnitClick={handleUnitClick}
                isMyInput={!!isMyInput || choosingStartingPosition}
                previewHexes={previewHexes}
                pings={pings}
                onPingTargetHover={myHeroId ? setHoveredPingTarget : undefined}
                onWorldPointer={myHeroId ? handleWorldPointer : undefined}
                remotePointers={showRemotePointers ? pointers : undefined}
                mapConfig={mapConfig}
              />

              <ResolutionQueue
                view={view}
                collapsed={resolutionQueueCollapsed}
                onCollapsedChange={handleResolutionQueueCollapsedChange}
              />

              {!mobile && <EventLog
                eventLog={eventLog}
                view={view}
                waitingForNames={waitingForNames}
                isMyInput={!!isMyInput}
              />}
            </>
          )}

          <div className={`${styles.revealStack} ${use3D ? styles.revealStackImmersive : ""}`}>
            <CardGuessReveal
              state={cardGuessReveal}
              view={view}
              immersive={use3D}
            />
            <SpellCastReveal
              reveal={spellCastReveal}
              view={view}
              immersive={use3D}
              hovered={spellCastHovered}
              onHoverChange={setSpellCastHovered}
            />
          </div>

          {phaseBanner && (
            <div className={`${styles.phaseBanner} ${use3D ? styles.phaseBanner3d : ""}`}>
              {phaseBanner.replace(/_/g, " ")}
            </div>
          )}

          {hoveredPingTarget && myHeroId && canPing && (
            <div className={`${styles.pingHint} ${use3D ? styles.pingHint3d : ""}`} aria-hidden="true">
              <kbd>TAB</kbd> Ping
            </div>
          )}

          <div className={styles.srOnly} role="status" aria-live="polite">
            {pings.length > 0
              ? `${pingPresentation(view, pings[pings.length - 1]).label} pinged the table`
              : ""}
          </div>

          {!use3D && startingControls}

          {use3D && isPlanning && canUncommit && (
            <div className={styles.planningActions} role="status" aria-live="polite">
              <span className={styles.committedSummary}>
                <span>{canCommitSecond ? "First card locked in" : `${committedCards.length} ${committedCards.length === 1 ? "card" : "cards"} locked in`}</span>
                <strong>{committedCardNames.join(" + ")}</strong>
              </span>
              <button type="button" onClick={takeBack}>
                {committedCards.length > 1 ? "Change latest card" : "Change card"}
              </button>
              {canCommitSecond && (
                <button type="button" className={styles.planningPrimary} onClick={finishPlanning}>Play one card</button>
              )}
            </div>
          )}

          {/* Planning take-back: return the committed card to hand (LIFO for
              a two-card hero) while waiting for the other players. */}
          {!use3D && canUncommit && (
            <button
              type="button"
              className={styles.takeBackBtn}
              onClick={takeBack}
              title="Return your committed card to your hand"
            >
              Take back card
            </button>
          )}

          {/* Emmitt's Alternative Timelines: after the first commit, offer to
              play only one card (commit a second card via the hand instead). */}
          {!use3D && isPlanning && canCommitSecond && (
            <button
              type="button"
              className={styles.finishPlanningBtn}
              onClick={finishPlanning}
              title="Play only one card this turn (Alternative Timelines)"
            >
              Done — play one card
            </button>
          )}

          {/* Consensus overrides: pick instruction chip + confirm bar. */}
          {overridePick && (
            <div className={styles.overridePickChip} role="status">
              <span>{describePick(overridePick, view)}</span>
              <button type="button" onClick={cancelOverridePick} aria-label="Cancel fix">
                ✕
              </button>
            </div>
          )}
          {pendingBoardProposal && (
            <div className={styles.overridePickChip} role="status">
              <span>
                {summarizeProposal({
                  family: "patch",
                  op: pendingBoardProposal.op,
                  args: pendingBoardProposal.proposal,
                }, view)}
              </span>
              <button type="button" onClick={proposeBoardFix}>
                Propose to the table
              </button>
              <button type="button" onClick={cancelOverridePick} aria-label="Cancel fix">
                ✕
              </button>
            </div>
          )}

          {/* Consensus overrides: vote prompt / outcome strip for everyone. */}
          <OverrideVoteBanner
            proposal={overrideProposal}
            resolution={overrideResolution}
            myHeroId={myHeroId}
            onVote={voteOverride}
            onCancel={cancelOverride}
            glass={use3D}
            view={view}
          />

          {/* Decision HUD — overlays both the 2D board and the 3D scene. */}
          {needsBanner && !overridePick && inputRequest && (
            <PromptBanner
              inputRequest={inputRequest}
              onSkip={inputRequest.can_skip ? handleSkip : undefined}
              onRollback={inputRequest.can_rollback ? rollback : undefined}
              glass={use3D}
            />
          )}

          {/* Abstract decisions → glass PickerDock (3D). */}
          {use3D && needsPicker && effectiveInputRequest && (ABSTRACT_INPUT_TYPES.has(effectiveInputRequest.type) || !!offBoardUnitChoice) && (
            <PickerDock
              inputRequest={effectiveInputRequest}
              onSelect={handleOptionSelect}
              onRollback={effectiveInputRequest.can_rollback ? rollback : undefined}
              onPreviewHexes={setPreviewHexes}
              dimmed={altHeld || handHovered}
            />
          )}

          {/* SELECT_CARD → centered overlay painting the selectable cards (3D). */}
          {cardSelectActive && view && inputRequest && (
            <CardSelectOverlay
              view={view}
              inputRequest={inputRequest}
              onSelect={(id) => handleOptionSelect(id)}
              onRollback={inputRequest.can_rollback ? rollback : undefined}
              onSkip={inputRequest.can_skip ? handleSkip : undefined}
              dimmed={altHeld}
              onBoardViewChange={setCardSelectBoardView}
            />
          )}

          {/* Defense → glass DefenseDock (3D); the cards carry the verdict. */}
          {use3D && defenseInfo && inputRequest && (
            <DefenseDock
              inputRequest={inputRequest}
              attackerName={defenseInfo.attackerName}
              anyDefenseAvailable={defenseInfo.anyDefenseAvailable}
              onPass={() => handleOptionSelect("PASS")}
              stagedCard={stagedDefenseCard}
              onConfirmStaged={() => { if (stagedDefenseId) handleOptionSelect(stagedDefenseId); }}
              onClearStaged={() => stageDefenseCard(null)}
              onRollback={inputRequest.can_rollback ? rollback : undefined}
              dimmed={altHeld || handHovered}
            />
          )}

          {/* Everything without a 3D home yet (all 2D; 3D UPGRADE_PHASE). */}
          {needsPicker && effectiveInputRequest && !handledIn3D && (
            <OptionPicker
              inputRequest={effectiveInputRequest}
              myHeroId={myHeroId ?? ""}
              view={view}
              waitingForNames={waitingForNames}
              onSelect={handleOptionSelect}
              onRollback={effectiveInputRequest.can_rollback ? rollback : undefined}
              onPreviewHexes={setPreviewHexes}
              glass={use3D}
              onBoardViewChange={use3D ? setUpgradeBoardView : undefined}
            />
          )}
        </div>

      </MobileGameShell>

      {use3D ? (
        <GameTools
          onReportBug={() => setShowBugReport(true)}
          onFixGameState={myHeroId ? () => setShowOverridePanel(true) : undefined}
          onRequestPause={canRequestPause ? requestPause : undefined}
          onShareLinks={() => setShowShareLinks(true)}
          useLegacyHeroModels={useLegacyHeroModels}
          onLegacyHeroModelsChange={handleLegacyHeroModelsChange}
          playerBoardLayout={playerBoardLayout}
          onPlayerBoardLayoutChange={handlePlayerBoardLayoutChange}
          brightness={boardBrightness}
          onBrightnessChange={handleBoardBrightnessChange}
          showRemotePointers={showRemotePointers}
          onShowRemotePointersChange={handleShowRemotePointersChange}
          onMobileView={() => changeLayout("mobile")}
        />
      ) : !mobile && (
        <div className={styles.gameToolsRow}>
          <button type="button" className={styles.bugReportBtn} onClick={() => changeLayout("mobile")}>
            Mobile UI
          </button>
          <button
            className={styles.bugReportBtn}
            onClick={() => setShowBugReport(true)}
            title="Report a bug - the current game moment is attached automatically"
          >
            Report bug
          </button>
          {myHeroId && (
            <button
              className={styles.fixStateBtn}
              onClick={() => setShowOverridePanel(true)}
              title="Propose a table override (majority vote)"
            >
              Fix game state
            </button>
          )}
          <button
            className={styles.shareLinksBtn}
            onClick={() => setShowShareLinks(true)}
            title="Get the watch link, or ask the table for a seat link"
          >
            Share links
          </button>
          {canRequestPause && (
            <button
              className={styles.requestPauseBtn}
              onClick={requestPause}
              title="Ask the table to pause (majority vote)"
            >
              Request pause
            </button>
          )}
        </div>
      )}

      {(showOverridePanel || mobileNavigation.dialog === "override") && gameId && view && (
        <OverridePanel
          view={view}
          gameId={gameId}
          token={token}
          myHeroId={myHeroId}
          onClose={() => mobile ? mobileNavigation.close() : setShowOverridePanel(false)}
          onPropose={handlePropose}
          onStartBoardPick={(pick) => {
            startBoardPick(pick);
            if (mobile) mobileNavigation.showPane("board");
          }}
        />
      )}

      {(showShareLinks || mobileNavigation.dialog === "share") && gameId && view && (
        <ShareLinksPanel
          gameId={gameId}
          origin={window.location.origin}
          token={token}
          view={view}
          heroNames={heroNames}
          myHeroId={myHeroId}
          revealedPlayerTokens={revealedPlayerTokens}
          proposalOpen={!!overrideProposal}
          onRequestPlayerLink={(id) => {
            askForPlayerLink(id);
            if (mobile) mobileNavigation.close();
          }}
          onClose={() => mobile ? mobileNavigation.close() : setShowShareLinks(false)}
        />
      )}

      {(showBugReport || mobileNavigation.dialog === "report") && gameId && (
        <BugReportModal gameId={gameId} token={token}
          onClose={() => mobile ? mobileNavigation.close() : setShowBugReport(false)} />
      )}

      {!connected && (
        <div className={styles.disconnected}>
          {closeCode !== null
            ? <ConnectionClosedNotice code={closeCode} onReconnect={reconnect} />
            : "Disconnected — reconnecting..."}
        </div>
      )}

      {error && !lockedNotice && <ErrorToast message={error} />}
      {lockedNotice && <ErrorToast message="Too late — all cards are locked in." />}

      {showDeck && myHero && (
        <DeckViewer
          hero={myHero}
          teamColor={myTeam ? TEAM_COLORS[myTeam] ?? "#888" : "#888"}
          onClose={() => setShowDeck(false)}
        />
      )}

      {showSpellbook && myHero && Array.isArray(myHero.spellbook) && (
        <SpellbookViewer
          hero={myHero}
          teamColor={myTeam ? TEAM_COLORS[myTeam] ?? "#888" : "#888"}
          onClose={() => setShowSpellbook(false)}
        />
      )}
    </div>
  );
}
