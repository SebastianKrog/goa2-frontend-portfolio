// Shared sizing for enlarged ("lifted") painted cards in the 3D HUD: the hand
// fan's hovered/selected card and the SELECT_CARD overlay agree on one size so
// a card reads the same wherever it's surfaced.

// Card backing canvas is 1192x1664; the background art is natively 775px wide.
export const CARD_ASPECT = 1664 / 1192; // height / width

// Size the enlarged card as a fraction of the viewport HEIGHT. This keeps the
// card at a consistent screen footprint for everyone, and gives high-DPR screens
// their extra sharpness for free (more device pixels in the same physical space).
// On a DPR-1 screen the card can't be as crisp as DPR-2 at equal size — that's
// the display's pixel density — so the fraction is a size/readability tradeoff.
//
// Tunable live via ?handcardvh=<0.3..0.95> so the value can be dialed in per
// screen without a redeploy; the chosen value is then baked in as the default.
const DEFAULT_CARD_VH = 0.5; // dialed in via the ?handcardvh knob
const ART_NATIVE_W = 775; // card background art native width; don't upscale past it

export interface LiftSize {
  w: number;
  h: number;
  liftY: number;
  scale: number;
}

export function computeLift(): LiftSize {
  if (typeof window === "undefined") {
    return { w: 336, h: 336 * CARD_ASPECT, liftY: -195, scale: 336 / 150 };
  }
  const dpr = window.devicePixelRatio || 1;
  const param = parseFloat(new URLSearchParams(window.location.search).get("handcardvh") ?? "");
  const vh = Number.isFinite(param) ? Math.min(0.95, Math.max(0.3, param)) : DEFAULT_CARD_VH;

  let h = window.innerHeight * vh;
  let w = h / CARD_ASPECT;
  // Don't display wider than the art's native resolution in device pixels, or it
  // softens on high-DPI screens (text stays crisp from the 1192px backing).
  const maxW = ART_NATIVE_W / dpr;
  if (w > maxW) { w = maxW; h = w * CARD_ASPECT; }
  w = Math.max(240, w);
  h = w * CARD_ASPECT;
  // Lift the bottom-anchored card up so it clears the fan; -0.416 reproduces the
  // old -195px lift on the old 469px-tall card and scales with the new height.
  return { w, h, liftY: -(h * 0.416), scale: w / 150 };
}
