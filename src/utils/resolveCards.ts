import type { CardView, GameView, Hex, HeroView, InputOption } from "../types/game";

export interface ResolvedCard {
  card: CardView;
  /** Owning hero id, e.g. "hero_ursafar" — derive the art slug from it. */
  ownerHeroId: string;
}

/** A selectable option whose id has no CardView in this viewer's masked view
 * (e.g. a non-owner caster picking from Gydion's hidden spellbook); the
 * backend supplies a display name in the request instead. */
export interface LabeledOption {
  id: string;
  text: string;
}

/** Hero slug used to load that hero's card art / logo (e.g. "ursafar"). */
export function heroSlug(heroId: string): string {
  return heroId.toLowerCase().replace(/^hero_/, "");
}

// Every zone of a hero that can hold a full CardView. `deck` is included only
// when it's the array form (a face-up/known deck); the { count } form is skipped.
function* heroCards(hero: HeroView): Generator<CardView> {
  yield* hero.hand;
  for (const c of hero.played_cards) if (c) yield c;
  if (hero.current_turn_card) yield hero.current_turn_card;
  // Emmitt's Alternative Timelines: this is the other committed card during
  // two-card Planning, then the second revealed card until the retrieve choice.
  if (hero.extra_turn_card) yield hero.extra_turn_card;
  yield* hero.discard_pile;
  if (hero.ultimate_card) yield hero.ultimate_card;
  if (Array.isArray(hero.deck)) yield* hero.deck;
  // Gydion: prepared spells are full cards only in the owner's view (the
  // { count } form is skipped); spells outside the spellbook are public.
  if (Array.isArray(hero.spellbook)) yield* hero.spellbook;
  yield* hero.cast_spells ?? [];
}

/**
 * Resolve SELECT_CARD option ids to their CardView and owning hero across every
 * zone (any hero's hand, board/active cards, current turn card, discard,
 * ultimate, known deck, spellbook, or cast spells). Returns matches in the
 * given option order; ids that resolve to nothing are dropped so a stray id
 * can't blank the picker.
 */
export function resolveSelectableCards(
  view: GameView,
  ids: (string | number | Hex)[],
): ResolvedCard[] {
  const byId = new Map<string, ResolvedCard>();
  for (const team of Object.values(view.teams)) {
    for (const hero of team.heroes) {
      for (const card of heroCards(hero)) {
        if (!byId.has(card.id)) byId.set(card.id, { card, ownerHeroId: hero.id });
      }
    }
  }

  const resolved: ResolvedCard[] = [];
  for (const id of ids) {
    const match = byId.get(String(id));
    if (match) resolved.push(match);
    else console.warn(`[resolveSelectableCards] no card found for option "${id}"`);
  }
  return resolved;
}

/**
 * Option ids the view cannot resolve to a card, labelled from the request's
 * `options` metadata. Happens when the chooser is picking cards masked in
 * their view — the backend sends `{id, text}` alongside `valid_options` so
 * the client can still render named choices.
 */
export function unresolvedLabeledOptions(
  resolved: ResolvedCard[],
  ids: (string | number | Hex)[],
  options: (InputOption | string)[] | undefined,
): LabeledOption[] {
  const resolvedIds = new Set(resolved.map((r) => r.card.id));
  const labels = new Map<string, string>();
  for (const opt of options ?? []) {
    if (typeof opt !== "string" && typeof opt.text === "string") labels.set(opt.id, opt.text);
  }
  return ids
    .map(String)
    .filter((id) => !resolvedIds.has(id))
    .map((id) => ({ id, text: labels.get(id) ?? id }));
}
