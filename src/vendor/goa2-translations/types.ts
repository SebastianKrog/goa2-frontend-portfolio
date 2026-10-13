// Vendored from goa2-translations (src/types.ts). Do not edit — see scripts/sync-translations.mjs.
export const CARD_COLORS = ["GOLD", "SILVER", "RED", "BLUE", "GREEN", "PURPLE"] as const
export type CardColor = (typeof CARD_COLORS)[number]

export const ACTION_TYPES = [
  "SKILL",
  "ATTACK",
  "MOVEMENT",
  "DEFENSE",
  "DEFENSE_SKILL",
] as const
export type ActionType = (typeof ACTION_TYPES)[number]

export const VALUE_SIGNS = ["PLUS", "MINUS", "EXCLAMATION"] as const
export type ValueSign = (typeof VALUE_SIGNS)[number]

export type Modifier = "RANGE" | "AREA"
export type Item = "ATTACK" | "DEFENSE" | "INITIATIVE" | "RANGE" | "AREA" | "MOVEMENT"
export type CardKind = "HERO" | "SPELL"

export interface CardVariant {
  first: number
  second: number
}

/**
 * Locale-independent card data. Field names intentionally follow
 * Stats-of-Atlantis `new_heroes.json`, while numeric values come from the
 * registered goa2-backend Card models.
 */
export interface CardDefinition {
  id: string
  heroId: string
  imageId: string
  kind: CardKind
  color: CardColor
  school?: string
  spellRank?: number
  level?: number
  variant?: CardVariant
  extra?: boolean
  initiative?: number
  primaryAction?: ActionType
  primaryValue?: number
  primaryValueSign?: ValueSign
  modifier?: Modifier
  modifierValue?: number
  modifierValueSign?: ValueSign
  secondaryMovement?: number
  secondaryDefense?: number
  secondaryAttack?: number
  item?: Item
  traits?: string[]
}

export interface HeroDefinition {
  id: string
  backendName: string
  difficultyStars: number
  cardIds: string[]
  spellIds?: string[]
}

export interface SourceRevision {
  repository: string
  commit: string
}

export interface MechanicsCatalog {
  schemaVersion: 1
  sources: {
    backend: SourceRevision
    statsOfAtlantis: SourceRevision
  }
  heroOrder: string[]
  heroes: Record<string, HeroDefinition>
  cards: Record<string, CardDefinition>
}

export interface CardTranslation {
  name: string
  description: string
}

export type TranslationStatus = "draft" | "approved"

export type TranslationMethod = "human" | "ai-assisted" | "machine"

export interface TranslationSource {
  repositoryCommit: string
  englishSha256: string
  mechanicsSha256: string
  sourceGlossarySha256: string
  /** Legacy records without a method are treated as AI-assisted. */
  method?: TranslationMethod
  model?: string
  promptRevision?: string
}

export interface PainterLabels {
  basicSkill: string
  basicAttack: string
  basicMovement: string
  basicDefense: string
  basicDefenseSkill: string
  /**
   * Basic defense/skill cards carrying a modifier print the separator without
   * surrounding spaces, because the card-type line is width-limited. Locales
   * that do not distinguish the two spellings omit this and reuse
   * `basicDefenseSkill`.
   */
  basicDefenseSkillCompact?: string
  skill: string
  attack: string
  movement: string
  defense: string
  defenseSkill: string
  ultimate: string
  ranged: string
}

export const ENGLISH_PAINTER_LABELS: PainterLabels = {
  basicSkill: "Basic Skill",
  basicAttack: "Basic Attack",
  basicMovement: "Basic Movement",
  basicDefense: "Basic Defense",
  basicDefenseSkill: "Basic Defense / Skill",
  basicDefenseSkillCompact: "Basic Defense/Skill",
  skill: "Skill",
  attack: "Attack",
  movement: "Movement",
  defense: "Defense",
  defenseSkill: "Defense / Skill",
  ultimate: "Ultimate",
  ranged: "Ranged",
}

export interface LocaleCatalog {
  schemaVersion: 1
  locale: string
  fallbackLocale?: string
  status?: TranslationStatus
  translatedHeroIds?: string[]
  translatedCardIds?: string[]
  translationSource?: TranslationSource
  painterLabels?: PainterLabels
  heroNames: Record<string, string>
  cards: Record<string, CardTranslation>
}

export interface LocalizedCard extends CardDefinition, CardTranslation {}
