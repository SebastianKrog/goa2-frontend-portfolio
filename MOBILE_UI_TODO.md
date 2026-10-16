# Mobile UI implementation plan

Status: proposed implementation plan, organized into reviewable milestones.

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
| M3 | Mobile cards, hero summaries, and decision presentation | M2 |
| M4 | Deck browsing and saved local plans | M3 |
| M5 | Backend batch-upgrade contract | M0; independent of M1–M4 |
| M6 | Staged upgrade tree with one Commit action | M4, M5 |
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
  readability, deck layout, and real touch gestures.
- Before completing M9: full device acceptance before automatic phone activation.

Implementation and synthetic tests can proceed without assets. Record missing
browser checks explicitly; automated milestone acceptance does not replace them.

## M0 — Integration boundary and test baseline

Deliverable: a documented feature matrix and the minimum shared interface needed
by the mobile shell, with no desktop presentation changes.

- [ ] Record a feature/input matrix covering current frontend and released patch
  behavior. Distinguish porting work from unfinished items in the patch roadmap.
- [ ] Capture the asset-independent frontend test baseline.
- [ ] Extract the minimum shared controller needed by mobile, keeping the desktop
  component tree and behavior stable. Avoid moving unrelated logic merely to
  establish the suggested directory structure.
- [ ] Define ownership of session state, decision permissions, presentation state,
  and actions; identify neutral card helpers needed by later milestones.

Acceptance: desktop tests retain their baseline results, the shared interface is
typed, and neither presentation needs to create a second socket/session.

## M1 — Opt-in mobile shell and navigation

Deliverable: an explicitly selectable mobile layout with a persistent board and
working panes. This milestone establishes composition; core-play acceptance is M2.

- [ ] Add an explicit layout selector, for example `?ui=mobile&3d=0`. Define
  precedence with the existing `3d` parameter and preserve tokens/query parameters
  when switching. Do not add automatic activation yet.
- [ ] Implement mobile header/status, board area, bottom navigation, and panes for
  Heroes, Hand, Deck, Log, and Settings. Tapping the active pane returns to Board.
- [ ] Define portrait and short-landscape layouts, viewport units, safe-area
  reservations, scrolling ownership, and overlay stacking. Reuse existing content
  where dedicated mobile content is scheduled later.
- [ ] Integrate Back/Escape with router-aware pane/dialog state from the outset.
  Closing a viewer must not unexpectedly leave the game.
- [ ] Preserve board/camera state across pane changes and clear presentation state
  on game/viewer changes.

Acceptance: synthetic interaction tests cover opening, switching, and closing
panes and Back/Escape. Pane changes recreate neither the socket nor the board.
Desktop appearance and tests remain stable. Visual layout review is pending.

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
- [ ] Add keyboard/focus behavior, dialog semantics, reduced-motion support,
  readable long text, and touch targets alongside visual presentation.

Acceptance: card selection and inspection remain distinct; displayed values match
shared calculations; unrelated updates retain valid selection and scroll/focus.

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

Acceptance: browsing and planning work against synthetic catalogs without assets;
changing views or revisiting a game does not silently submit or lose valid plans.

## M5 — Backend batch-upgrade contract

Deliverable: a documented, tested batch-upgrade API usable by either frontend
layout. This milestone can be completed before the mobile deck tree.

Preferred approach: add a backward-compatible batch submission contract rather
than reproduce the userscript's client-side chain of native confirmations.
Design the precise payload after inspecting the existing upgrade engine/session,
REST/WebSocket validation, replay, and persistence paths.

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
Acceptance: engine/API tests demonstrate atomic valid batches, rejection without
partial spending, safe retry/reconnect behavior, and preserved replay/persistence.
The existing desktop single-upgrade flow continues working. Frontend types and
clients can submit a batch, but the staged mobile UI belongs to M6.

## M6 — Staged mobile upgrade tree

Deliverable: complete upgrade staging with a single explicit Commit action,
sharing M4's tree and card primitives and using M5's server contract.

- [ ] Port staged tree selection, item totals, Preview, Reset, and Commit. Keep
  valid staging through unrelated updates; disable repeat submission while pending.
- [ ] On failure/reconnect, reconcile with authoritative state before retrying.
  If the server lacks batch support, retain explicit single-upgrade confirmation;
  avoid an invisible automatic submission chain.

Acceptance: one Commit applies a complete valid batch, or reports a failure without
partially spending it. Desktop's existing single-upgrade flow continues working.

## M7 — 2D camera and hero focus

Deliverable: one camera implementation supporting the patch's rotation and focus
behavior through native commands.

- [ ] Extend the existing 2D camera with rotation, hero/piece focus, fit/reset,
  and reserved-pane-aware centering. Use direct commands and one transform model.
- [ ] Test pan/pinch/rotation composition, pointer cancellation, orientation
  changes, and click suppression after a gesture. Preserve board target selection.
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

Acceptance: each adopted component has desktop-specific verification and a clear
maintenance or usability benefit. No wholesale desktop redesign is implied.

## Deferred scope

- Tablet-specific split panels and alternative navigation modes from the patch
  roadmap.
- New hero-specific indicator designs, including the proposed Gydion spell counter.
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

Start implementation with M0. Review each milestone independently, with a broader
review after M2 establishes core play.
