# Mobile UI integration and M1 acceptance

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

## Minimum shared boundary (M0 groundwork)

`GameView` establishes a session identity from game ID and credential. Its
`GameSession` child owns the single `useGameSocket` instance, existing derived
permissions/status, game actions, and game-level modal state. A game or credential
change remounts that child, clearing stale selection, camera, panes, and dialogs.
Changing layout or pane retains the live session.

The M1 boundary uses typed presentation props rather than a second controller
implementation. `MobileGameShell` receives the existing board as a persistent slot
and typed pane/navigation callbacks. `MobileGamePanels`, `MobileGameHeader`, and
`MobileGameSettings` receive supplied view data and actions; they do not open
connections or infer authorization. A larger controller-hook extraction can be
made incrementally when later milestones require it.

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

| Area | Existing frontend / released patch | M1 integration | Later acceptance |
| --- | --- | --- | --- |
| Session | Shared REST/WebSocket actions and authoritative views | Existing session retained across panes/layout | M2 gameplay/reconnect scenarios |
| Layout/navigation | Legacy board/sidebar; patch mobile panes and Back | Opt-in shell, five panes, active-pane toggle, Back/Escape, portrait/landscape rules | M9 rendered/device fit |
| Header/status | PhaseBar; patch compact header | Compact text phase, round/turn, team life, player/connection status | M2 clocks and complete gameplay status |
| Heroes | HeroInfo; patch compact/expanded dashboards | Existing HeroInfo in its own pane; own Deck shortcut uses pane navigation | M3 compact rows, focus, special hero presentation |
| Hand | CardList; patch compact rows and text inspection | Existing CardList in Hand with shared callbacks | M2 touch inspection/core play; M3 richer cards |
| Deck | Painted DeckViewer; patch Tree/List/Grid and plans | Existing DeckViewer embedded in pane | M4 trees, sorting, saved plans |
| Log | EventLog; patch saved Events/Decisions | Existing live EventLog embedded and expanded | M8 decision history and persistence |
| Settings/tools | Existing cursor preference, reporting, sharing, overrides/pause | Basic settings, layout selector, existing tool dialogs | M8 appearance/sound/language/fullscreen parity |
| Board selections | Hex/unit/token, respawn hex, off-board choices | Existing board and decision routing retained | M2 input matrix and touch reachability |
| Other decisions | Card/defense, action/option/number, passive, actor, respawn, fast travel and special choices | Existing 2D controls retained | M2 all request flows; M3 mobile decision surfaces |
| Planning/setup | Ready/start position, commit/take-back, second card/Done | Existing game actions retained; no duplicated rules | M2 full flow acceptance |
| Upgrades | Existing single-confirm picker; patch staging | Existing picker retained | M5 batch API, M6 staged tree |
| Camera | Native pan/pinch/wheel/double tap; patch adds rotation/focus | Native camera retained across panes | M7 rotation, focus and transform composition |
| Hidden information | Player-scoped/masked frontend data and patch behavior | Supplied views retained; no hidden-card reconstruction | M2/M3 owner/opponent/spectator regressions |
| Tablet/new markers | Unfinished patch roadmap items | Deferred | Separate follow-up scope |

Neutral helpers for later reuse include card stats/icons, localized text, hero
status, upgrade offer identity, and deck-tree calculations. `CardCanvas` and painter
access currently remain under `board3d`; M1 reuses them through existing components.
Moving them to a neutral directory is deferred until the mobile card work needs it.

## Verification

Baseline before implementation: **51 test files / 332 tests passed**, and
`npx tsc -b --pretty false` passed. M1 adds **16 tests** across layout selection,
GameView integration, and CSS declaration checks.

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
npx eslint src/components/mobile src/components/ui/DeckViewer.tsx src/components/ui/EventLog.tsx src/components/ui/HeroInfo.tsx src/components/board3d/hud/GameTools.tsx
```

The existing `GameView.tsx` baseline has an effect-state lint error and an
unnecessary hook dependency warning, reproduced against the plan branch. M1 does
not change that code or suppress the findings. The new/other touched components
pass targeted lint.

Browser/device acceptance is pending: actual portrait/landscape geometry, browser
chrome and keyboard resizing, safe areas, fonts/artwork, card overflow, native
focus/inert behavior, and real touch gestures. jsdom history/CSS checks do not
establish rendered fit. Core-play acceptance belongs to M2; full patch parity,
automatic activation, and desktop convergence remain later milestones.
