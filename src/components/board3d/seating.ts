import type { GameView, HeroView } from "../../types/game";
import { CARD_H, CARD_W } from "./cards/paintCard";

export type PlayerBoardLayout = "interleaved" | "grouped" | "rows";

const LAYOUT_CYCLE: PlayerBoardLayout[] = ["interleaved", "grouped", "rows"];

export function nextPlayerBoardLayout(current: PlayerBoardLayout): PlayerBoardLayout {
  const i = LAYOUT_CYCLE.indexOf(current);
  return LAYOUT_CYCLE[(i + 1) % LAYOUT_CYCLE.length];
}

export const DEFAULT_PLAYER_BOARD_LAYOUT: PlayerBoardLayout = "rows";

export function parsePlayerBoardLayout(stored: string | null | undefined): PlayerBoardLayout {
  const match = LAYOUT_CYCLE.find((layout) => layout === stored);
  return match ?? DEFAULT_PLAYER_BOARD_LAYOUT;
}

export interface SeatPlacement {
  hero: HeroView;
  heroSlug: string;
  imagePath: string;
  position: [number, number, number];
  rotationY: number;
  scale: number;
}

/**
 * A board is wider than its mat art: the deck, ultimate, spellbook and status
 * satellites reach roughly this far to either side of the seat, so neighbours
 * must clear this, not the 4.5-wide mat.
 */
const BOARD_SPAN = 7.4;
const BOARD_HALF_SPAN = BOARD_SPAN / 2;
/** Committed cards float out to ~2.14 in front; the mat itself is 2.25 deep. */
export const BOARD_HALF_DEPTH = 2.2;
const GAP = 0.3;

/** MapPlane draws the board at imageSize 10, so it reaches this far in x. */
export const MAP_HALF_WIDTH = 5;

const RING_RADIUS = 8;
const RING_RADIUS_LARGE = 9.3;

const MAT_Y = 0.02;

/**
 * Rows of three per team plus two flanks, mirroring the Tabletop Simulator
 * mod: a team fills its row from the centre outward, then takes the two
 * flanking seats on its own half of the table.
 */
const FLANK_Z = BOARD_HALF_SPAN + GAP;
/** Far enough out to leave the turn-card strip a lane against the map edge. */
const FLANK_X = 9;
const ROW_Z = RING_RADIUS;
/** Flanks lie broadside-on, so the row has to retreat to clear their span. */
const ROW_Z_WITH_FLANKS = FLANK_Z + BOARD_HALF_SPAN + BOARD_HALF_DEPTH + GAP;

const matKeyOf = (hero: HeroView) => hero.id.toLowerCase().replace(/^hero_/, "");

function place(hero: HeroView, x: number, z: number, rotationY: number, scale: number): SeatPlacement {
  const heroSlug = matKeyOf(hero);
  return {
    hero,
    heroSlug,
    imagePath: `/mats/${heroSlug}_front.webp`,
    position: [x, MAT_Y, z],
    rotationY,
    scale,
  };
}

/** Split the roster into your team (you first) and everyone else. */
export function heroesByTeam(view: GameView, myHeroId: string | null): { own: HeroView[]; other: HeroView[] } {
  let myTeam: string | null = null;
  if (myHeroId) {
    for (const team of Object.values(view.teams ?? {})) {
      if (team.heroes.some((h) => h.id === myHeroId)) {
        myTeam = team.color;
        break;
      }
    }
  }

  const ownTeam: HeroView[] = [];
  const otherTeams: HeroView[] = [];
  for (const team of Object.values(view.teams ?? {})) {
    for (const hero of team.heroes) {
      if (myTeam !== null && team.color === myTeam) ownTeam.push(hero);
      else otherTeams.push(hero);
    }
  }
  ownTeam.sort((a, b) => a.id.localeCompare(b.id));
  if (myHeroId) {
    const youIdx = ownTeam.findIndex((h) => h.id === myHeroId);
    if (youIdx > 0) {
      const [you] = ownTeam.splice(youIdx, 1);
      ownTeam.unshift(you);
    }
  }
  otherTeams.sort((a, b) => a.id.localeCompare(b.id));
  return { own: ownTeam, other: otherTeams };
}

function ringOrder(ownTeam: HeroView[], otherTeams: HeroView[], layout: PlayerBoardLayout): HeroView[] {
  if (layout === "grouped") {
    if (ownTeam.length === 0) return [...otherTeams];
    // Keep your seat anchored while wrapping allies around it: one side
    // fills clockwise, enemies occupy the far side, then the other side.
    const allies = ownTeam.slice(1);
    const nearSideCount = Math.ceil(allies.length / 2);
    return [
      ownTeam[0],
      ...allies.slice(0, nearSideCount),
      ...otherTeams,
      ...allies.slice(nearSideCount),
    ];
  }
  // Interleave to alternate teams around the ring: own[0], other[0], own[1], ...
  const ordered: HeroView[] = [];
  const len = Math.max(ownTeam.length, otherTeams.length);
  for (let i = 0; i < len; i++) {
    if (i < ownTeam.length) ordered.push(ownTeam[i]);
    if (i < otherTeams.length) ordered.push(otherTeams[i]);
  }
  return ordered;
}

function ringPlacements(ordered: HeroView[]): SeatPlacement[] {
  // Large tables need more tangential room for each board's deck and discard
  // sections, not just for the mat itself. Scale the whole local board around
  // its seat so 4v4/5v5 stays legible without overlap.
  const radius = ordered.length > 6 ? RING_RADIUS_LARGE : RING_RADIUS;
  const seatSpacing = ordered.length > 1
    ? 2 * radius * Math.sin(Math.PI / ordered.length)
    : Infinity;
  const scale = ordered.length > 6 ? Math.min(1, (seatSpacing / BOARD_SPAN) * 0.92) : 1;
  return ordered.map((hero, i) => {
    const theta = (i / ordered.length) * Math.PI * 2;
    return place(hero, radius * Math.sin(theta), radius * Math.cos(theta), theta, scale);
  });
}

/** Seat slots for one team, in fill order, on the half of the table given by `sign`. */
function rowSlots(count: number, sign: 1 | -1): Array<{ x: number; z: number; rotationY: number }> {
  const rowZ = sign * (count > 3 ? ROW_Z_WITH_FLANKS : ROW_Z);
  const rowFacing = sign > 0 ? 0 : Math.PI;
  const row = (x: number) => ({ x, z: rowZ, rotationY: rowFacing });
  if (count === 2) return [row(-BOARD_SPAN / 2), row(BOARD_SPAN / 2)];
  const slots = [row(0), row(-BOARD_SPAN), row(BOARD_SPAN)];
  if (count > 3) {
    // A mat faces along its local -y axis, which world-space rotationY spins:
    // -π/2 looks toward +x, so the left flank turns in toward the map.
    slots.push({ x: -FLANK_X, z: sign * FLANK_Z, rotationY: -Math.PI / 2 });
    slots.push({ x: FLANK_X, z: sign * FLANK_Z, rotationY: Math.PI / 2 });
  }
  // Beyond a full table the row simply keeps growing outward.
  for (let i = slots.length; i < count; i++) {
    const step = Math.floor((i - slots.length) / 2) + 2;
    const side = (i - slots.length) % 2 === 0 ? -1 : 1;
    slots.push(row(side * step * BOARD_SPAN));
  }
  return slots.slice(0, count);
}

function rowPlacements(ownTeam: HeroView[], otherTeams: HeroView[]): SeatPlacement[] {
  let near = ownTeam;
  let far = otherTeams;
  if (ownTeam.length === 0) {
    // Spectators and replays have no own team; recover the real team rows.
    const byTeam = new Map<string, HeroView[]>();
    for (const hero of otherTeams) {
      const team = byTeam.get(hero.team);
      if (team) team.push(hero);
      else byTeam.set(hero.team, [hero]);
    }
    const spectatorTeams = [...byTeam.values()];
    near = spectatorTeams[0] ?? [];
    far = spectatorTeams.slice(1).flat();
  }
  const seat = (heroes: HeroView[], sign: 1 | -1) => {
    const slots = rowSlots(heroes.length, sign);
    return heroes.map((hero, i) => place(hero, slots[i].x, slots[i].z, slots[i].rotationY, 1));
  };
  return [...seat(near, 1), ...seat(far, -1)];
}

/**
 * Where each hero's board sits on the table, ordered with your own hero first.
 * `interleaved` and `grouped` ring the map; `rows` mirrors the Tabletop
 * Simulator mod, with each team in a row on its own half.
 */
export function seatPlacements(
  view: GameView | null | undefined,
  myHeroId: string | null,
  layout: PlayerBoardLayout,
): SeatPlacement[] {
  if (!view) return [];
  const { own: ownTeam, other: otherTeams } = heroesByTeam(view, myHeroId);
  if (ownTeam.length === 0 && otherTeams.length === 0) return [];
  if (layout === "rows") return rowPlacements(ownTeam, otherTeams);
  return ringPlacements(ringOrder(ownTeam, otherTeams, layout));
}

/**
 * The turn-card strip: a copy of every committed card gathered beside the map,
 * after the Tabletop Simulator mod's autoCard row. Each hero keeps a permanent
 * slot so a card never moves once it lands.
 */
export const TURN_CARD_WIDTH = 0.45;
const TURN_CARD_HEIGHT = TURN_CARD_WIDTH * (CARD_H / CARD_W);
const STRIP_Y = 0.05;
const STRIP_ROW_GAP = 0.08;
const STRIP_COLUMN_GAP = 0.1;
const STRIP_INNER_X = -(MAP_HALF_WIDTH + GAP + TURN_CARD_WIDTH / 2);
const STRIP_OUTER_X = STRIP_INNER_X - (TURN_CARD_WIDTH + STRIP_COLUMN_GAP);

export interface TurnCardSlot {
  hero: HeroView;
  position: [number, number, number];
}

/**
 * One slot per seated hero, your team in the outer column. Slots come from the
 * seating alone, so a hero holds the same spot whether or not they have
 * committed.
 */
export function turnCardStripSlots(placements: SeatPlacement[]): TurnCardSlot[] {
  const columns: HeroView[][] = [];
  const columnOf = new Map<string, number>();
  for (const { hero } of placements) {
    let index = columnOf.get(hero.team);
    if (index === undefined) {
      index = columns.length;
      columnOf.set(hero.team, index);
      columns.push([]);
    }
    columns[index].push(hero);
  }

  const slots: TurnCardSlot[] = [];
  columns.forEach((heroes, index) => {
    const x = index === 0 ? STRIP_OUTER_X : STRIP_INNER_X;
    const pitch = TURN_CARD_HEIGHT + STRIP_ROW_GAP;
    heroes.forEach((hero, i) => {
      const z = (i - (heroes.length - 1) / 2) * pitch;
      slots.push({ hero, position: [x, STRIP_Y, z] });
    });
  });
  return slots;
}

/** The slab every game has shipped with; the table only ever grows past it. */
export const MIN_TABLE_HALF_EXTENT = 11;

/**
 * How far the table has to reach to hold every board. `boardReach` is the
 * distance from a seat to its furthest piece in board-local units, which the
 * board's own scale shrinks along with everything else around that seat.
 */
export function tableHalfExtent(placements: SeatPlacement[], boardReach: number): number {
  let extent = MIN_TABLE_HALF_EXTENT;
  for (const { position, scale } of placements) {
    const seat = Math.max(Math.abs(position[0]), Math.abs(position[2]));
    extent = Math.max(extent, seat + boardReach * scale);
  }
  return extent;
}
