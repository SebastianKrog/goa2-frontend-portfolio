# 3D HUD Restyle — Design (M8)

**Date:** 2026-05-31
**Branch:** `3d-board-rework`
**Status:** Design — agreed in brainstorm, pending review of the minor sections.

## Problem

In the 3D view, the decision HUD is the ported 2D `OptionPicker` + `PromptBanner`. They are
shared with the 2D path and styled with the 2D dashboard's CSS vars (`--bg-secondary`,
`--border`), so over the dark tabletop they read as flat light panels that don't belong to the
scene. Worse, `OptionPicker`'s `.overlay` is pinned `bottom:0`, centered, `z-index:1000`, while
`HandRow` is also `bottom:0`, centered, `z-index:50` — the picker physically covers the hand fan.
The "peek" eye-button (hold to see the board) exists only because the picker eats the screen; it's
a symptom, not a feature to keep.

This is the M8 "pickers styled to match table aesthetic" item, expanded once we realised a pure
reskin leaves the awkward parts (text-list-of-card-names, peek button, overlap) intact.

## Principles

- **Decisions appear where attention already is.** During a turn that's the board + your seat
  (bottom), not a peripheral corner.
- **Card decisions belong on the cards.** The board already does this — `HexOverlay` highlights
  valid hexes and you click the real hex. Card decisions should mirror that: glow the real cards,
  click the real card. No text list of card names.
- **Mirror the engine's certainty, never fake it.** For defense we re-present the *existing,
  correct* 2D classification (can-block / can't-block / primary-defense-read-it) — no new source
  of truth, no backend change.
- **Don't fight the hand fan for space.** The bottom belongs to the hand; the decision strip
  either sits clear of it or makes the hand recede while it's up.
- **Build 3D-specific components; leave the 2D path untouched.** New `PromptDock` / `PickerDock`
  (and helpers) under `board3d/hud/`. The shared `OptionPicker`/`PromptBanner` stay as-is until
  the 2D `HexGrid` branch is deleted (later in M8).

## Decision taxonomy

The picker currently handles every non-board decision in one component. We split by *nature*:

| Kind | Types | 3D home |
|------|-------|---------|
| **Card choice** | `SELECT_CARD`, `SELECT_CARD_OR_PASS` (defense) | Glow the real hand cards; click to choose |
| **Abstract choice** | `CHOOSE_ACTION`, `SELECT_OPTION`, `SELECT_NUMBER`, `CONFIRM_PASSIVE`, `CHOOSE_ACTOR`, `CHOOSE_RESPAWN`, `FAST_TRAVEL` | Compact bottom-center strip; hand recedes while open |
| **Between-rounds** | `UPGRADE_PHASE` | Centered modal (kept), reskinned |
| **Board choice** | `SELECT_HEX/UNIT/UNIT_OR_TOKEN`, `CHOOSE_RESPAWN_HEX` | Already handled by `HexOverlay` (unchanged) |

## Visual language (agreed: dark translucent glass + warm accents)

- Frosted dark-glass chrome (`backdrop-filter: blur`, low-alpha dark fill) that lets the tabletop
  show through.
- Warm accents reusing the existing gold/`--phase-resolution` accent; a hint of parchment texture
  on the readout surface.
- Soft drop shadow to lift surfaces off the scene without hard borders.
- This is ~80% of an in-world feel at a fraction of diegetic-art cost, and won't visually fight the
  M6 animation work. (Full diegetic materials are a possible later investment; near-invisible HUD
  rejected — affordance matters for decisions under pressure.)

## Card decisions — glow on the real cards

`HandRow` gains a "selectable" mode driven by the active input request:

- Selectable cards glow (gold for a plain `SELECT_CARD`); non-selectable cards dim.
- Hover lifts the card (existing lift logic); click submits the choice
  (`{ hero_id, card_id }`, same payload `OptionPicker` sends today).
- For `SELECT_CARD` outside defense, that's the whole interaction — no panel.

### Defense (`SELECT_CARD_OR_PASS`) — the rich case

Re-presents the **existing, correct** 2D logic (`OptionPicker.tsx` `canBlock`/primary-defense
detection). **No backend change.** Three states, shown as card glows:

- **Can block** (`defense_value ≥ defense_needed`) → green ✓ glow + defense number on the card.
- **Can't block** (insufficient) → dimmed / desaturated, red ✗. Demoted, not an equal option.
- **Primary defense** (`primary_action` ∈ {`DEFENSE`, `DEFENSE_SKILL`}) → neutral "read it"
  treatment (distinct shield, no green/red verdict), effect text surfaced legibly. Mirrors the 2D
  `"Primary Defense"` badge — the engine/frontend doesn't assert a verdict; the player reads and
  judges (conditional effects like "blocks ranged only", "+2 if ally in range 3").

Supporting elements in the strip:

- **Combat readout**, framed as a situation not a stat sheet:
  `⚔ {attacker} attacks — need {defense_needed} to block` (carry `minion_modifier` when nonzero).
- **PASS** as a distinct, danger-styled action. When no card can fully block (today's
  "consider passing" warning), PASS becomes the emphasized/expected action and the warning rides
  with it.
- **Hover** reflects the hovered card's state in the readout (green → "blocked"; primary-defense →
  shows its effect; insufficient → stays demoted). Click commits.

Board context: the M6 combat lunge already draws the eye to the attacked unit; optionally anchor
the readout over that unit later (not required for v1).

## Abstract choices — the bottom strip (`PickerDock`)

- Compact, centered, low — sits in the glass language above where the hand rests.
- **Hand recedes** (slides down / dims) while the strip is open. Safe because during an abstract
  decision your hand is irrelevant (your card is already committed). Reverts when the decision
  clears. Card decisions, by contrast, keep the hand up and glowing.
- Layout: prompt text as a slim line at the top of the strip; option buttons in a row (wrap if
  many); `Skip` / `Undo` as secondary buttons when `can_skip` / `can_rollback`.
- `SELECT_NUMBER`: render the numeric options as a tight row of number chips (fall back to the
  `options` list when the engine supplies labelled options).
- `CHOOSE_ACTION`: action buttons reuse the existing action colour coding
  (Movement/Attack/Skill/Defense) so they read consistently with the cards.
- The **peek button is removed** — nothing covers the board anymore.

## Upgrade phase — modal (`UpgradeModal`)

Keep the centered, dim-backdrop modal (it's between-rounds, deserves focus). Reskin to the glass
language; keep the existing card-pair layout, tooltips, "remaining" count, and waiting-for-players
footer. Lowest-risk piece — mostly a CSS reskin of `overlayUpgrade`/`pickerUpgrade`.

## Wiring

In `GameView.tsx`, the 3D branch currently renders the shared `PromptBanner`/`OptionPicker` over
both boards (lines ~260–277). For the 3D path:

- Route the request by type to the new components (`PickerDock` / card-glow mode / `UpgradeModal`).
- Thread the same callbacks already in place: `handleOptionSelect`, `handleCardSelect`-equivalent
  (`{hero_id, card_id}`), `rollback`, `handleSkip`, `onPreviewHexes`.
- The 2D branch keeps using `OptionPicker`/`PromptBanner` unchanged.

## Out of scope (this design)

- No backend / protocol changes (defense reuses existing fields).
- Diegetic in-world materials (possible later).
- Anchoring readouts to 3D units (optional later enhancement).
- The other M8 items (lighting/material polish, "your seat" cinematic, 2D deletion + `?3d=1`
  default flip) are tracked separately.

## Open / defaulted (confirm on review)

- Exact glass tokens (blur radius, fill alpha, accent gold hex) — to tune in-browser via the
  usual checkpoint workflow.
- Whether the hand "recede" is a slide, a dim, or both.
- `CHOOSE_ACTOR` / `CHOOSE_RESPAWN` presentation — treated as plain abstract buttons for now.
