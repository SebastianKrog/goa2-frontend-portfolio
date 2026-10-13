# 3D SELECT_CARD overlay — design

Date: 2026-06-05

## Problem

In the 3D board, a `SELECT_CARD` input request is answered by clicking the real
glowing card **in your hand** (`GameView.tsx`, `cardPickActive` →
`selectableCardIds` resolved against `myHero.hand`). But a card option can live
in zones other than your hand — most commonly an **active card** in some hero's
`played_cards`. Example:

```json
{
  "type": "SELECT_CARD",
  "prompt": "Select an active card with an active effect to perform its primary action.",
  "player_id": "hero_ursafar",
  "valid_options": ["prowling_brute"]
}
```

`prowling_brute` is an active card on the board, not in hand. Nothing in the
hand matches, so nothing glows and `PickerDock` builds zero buttons for
`SELECT_CARD`. The decision is unanswerable.

## Goal

Render the selectable cards as painted GUI cards (like the Alt-hover enlarged
preview) that the player clicks to pick — working for cards in **any** zone
(your board, an opponent's board, your discard, an opponent's discard, hand).

## Decisions (from brainstorming)

- **Unified tray for all SELECT_CARD picks.** Always render a GUI tray, whether
  the options are in hand or not. Retires the in-place hand-glow path for
  `SELECT_CARD`. (Safe: normal card play during PLANNING uses its own
  `selectedCardId` + `commitCard` flow, not a `SELECT_CARD` input request — so
  only effect-driven card picks are affected.)
- **Centered overlay row.** Dimmed full-screen backdrop, prompt above, candidate
  cards laid out large and centered. Modal-like, full focus.
- **No per-card provenance label.** Just the painted card art. No owner/zone
  caption.

## Approach A (chosen)

A dedicated centered-overlay component fed by a small cross-zone resolver.
`SELECT_CARD` stops routing through PickerDock / HandRow-glow and renders this
overlay instead. Keeps planning and defense flows untouched.

### 1. Cross-zone resolver — `src/utils/resolveCards.ts`

```ts
resolveSelectableCards(view: GameView, ids: (string | number)[])
  : { card: CardView; ownerHeroId: string }[]
```

- Scans every hero across all teams over: `hand`, `played_cards` (non-null),
  `current_turn_card`, `discard_pile`, `ultimate_card`, and `deck` when it is an
  array (skip the `{ count }` form).
- Returns matches in `valid_options` order.
- `ownerHeroId` lets the caller derive the slug
  (`id.toLowerCase().replace(/^hero_/, "")`) so each card paints from the right
  hero's art folder.
- IDs that resolve to nothing are skipped (logged once) so a stray ID can't
  blank the whole overlay.

### 2. `CardSelectOverlay.tsx` — `src/components/board3d/hud/`

- Fixed full-screen dimmed backdrop using the glass design tokens; prompt at top
  via `hud.accentText`.
- Centered row of cards painted with `CardCanvas` at the existing lifted size.
  Reuse the `?handcardvh` sizing logic — extract the size computation into a tiny
  shared helper so HandRow and the overlay agree. Cards wrap if there are many.
- Hover lifts / brightens a card; click submits that card's ID via `onSelect`.
- Footer: **Undo** when `can_rollback`, **Skip** when `can_skip`.
- Keyboard: number keys `1..9` pick the Nth card; `Esc` triggers Undo when
  available.

### 3. Routing changes — `GameView.tsx`

- Drop `cardPickActive` from the `PickerDock` render condition and stop passing
  `selectableCardIds` to `HandRow` (retires the hand-glow path for
  `SELECT_CARD`).
- Render `<CardSelectOverlay>` when
  `use3D && isMyInput && inputRequest.type === "SELECT_CARD"`, fed by the
  resolver; `onSelect` → `submitInput(id)`, `onRollback` → `rollback`,
  `onSkip` → `submitInput("SKIP")`.
- `SELECT_CARD_OR_PASS` (defense) stays on `DefenseDock` — its options are
  always hand cards carrying block/read verdicts, a different interaction.

## Out of scope

- Defense flow (`SELECT_CARD_OR_PASS` / DefenseDock).
- The legacy 2D path.
- Opponents' facedown cards: if the backend offers a facedown card as an option,
  `CardCanvas` already renders the hero-logo back gracefully.

## Components & boundaries

| Unit | Does | Depends on |
| --- | --- | --- |
| `resolveSelectableCards` | Map option IDs → `{ card, ownerHeroId }` across all zones | `GameView`/`CardView` types only (pure) |
| `CardSelectOverlay` | Present resolved cards, take the pick, undo/skip | `CardCanvas`, glass tokens, shared lift-size helper |
| `GameView` wiring | Route `SELECT_CARD` to the overlay | the two above + `submitInput`/`rollback` |
