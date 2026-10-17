# Mobile UI integration and M0/M1 acceptance

## Selecting the layout

Mobile remains opt-in. Add `ui=mobile` to a game URL; `3d=0` is optional because
explicit mobile selection always uses the 2D board, including on links with
`3d=1`. For example:

```text
/game/<game-id>?token=<seat-or-watch-token>&ui=mobile
```

Existing links retain their behavior: the default is desktop 3D, and `3d=0`
selects desktop 2D. Desktop 2D exposes a Mobile UI button; desktop 3D exposes
Switch to mobile 2D inside Help. Mobile Settings offers Desktop 2D and Desktop 3D.
Layout changes preserve the token, unrelated query parameters, and URL fragment.
There is no automatic phone detection or saved layout preference in M1.

## Shared controller boundary (M0)

`GameView` establishes a session identity from game ID and credential. Its
`GameSession` child mounts `useGameController(gameId, token)` once. The controller
owns the sole `useGameSocket` instance, derives shared game/decision state, and
coordinates planning commands. A game or credential change remounts the owner,
clearing stale selection, camera, panes, and dialogs. Changing layout or pane
retains the live session.

`src/hooks/useGameController.ts` exports the typed `GameController` interface:

| Group | Ownership |
| --- | --- |
| `session` | Player-scoped view/request, connection/error state, events, names, pings/pointers, and override state supplied by the transport. |
| `model` | Own hero/team, personal/team decision ownership, frozen state, simultaneous upgrade phase, off-board choice adaptation, starting-position availability, planning flags, committed/waiting names, status, ping/pause availability. |
| `actions` | Existing request-correlated commands and planning coordination: direct commit, take-back, and swap after authoritative acknowledgment. |
| `selection` | Ephemeral cross-layout hand selection; separate from authoritative server state. |
| `lockedNotice` | Temporary notice when take-back loses a race with planning completion. |

`src/hooks/gameControllerModel.ts` derives the model without React state, router,
renderers, or asset access. The controller does not reconstruct hidden data or
introduce new server rules. Request IDs and selection payloads pass through the
existing socket hook. A staged swap waits until the server view confirms take-back
and the requested card is in hand; rejection or leaving planning cancels it.

`GameView` composes the model/actions with presentation state. It owns layout and
camera preferences, pane/modal visibility, board inspection/override picking,
reveal/animation/audio display behavior, and renderer-specific decision placement
(for example, 3D direction arrows versus 2D options). These do not belong to the
transport or the shared game model.

`MobileGameShell` receives the existing board as a persistent slot and typed
pane/navigation callbacks. Both desktop `Sidebar` and `MobileGamePanels` consume
the same own-hero, commit-availability, and waiting-name model. The desktop hand
therefore also honors the existing timeout lock flag rather than recalculating
availability separately. The desktop component structure and CSS are retained.
`MobileGameHeader` and `MobileGameSettings` receive supplied data/actions; none
of these presentations opens another connection.

`useMobileNavigation` owns mobile pane/dialog history through React Router. Opening
a pane pushes one history entry; switching panes replaces it. A settings dialog
adds one entry above its pane. Back/Escape closes the top surface, and activating
the current navigation button returns to Board. Session-specific history ownership
prevents a different game/viewer from inheriting old panes. Pending navigation
guards prevent a rapid duplicate close from leaving the game. No credentials are
copied into navigation state.

The SVG board stays mounted with the same available bounds across pane switches.
Panes cover it and make it inert; their content scrolls independently. Portrait
uses bottom navigation, while short landscape uses a scrollable right rail.
CSS declares dynamic viewport height and safe-area reservations. These declarations
are tested, but their rendered fit still needs browser validation with assets.

## Feature/input matrix

The released userscript is a behavior reference. Its DOM observers, private React
fiber access, selector adaptation, and native-button proxies are not ported.
The parity target is [v1.3.0 (`ad1eed5`)](https://github.com/SebastianKrog/goa2-mobile-2d-patch/commit/ad1eed5427b91b8daaebb56c4ceafda01db5f7de).
The [roadmap](../MOBILE_UI_TODO.md#release-reconciliation-v113-to-v130)
accounts for all 13 changelog entries since the original v1.1.3 baseline.
These additions are planned work beyond the implemented M0/M1 foundation.

| Area | Existing frontend / released patch | M1 integration | Later acceptance |
| --- | --- | --- | --- |
| Session | Shared REST/WebSocket actions and authoritative views | One typed controller/session retained across panes/layout | M2 gameplay/reconnect scenarios |
| Layout/navigation | Legacy board/sidebar; patch mobile panes and Back | Opt-in shell, five panes, active-pane toggle, Back/Escape, portrait/landscape rules | M9 rendered/device fit |
| Header/status | PhaseBar; patch compact header | Compact text phase, round/turn, team life, player/connection status | M2 clocks and complete gameplay status |
| Heroes | HeroInfo; patch compact/expanded dashboards | Existing HeroInfo in its own pane; own Deck shortcut uses pane navigation | M3 compact rows, focus, special hero presentation |
| Hand | CardList; patch compact rows and text inspection | Existing CardList in Hand with shared callbacks | M2 touch inspection/core play; M3 richer cards |
| Deck | Painted DeckViewer; patch Tree/List/Grid, spells and plans | Existing DeckViewer embedded in pane | M4 trees, shared spell sorting/grouping, saved plans |
| Indicators | Patch shared Bounty/Poison, Gydion counter and compact rune indicators | Existing HeroInfo retained | M3 hero/piece markers, counters, row geometry; M9 asset acceptance |
| Spells | Patch public cast list, owner Spellbook, Tiny/Large/Image and embedded references | Existing card/deck viewers retained | M3 spell views/choices and embedded rows; M4 Deck integration; M8 preferences/nested navigation |
| Snorri | Patch fixed rune columns, confirmed progress and hero history labels | Existing decision controls retained | M3 presentation/recovery; M5 typed contract; M6 batch submission |
| Log | EventLog; patch saved Events/Decisions | Existing live EventLog embedded and expanded | M8 decision history and persistence |
| Settings/tools | Existing cursor preference, reporting, sharing, overrides/pause | Basic settings, layout selector, existing tool dialogs | M8 appearance/sound/language/fullscreen parity |
| Board selections | Hex/unit/token, respawn hex, off-board choices | Existing board and decision routing retained | M2 input matrix and touch reachability |
| Other decisions | Card/defense, action/option/number, passive, actor, respawn, fast travel and special choices | Existing 2D controls retained | M2 all request flows; M3 spell previews, Small gold choices, icons and mobile decision surfaces |
| Planning/setup | Ready/start position, commit/take-back, second card/Done | Shared model and acknowledged swap coordination; both hands consume the same availability | M2 full flow acceptance |
| Upgrades | Existing single-confirm picker; patch staging | Existing picker retained | M5 backend contract/frontend adapters, M6 staged tree |
| Camera | Native pan/pinch/wheel/double tap; patch adds rotation/focus | Native camera retained across panes | M7 rotation, focus and transform composition |
| Hidden information | Player-scoped/masked frontend data and patch behavior | Supplied views retained; no hidden-card reconstruction | M2/M3 owner/opponent/spectator regressions |
| Tablet/alternative navigation | Unfinished patch roadmap items | Deferred | Separate follow-up scope |

### Input inventory

This inventories the current contract and rendering paths; it does not claim M2
gameplay/device acceptance. Personal and team ownership, frozen-state suppression,
and scoped simultaneous upgrade handling come from the shared controller model.
Renderer-specific placement remains in `GameView` and existing decision components.

| Input type | Selection / existing rendering path | Mobile port work remaining |
| --- | --- | --- |
| `SELECT_HEX` | Hex object from HexGrid; PromptBanner supplies optional Skip/Undo. | M2 touch targeting and prompt reachability. |
| `SELECT_UNIT` | Unit ID from board, or shared off-board adaptation to options. | M2 both on/off-board flows. |
| `SELECT_UNIT_OR_TOKEN` | Unit/token ID; same off-board adaptation when all candidates are absent. | M2 token and mixed-candidate flows. |
| `CHOOSE_RESPAWN_HEX` | Hex object through board targeting. | M2 respawn flow. |
| `SELECT_CARD` | Card ID; OptionPicker in 2D, CardSelectOverlay in 3D. | M2 touch inspection/selection; M3 richer surface. |
| `SELECT_CARD_OR_PASS` | Offered card ID or `PASS`; OptionPicker in 2D, hand plus DefenseDock in 3D. | M2 defense and granted out-of-hand cards; M3 presentation. |
| `CHOOSE_ACTION` | Option ID; OptionPicker in 2D, PickerDock in 3D. | M2 all action choices. |
| `SELECT_OPTION` | Option ID and optional preview metadata; same picker routing. | M2 special choices/previews; M3 rune columns; M5/M6 typed ordered rune arrays and capability-gated submission. |
| `SELECT_NUMBER` | Current pickers submit option IDs, stringifying numeric fallbacks; 3D specializes direction/split-line requests onto the board. | M2 validate each payload flow and special choices. |
| `CONFIRM_PASSIVE` | Supplied option or `YES`/`NO` fallback. | M2 optional/mandatory passive handling. |
| `CHOOSE_ACTOR` | Hero ID from `player_ids`. | M2 actor/tie choices. |
| `CHOOSE_RESPAWN` | Supplied option or current `YES`/`NO` fallback. | M2 skip/respawn flow. |
| `UPGRADE_PHASE` | `{hero_id, card_id}` from the viewer's scoped offer, with per-choice confirmation; shared by both renderers. | M2 baseline flow; M5 typed `{hero_id, card_ids}` adapter; M6 staged tree. |

`SKIP` is the string sentinel for optional selections. The controller forwards
selections (including numeric values, hexes, and structured upgrades) unchanged;
the existing socket hook echoes the current opaque request ID. No aliasing of
legacy or unknown request names is added by M0.

The backend enum also retains `NONE`, `ACTION_CHOICE`, `MOVEMENT_HEX`,
`DEFENSE_CARD`, `TIE_BREAKER`, `SELECT_ALLY`, `FAST_TRAVEL_DESTINATION`,
`SELECT_ENEMY`, and `UPGRADE_CHOICE` as legacy names. The current OptionPicker has
no dedicated branches for them. The frontend's abstract-route list additionally
contains `FAST_TRAVEL`, also without a dedicated 2D option-normalization branch.
These are compatibility gaps to assess in M2 against actual server emissions;
they are not silently counted as supported. Direction and reality-split prompts
are specialized `SELECT_NUMBER` requests, not separate input types.

Backend batch support exists on `feat/batch-upgrades-and-runes` at `740ec5b`;
frontend array payloads and capability/count metadata remain M5 work. This does
not establish deployment or completion of the staged mobile UI. Preserve current
single-choice flows and use the documented one-or-completing-batch restrictions.

Released v1.2/v1.3 spell/marker and Snorri features are porting scope in M3–M8.
Only additional unspecified hero designs, alternative navigation modes, tablet
split panels, and complete offline event backfill remain deferred. The patch's
older roadmap wording must not override its shipped source and tests.

Neutral helpers for later reuse include card stats/icons, localized text, hero
status, upgrade offer identity, and deck-tree calculations. `CardCanvas` and painter
access currently remain under `board3d`; M1 reuses them through existing components.
Moving them to a neutral directory is deferred until the mobile card work needs it.

## Verification

Baseline before implementation: **51 test files / 332 tests passed**, and
`npx tsc -b --pretty false` passed. The M1 branch baseline was rechecked before M0
extraction: **54 files / 348 tests passed**. The completed M0/M1 branch has
**56 files / 369 tests passed**: the original 16 M1 tests plus 20 controller/model
tests and one shared desktop/mobile timeout-availability regression.

Controller tests substitute only the GameSocket network boundary, running the
real socket hook and controller. They verify one transport across presentation
changes, disconnect/timer cleanup, personal/team ownership, frozen and simultaneous
decisions, scoped data, off-board request adaptation, two-card ordering/timeout
flags, direct commit, acknowledged swap without duplicate commits, missing-card and
phase-change cancellation, rejection notice expiry, and fresh request-ID echo with
unchanged payloads. They do not require a backend process or licensed assets.

The integration tests run in jsdom with synthetic game data, a substituted socket
transport, and an asset-free CardCanvas substitute. They exercise production
GameView composition, the actual SVG board/camera, pane components, and router
history. They check:

- Mobile precedence, desktop defaults, and both desktop entry points.
- Every pane, active-pane closing, embedded Deck/Log, and the hero Deck shortcut.
- Board node identity and actual wheel zoom across all panes; one session mount.
- Router Back/Escape, native jsdom Back/Forward, nested dialog dismissal, and
  duplicate-close protection.
- Selection, focus, and scroll retention on an ordinary view update; state reset
  on game/credential changes; spectator pane fallbacks; ordinary Tab traversal.
- Query/fragment preservation and switching back to desktop without reconnecting.
- CSS declarations for equal board/pane bounds, scrolling, safe-area reservations,
  short-landscape rail, and overlay stacking.

Commands:

```sh
npm test
npx tsc -b --pretty false
npx eslint src/hooks/useGameController.ts src/hooks/gameControllerModel.ts src/hooks/gameControllerModel.test.ts src/hooks/useGameController.test.tsx src/hooks/__fixtures__/gameController.ts src/components/pages/GameView.tsx src/components/ui/Sidebar.tsx src/components/mobile src/components/ui/DeckViewer.tsx src/components/ui/EventLog.tsx src/components/ui/HeroInfo.tsx src/components/board3d/hud/GameTools.tsx
```

Targeted lint passes for the controller/model, their tests, GameView, and changed
presentation components. The original GameView effect-state error is resolved by
invalidating rejected planning commands during the controller's render-time state
transition. The prior unnecessary dependency is removed, and the shared selection
setter is now an explicit dependency of keyboard-binding memoization.

Browser/device acceptance is pending: actual portrait/landscape geometry, browser
chrome and keyboard resizing, safe areas, fonts/artwork, card overflow, native
focus/inert behavior, and real touch gestures. jsdom history/CSS checks do not
establish rendered fit. Core-play acceptance belongs to M2; full patch parity,
automatic activation, and desktop convergence remain later milestones.
