# 3D HUD Restyle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the ported-2D decision HUD in the 3D view with table-native components — card decisions happen on the real cards, abstract choices live in a compact glass dock that doesn't fight the hand fan, and defense re-presents the existing correct logic as on-card states.

**Architecture:** New 3D-only components under `src/components/board3d/hud/` (`PickerDock`, `UpgradeModal`) plus a "selectable" mode on `HandRow`. The shared `src/components/ui/OptionPicker.tsx` + `PromptBanner.tsx` stay UNTOUCHED so the 2D path keeps working until the 2D `HexGrid` branch is deleted later in M8. Defense sufficiency logic is extracted from `OptionPicker` into a shared `src/utils/defense.ts` so 2D and 3D share one source of truth (DRY). Visual language: dark translucent "glass" + warm gold/parchment accents.

**Tech Stack:** React + TypeScript, React Three Fiber / drei for the 3D scene, CSS modules for HUD chrome (HUD is regular DOM overlaid on the canvas, not in-scene).

**Verification model:** This project has no front-end component test harness (the `goa2-card-effect-tests` skill is backend Python only). Each task verifies by: (1) `npm run build` passes (tsc -b — enforces noUnusedLocals/Parameters, this is what deploy runs), then (2) an in-browser checkpoint at `?3d=1` (and `?3d=1&calibrate=1` where relevant) which the USER validates before the commit is kept. Hold all pushes until the user asks. Do NOT include this plan file or the design doc in any commit.

**Design doc:** `docs/plans/2026-05-31-3d-hud-restyle-design.md`

---

### Task 1: Glass design tokens

Shared CSS variables + helper classes for every HUD surface, so the look is defined once.

**Files:**
- Create: `src/components/board3d/hud/hud.module.css`

**Step 1: Define the glass tokens + surface classes**

Create `hud.module.css` with the agreed visual language. CSS-module `:export`-free; expose reusable classes and a `glassVars` block applied at the dock root.

```css
/* Dark translucent "glass" + warm accents — the 3D HUD visual language. */
.glass {
  background: rgba(18, 16, 22, 0.62);
  backdrop-filter: blur(14px) saturate(1.1);
  -webkit-backdrop-filter: blur(14px) saturate(1.1);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-top: 1px solid rgba(255, 215, 128, 0.25); /* warm top edge catch */
  border-radius: 14px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255,255,255,0.04);
  color: #f2ece0; /* warm off-white */
}

/* warm accent + the three defense states, used by cards and dock alike */
:root {
  --hud-accent: #ffcf6b;          /* gold */
  --hud-accent-dim: rgba(255, 207, 107, 0.35);
  --hud-block: #5fd17a;           /* green — will block */
  --hud-fail: #d65b5b;            /* red — can't block */
  --hud-read: #6fc3e0;            /* cyan — primary defense, read it */
}

.accentText { color: var(--hud-accent); }
.parchment {
  background: linear-gradient(180deg, rgba(60,48,32,0.55), rgba(40,32,22,0.55));
  border: 1px solid rgba(255, 207, 107, 0.18);
  border-radius: 10px;
}
.dangerBtn {
  background: rgba(120, 36, 36, 0.55);
  border: 1px solid rgba(214, 91, 91, 0.6);
  color: #ffd9d9;
}
.secondaryBtn {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.12);
  color: #d8d2c6;
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS (an unused CSS module won't fail tsc, but confirm no syntax break elsewhere).

**Step 3: Commit**

```bash
git add src/components/board3d/hud/hud.module.css
git commit -m "feat(3d): glass HUD design tokens (M8)"
```

---

### Task 2: Extract shared defense classification (DRY)

Pull the block/can't-block/primary-defense logic out of `OptionPicker` so 2D and the new 3D code share it.

**Files:**
- Create: `src/utils/defense.ts`
- Modify: `src/components/ui/OptionPicker.tsx` (use the helper, behavior unchanged)

**Step 1: Write the helper**

```ts
import type { CardView } from "../types/game";

export type DefenseState = "BLOCKS" | "FAILS" | "PRIMARY";

export interface DefenseOptionInfo {
  state: DefenseState;
  /** secondary defense value, present for BLOCKS/FAILS (not PRIMARY) */
  defenseValue?: number;
  baseDefense?: number;
}

/** Re-presents the EXISTING 2D logic — single source of truth for both views. */
export function classifyDefenseOption(
  opt: { id: string; defense_value?: number; base_defense?: number },
  card: CardView | undefined,
  defenseNeeded: number | null | undefined,
): DefenseOptionInfo {
  const isPrimary =
    card?.primary_action === "DEFENSE" || card?.primary_action === "DEFENSE_SKILL";
  if (isPrimary) return { state: "PRIMARY" };

  const dv = opt.defense_value;
  const blocks =
    dv !== undefined &&
    defenseNeeded !== undefined &&
    defenseNeeded !== null &&
    dv >= defenseNeeded;
  return { state: blocks ? "BLOCKS" : "FAILS", defenseValue: dv, baseDefense: opt.base_defense };
}
```

**Step 2: Refactor `OptionPicker` to call it**

In the `SELECT_CARD_OR_PASS` branch (`OptionPicker.tsx:340-444`), replace the inline `isPrimaryDefense` / `canBlock` derivations with `classifyDefenseOption(...)`. Keep all rendering identical — this is a pure refactor.

**Step 3: Verify build + 2D regression**

Run: `npm run build` → PASS.
Browser checkpoint (2D, no `?3d=1`): trigger a defense decision; confirm green/red badges + "Primary Defense" label are unchanged.

**Step 4: Commit**

```bash
git add src/utils/defense.ts src/components/ui/OptionPicker.tsx
git commit -m "refactor: extract defense classification into shared util (M8)"
```

---

### Task 3: `PickerDock` — abstract choices in a glass dock

New component for the abstract decision types; replaces the 3D use of `OptionPicker`/`PromptBanner` for those types only.

**Files:**
- Create: `src/components/board3d/hud/PickerDock.tsx`
- Create: `src/components/board3d/hud/PickerDock.module.css`
- Modify: `src/components/pages/GameView.tsx` (route abstract types in the 3D branch)

**Step 1: Build `PickerDock`**

Handles `CHOOSE_ACTION`, `SELECT_OPTION`, `SELECT_NUMBER`, `CONFIRM_PASSIVE`, `CHOOSE_ACTOR`, `CHOOSE_RESPAWN`, `FAST_TRAVEL`. Props mirror what `OptionPicker` already receives (`inputRequest`, `view`, `myHeroId`, `onSelect`, `onRollback`, `onPreviewHexes`). Reuse the existing option-derivation logic from `OptionPicker` (copy the relevant `displayOptions` branches; the `SELECT_CARD`/defense branches do NOT belong here — those go to the hand in Tasks 4–5).

Layout: a centered, bottom-anchored glass card (`hud.module.css` `.glass`) sitting clear of the hand. Prompt text on top (`.accentText` slim line); option buttons in a wrapping row; `SELECT_NUMBER` renders numeric `valid_options` as a tight row of number chips; `CHOOSE_ACTION` buttons reuse the action color map from `OptionPicker` (`getActionClass`/`formatActionName` — extract these to a tiny shared `src/utils/actionLabels.ts` if cleaner). `Skip`/`Undo` as `.secondaryBtn` when `can_skip`/`can_rollback`. Keep `onPreviewHexes` hover wiring for option metadata. **No peek button.**

Positioning in CSS: `position: absolute; left: 50%; transform: translateX(-50%); bottom: 220px;` (above the resting hand fan — tune in browser).

**Step 2: Route in `GameView`**

Add type sets near `BOARD_INPUT_TYPES` (`GameView.tsx:20`):

```ts
const ABSTRACT_INPUT_TYPES = new Set([
  "CHOOSE_ACTION", "SELECT_OPTION", "SELECT_NUMBER", "CONFIRM_PASSIVE",
  "CHOOSE_ACTOR", "CHOOSE_RESPAWN", "FAST_TRAVEL",
]);
```

In the 3D branch only, render `PickerDock` for `ABSTRACT_INPUT_TYPES` (and `UPGRADE_PHASE` still goes to the modal in Task 6; `SELECT_CARD`/`SELECT_CARD_OR_PASS` to the hand in Tasks 4–5). The 2D branch keeps rendering `OptionPicker`/`PromptBanner` exactly as now. Gate the shared `OptionPicker`/`PromptBanner` block (`GameView.tsx:259-277`) behind `!use3D` so it no longer paints over the 3D scene.

**Step 3: Verify build + browser**

Run: `npm run build` → PASS.
Browser (`?3d=1`): trigger a `CHOOSE_ACTION` (commit a card, resolve) and a `CONFIRM_PASSIVE`/`SELECT_NUMBER` if reachable; confirm the glass dock appears, options work, board is not covered, no peek button.

**Step 4: Commit**

```bash
git add src/components/board3d/hud/PickerDock.tsx src/components/board3d/hud/PickerDock.module.css src/components/pages/GameView.tsx src/utils/actionLabels.ts
git commit -m "feat(3d): glass PickerDock for abstract decisions (M8)"
```

---

### Task 4: Hand recedes while the dock is open — DROPPED (user preference, 2026-05-31)

The dock sits clear above the resting hand, so receding wasn't needed; user preferred the
hand to stay put. Reverted, no commit.

<details><summary>original task</summary>

**Files:**
- Modify: `src/components/board3d/hud/HandRow.tsx`
- Modify: `src/components/board3d/hud/HandRow.module.css`
- Modify: `src/components/pages/GameView.tsx`

**Step 1: Add a `recede` prop**

`HandRow` gains `recede?: boolean`. When true, apply a class that slides the hand down and dims it (`transform: translateY(60%); opacity: 0.4; transition: transform .25s, opacity .25s; pointer-events: none;`). Safe because abstract decisions don't use the hand.

**Step 2: Drive it from `GameView`**

Pass `recede={use3D && needsPicker for ABSTRACT types}` — i.e. true when a `PickerDock` (abstract) decision is active, false for card/defense decisions (those keep the hand up).

**Step 3: Verify build + browser**

`npm run build` → PASS. Browser (`?3d=1`): on a `CHOOSE_ACTION`, hand slides down/dims; clears when resolved.

**Step 4: Commit**

```bash
git add src/components/board3d/hud/HandRow.tsx src/components/board3d/hud/HandRow.module.css src/components/pages/GameView.tsx
git commit -m "feat(3d): hand recedes while the abstract picker is open (M8)"
```
</details>

---

### Task 5: Card-glow `SELECT_CARD` on the real hand

**Files:**
- Modify: `src/components/board3d/hud/HandRow.tsx`
- Modify: `src/components/board3d/hud/HandRow.module.css`
- Modify: `src/components/pages/GameView.tsx`

**Step 1: Add selectable mode to `HandRow`**

New props: `selectableCardIds?: Set<string>` and `onPickCard?: (cardId: string) => void`. When `selectableCardIds` is present:
- cards in the set get a glow class (`box-shadow`/outline using `--hud-accent`); cards not in the set get a `.dimmed` class.
- clicking a selectable card calls `onPickCard(card.id)` instead of the normal select/commit behavior.
This is independent of the existing planning-commit flow (guard with the prop's presence).

**Step 2: Route `SELECT_CARD` in `GameView`**

When `use3D` and `inputRequest.type === "SELECT_CARD"`: compute `selectableCardIds` from `inputRequest.valid_options` (string card ids), pass to `HandRow` with `onPickCard={(id) => handleOptionSelect({ hero_id: myHeroId, card_id: id })}`. Do NOT render `PickerDock` for `SELECT_CARD`.

**Step 3: Verify build + browser**

`npm run build` → PASS. Browser (`?3d=1`): reach a `SELECT_CARD` decision; only valid cards glow, others dim, clicking a glowing card submits and advances. No panel/list.

**Step 4: Commit**

```bash
git add src/components/board3d/hud/HandRow.tsx src/components/board3d/hud/HandRow.module.css src/components/pages/GameView.tsx
git commit -m "feat(3d): SELECT_CARD picks the real hand card (M8)"
```

---

### Task 6: Defense — three-state cards + readout/PASS dock

**Files:**
- Modify: `src/components/board3d/hud/HandRow.tsx` (per-card defense state badge/glow)
- Create: `src/components/board3d/hud/DefenseDock.tsx` + `.module.css` (readout + PASS)
- Modify: `src/components/pages/GameView.tsx`

**Step 1: Per-card defense state in `HandRow`**

New prop `defenseStates?: Map<string, { state: DefenseState; defenseValue?: number }>` (from `classifyDefenseOption`). Render per glowing card:
- `BLOCKS` → green glow (`--hud-block`) + `✓ {defenseValue}` badge.
- `FAILS` → dimmed/desaturated + red `✗` (still clickable for rare effect cases, but demoted).
- `PRIMARY` → cyan shield glow (`--hud-read`), no verdict; surface the card's effect text (the card art already shows it; add a small "read" shield marker).
Reuse the Task 5 `onPickCard` for the click.

**Step 2: `DefenseDock`**

Glass readout (use `.parchment`): `⚔ {attacker} attacks — need {defense_needed} to block` (include `minion_modifier` when nonzero). A `.dangerBtn` **PASS** (`onSelect("PASS")`). When no option `BLOCKS` and none is `PRIMARY`, emphasize PASS and show the "no card fully blocks" note. Hover on a hand card updates the readout line (thread a hovered-state callback up, or keep readout static for v1 and add hover-reflection as a follow-up — static is acceptable for first checkpoint).

**Step 3: Route `SELECT_CARD_OR_PASS` in `GameView`**

When `use3D` and type `SELECT_CARD_OR_PASS`: build `defenseStates` via `classifyDefenseOption` over `inputRequest.options`, pass to `HandRow` (selectable = the card ids; `onPickCard` submits `{hero_id, card_id}`), and render `DefenseDock` for the readout + PASS. Hand stays UP (not receded) for defense.

**Step 4: Verify build + browser**

`npm run build` → PASS. Browser (`?3d=1`): force a defense decision (combat against your hero). Confirm: blocking cards glow green ✓ with value, insufficient dim red, primary-defense cyan "read it", readout names attacker + need, PASS works and is emphasized when nothing blocks.

**Step 5: Commit**

```bash
git add src/components/board3d/hud/HandRow.tsx src/components/board3d/hud/DefenseDock.tsx src/components/board3d/hud/DefenseDock.module.css src/components/pages/GameView.tsx
git commit -m "feat(3d): defense as on-card states + readout/PASS dock (M8)"
```

---

### Task 7: `UpgradeModal` — reskin the between-rounds modal

**Files:**
- Create: `src/components/board3d/hud/UpgradeModal.tsx` (or reskin in place if simpler — see note)
- Modify: `src/components/pages/GameView.tsx`

**Step 1: Reskin**

Keep the existing card-pair layout, tooltips, "Upgrades remaining" count, and waiting-for-players footer from `OptionPicker`'s `UPGRADE_PHASE` branch (`OptionPicker.tsx:193-338`). Wrap it in the glass language (dim backdrop kept; panel uses `.glass`). Cleanest path: extract the upgrade JSX into `UpgradeModal.tsx`, used by the 3D branch; the 2D `OptionPicker` keeps its own copy until 2D deletion. (If extraction risks the 2D path, just author a fresh `UpgradeModal` for 3D and leave `OptionPicker` alone — DRY is secondary to not breaking 2D here, since this whole 2D component is slated for deletion.)

**Step 2: Route in `GameView`**

`use3D && type === "UPGRADE_PHASE"` → `UpgradeModal`; 2D unchanged.

**Step 3: Verify build + browser**

`npm run build` → PASS. Browser (`?3d=1`): reach the upgrade phase; confirm card pairs, tooltips, remaining count, and waiting footer all work with the glass look.

**Step 4: Commit**

```bash
git add src/components/board3d/hud/UpgradeModal.tsx src/components/pages/GameView.tsx
git commit -m "feat(3d): glass upgrade modal (M8)"
```

---

### Task 8: Cleanup pass

**Files:**
- Modify: `src/components/pages/GameView.tsx`

**Step 1: Confirm 3D no longer renders the old shared HUD**

Verify the shared `OptionPicker`/`PromptBanner` are now `!use3D`-only and every 3D decision type routes to a new component (PickerDock / hand-glow / DefenseDock / UpgradeModal). Remove any now-dead props/imports the build flags. Confirm `BOARD_INPUT_TYPES` still go through `HexOverlay` untouched.

**Step 2: Verify build + full 3D playthrough**

`npm run build` → PASS. Browser (`?3d=1`): play a full turn cycle (plan → commit → resolve actions → a defense → upgrade) and confirm no old light panels appear and the board is never covered.

**Step 3: Commit**

```bash
git add src/components/pages/GameView.tsx
git commit -m "chore(3d): route all 3D decisions to glass HUD, drop 2D picker in 3D (M8)"
```

---

## Notes for the executor

- **2D path is sacred until its scheduled deletion** — never change `OptionPicker`/`PromptBanner` rendering for the `!use3D` branch beyond the Task 2 pure refactor.
- **Tune in browser, then bake** — glass alpha/blur, accent hex, dock `bottom` offset, and recede distance are all expected to be dialed in at each checkpoint, like the rest of the rework (`&calibrate=1` exists for placement).
- **Hold pushes** until the user asks.
- **Do not commit** this plan or the design doc (per project rule).
