// Hex coordinate (cube system: q + r + s = 0)
export interface Hex {
  q: number;
  r: number;
  s: number;
}

export type PingCardZone =
  | "CURRENT"
  | "EXTRA"
  | "PLAYED"
  | "DISCARD"
  | "ULTIMATE"
  | "CAST";

export type PingTarget =
  | { kind: "HEX"; hex: Hex }
  | { kind: "CARD"; hero_id: string; zone: PingCardZone; index?: number };

// Board
export interface TileView {
  hex: Hex;
  zone_id: string;
  is_terrain: boolean;
  occupant_id: string | null;
  spawn_point: SpawnPointView | null;
}

export interface SpawnPointView {
  location: Hex;
  team: string;
  type: string;
  minion_type: string | null;
}

export interface ZoneView {
  id: string;
  neighbors: string[];
  spawn_points: SpawnPointView[];
}

export interface BoardView {
  map: string;
  tiles: Record<string, TileView>;
  zones: Record<string, ZoneView>;
  entity_locations: Record<string, Hex>;
}

// Units
export interface HeroView {
  id: string;
  name: string;
  title: string;
  team: string;
  level: number;
  gold: number;
  items: Record<string, unknown>;
  hand: CardView[];
  /** Public card count. Opponents still receive an empty, masked `hand`. */
  hand_size?: number;
  deck: CardView[] | { count: number };
  played_cards: (CardView | null)[];
  current_turn_card: CardView | null;
  // Other committed card (Emmitt's Alternative Timelines): during two-card
  // Planning this is the first commit while current_turn_card is the latest;
  // after revelation it is the second revealed card until the retrieve choice.
  extra_turn_card: CardView | null;
  // True only in this hero's own view while they may still commit a second
  // card or call planning-done (Emmitt's Alternative Timelines). Always false
  // for opponents/spectators and outside their two-card planning window.
  can_commit_second_card: boolean;
  discard_pile: CardView[];
  ultimate_card: CardView | null;
  // Snorri's rune slots: { "1".."4": rune_type }. Absent/empty slots are simply
  // missing keys (default {}). Persistent and public to all viewers.
  rune_slots?: Record<string, RuneType>;
  // Prepared spells (Gydion). Full cards in the owner's own view (and offline
  // reveal_all); opponents/spectators get only { count }. Null for heroes
  // without spells.
  spellbook?: CardView[] | { count: number } | null;
  // Spells currently outside the spellbook: faceup, public, full cards in
  // every view. Empty for heroes without spells.
  cast_spells?: CardView[];
  // Public per-caster progress for Gydion's Wish; the caster's team wins after
  // their third Wish resolves its selected spell.
  wish_cast_count?: number;
}

export type RuneType = "axe" | "bird" | "anvil" | "horn";

export interface MinionView {
  id: string;
  type: string; // MELEE, RANGED, HEAVY
  team: string;
  value: number;
  is_heavy: boolean;
}

export interface CardView {
  id: string;
  name: string;
  image_id?: string;
  tier: string;
  color: string | null;
  primary_action: string | null;
  primary_action_value: number | null;
  secondary_actions: Record<string, number>;
  effect_id: string | null;
  effect_text: string | null;
  initiative: number;
  state: string;
  is_facedown: boolean;
  is_ranged: boolean;
  range_value: number | null;
  radius_value: number | null;
  item: string | null;
  is_active: boolean;
  // Spellbook rank; present only on complete spell-card views (count-only
  // opponent spellbooks never expose it). Spell cards also use the extra
  // states "SPELLBOOK" (prepared, facedown) and "OUTSIDE_SPELLBOOK" (spent,
  // faceup).
  spell_rank?: number;
}

// Teams
export interface TeamView {
  color: string;
  life_counters: number;
  /** Setup value, never mutated by play; absent on views from older servers. */
  starting_life_counters?: number | null;
  heroes: HeroView[];
  minions: MinionView[];
}

// Tokens
export interface TokenView {
  id: string;
  name: string;
  token_type: string;
  owner_id: string | null;
  hex: Hex | null;
}

// Board entities (non-unit, non-token board objects, e.g. Trinkets turret)
export interface BoardEntityView {
  id: string;
  name: string;
  entity_kind: string;
  owner_id: string | null;
  is_obstacle: boolean;
  hex: Hex | null;
}

// Effects & Markers
export interface EffectView {
  id: string;
  type: string;
  source_card_id: string | null;
  duration: string;
  is_active: boolean;
  scope: {
    shape: string;
    range: number;
    origin: Hex | null;
    origin_id: string | null;
    affects: string;
  };
  stat_type: string | null;
  stat_value: number | null;
  /** NebKher reality splits: the line is every hex where hex[split_axis] === split_value. */
  split_axis?: "q" | "r" | "s" | null;
  split_value?: number;
  /** Card color publicly announced at creation (Imbue Doubt family); public info. */
  named_color?: string | null;
}

export interface MarkerView {
  target_id: string;
  value: number;
  source_id: string;
}

// Resolution queue entry
export interface UnresolvedCard {
  hero_id: string;
  initiative: number;
  card: CardView;
}

export interface TimeControlConfig {
  planning_allowance_seconds: number;
  resolution_allowance_seconds: number;
  /** One-shot bonus for the first primary Resolution actor of a shared turn. */
  initiative_bonus_seconds: number;
  response_grant_seconds: number;
  initial_time_bank_seconds: number;
  time_bank_increment_seconds: number;
  max_time_bank_seconds: number;
  upgrade_allowance_seconds: number;
  automatic_turn_limit: number;
  /** False makes the clocks advisory: running out decides nothing. */
  enforce_timeouts: boolean;
}

export type ClockStatus =
  | "WAITING_FOR_PLAYERS"
  | "SUSPENDED_FOR_INACTIVITY"
  | "PAUSED"
  | "RUNNING"
  | "FINISHED";
export type ClockKind = "PLANNING" | "RESOLUTION" | "RESPONSE" | "LEVEL_UP";

export interface PlayerClockView {
  planning_allowance_ms: number;
  resolution_allowance_ms: number;
  /** Spent only on this hero's own primary Resolution, never on a Response. */
  initiative_bonus_ms: number;
  response_time_ms: number;
  upgrade_allowance_ms: number;
  time_bank_ms: number;
  /** Time spent past every pool, in an advisory match. Render the Time Bank
   * as `time_bank_ms - overrun_ms`; only one of the two is ever non-zero. */
  overrun_ms: number;
  planning_complete: boolean;
  planning_locked_by_timeout: boolean;
  running: boolean;
}

export interface GameClockView {
  status: ClockStatus;
  enforce_timeouts: boolean;
  server_now_ms: number;
  turn_key: { round: number; turn: number };
  ready_hero_ids: string[];
  /** Present only while status is PAUSED. */
  pause: { requested_by: string | null; since_ms: number | null } | null;
  active: {
    kind: ClockKind;
    request_id: string | null;
    hero_ids: string[];
    running_hero_ids?: string[];
  } | null;
  players: Record<string, PlayerClockView>;
  /** Client-only receipt anchor added by the socket hook. */
  client_received_at_ms?: number;
}

// Top-level game view
export interface HeroPieceView {
  owner_hero_id: string;
  team: string | null;
  position: Hex | null;
}

export interface StartingPositionView {
  destinations: Hex[];
  swap_targets: string[];
  requests: { id: string; from: string; to: string }[];
}

export type StartingPositionAction =
  | { op: "move"; destination: Hex }
  | { op: "request_swap"; target: string }
  | { op: "respond_swap"; request_id: string; accept: boolean }
  | { op: "cancel" };

export interface GameView {
  starting_position?: StartingPositionView | null;
  phase: string;
  round: number;
  turn: number;
  current_actor_id: string | null;
  unresolved_hero_ids: string[];
  unresolved_cards: UnresolvedCard[];
  /** Current Battle Zone per lane. Single-lane games contain only lane_1. */
  battle_zones: Record<string, string>;
  /** Remaining Wave counters per lane. */
  wave_counters: Record<string, number>;
  /** Legacy single-lane Battle Zone; null on multi-lane maps. */
  active_zone_id: string | null;
  cheats_enabled: boolean;
  tie_breaker_team: string;
  teams: Record<string, TeamView>;
  board: BoardView;
  effects: EffectView[];
  markers: Record<string, MarkerView>;
  tokens: TokenView[];
  board_entities?: BoardEntityView[];
  hero_pieces?: Record<string, HeroPieceView>;
  time_control: TimeControlConfig | null;
  clock: GameClockView | null;
  /** Authoritative public state for an active card-color guess, including a
   * facedown repeat card and any earlier card already revealed this action. */
  card_guess?: {
    guesser_id: string;
    attempts: Array<{
      attempt: number;
      victim_id: string;
      card: CardView | null;
      guessed_color: string | null;
      actual_color: string | null;
      correct: boolean | null;
    }>;
  } | null;
}

// Input requests
export interface InputOption {
  id: string;
  text: string;
  defense_value?: number;
  base_defense?: number;
  [key: string]: unknown;
}

export interface UpgradeCardDetail {
  id: string;
  name: string;
  image_id?: string;
  item: string | null;
  tier: string | null;
  color: string | null;
  primary_action: string | null;
  primary_action_value: number | null;
  secondary_actions: Record<string, number>;
  effect_text: string | null;
  initiative: number | null;
  is_ranged: boolean;
  range_value: number | null;
  radius_value: number | null;
}

export interface UpgradeOption {
  color: string;
  tier: string;
  pair: [string, string];
  card_details: [UpgradeCardDetail, UpgradeCardDetail];
}

export interface UpgradePlayerData {
  remaining: number;
  options: UpgradeOption[];
}

export interface InputRequest {
  /**
   * Opaque ID for this specific prompt. It must be echoed unchanged when
   * submitting the player's selection.
   */
  request_id?: string;
  type: string;
  player_id: string;
  prompt: string;
  can_skip?: boolean;
  can_rollback?: boolean;
  valid_options?: (string | number | Hex)[];
  valid_hexes?: Hex[];
  options?: (InputOption | string)[];
  player_ids?: string[];
  players?: Record<string, UpgradePlayerData>;
  attack_value?: number | null;
  minion_modifier?: number;
  defense_needed?: number | null;
  [key: string]: unknown;
}

// WebSocket messages
export interface StateUpdateMessage {
  type: "STATE_UPDATE";
  /** Optional correlation ID echoed only to the player whose action produced this update. */
  client_action_id?: string;
  view: GameView;
  input_request?: InputRequest;
  /**
   * Hero IDs the pending request is waiting on. Sent to every recipient,
   * including those whose `input_request` was withheld as private, so an
   * observer can name the blocking player. Optional so the client degrades
   * gracefully against a backend that predates this field.
   */
  awaiting_input?: string[];
  winner?: string;
  /**
   * Display name per hero id, static for the match. Omitted when empty, so a
   * client must retain the last non-empty map rather than replacing on each
   * message.
   */
  hero_names?: Record<string, string>;
  /**
   * Public events from the mutation that triggered this broadcast, present only
   * on post-mutation broadcasts (absent on initial connect / GET_VIEW). Drives
   * animations for every client, not just the actor. Optional so the client
   * degrades gracefully against a backend that predates this field.
   */
  events?: GameEvent[];
}

export interface ActionResultMessage {
  type: "ACTION_RESULT";
  /** Optional correlation ID supplied by the acting client. */
  client_action_id?: string;
  result_type: string;
  current_phase: string;
  events: GameEvent[];
  input_request?: InputRequest;
  awaiting_input?: string[];
  winner: string | null;
}

export interface ErrorMessage {
  type: "ERROR";
  detail: string;
}

export interface ReadyUpdatedMessage {
  type: "READY_UPDATED";
  hero_id: string;
  ready: boolean;
}

export interface PingMessage {
  type: "PING";
  ping_id: string;
  /** Authenticated by the server; clients cannot choose or spoof this value. */
  hero_id: string;
  target: PingTarget;
}

export interface ActivePing extends PingMessage {
  /** Client receipt time used to drive the short local animation lifetime. */
  received_at_ms: number;
}

export interface PointerMessage {
  type: "POINTER";
  /** Authenticated by the server; clients cannot choose or spoof this value. */
  hero_id: string;
  /**
   * Either raw table-plane world coordinates (3D scene space, valid over the
   * shared map) or a semantic target: whose board zone the pointer is over.
   * Seat layouts differ per client, so only zone targets are meaningful over
   * player boards. Absent entirely when hidden.
   */
  x?: number;
  z?: number;
  target_hero_id?: string;
  zone?: string;
  /** Sender's pointer left the table (hand, HUD, sky); marker must vanish. */
  hidden?: boolean;
}

/** A pointer hovering the shared map, in table world coordinates. */
export interface RemotePoint {
  kind: "point";
  x: number;
  z: number;
}

/** A pointer hovering somewhere on a hero's board (sheet, deck, discard...). */
export interface RemoteZone {
  kind: "zone";
  target_hero_id: string;
  zone: string;
}

export type RemotePointerLocation = RemotePoint | RemoteZone;

export type RemotePointer = RemotePointerLocation & {
  /** Client receipt time; entries older than a few seconds are dropped. */
  received_at_ms: number;
};

// Consensus overrides (see backend CLIENT_INTEGRATION_GUIDE § Consensus Overrides)

export type OverrideFamily =
  | "patch"
  | "unstick"
  | "rewind"
  | "pause"
  | "reveal_player";

export interface OverrideTally {
  yes: string[];
  no: string[];
}

export interface OverrideProposedMessage {
  type: "OVERRIDE_PROPOSED";
  proposal_id: string;
  proposer_hero_id: string;
  family: OverrideFamily;
  op: string | null;
  args: Record<string, unknown>;
  to: number | null;
  summary: string;
  eligible_voters: string[];
  threshold: number;
  tally: OverrideTally;
  /** Absolute epoch seconds — render the countdown against the local clock. */
  expires_at: number;
}

export interface OverrideUpdatedMessage {
  type: "OVERRIDE_UPDATED";
  proposal_id: string;
  tally: OverrideTally;
}

export type OverrideOutcome = "applied" | "rejected" | "expired" | "cancelled";

export interface OverrideResolvedMessage {
  type: "OVERRIDE_RESOLVED";
  proposal_id: string;
  outcome: OverrideOutcome;
  tally: OverrideTally;
  /** Present only when an approved override failed validation at apply time. */
  reason?: { code: string; message: string };
}

/** The open proposal as tracked client-side (PROPOSED + latest UPDATED tally). */
/**
 * The seat token for one hero, released to the players (never to spectators)
 * once the table approves a `reveal_player` override.
 */
export interface PlayerLinkRevealedMessage {
  type: "PLAYER_LINK_REVEALED";
  hero_id: string;
  token: string;
}

export type ActiveOverrideProposal = Omit<OverrideProposedMessage, "type">;

export interface OverrideResolution {
  outcome: OverrideOutcome;
  summary: string;
  /** Absent when the resolved proposal was never seen by this client. */
  family?: OverrideFamily;
  reason?: { code: string; message: string };
}

export type ServerMessage =
  | StateUpdateMessage
  | ActionResultMessage
  | ReadyUpdatedMessage
  | PingMessage
  | PointerMessage
  | OverrideProposedMessage
  | OverrideUpdatedMessage
  | OverrideResolvedMessage
  | PlayerLinkRevealedMessage
  | ErrorMessage;

/**
 * Engine event types emitted in `events`, mirroring the backend
 * `GameEventType` enum. Used to drive 3D animations. `string` is kept in the
 * union so an unknown future event type never breaks the type-check.
 */
export type GameEventType =
  | "UNIT_MOVED"
  | "TOKEN_MOVED"
  | "UNIT_PLACED"
  | "TOKEN_PLACED"
  | "BOARD_ENTITY_PLACED"
  | "UNIT_PUSHED"
  | "TOKEN_PUSHED"
  | "UNITS_SWAPPED"
  | "COMBAT_RESOLVED"
  | "UNIT_DEFEATED"
  | "UNIT_REMOVED"
  | "TOKEN_REMOVED"
  | "BOARD_ENTITY_REMOVED"
  | "EFFECT_CREATED"
  | "MARKER_PLACED"
  | "MARKER_REMOVED"
  | "GOLD_GAINED"
  | "GOLD_LOST"
  | "ITEM_GAINED"
  | "LIFE_COUNTER_CHANGED"
  | "CARD_RETRIEVED"
  | "CARD_SELECTED_FOR_GUESS"
  | "GUESSED_CARD_REVEALED"
  | "CARD_REVEALED"
  | "MINION_PROTECTED"
  | "TURN_ENDED"
  | "GAME_OVER"
  | "MINE_TRIGGERED"
  | "HERO_LAUGHED"
  | "RESOLVED_CARDS_SWAPPED"
  | "DECK_CARD_SWAPPED"
  | "RUNES_PLACED"
  | "SPELL_CAST"
  | "SPELL_REMOVED_FROM_SPELLBOOK"
  | "SPELLBOOK_PREPARED"
  | "WISH_CAST_COUNT_CHANGED"
  | "TIMER_EXPIRED"
  | "TIE_BREAKER_FLIPPED"
  | (string & {});

export interface GameEvent {
  event_type: GameEventType;
  actor_id: string | null;
  target_id: string | null;
  from_hex: Hex | null;
  to_hex: Hex | null;
  metadata: Record<string, unknown>;
}

// REST API
export interface PlayerToken {
  hero_id: string;
  token: string;
}

export interface CreateGameResponse {
  game_id: string;
  player_tokens: PlayerToken[];
  spectator_token: string;
}
