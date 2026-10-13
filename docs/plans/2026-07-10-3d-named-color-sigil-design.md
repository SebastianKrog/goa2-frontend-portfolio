# Named-Color Sigil for NebKher's Imbue Doubt Family

`imbue_doubt`, `time_to_reconsider`, and `an_illusion_of_choice` have the
caster name a card color; next turn, after cards are played, an enemy hero in
radius discards a card of that color. Naming a color is public information at
the table, so other players — enemies planning their next hand most of all —
should see the named color clearly while the effect is pending.

## Backend (goa2-backend)

The chosen color was previously baked only into the delayed effect's
`finishing_steps` (engine internals, not serialized). Now:

- `ActiveEffect.named_color: CardColor | None` — public field.
- `CreateEffectStep.named_color_key` — context key resolved at creation
  (`"chosen_color"`); stored on the effect and added to `EFFECT_CREATED`
  metadata as `named_color`.
- The three Imbue Doubt cards pass `named_color_key="chosen_color"`.
- `_build_effects_view` serializes `named_color`; documented in
  `CLIENT_INTEGRATION_GUIDE.md`; covered by view + card-effect tests.

## Frontend (goa2-frontend)

- `EffectView.named_color?: string | null`.
- `NamedColorSigil.tsx` — card-shaped billboard swatch in the named color
  floating above the source hero (height 1.75, above UnitMarkers' 1.3), thin
  stem, dark frame so gold/silver read against the sky, gentle bob. Colors are
  literal hexes mirroring theme.css (CSS vars can't reach three.js materials).
- `Board3D.tsx` builds `namedColorsByUnit` from `view.effects`
  (`is_active && named_color != null`, keyed by `scope.origin_id`) and mounts
  the sigil inside the hero's `AnimatedUnit` so it follows movement.

Keyed on `named_color` rather than effect type: any future "name a color"
card gets the sigil for free. State-driven, so spectators and reconnects see
it; it disappears when the effect fires or expires.
