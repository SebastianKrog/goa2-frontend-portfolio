import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { getLocale, subscribeLocale } from "../../../i18n/locale";
import type { CardView } from "../../../types/game";
import {
  CARD_W, CARD_H, SPELL_W, SPELL_H,
  ensureCardAssetsReady, loadCardBackground,
  paintCard, paintFacedown, loadHeroLogo,
  isSpellCard, loadSpellFace,
  type HeroStats,
} from "../cards/paintCard";

interface Props {
  card: CardView;
  heroSlug: string;
  heroStats?: HeroStats;
  width: number | string;
  className?: string;
}

export function CardCanvas({ card, heroSlug, heroStats, width, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Spell faces are pre-rendered landscape images; everything else is a
  // painter-drawn portrait card. Facedown spells keep the portrait back.
  const spellFace = isSpellCard(card) && !card.is_facedown;
  const [cw, ch] = spellFace ? [SPELL_W, SPELL_H] : [CARD_W, CARD_H];
  const height = typeof width === "number" ? width * (ch / cw) : "auto";

  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);

  const repaintKey = useMemo(() => {
    const sec = JSON.stringify(card.secondary_actions ?? {});
    return [
      card.id, card.name, card.image_id ?? "", card.color ?? "", card.tier,
      card.primary_action ?? "", card.primary_action_value ?? 0, card.initiative,
      card.effect_text ?? "", card.item ?? "", sec, heroSlug,
      card.is_facedown ? "back" : "front", spellFace ? "spell" : "card",
      heroStats?.attack ?? 0, heroStats?.defense ?? 0, heroStats?.initiative ?? 0, heroStats?.movement ?? 0,
      locale,
    ].join("|");
  }, [card, heroSlug, heroStats, spellFace, locale]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const canvas = ref.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      if (card.is_facedown) {
        const logo = await loadHeroLogo(heroSlug);
        if (cancelled) return;
        paintFacedown(canvas, ctx, logo);
        return;
      }
      if (spellFace && card.image_id) {
        const face = await loadSpellFace(card.image_id);
        if (cancelled) return;
        if (face) {
          ctx.clearRect(0, 0, SPELL_W, SPELL_H);
          ctx.drawImage(face, 0, 0, SPELL_W, SPELL_H);
          return;
        }
        console.warn(`[CardCanvas] missing spell face for "${card.image_id}", falling back to painter`);
      }
      await ensureCardAssetsReady(card);
      const bg = card.image_id ? await loadCardBackground(heroSlug, card.image_id) : undefined;
      if (cancelled) return;
      paintCard(canvas, ctx, card, bg, heroStats);
    })();
    return () => { cancelled = true; };
  }, [repaintKey]);

  return (
    <canvas
      ref={ref}
      width={cw}
      height={ch}
      className={className}
      style={{ width, height, display: "block", borderRadius: 12 }}
    />
  );
}
