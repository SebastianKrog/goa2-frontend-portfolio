# Mobile UI implementation plan

Status: M0 and M1 implemented; M1 browser/device review remains pending.
See [integration and acceptance notes](docs/mobile-ui-integration.md).
Parity target: mobile patch **v1.3.0**, commit
[`ad1eed5`](https://github.com/SebastianKrog/goa2-mobile-2d-patch/commit/ad1eed5427b91b8daaebb56c4ceafda01db5f7de).
The original plan used v1.1.3 (`b1ecc66`). This revision accounts for both releases
since then (v1.2.0 and v1.3.0); it does not claim their features are implemented in
the native frontend. M0/M1 completion refers to their original foundation/shell scope.

## Agreed direction

- Implement in milestones. M0–M2 deliver the first usable mobile shell with core
  play; full parity with the mobile patch follows in later milestones.
- Make the new UI explicitly opt-in initially. Add automatic phone detection
  after validation, with a manual override.
- Keep the desktop appearance stable during the port. Evaluate desktop adoption
  of the new components afterward.
- Keep mobile CSS and presentation/interaction components separate initially.
  Share networking, game decisions, data transformations, and suitable primitives.
- Server changes are in scope where they simplify the UI, including submitting
  several upgrades in one request.
- Assets are unavailable in these checkouts. Plan and implement against synthetic
  data and automated tests; visual/browser acceptance remains pending until an
  asset-equipped environment is available.

## Release reconciliation: v1.1.3 to v1.3.0

The published patch identifies its newest release as v1.3.0 in `package.json`,
the userscript header, and Git HEAD. No v1.13 release/tag was found. The source
range reviewed is `b1ecc66..ad1eed5`, with changelog, source, and regression-test
inspection. The rows below account for every new changelog entry; the owning
milestones contain the corresponding implementation and acceptance work.

| Release/change | Owning milestones | Required parity at v1.3.0 |
| --- | --- | --- |
| 1.2: shared marker area | M3, M9 | Yellow Bounty/green Poison; hero and owned-piece targets; replace Played label only when indicators exist; three indicators compress card text without changing row height. |
| 1.2: public Gydion counter | M3, M8, M9 | Any viewer can inspect public cast spells; colored pips through nine and numeric fallback; latest emblem treatment supersedes the initial portrait. |
| 1.2: compact indicators | M3, M9 | One B/P or spell indicator, purple combined indicator count for multiple types; a spell counter contributes one indicator. |
| 1.2: owner spellbook and spell faces | M3, M4, M9 | Prepared owner spells and public cast spells in Tree/List/Grid; readable landscape faces; count-only opponents stay masked; no mutation of native facedown state. |
| 1.3: emblem and compact spacing | M3, M9 | Neutral clickable border on Gydion's emblem; replace redundant Deck/Cast counts; indicators follow names and occupy no space when absent. |
| 1.3: Tiny public spell list | M3, M8, M9 | Flat Rank/Color-sorted list, shorter Large viewer above Board/beside it in landscape, saved Image alternative, and solid rank-IV end accents. |
| 1.3: sorting/grouping/highlights | M3, M4, M8 | Share Deck sort with spell lists; Cast Spells precedes Spellbook; rank/color subheadings only within Spellbook; inspected spells stay highlighted. |
| 1.3: embedded spell references | M3, M9 | Unique slim full-width owner spell rows across viewers; choose-one lists become rows; normal rule names and parenthetical text survive; other viewers retain text. |
| 1.3: nested spell details and casting | M2, M3, M8, M9 | Padded/shadowed details preserve parent dimensions; Back/Close restores parent; Tiny casting choices show the chosen spell in its action preview. |
| 1.3: inscription choices | M2, M3, M5, M6, M9 | Fixed Bird/Axe/Anvil/Horn columns; acknowledged progress through Undo/reload/Board peek; four visible slots and centered labels at confirmation; no invented midway history. |
| 1.3: rune indicators/history | M3, M9 | Active rune in compact summaries, named runes above hero turn slots, unchanged board height/current-turn gold glow, and no redundant rune row. |
| 1.3: focus/setup controls | M2, M7, M9 | Names and status/order controls open focused heroes; starting-position controls sit at the top with Close; selection instructions use the action strip. |
| 1.3: action/card-choice polish | M3, M9 | Small gold-choice cards, skill/defense icons, no FAST TRAVEL zero placeholder, and removal of redundant red picker framing while retaining clear state/focus cues. |

Use `tests/test-hero-indicators.cjs` and `tests/test-action-choices.cjs` in the
pinned patch release as scenario references, along with the existing landscape,
timed-controls, and Board-shortcut regressions. Port behavior into native tests;
do not port private-fiber/native-button adapter mechanics.

## Findings from the two projects

The frontend is a React/TypeScript application with an existing SVG 2D board,
Three.js 3D board, shared WebSocket state, and substantial game-flow handling.
`src/components/pages/GameView.tsx` currently combines game decisions and rendering
for both views. Its existing 2D layout is a board with a sidebar, with a small
portrait adaptation.

The mobile patch is a JavaScript userscript with a much richer mobile presentation:
Board/Heroes/Hand/Deck/Log/Settings navigation, compact hero summaries, multiple
card sizes, text inspection, deck trees and saved plans, staged upgrades, board
rotation/focus, settings, and local event history. It has extensive synthetic DOM
regression coverage, including portrait and landscape behavior.
v1.2/v1.3 also ship shared markers, owner/public spell viewers and embedded spell
references, Snorri inscription/history presentation, and compact focus/setup controls.

The patch necessarily integrates through generated CSS class fragments, private
React fibers, DOM observers, native-button proxies, and synthetic camera events.
Port its behavior and suitable calculations into native components. These adapter
mechanisms should disappear when React directly owns the mobile UI.

There is no identified hidden-information defect in the patch. Preserve the
existing player-scoped data contract and the patch's masking behavior as normal
regression requirements during the rewrite.

## Proposed architecture

Use one live game session/controller, with presentation selected independently
from board renderer. Mobile initially uses the existing 2D renderer. Avoid tying
the concepts of mobile layout and 2D rendering together permanently.

Suggested organization, to refine during implementation:

```text
src/components/game/       shared game composition and controller contract
src/components/mobile/     mobile shell, panes, navigation, decisions, CSS modules
src/components/cards/      shared card rendering and presentation primitives
src/components/board/      existing 2D board and its camera
src/components/board3d/    existing 3D renderer and desktop tabletop presentation
src/hooks/                 shared session and presentation-state hooks
src/utils/                 pure card, deck, status, and input transformations
```

- Extract a typed controller/model from `GameView` incrementally. It should expose
  the current view, decision state, permissions, connection status, and actions.
  Keep pane state and mobile inspection state outside the socket hook.
- Mount the socket/session once. Changing panes or layouts must not reconnect it.
- Keep mobile styles under a mobile shell and CSS modules. Share theme tokens
  where useful; avoid importing the patch's global override stylesheet wholesale.
- Move neutral DOM components such as `CardCanvas` and card-painter access out of
  `board3d` when they are needed by mobile. Preserve existing desktop imports via
  small compatibility exports if that reduces migration scope.
- Keep one owner for each decision surface. Do not render a hidden legacy picker
  solely to supply callbacks to the new UI.
- Keep the board mounted across mobile panes, preserving camera state. Define
  overlay bounds without repeatedly resizing or reconstructing the board.

## Reuse map

| Concern | Existing source | Plan |
| --- | --- | --- |
| Session/actions | Frontend `hooks/useGameSocket.ts`, `api/*` | Reuse; retain request correlation, reconnect, and authoritative state handling. |
| Decision routing | Frontend `pages/GameView.tsx`, `ui/OptionPicker.tsx` | Extract common decision data/permissions; provide mobile presentation. |
| 2D rendering/camera | Frontend `board/HexGrid.tsx`, `useMapZoom.ts`, `mapZoom.ts` | Extend with native rotation and focus commands. |
| Status and clocks | Frontend `utils/gameStatus.ts`, `utils/timeControl.ts`, clock hooks/components | Reuse calculations and synchronization; adapt mobile layout. |
| Cards | Patch `cards.js`, `card-rows.js`; frontend card stats, text, icons, painter | Port compact/text layouts; consolidate shared calculations and localization. |
| Heroes | Patch `heroes.js`, `board.js`; frontend hero/status utilities | Port presentation using typed hero data and explicit actions. |
| Indicators/spells/runes | Patch `hero-indicators.js`, `spells.js`, `rune-choices.js` | Share typed indicator/spell models and native React views; preserve ownership and acknowledged rune progress. |
| Deck trees | Patch `tree-model.js`, `tree-view.js`, `deck-tree.js` | Reuse suitable pure algorithms after typing; rewrite DOM rendering as React. |
| Upgrades | Patch `upgrade-tree.js`; frontend `upgradeOffer.ts` | Preserve staging/preview concepts; prefer server-supported batch commit. |
| Navigation | Patch `navigation.js` | Preserve user behavior; integrate with React Router rather than copying raw history manipulation. |
| Log | Patch `history.js`, `log.js`; frontend event log and decision history API | Consolidate data access and persistence; adapt presentation. |
| Tests | Patch `tests/README.md` and scenario fixtures; frontend Vitest | Translate behavioral cases, not private-fiber/selector compatibility tests. |

## Milestone overview

Each milestone should be independently reviewable and leave the existing desktop
UI working. A milestone can span several small changes. Automated verification is
part of every milestone; asset-dependent visual acceptance is tracked separately.

| Milestone | Deliverable | Depends on |
| --- | --- | --- |
| M0 | Shared integration boundary and test baseline | — |
| M1 | Opt-in mobile shell and navigation | M0 |
| M2 | Core gameplay through the mobile shell | M1 |
| M3 | Mobile cards, hero summaries, indicators, spells/runes, and decisions | M2 |
| M4 | Deck/spell browsing and saved local plans | M3 |
| M5 | Batch-upgrade/rune contract and typed frontend adapters | M0; independent of M1–M4 |
| M6 | Staged upgrade tree and rune batch submission | M4, M5; rune presentation from M3 |
| M7 | Unified 2D camera with rotation and hero focus | M2 |
| M8 | Settings, history, and remaining patch parity | M3; final parity review after M6–M7 |
| M9 | Asset-equipped acceptance and automatic phone activation | M6–M8 and access to assets |
| M10 | Optional desktop/mobile convergence | Validated mobile components; separate scope decision |

Recommended order: M0 → M1 → M2, then review the first usable slice before M3.
Continue M3 → M4 → M6, scheduling M5 before M6. M7 and M8 can be implemented as
separate workstreams after their dependencies; they do not require the deck tree.
M9 remains blocked on visual/device access even if all automated checks pass.

### Browser validation checkpoints (requires assets)

- After M1: first visual check of portrait/landscape layout, navigation, scrolling,
  and overlays.
- After M2: first gameplay check of targeting, prompts, card commitment, and
  reconnect states. Ideally validate M1–M2 before expanding the presentation so
  incorrect layout assumptions do not spread into later milestones.
- During M3–M8: focused browser/device checks as features land, especially card
  readability, deck/spell layout, nested spell overlays, rune columns, indicator
  crowding, and real touch gestures.
- Before completing M9: full device acceptance before automatic phone activation.

Implementation and synthetic tests can proceed without assets. Record missing
browser checks explicitly; automated milestone acceptance does not replace them.

## M0 — Integration boundary and test baseline

Deliverable: a documented feature matrix and the minimum shared interface needed
by the mobile shell, with no desktop presentation changes.

- [x] Record a feature/input matrix covering current frontend and released patch
  behavior. Distinguish porting work from unfinished items in the patch roadmap.
- [x] Capture the asset-independent frontend test baseline.
- [x] Extract the minimum shared controller needed by mobile, keeping the desktop
  component tree and behavior stable. Avoid moving unrelated logic merely to
  establish the suggested directory structure.
- [x] Define ownership of session state, decision permissions, presentation state,
  and actions; identify neutral card helpers needed by later milestones.
- [x] Reconcile the feature/input inventory with patch v1.2.0/v1.3.0, assigning
  new parity tasks to the milestones below and retaining explicit unimplemented status.

Acceptance: desktop tests retain their baseline results, the shared interface is
typed, and neither presentation needs to create a second socket/session.

Implementation: `useGameController` owns one socket session, a renderer-independent
model, shared selection, and planning coordination. Desktop and mobile hand views
consume the same model/actions. Pane/modal state, visual preferences, and
renderer-specific presentation remain outside the controller. See the integration
notes for the complete feature/input inventory, ownership, and test evidence.

## M1 — Opt-in mobile shell and navigation

Deliverable: an explicitly selectable mobile layout with a persistent board and
working panes. This milestone establishes composition; core-play acceptance is M2.

- [x] Add an explicit layout selector, for example `?ui=mobile&3d=0`. Define
  precedence with the existing `3d` parameter and preserve tokens/query parameters
  when switching. Do not add automatic activation yet.
- [x] Implement mobile header/status, board area, bottom navigation, and panes for
  Heroes, Hand, Deck, Log, and Settings. Tapping the active pane returns to Board.
- [x] Define portrait and short-landscape layouts, viewport units, safe-area
  reservations, scrolling ownership, and overlay stacking. Reuse existing content
  where dedicated mobile content is scheduled later.
- [x] Integrate Back/Escape with router-aware pane/dialog state from the outset.
  Closing a viewer must not unexpectedly leave the game.
- [x] Preserve board/camera state across pane changes and clear presentation state
  on game/viewer changes.

Acceptance: synthetic interaction tests cover opening, switching, and closing
panes and Back/Escape. Pane changes recreate neither the socket nor the board.
Desktop appearance and tests remain stable. Visual layout review is pending.

v1.3 follow-through: M3 adds public cast-spell surfaces using this shell; M8 extends
its navigation to nested spell inspection. Their absence does not turn the original
M1 shell checks into proof of v1.3 feature parity.

## M2 — Core mobile gameplay

Deliverable: opt-in mobile 2D UI with essential gameplay available. Desktop keeps
its current appearance. This milestone may use simple existing decision
controls inside the mobile shell; it does not require every compact card variant
or the deck tree.

- [ ] Provide text-first card inspection and essential hero information with
  asset fallbacks. Keep inspection separate from playing/committing a card.
- [ ] Route all existing inputs through accessible controls: board/unit/token
  choices, off-board units, card selection, defense, action/option/number choices,
  passive confirmations, respawn, direction/special choices, and upgrades.
  Existing picker presentation is acceptable where a dedicated mobile surface
  is deferred. Include Skip, Undo, and return-to-board affordances.
- [ ] Include ready/setup and starting-position actions, card commit/take-back,
  Emmitt's second-card/Done behavior, waiting states, and match completion.
- [ ] Preserve disconnected, reconnecting, paused/frozen, spectator, and error
  states. Keep bug reporting, sharing, and override/vote tools reachable.
- [ ] Preserve meaningful pane/inspection state on ordinary updates; clear stale
  state on game/viewer changes and invalidate obsolete decisions.
- [ ] Move contextual starting-position controls to the top, with Close/Done and
  Back synchronized to the actual adjustment state. Put selection instructions in
  the action strip, preserving Undo/Skip, Board peek, and viewport/keyboard bounds.
- [ ] Exercise Gydion spell selection then spell-action confirmation, and Snorri
  inscription then final confirmation. Inspection must not cast/place anything.
  Keep valid single-choice flows operational before the M5/M6 batch adapter lands.

Acceptance: synthetic tests can exercise core play through the mobile shell,
including upgrade choices through the existing one-at-a-time flow. Pane changes
do not recreate the socket or board. Desktop regression tests pass. This milestone
is ready for later visual review, not approved for automatic activation.

## M3 — Cards, heroes, and mobile decision presentation

Deliverable: native React card and hero presentation matching the patch's main
mobile reading and decision flows.

- [ ] Port shared full/text card inspection and the compact sizes needed by
  Hand, hero dashboards, Board summaries, and resolution controls.
- [ ] Consolidate printed versus upgraded stats, paired-item grants, tier/color
  display, active effects, and ultimate availability into shared helpers.
- [ ] Use the frontend localization/text pipeline, including its distinct backend
  and translated markup dialects. Avoid a second embedded card painter.
- [ ] Port expanded/compact hero summaries, focused hero inspection, card dots,
  played/discard inspection, resolution order, and planning controls.
- [ ] Preserve Emmitt's independent card slots, Razzle piece ownership, and
  Gydion's existing spell data. Test owner/opponent/spectator presentations using
  only their supplied views; never fill masked cards from a global catalog.
- [ ] Adapt action/defense/card-choice surfaces for touch. Keep simple generic
  controls as a fallback for unfamiliar request shapes.
- [ ] Add the shared hero/piece-aware indicator model: Bounty in yellow, Poison
  in green, Gydion's public cast-spell counter, and Snorri's active rune in compact
  rows. Resolve markers on owned pieces back to their hero and remove stale markers.
- [ ] Replace Played with indicators only when present; at three or more indicators
  shorten the current-card name area without changing row height. Compact markers
  follow the name with no empty reservation; use B/P circles or the spell count for
  one indicator and a purple combined count for multiple indicator types.
- [ ] Render Gydion's emblem with a neutral clickable border and spell-colored dice
  pips for 1–9 cast spells, numeric zero/above-nine fallback, and a compact numeric
  variant. Replace redundant Deck/Cast counters. Open the public cast list for every
  viewer; a spell counter counts as one indicator regardless of its spell total.
- [ ] Provide the public cast-spell browser: flat Tiny rows sorted by Rank/Color,
  inspected-row highlighting, and a shorter Large viewer above Board in portrait
  or beside it in landscape. Share sorting with Deck; Image remains a Settings choice.
- [ ] Reuse spell-specific Tiny/Large/Image renderers for public and owner views.
  Show printed spell values without hero-item bonuses (owner may differ from caster),
  omit initiative/empty stat rails/item slots, preserve range/radius/printed notation,
  label Cantrips and ranks correctly, and give rank IV solid end accents. Keep
  readable name/rules fallbacks when images are missing.
- [ ] Embed each known spell once as a slim full-width Tiny row in the owner's card
  descriptions across Hand, Heroes/focus, Deck, and decision viewers. Replace
  choose-one lists; retain spell names in ordinary rules, other clauses, and
  parenthetical notes (rows precede notes). Other viewers retain ordinary text.
  Resolve only supplied known spell data; keep source text/card state unchanged.
- [ ] Open embedded spell details in a padded, shadowed overlay without resizing
  the parent card. Preserve parent inspection identity, focus, and scroll while
  data updates; M8 supplies layered Back/Close behavior.
- [ ] Use Tiny spell-cast choices for `SELECT_CARD`/`SELECT_OPTION`; after selection,
  display the actual chosen spell in the next action preview. Use Small catalog
  cards for gold-card choices, skill/defense icons for action labels, and no FAST
  TRAVEL zero placeholder. Remove redundant red picker framing without losing
  disabled, selected, pending, focus, or rollback cues.
- [ ] Port Snorri's fixed Bird/Axe/Anvil/Horn option columns and four turn slots.
  Reconcile acknowledged choices through Undo, reload, and Board peek; prefer
  server `next_slot`/offered IDs over prompt-text inference. Scope saved progress
  by game/viewer/hero/round/turn, discard invalidated future slots, and never guess
  earlier order when joining midway. Show all four runes, including the automatic
  last rune, at confirmation with centered turn labels.
- [ ] Show the active rune only in compact indicators and named runes above the
  matching hero history slots, including empty card slots. Preserve the current
  turn's gold glow and row height; do not duplicate the old native rune row.
- [ ] Add keyboard/focus behavior, dialog semantics, reduced-motion support,
  readable long text, and touch targets alongside visual presentation.

Acceptance: card selection and inspection remain distinct; displayed values match
shared calculations; unrelated updates retain valid selection and scroll/focus.
Cover owner/opponent/spectator spell access, counter/marker combinations, nested
spell inspection, rune confirmation/recovery, and gold/spell/action choice variants
from the v1.3 source regressions.

## M4 — Deck browsing and local planning

Deliverable: a read-only deck browser with persistent hypothetical build plans.

- [ ] Port Tree/List/Grid, tier/color sorting, card preview, and build totals.
- [ ] Type/extract tree calculations before porting the rendering.
- [ ] Keep hypothetical Deck plans separate from actual acquired upgrades and
  pending server decisions. Editing a plan must not submit an action.
- [ ] Version preference/build storage; define migration from useful patch keys.
  Scope plans by game, viewer/hero, and catalog identity as appropriate.
- [ ] Preserve recovery from unavailable/corrupt storage and changing game state.
- [ ] Reuse the same tree/card primitives for the later upgrade picker.
- [ ] Include the owning Gydion player's prepared Spellbook and public Cast Spells
  in every Tree/List/Grid layout. Put Cast Spells before Spellbook; only Spellbook
  gets rank/color subheadings. Share Deck Rank/Color sorting with the public list,
  keep inspected-spell highlighting through sorting/live updates, and never sort
  authoritative arrays in place or flip live prepared cards face up.
- [ ] Keep spell browsing outside upgrade-tree eligibility and hypothetical item
  totals. Count-only opponent spellbooks must never acquire fabricated card rows;
  public cast-spell inspection remains available independently of owning a Deck.

Acceptance: browsing and planning work against synthetic catalogs without assets;
changing views or revisiting a game does not silently submit or lose valid plans.

## M5 — Batch-upgrade/rune contract and frontend adapters

Deliverable: documented, tested batch-upgrade/rune APIs and typed frontend adapters
usable by either layout. This milestone can be completed before the mobile deck tree.

Backend functional support is available on `feat/batch-upgrades-and-runes` at
[`740ec5b`](https://github.com/SebastianKrog/goa2-backend/commit/740ec5b)
(including `b412c02`); this is not a claim that it is merged or deployed. The review
verified old single choices, ordered batches, whole-batch rejection, and request
preservation. M5 remains open for frontend adapters and durable lifecycle regressions.
Use that documented contract rather than reproducing the userscript's confirmation chain.

- [ ] Define an ordered list of upgrade selections for one authenticated hero.
  Keep existing single-upgrade submissions valid for older clients.
- [ ] Specify whether a batch must exhaust the remaining choices. Initial mobile
  behavior should stage the complete required set and expose one Commit action.
- [ ] Validate the entire batch against authoritative state before committing:
  ownership, current upgrade opportunity, remaining count, tier prerequisites,
  legal card choices, paired grants, and each choice's effect on subsequent ones.
- [ ] Reject an invalid batch without partial mutation. Apply through existing
  engine rules with a transactional strategy rather than duplicating game rules
  in the server route or frontend.
- [ ] Specify stale-request behavior when another player's upgrade refreshes a
  simultaneous request. Do not assume a raw request ID is a stable offer identity.
- [ ] Define retry/duplicate handling so uncertain delivery cannot spend upgrades
  twice. Reuse existing action correlation where it provides sufficient guarantees.
- [ ] Preserve player-scoped responses, broadcasts, save behavior, emitted events,
  replay/rollback semantics, and meaningful per-choice history.
- [ ] Update backend `docs/CLIENT_INTEGRATION_GUIDE.md` and frontend types/clients.
  Add engine and REST/WebSocket tests for valid, invalid, stale, concurrent, and
  repeated submissions, plus persistence/replay behavior.
- [ ] Reflect the available contract in frontend selection types and controller,
  WebSocket, and REST adapters: `{hero_id, card_ids: string[]}` for upgrades and an
  ordered rune-ID array for inscription, alongside existing single payloads.
- [ ] Type and consume `supports_batch`, per-hero upgrade `selection_counts`, and
  rune `next_slot`, `max_selections`, and `selection_counts`. Upgrades accept one
  or all remaining choices. Runes accept one or a completing sequence (including
  leaving the automatically placed final rune); reject intermediate subsets.
- [ ] Preserve invalid requests/clock allowances and prior acknowledged progress;
  on stale/uncertain delivery fetch the latest scoped view before resubmitting.
  Add permanent regressions for the reviewed replay, serialized-resume, duplicate,
  and cross-player stale-request recovery probes. Keep backend verification results
  separate from frontend completion and actual backend deployment.
Acceptance: engine/API tests demonstrate atomic valid batches, rejection without
partial spending, safe retry/reconnect behavior, and preserved replay/persistence.
The existing desktop single-upgrade flow continues working. Frontend types and
clients can submit a batch, but the staged mobile UI belongs to M6.

## M6 — Staged mobile upgrade tree and rune batches

Deliverable: complete upgrade staging with a single explicit Commit action,
sharing M4's tree and card primitives and using M5's server contract.

- [ ] Port staged tree selection, item totals, Preview, Reset, and Commit. Keep
  valid staging through unrelated updates; disable repeat submission while pending.
- [ ] On failure/reconnect, reconcile with authoritative state before retrying.
  If the server lacks batch support, retain explicit single-upgrade confirmation;
  avoid an invisible automatic submission chain.
- [ ] Wire Snorri's M3 four-slot arrangement to batch submission only when the
  current prompt advertises support. Keep local staging distinct from acknowledged
  placements, require explicit confirmation of a complete allowed arrangement,
  and show the resulting four-rune layout. Older servers retain sequential choices.
- [ ] Reconcile rune staging after Undo, stale requests, reload, and Board peek
  using current offered IDs/slot metadata. Never silently replay a partially or
  uncertainly accepted batch, and clear stale game/viewer/turn-owned staging.

Acceptance: one Commit applies a complete valid batch, or reports a failure without
partially spending it. Desktop's existing single-upgrade flow continues working.

## M7 — 2D camera and hero focus

Deliverable: one camera implementation supporting the patch's rotation and focus
behavior through native commands.

- [ ] Extend the existing 2D camera with rotation, hero/piece focus, fit/reset,
  and reserved-pane-aware centering. Use direct commands and one transform model.
- [ ] Test pan/pinch/rotation composition, pointer cancellation, orientation
  changes, and click suppression after a gesture. Preserve board target selection.
- [ ] Open a focused Board hero from compact name and status/order controls,
  with Enter/Space support and independent marker/spell buttons. Keep focus
  inspection separate from the existing portrait/double-tap camera-centering action.
Acceptance: automated geometry/interaction checks cover transform composition,
reset, focus on hero pieces, cancellation, and selection after gestures. Real
two-finger behavior and viewport fit remain pending device checks in M9.

## M8 — Settings, history, and patch parity

Deliverable: remaining utility flows and an explicit accounting of released patch
features, including any intentionally deferred items.

- [ ] Extend M1's Back/Escape behavior to the final card/deck/upgrade dialogs;
  closing a view must not revive a stale decision.
- [ ] Port useful appearance controls, hand sizing, art visibility, deck controls,
  and fullscreen. Reuse frontend sound/language preferences and their live state.
- [ ] Consolidate Events/Decisions views. Use the existing authenticated decision
  history route; do not describe it as a complete server event archive.
- [ ] If retaining local event history, bound storage and isolate it by game and
  viewer. Define rewind/deduplication behavior and handle storage failures.
- [ ] Treat backfilling missed events as a separate optional backend feature with
  player-scoped history and cursor/delta semantics; it is not required for core play.
- [ ] Review the released patch feature matrix and document remaining omissions.
- [ ] Persist the spell viewer's Large/Image preference (shorter Large by default),
  and reconcile Rank/Color sort with Deck. Migrate/validate useful patch preferences
  without sharing local appearance state with Deck upgrade plans or rune progress.
- [ ] Extend the navigation model to public cast list → spell details and parent
  card → embedded spell details. Back/Close/Escape unwinds one layer, restores
  parent focus/scroll, and never chooses, casts, undoes, or leaves the game.
  Clear nested surfaces safely on game/viewer/layout changes and removed source cards.

Acceptance: preferences persist and update live, history handles reconnect/rewind
and storage failure, and every released patch feature is implemented or recorded
as an explicit deferral. Feature accounting is complete after M6 and M7.

## M9 — Validation and automatic activation

Deliverable: a validated mobile release with automatic phone selection and an
explicit manual override. This milestone requires an asset-equipped environment.

- [ ] Run focused Vitest checks per change, then the frontend regression suite.
  Add a DOM-capable test environment if needed; existing tests include server-side
  rendering, which alone cannot verify interaction.
- [ ] Verify TypeScript where the available files permit it. Record asset-related
  blockers separately from implementation errors. Do not fetch/reconstruct licensed
  assets or claim a successful production build without them.
- [ ] Assess lazy loading of the 3D renderer and asset-dependent modules so mobile
  does not eagerly load an unnecessary 3D path. Measure bundle changes.
- [ ] Leave visual/device acceptance explicitly pending: portrait/landscape,
  narrow/short screens, large rosters, long/localized text, safe areas, browser
  chrome/keyboard, real gestures, fonts/artwork/canvas, fullscreen, and sound.
- [ ] Port v1.2/v1.3 indicator/action-choice scenarios into native regressions:
  hero/piece marker removal, 0/1–9/>9 spell counters, three-indicator compression,
  compact combined counts/no empty gaps, every viewer's public cast list, and
  owner-only prepared/embedded spell data without mutating facedown cards.
- [ ] Cover Tiny/Large/Image spell display, Cantrip/rank-IV cases, printed values
  without caster/owner item confusion, shared sorting/highlights, empty lists,
  missing images, nested parent-size/focus/scroll restoration, and localized rules
  retaining choose-one versus ordinary/parenthetical semantics.
- [ ] Cover fixed rune columns, mid-inscription joins without guessed history,
  acknowledged progress through Undo/reload/peek, automatic final rune/confirmation,
  active/history-slot indicators, stale batch recovery, starting-position Close/Done,
  status-control keyboard focus, Small gold choices, and skill/FAST TRAVEL labels.
- [ ] With assets, check these surfaces in portrait and short landscape alongside
  the pre-existing Emmitt/timed-navigation regressions. Verify nested shadow/padding,
  unchanging parent/board dimensions, long spell rules, crowded markers, and rune
  confirmation clipping. Synthetic declaration checks are not visual acceptance.
- [ ] After asset-equipped validation, introduce automatic phone activation with
  an explicit manual override. Test coarse-pointer landscape and hybrid devices;
  viewport width alone should not permanently determine user preference.
Acceptance: automated checks pass, asset/device checks are recorded, and automatic
activation respects the manual override across navigation and orientation changes.
Until asset/device checks are possible, keep mobile opt-in and mark M9 incomplete.

## M10 — Optional desktop/mobile convergence

Deliverable: separately reviewed adoption of proven shared UI components on desktop.
This is follow-up work, not a requirement for completing the mobile port.

- [ ] Evaluate shared desktop 2D card viewers, deck tree, hero lists, and settings
  as separate changes. Let demonstrated reuse drive convergence.
- [ ] Revisit responsive shells and shared styling after both layouts have concrete
  requirements. Preserve distinct 2D/3D rendering needs.
- [ ] Include the reusable spell row/viewer, indicator model, rune arrangement,
  and gold/spell/action choice primitives in the later desktop adoption review;
  their mobile integration does not itself authorize a desktop restyle.

Acceptance: each adopted component has desktop-specific verification and a clear
maintenance or usability benefit. No wholesale desktop redesign is implied.

## Deferred scope

- Tablet-specific split panels and alternative navigation modes from the patch
  roadmap.
- Future hero-specific designs beyond the shipped v1.3 indicators. Gydion's counter,
  prepared/public spell viewers, and Snorri's released inscription/history UI are
  now porting scope in M3/M4/M6/M8, not deferred designs.
- Additional Snorri presentation beyond v1.3 remains unspecified: the patch's
  ROADMAP still has a generic Snorri follow-up despite its shipped rune UI. Use
  released source/tests as the parity target rather than deferring those features.
- Redesigning desktop or adapting the 3D tabletop to the mobile shell.
- Complete server event-history retrieval unless prioritized independently.
- A single universal CSS/layout implementation before mobile behavior is validated.

## Main risks and controls

| Risk | Control |
| --- | --- |
| Desktop regressions during controller extraction | Extract incrementally; preserve desktop rendering and run existing tests. |
| Forked game logic between layouts | Shared controller, selectors, input routing, and server-authoritative legality. |
| Styling conflicts | Scoped mobile CSS modules and explicit shared primitives. |
| Camera drift or accidental selections | One camera state; pure geometry and gesture interaction tests. |
| Upgrade races/partial application | Server batch validation and atomic application; explicit pending/recovery states. |
| Stale inspection, history, or private data after navigation | Clear ownership boundaries and game/viewer-scoped state/storage. |
| False confidence from DOM tests | Separate automated behavior acceptance from deferred visual/device acceptance. |

Continue with M2 after the completed M0/M1 foundation. Review each milestone
independently, with a broader review after M2 establishes core play. The release
reconciliation table is a parity inventory; unchecked implementation tasks remain work.
