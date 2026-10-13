import { ensureCardTextReady, getCardText, getPainterLabels } from "../../../i18n/cardText";
import { ensurePrintSignsReady, getPrintSign } from "../../../i18n/printSigns";
import type { CardView } from "../../../types/game";
import { CARD_ICONS } from "../../../utils/cardIcons";
import {
  importCardImage,
  PAINTER_BODY_FONT,
  PAINTER_DISPLAY_FONT,
  preloadImages,
  setPainterAssetBaseUrl,
  updateCanvas,
} from "../../../vendor/goa2-translations/painter/cardPainter";
import {
  Color,
  Item,
  Modifier,
  Type,
  ValueSign,
} from "../../../vendor/goa2-translations/painter/painterTypes";
import "./cardFonts.css";
import { FALLBACK_LOCALE, getLocale } from "../../../i18n/locale";

// The painter defaults to the /goa2-cards/ layout its own package ships; this
// repo serves the same sheets and backgrounds from /cards/. Set at module scope
// so it is in place before any loader runs.
setPainterAssetBaseUrl(`${import.meta.env.BASE_URL}cards`);

export const CARD_W = 1192;
export const CARD_H = 1664;
export const CARD_BACK_ART_VERSION = 2;

// Gydion's spell cards are landscape half-cards shipped as complete
// pre-rendered faces (vendored from Stats-of-Atlantis spell_cards/), so they
// bypass the painter entirely — just blit the webp.
export const SPELL_W = 1192;
export const SPELL_H = 831;

/** Spell cards carry spell_rank on every complete view; the extra states cover
 * defensive callers that only have a masked/partial card. */
export function isSpellCard(card: CardView): boolean {
  return card.spell_rank != null || card.state === "SPELLBOOK" || card.state === "OUTSIDE_SPELLBOOK";
}

const spellFaceCache = new Map<string, Promise<HTMLImageElement | undefined>>();

function fetchImage(src: string): Promise<HTMLImageElement | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(undefined);
    img.src = src;
  });
}

// A spell face is a finished landscape image rather than something the painter
// composes, so a translated one is its own file. Locales without translated
// faces fall back to the English ones.
export function loadSpellFace(imageId: string): Promise<HTMLImageElement | undefined> {
  const locale = getLocale();
  const key = `${locale}/${imageId}`;
  const existing = spellFaceCache.get(key);
  if (existing) return existing;
  const p = (locale === FALLBACK_LOCALE
    ? fetchImage(`/cards/spells/${imageId}.webp`)
    : fetchImage(`/cards/spells/${locale}/${imageId}.webp`)
        .then((img) => img ?? fetchImage(`/cards/spells/${imageId}.webp`)));
  spellFaceCache.set(key, p);
  return p;
}

let assetsReadyPromise: Promise<void> | null = null;
export function ensureCardAssetsReady(card?: CardView): Promise<void> {
  assetsReadyPromise ??= Promise.all([
    preloadImages(),
    ensurePrintSignsReady(),
    document.fonts.load(`16px "Modesto Poster"`),
    document.fonts.load(`16px "Noto Sans SC Variable"`, "简体中文"),
  ]).then(() => undefined);
  // Card text is per-locale and re-arms itself when the player switches
  // language, so it is awaited on every call instead of being folded into the
  // one-time bundle above; caching it there would pin the first locale.
  return Promise.all([assetsReadyPromise, ensureCardTextReady()])
    .then(() => card === undefined ? undefined : ensureCardFontsReady(card));
}

const cardFontPromises = new Map<string, Promise<void>>();

function ensureCardFontsReady(card: CardView): Promise<void> {
  const face = cardFace(card, asColor(card.color));
  const labels = Object.values(getPainterLabels()).join(" ");
  const sample = `${face.name}\n${face.description}\n${labels}`;
  let ready = cardFontPromises.get(sample);
  if (ready === undefined) {
    ready = Promise.all([
      document.fonts.load(`49px ${PAINTER_BODY_FONT}`, sample),
      document.fonts.load(`bold 49px ${PAINTER_BODY_FONT}`, sample),
      document.fonts.load(`italic 36px ${PAINTER_BODY_FONT}`, sample),
      document.fonts.load(`66px ${PAINTER_DISPLAY_FONT}`, sample),
    ]).then(() => document.fonts.ready).then(() => undefined);
    cardFontPromises.set(sample, ready);
  }
  return ready;
}

const bgCache = new Map<string, Promise<HTMLImageElement | undefined>>();
export function loadCardBackground(heroSlug: string, imageId: string): Promise<HTMLImageElement | undefined> {
  const key = `${heroSlug}/${imageId}`;
  const existing = bgCache.get(key);
  if (existing) return existing;
  const p = importCardImage(heroSlug, imageId);
  bgCache.set(key, p);
  return p;
}

const logoCache = new Map<string, Promise<HTMLImageElement | undefined>>();

export function loadHeroLogo(heroSlug: string): Promise<HTMLImageElement | undefined> {
  const existing = logoCache.get(heroSlug);
  if (existing) return existing;
  const p = new Promise<HTMLImageElement | undefined>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(undefined);
    img.src = `/cards/logos/${heroSlug}.png`;
  });
  logoCache.set(heroSlug, p);
  return p;
}

export function paintFacedown(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement | undefined,
): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (logo) {
    const targetW = CARD_W * 0.7;
    const targetH = targetW * (logo.height / logo.width);
    const x = (CARD_W - targetW) / 2;
    const y = (CARD_H - targetH) / 2;
    ctx.drawImage(logo, x, y, targetW, targetH);
  }
  const borderWidth = 22;
  const borderInset = 30;
  ctx.strokeStyle = "#292522";
  ctx.lineWidth = borderWidth;
  ctx.strokeRect(
    borderInset,
    borderInset,
    CARD_W - borderInset * 2,
    CARD_H - borderInset * 2,
  );
}

const TIER_TO_LEVEL: Record<string, string> = {
  I: "i",
  II: "ii",
  III: "iii",
  IV: "iv",
  UNTIERED: "i",
};

const VALID_COLORS = new Set<string>(Object.values(Color));
const VALID_TYPES = new Set<string>(Object.values(Type));
const VALID_ITEMS = new Set<string>(Object.values(Item));

function tierToLevel(tier: string): string {
  return TIER_TO_LEVEL[tier] ?? "i";
}

function asColor(c: string | null): Color {
  return c && VALID_COLORS.has(c) ? (c as Color) : Color.GOLD;
}

function asType(t: string | null): Type {
  return t && VALID_TYPES.has(t) ? (t as Type) : Type.ATTACK;
}

// The server names the area item RADIUS; the vendored painter calls it AREA.
const SERVER_ITEM_ALIASES: Record<string, string> = { RADIUS: Item.AREA };

export function asItem(i: string | null): Item {
  const name = i ? SERVER_ITEM_ALIASES[i] ?? i : null;
  return name && VALID_ITEMS.has(name) ? (name as Item) : Item.ATTACK;
}

/**
 * A defense that blocks without a number prints "!" instead of its 0. Printed
 * signs cover this too, so it only matters for a card the catalog does not
 * carry — a masked view without an id, or a hero still in development.
 */
function derivePrimarySign(value: number, action: Type): ValueSign {
  const blocks = action === Type.DEFENSE || action === Type.DEFENSE_SKILL;
  return value === 0 && blocks ? ValueSign.EXCLAMATION : ValueSign.NONE;
}

/**
 * Card face text, preferring the translation catalog. Backend effect_text is
 * the fallback for heroes not yet imported there (Cordelia) and for cards a
 * lagging vendored snapshot has never seen; it is written in the older `:icon:`
 * dialect, so it needs converting before the painter sees it.
 */
function cardFace(card: CardView, color: Color): { name: string; description: string } {
  const translated = card.id === undefined ? null : getCardText(card.id);
  if (translated !== null) {
    return { name: translated.name, description: translated.description };
  }
  return {
    name: card.name ?? "",
    description: translateEffectIcons(card.effect_text ?? "", color),
  };
}

// Translate the 2D-tooltip `:icon:` syntax to the painter's `::sprite::` syntax
// so server-supplied effect_text renders icons inline on the 3D card.
function translateEffectIcons(text: string, color: Color): string {
  const colorLower = color.toLowerCase();
  return text.replace(/(?<!:):([a-z_]+):(?!:)/g, (match, name) => {
    const def = CARD_ICONS[name];
    if (!def) return match;
    return `::${def.painterSprite(colorLower)}::`;
  });
}

export interface HeroStats {
  attack: number;
  defense: number;
  initiative: number;
  movement: number;
}

export function paintCard(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  card: CardView,
  background: HTMLImageElement | undefined,
  heroStats?: HeroStats,
): void {
  const color = asColor(card.color);
  const primaryType = asType(card.primary_action);
  const primaryValue = card.primary_action_value ?? 0;
  const secondary = card.secondary_actions ?? {};
  const secondaryMovement = secondary.MOVEMENT ?? 0;
  const secondaryDefense = secondary.DEFENSE ?? 0;
  const secondaryAttack = "ATTACK" in secondary ? secondary.ATTACK : null;

  const printed = card.id === undefined ? null : getPrintSign(card.id);
  const primarySign = printed?.primary ?? derivePrimarySign(primaryValue, primaryType);
  const modifierSign = printed?.modifier ?? ValueSign.NONE;

  let modifier: Modifier = Modifier.NONE;
  let modifierValue = 0;
  if (card.radius_value != null) {
    modifier = Modifier.AREA;
    modifierValue = card.radius_value;
  } else if (card.range_value != null) {
    modifier = Modifier.RANGE;
    modifierValue = card.range_value;
  }

  const face = cardFace(card, color);

  const paint = (description: string) =>
    updateCanvas(
      canvas,
      ctx,
      [],
      background,
      color,
      false, // handicap
      false, // extra
      face.name,
      description,
      tierToLevel(card.tier),
      asItem(card.item),
      card.initiative ?? 0,
      primaryType,
      Math.abs(primaryValue),
      primarySign,
      modifier,
      modifierValue,
      modifierSign,
      secondaryMovement,
      secondaryDefense,
      secondaryAttack,
      0, 0, 0, 0, 0, 0, // initiative/attack/defense/area/range/movement bonuses
      true, // showNumbers — always print actual values
      heroStats?.attack ?? 0,
      heroStats?.defense ?? 0,
      heroStats?.initiative ?? 0,
      heroStats?.movement ?? 0,
      getPainterLabels(),
    );

  try {
    paint(face.description);
  } catch (reason) {
    // The painter throws rather than overflow when text cannot be shrunk to
    // fit. That is right for the card archive it came from, but here it would
    // take down the board mid-game, so drop the text and keep the card
    // playable — the 2D tooltip still shows it in full.
    console.error(`Card "${card.id ?? face.name}" description does not fit; painting without it.`, reason);
    paint("");
  }
}
