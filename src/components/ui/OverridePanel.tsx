import { useEffect, useMemo, useState } from "react";
import type { GameView } from "../../types/game";
import {
  fetchOverrideHistory,
  fetchOverrideSchema,
  type OverrideHistoryResponse,
  type OverrideOpSchema,
  type OverrideSchemaResponse,
} from "../../api/overrides";
import { startPick, type OverridePick } from "../../utils/overridePick";
import {
  CARD_ZONE_LABEL,
  entityLabel,
  findHero,
  finishedTurns,
  laneLabel,
  teamLabel,
  heroCardZones,
  summarizeProposal,
  type CardZone,
  type OverrideProposalPayload,
} from "../../utils/overrideSummary";
import styles from "./OverridePanel.module.css";
import { useLocalizedHeroNames, type HeroNameResolver } from "../../i18n/useLocalizedHeroNames";

export type { OverrideProposalPayload };

interface Props {
  view: GameView;
  gameId: string;
  token: string;
  /** Preselected in the Cards tab; null for spectators. */
  myHeroId?: string | null;
  onClose: () => void;
  onPropose: (payload: OverrideProposalPayload) => void;
  /** Collapse the panel and enter board pick mode (move/remove/place). */
  onStartBoardPick: (pick: OverridePick) => void;
  initialTab?: TabId;
  /** Test seams — production fetches lazily. */
  preloadedSchema?: OverrideSchemaResponse;
  preloadedHistory?: OverrideHistoryResponse;
}

type TabId = "board" | "cards" | "values" | "advanced" | "unstick" | "rewind";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "board", label: "Board" },
  { id: "cards", label: "Cards" },
  { id: "values", label: "Values" },
  { id: "advanced", label: "Advanced" },
  { id: "unstick", label: "Unstick" },
  { id: "rewind", label: "Rewind" },
];

// Ops with a curated UI; everything else in the patch family lands in Advanced.
const CURATED_OPS = new Set([
  "move_entity",
  "remove_entity",
  "place_entity",
  "move_card",
  "set_gold",
  "set_level",
  "set_life_counters",
  "set_wave_counter",
  "set_tie_breaker_team",
  "swap_item_card",
  "set_item",
  "skip_input",
  "abort_action",
  "end_turn",
  "force_actor",
]);

const ITEM_STATS = ["ATTACK", "DEFENSE", "MOVEMENT", "INITIATIVE", "RANGE", "RADIUS"];
const UPGRADE_SLOTS = ["RED", "BLUE", "GREEN"].flatMap((color) =>
  ["II", "III"].map((tier) => ({ color, tier })),
);

function statLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function allHeroes(view: GameView, localizedHeroName: HeroNameResolver): Array<{ id: string; name: string }> {
  return Object.values(view.teams).flatMap((team) =>
    team.heroes.map((hero) => ({
      id: hero.id,
      name: localizedHeroName(hero.id, hero.name),
    })),
  );
}

export function OverridePanel({
  view,
  gameId,
  token,
  myHeroId = null,
  onClose,
  onPropose,
  onStartBoardPick,
  initialTab = "board",
  preloadedSchema,
  preloadedHistory,
}: Props) {
  const localizedHeroName = useLocalizedHeroNames();
  const [tab, setTab] = useState<TabId>(initialTab);
  const [confirm, setConfirm] = useState<OverrideProposalPayload | null>(null);

  const heroes = useMemo(
    () => allHeroes(view, localizedHeroName),
    [view, localizedHeroName],
  );

  const propose = (payload: OverrideProposalPayload) => setConfirm(payload);

  const send = () => {
    if (!confirm) return;
    onPropose(confirm);
    onClose();
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.panel}
        role="dialog"
        aria-label="Fix game state"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.titleRow}>
          <h2>Fix game state</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className={styles.intro}>
          Propose a correction — it applies only after a majority of connected
          players approve it.
        </p>

        {confirm ? (
          <div className={styles.confirm}>
            <div className={styles.confirmSummary}>{summarizeProposal(confirm, view)}</div>
            <div className={styles.confirmActions}>
              <button type="button" className={styles.primary} onClick={send}>
                Propose to the table
              </button>
              <button type="button" onClick={() => setConfirm(null)}>
                Back
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.tabs} role="tablist">
              {TABS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === entry.id}
                  className={tab === entry.id ? styles.tabActive : styles.tab}
                  onClick={() => setTab(entry.id)}
                >
                  {entry.label}
                </button>
              ))}
            </div>

            {tab === "board" && (
              <BoardTab view={view} heroes={heroes} onStartBoardPick={onStartBoardPick} />
            )}
            {tab === "cards" && (
              <CardsTab view={view} heroes={heroes} myHeroId={myHeroId} onPropose={propose} />
            )}
            {tab === "values" && (
              <ValuesTab view={view} heroes={heroes} onPropose={propose} />
            )}
            {tab === "advanced" && (
              <AdvancedTab onPropose={propose} preloadedSchema={preloadedSchema} />
            )}
            {tab === "unstick" && (
              <UnstickTab heroes={heroes} onPropose={propose} />
            )}
            {tab === "rewind" && (
              <RewindTab
                gameId={gameId}
                token={token}
                onPropose={propose}
                preloadedHistory={preloadedHistory}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface OffBoardGroup {
  title: string;
  entities: Array<{ id: string; label: string }>;
}

/** Everything place_entity can put back that is not on the board now. */
function offBoardGroups(view: GameView, heroes: Array<{ id: string; name: string }>): OffBoardGroup[] {
  const onBoard = new Set(Object.keys(view.board.entity_locations));
  // Multi-piece heroes are placed piece by piece, never by hero id.
  const pieceOwners = new Set(
    Object.values(view.hero_pieces ?? {}).map((piece) => piece.owner_hero_id),
  );
  const groups: OffBoardGroup[] = [
    {
      title: "Heroes",
      entities: heroes
        .filter((hero) => !onBoard.has(hero.id) && !pieceOwners.has(hero.id))
        .map((hero) => ({ id: hero.id, label: hero.name })),
    },
    ...Object.entries(view.teams).map(([teamId, team]) => ({
      title: `${teamId.charAt(0)}${teamId.slice(1).toLowerCase()} minions`,
      entities: team.minions
        .filter((minion) => !onBoard.has(minion.id))
        .map((minion) => ({ id: minion.id, label: entityLabel(view, minion.id) })),
    })),
    {
      title: "Other",
      entities: (view.board_entities ?? [])
        .filter((entity) => !onBoard.has(entity.id))
        .map((entity) => ({ id: entity.id, label: entity.name })),
    },
  ];
  return groups.filter((group) => group.entities.length > 0);
}

function BoardTab({
  view,
  heroes,
  onStartBoardPick,
}: {
  view: GameView;
  heroes: Array<{ id: string; name: string }>;
  onStartBoardPick: (pick: OverridePick) => void;
}) {
  const groups = offBoardGroups(view, heroes);

  return (
    <div className={styles.section}>
      <button
        type="button"
        className={styles.rowButton}
        onClick={() => onStartBoardPick(startPick("move_entity"))}
      >
        <strong>Move a unit or token</strong>
        <small>A legal move was refused, or something sits on the wrong hex.</small>
      </button>
      <button
        type="button"
        className={styles.rowButton}
        onClick={() => onStartBoardPick(startPick("remove_entity"))}
      >
        <strong>Remove a unit or token</strong>
        <small>Something should have been defeated but wasn't.</small>
      </button>
      <div className={styles.placeRow}>
        <div className={styles.rowText}>
          <strong>Put a unit back on the board</strong>
          <small>Choose who belongs on the board, then click the hex to put them on.</small>
        </div>
        {groups.length === 0 ? (
          <small className={styles.cardZoneEmpty}>Every unit is already on the board.</small>
        ) : (
          groups.map((group) => (
            <div key={group.title} className={styles.cardZone}>
              <span className={styles.cardZoneTitle}>{group.title}</span>
              <div className={styles.cardChips}>
                {group.entities.map((entity) => (
                  <button
                    key={entity.id}
                    type="button"
                    className={styles.cardChip}
                    onClick={() => onStartBoardPick(startPick("place_entity", entity.id))}
                  >
                    {entity.label}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const CARD_ZONES: CardZone[] = ["hand", "played", "discard", "deck"];
const PLAYED_SLOTS = [1, 2, 3, 4];

const CARD_ZONE_TITLE: Record<CardZone, string> = {
  hand: "Hand",
  played: "Played",
  discard: "Discard pile",
  deck: "Deck",
};

function CardsTab({
  view,
  heroes,
  myHeroId,
  onPropose,
}: {
  view: GameView;
  heroes: Array<{ id: string; name: string }>;
  myHeroId: string | null;
  onPropose: (payload: OverrideProposalPayload) => void;
}) {
  const [heroId, setHeroId] = useState(
    myHeroId && heroes.some((hero) => hero.id === myHeroId) ? myHeroId : heroes[0]?.id ?? "",
  );
  const [picked, setPicked] = useState<{ id: string; zone: CardZone } | null>(null);

  const hero = findHero(view, heroId);
  if (!hero) return <div className={styles.section}>No heroes in this game.</div>;
  const zones = heroCardZones(hero);
  const heroName = heroes.find((entry) => entry.id === heroId)?.name ?? hero.name;
  const hiddenHand = zones.hand.length === 0 && (hero.hand_size ?? 0) > 0;
  const hiddenDeck = !Array.isArray(hero.deck);
  const finished = finishedTurns(view, hero);
  const pickedCard = picked ? zones[picked.zone].find((card) => card.id === picked.id) : undefined;
  const slotOf = (cardId: string) => {
    const index = hero.played_cards.findIndex((card) => card?.id === cardId);
    return index >= 0 ? index + 1 : null;
  };
  const moveTo = (zone: CardZone, slot?: number) => {
    if (!pickedCard) return;
    onPropose({
      family: "patch",
      op: "move_card",
      args: { hero_id: heroId, card_id: pickedCard.id, zone, ...(slot ? { slot } : {}) },
    });
  };

  return (
    <div className={styles.section}>
      <div className={styles.formRow}>
        <label>Whose cards</label>
        <select
          value={heroId}
          onChange={(event) => {
            setHeroId(event.target.value);
            setPicked(null);
          }}
        >
          {heroes.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
      </div>
      <p className={styles.opDescription}>
        Click the card that is in the wrong place, then choose where it belongs.
      </p>

      {CARD_ZONES.map((zone) => (
        <div key={zone} className={styles.cardZone}>
          <span className={styles.cardZoneTitle}>{CARD_ZONE_TITLE[zone]}</span>
          <div className={styles.cardChips}>
            {zones[zone].map((card) => {
              const isPicked = picked?.id === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  aria-pressed={isPicked}
                  className={isPicked ? styles.cardChipActive : styles.cardChip}
                  onClick={() => setPicked(isPicked ? null : { id: card.id, zone })}
                >
                  {zone === "played" && (
                    <span className={styles.slotTag}>{slotOf(card.id) ?? "now"}</span>
                  )}
                  {card.name}
                  {zone === "deck" && card.state === "RETIRED" && (
                    <span className={styles.slotTag}> (retired)</span>
                  )}
                  {zone === "deck" && card.state !== "RETIRED" && card.state !== "DECK" && (
                    <span className={styles.lostTag}> (lost)</span>
                  )}
                </button>
              );
            })}
            {zone === "hand" && hiddenHand ? (
              <small className={styles.cardZoneEmpty}>
                {hero.hand_size} hidden — only {heroName} can move cards out of their hand.
              </small>
            ) : zone === "deck" && hiddenDeck ? (
              <small className={styles.cardZoneEmpty}>
                Hidden — only {heroName} can move cards out of their deck.
              </small>
            ) : (
              zones[zone].length === 0 && <small className={styles.cardZoneEmpty}>Empty</small>
            )}
          </div>
        </div>
      ))}

      {picked && pickedCard && (
        <div className={styles.placeRow}>
          <div className={styles.rowText}>
            <strong>Move {pickedCard.name} to…</strong>
          </div>
          <div className={styles.placeControls}>
            {(["hand", "discard", "deck"] as const)
              .filter((zone) => zone !== picked.zone)
              .map((zone) => (
                <button key={zone} type="button" onClick={() => moveTo(zone)}>
                  {heroName}'s {CARD_ZONE_LABEL[zone]}
                </button>
              ))}
          </div>
          <div className={styles.slotRow}>
            <span>Played slot</span>
            {PLAYED_SLOTS.map((slot) => {
              const occupant = hero.played_cards[slot - 1];
              const upcoming = slot > finished;
              return (
                <button
                  key={slot}
                  type="button"
                  className={styles.slotButton}
                  disabled={!!occupant || upcoming}
                  title={
                    occupant
                      ? `Turn ${slot}: ${occupant.name}`
                      : upcoming
                        ? `Turn ${slot} hasn't been played yet`
                        : `Turn ${slot}: empty`
                  }
                  onClick={() => moveTo("played", slot)}
                >
                  {slot}
                  {occupant ? <small>{occupant.name}</small> : upcoming && <small>not yet</small>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ValueStepper({
  label,
  current,
  min,
  max,
  warning,
  onPropose,
}: {
  label: string;
  current: number;
  min: number;
  max?: number;
  warning?: (value: number) => string | null;
  onPropose: (value: number) => void;
}) {
  const [draft, setDraft] = useState(current);
  const [seen, setSeen] = useState(current);
  // A server update to the value discards the draft.
  if (seen !== current) {
    setSeen(current);
    setDraft(current);
  }
  const clamp = (value: number) => Math.max(min, max === undefined ? value : Math.min(max, value));
  const changed = draft !== current;
  const note = changed ? warning?.(draft) : null;

  return (
    <div className={styles.stepperRow}>
      <span className={styles.stepperLabel}>{label}</span>
      <div className={styles.stepper}>
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={draft <= min}
          onClick={() => setDraft(clamp(draft - 1))}
        >
          −
        </button>
        <span className={changed ? styles.stepperValueChanged : styles.stepperValue}>{draft}</span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={max !== undefined && draft >= max}
          onClick={() => setDraft(clamp(draft + 1))}
        >
          +
        </button>
      </div>
      {changed && (
        <>
          <button type="button" className={styles.primary} onClick={() => onPropose(draft)}>
            Propose {current} → {draft}
          </button>
          <button
            type="button"
            className={styles.stepperReset}
            aria-label={`Reset ${label}`}
            onClick={() => setDraft(current)}
          >
            ↺
          </button>
        </>
      )}
      {note && <small className={styles.warning}>{note}</small>}
    </div>
  );
}

function ValuesTab({
  view,
  heroes,
  onPropose,
}: {
  view: GameView;
  heroes: Array<{ id: string; name: string }>;
  onPropose: (payload: OverrideProposalPayload) => void;
}) {
  const patch = (op: string, args: Record<string, unknown>) =>
    onPropose({ family: "patch", op, args });
  const heroName = (id: string, fallback: string) =>
    heroes.find((hero) => hero.id === id)?.name ?? fallback;
  const lanes = Object.entries(view.wave_counters).sort(([a], [b]) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );

  return (
    <div className={styles.section}>
      <p className={styles.opDescription}>
        Change a value with − and +, then propose it to the table.
      </p>

      {Object.entries(view.teams).map(([teamId, team]) => (
        <div key={teamId} className={styles.valueGroup}>
          <span className={styles.cardZoneTitle}>{teamLabel(teamId)} team</span>
          <ValueStepper
            label="Life counters"
            current={team.life_counters}
            min={0}
            warning={(value) => (value === 0 ? `0 ends the game: ${teamLabel(teamId)} loses.` : null)}
            onPropose={(value) => patch("set_life_counters", { team: teamId, value })}
          />
          {team.heroes.map((hero) => (
            <div key={hero.id} className={styles.heroValues}>
              <strong>{heroName(hero.id, hero.name)}</strong>
              <ValueStepper
                label="Gold"
                current={hero.gold}
                min={0}
                onPropose={(value) => patch("set_gold", { hero_id: hero.id, value })}
              />
              <ValueStepper
                label="Level"
                current={hero.level}
                min={1}
                max={8}
                onPropose={(value) => patch("set_level", { hero_id: hero.id, value })}
              />
              {ITEM_STATS.filter((stat) => Number(hero.items[stat] ?? 0) > 0).map((stat) => (
                <ValueStepper
                  key={stat}
                  label={`${statLabel(stat)} items`}
                  current={Number(hero.items[stat])}
                  min={0}
                  onPropose={(value) => patch("set_item", { hero_id: hero.id, stat, value })}
                />
              ))}
              <div className={styles.stepperRow}>
                <span className={styles.stepperLabel}>Add item</span>
                <div className={styles.segmented}>
                  {ITEM_STATS.filter((stat) => !(Number(hero.items[stat] ?? 0) > 0)).map((stat) => (
                    <button
                      key={stat}
                      type="button"
                      className={styles.segment}
                      onClick={() => patch("set_item", { hero_id: hero.id, stat, value: 1 })}
                    >
                      {statLabel(stat)}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.stepperRow}>
                <span className={styles.stepperLabel}>Swap upgrade with item</span>
                <div className={styles.segmented}>
                  {UPGRADE_SLOTS.map(({ color, tier }) => (
                    <button
                      key={`${color}-${tier}`}
                      type="button"
                      className={styles.segment}
                      onClick={() => patch("swap_item_card", { hero_id: hero.id, color, tier })}
                    >
                      {statLabel(color)} {tier}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}

      <div className={styles.valueGroup}>
        <span className={styles.cardZoneTitle}>Board</span>
        {lanes.map(([laneId, count]) => (
          <ValueStepper
            key={laneId}
            label={laneLabel(view, laneId)}
            current={count}
            min={0}
            onPropose={(value) => patch("set_wave_counter", { lane_id: laneId, value })}
          />
        ))}
        <div className={styles.stepperRow}>
          <span className={styles.stepperLabel}>Tie-breaker</span>
          <div className={styles.segmented} role="radiogroup" aria-label="Tie-breaker team">
            {Object.keys(view.teams).map((teamId) => (
              <button
                key={teamId}
                type="button"
                role="radio"
                aria-checked={view.tie_breaker_team === teamId}
                className={view.tie_breaker_team === teamId ? styles.segmentActive : styles.segment}
                disabled={view.tie_breaker_team === teamId}
                onClick={() => patch("set_tie_breaker_team", { team: teamId })}
              >
                {teamLabel(teamId)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdvancedTab({
  onPropose,
  preloadedSchema,
}: {
  onPropose: (payload: OverrideProposalPayload) => void;
  preloadedSchema?: OverrideSchemaResponse;
}) {
  const [schema, setSchema] = useState<OverrideSchemaResponse | null>(preloadedSchema ?? null);
  const [error, setError] = useState<string | null>(null);
  const [opName, setOpName] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (schema) return;
    let cancelled = false;
    fetchOverrideSchema()
      .then((data) => {
        if (!cancelled) setSchema(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [schema]);

  const ops = useMemo(
    () => (schema?.ops ?? []).filter((op) => op.family === "patch" && !CURATED_OPS.has(op.name)),
    [schema],
  );
  const selected: OverrideOpSchema | undefined = ops.find((op) => op.name === opName);
  const properties = (selected?.args_schema.properties ?? {}) as Record<
    string,
    { type?: string; anyOf?: Array<{ type?: string }> }
  >;

  const buildArgs = (): Record<string, unknown> | null => {
    const args: Record<string, unknown> = {};
    for (const [name, prop] of Object.entries(properties)) {
      const raw = fields[name] ?? "";
      if (raw === "") continue;
      const kind = prop.type ?? prop.anyOf?.find((entry) => entry.type)?.type;
      if (kind === "integer" || kind === "number") {
        args[name] = Number(raw);
      } else if (kind === "object" || kind === "array" || kind === undefined) {
        try {
          args[name] = JSON.parse(raw);
        } catch {
          setFieldError(`"${name}" must be valid JSON`);
          return null;
        }
      } else {
        args[name] = raw;
      }
    }
    for (const required of selected?.args_schema.required ?? []) {
      if (!(required in args)) {
        setFieldError(`"${required}" is required`);
        return null;
      }
    }
    return args;
  };

  if (error) {
    return (
      <div className={styles.section}>
        <p className={styles.warning}>{error}</p>
        <button type="button" onClick={() => setError(null)}>
          Retry
        </button>
      </div>
    );
  }
  if (!schema) {
    return <div className={styles.section}>Loading op catalogue…</div>;
  }

  return (
    <div className={styles.section}>
      <div className={styles.formRow}>
        <label>Operation</label>
        <select
          value={opName}
          onChange={(event) => {
            setOpName(event.target.value);
            setFields({});
            setFieldError(null);
          }}
        >
          <option value="">Choose…</option>
          {ops.map((op) => (
            <option key={op.name} value={op.name}>
              {op.label}
            </option>
          ))}
        </select>
      </div>
      {selected && <p className={styles.opDescription}>{selected.description}</p>}
      {selected &&
        Object.entries(properties).map(([name, prop]) => {
          const kind = prop.type ?? prop.anyOf?.find((entry) => entry.type)?.type;
          const isJson = kind === "object" || kind === "array" || kind === undefined;
          return (
            <div className={styles.formRow} key={name}>
              <label>{name}</label>
              {isJson ? (
                <textarea
                  rows={3}
                  placeholder="JSON"
                  value={fields[name] ?? ""}
                  onChange={(event) =>
                    setFields((prev) => ({ ...prev, [name]: event.target.value }))
                  }
                />
              ) : (
                <input
                  type={kind === "integer" || kind === "number" ? "number" : "text"}
                  value={fields[name] ?? ""}
                  onChange={(event) =>
                    setFields((prev) => ({ ...prev, [name]: event.target.value }))
                  }
                />
              )}
            </div>
          );
        })}
      {fieldError && <p className={styles.warning}>{fieldError}</p>}
      {selected && (
        <button
          type="button"
          className={styles.primary}
          onClick={() => {
            setFieldError(null);
            const args = buildArgs();
            if (args) onPropose({ family: "patch", op: selected.name, args });
          }}
        >
          Review proposal
        </button>
      )}
    </div>
  );
}

function UnstickTab({
  heroes,
  onPropose,
}: {
  heroes: Array<{ id: string; name: string }>;
  onPropose: (payload: OverrideProposalPayload) => void;
}) {
  const [actorId, setActorId] = useState(heroes[0]?.id ?? "");
  const unstick = (op: string, args: Record<string, unknown> = {}) =>
    onPropose({ family: "unstick", op, args });

  return (
    <div className={styles.section}>
      <button type="button" className={styles.rowButton} onClick={() => unstick("skip_input")}>
        <strong>Skip the stuck input</strong>
        <small>Answer the wedged prompt with SKIP and move on.</small>
      </button>
      <button type="button" className={styles.rowButton} onClick={() => unstick("abort_action")}>
        <strong>Abort the current action</strong>
        <small>Unwind the wedged action through the normal abort path.</small>
      </button>
      <button type="button" className={styles.rowButton} onClick={() => unstick("end_turn")}>
        <strong>Force the turn to end</strong>
        <small>Discard the stuck work and finalize the current hero's turn.</small>
      </button>
      <div className={styles.placeRow}>
        <div className={styles.rowText}>
          <strong>Fix whose turn it is</strong>
          <small>Set the current actor when turn order itself went wrong.</small>
        </div>
        <div className={styles.placeControls}>
          <select value={actorId} onChange={(event) => setActorId(event.target.value)}>
            {heroes.map((hero) => (
              <option key={hero.id} value={hero.id}>
                {hero.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => unstick("force_actor", { hero_id: actorId })}
          >
            Set actor
          </button>
        </div>
      </div>
    </div>
  );
}

function RewindTab({
  gameId,
  token,
  onPropose,
  preloadedHistory,
}: {
  gameId: string;
  token: string;
  onPropose: (payload: OverrideProposalPayload) => void;
  preloadedHistory?: OverrideHistoryResponse;
}) {
  const [history, setHistory] = useState<OverrideHistoryResponse | null>(
    preloadedHistory ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (history) return;
    let cancelled = false;
    fetchOverrideHistory(gameId, token)
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [history, gameId, token]);

  if (error) {
    return (
      <div className={styles.section}>
        <p className={styles.warning}>{error}</p>
        <button type="button" onClick={() => setError(null)}>
          Retry
        </button>
      </div>
    );
  }
  if (!history) {
    return <div className={styles.section}>Loading decision history…</div>;
  }

  return (
    <div className={styles.section}>
      <p className={styles.opDescription}>
        Click a decision to rewind to the moment <em>before</em> it happened.
        Greyed rows were already undone by an earlier rewind.
      </p>
      <ul className={styles.historyList}>
        {history.decisions.map((decision) => (
          <li
            key={decision.index}
            className={[
              styles.historyRow,
              decision.superseded ? styles.superseded : "",
              decision.type === "ov_rewind" ? styles.rewindMarker : "",
            ].join(" ")}
          >
            <button
              type="button"
              disabled={decision.type === "ov_rewind"}
              onClick={() => onPropose({ family: "rewind", to: decision.index })}
              title={
                decision.superseded
                  ? "superseded — already undone by a rewind"
                  : `Rewind to before decision ${decision.index}`
              }
            >
              <span className={styles.historyIndex}>#{decision.index}</span>
              <span className={styles.historyMeta}>
                R{decision.round ?? "?"} T{decision.turn ?? "?"}
              </span>
              <span className={styles.historyLabel}>{decision.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
