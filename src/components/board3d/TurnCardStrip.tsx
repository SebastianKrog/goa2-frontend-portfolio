import { Fragment } from "react";
import { CardMesh } from "./cards/CardMesh";
import { TURN_CARD_WIDTH, turnCardStripSlots, type SeatPlacement } from "./seating";
import type { CardView, PingTarget } from "../../types/game";

interface Props {
  placements: SeatPlacement[];
  onCardHover?: (card: CardView, heroSlug: string, target: PingTarget) => (hovered: boolean) => void;
}

/**
 * Every committed card copied into one row beside the map, after the Tabletop
 * Simulator mod's autoCard row. The copy renders the same CardView the mat
 * holds, so a facedown commit stays facedown here and flips with the original.
 */
export function TurnCardStrip({ placements, onCardHover }: Props) {
  const slugByHeroId = new Map(placements.map((p) => [p.hero.id, p.heroSlug]));

  return (
    <>
      {turnCardStripSlots(placements).map(({ hero, position }) => {
        const heroSlug = slugByHeroId.get(hero.id) ?? "";
        const cards: Array<{ card: CardView; zone: "CURRENT" | "EXTRA" }> = [];
        if (hero.current_turn_card) cards.push({ card: hero.current_turn_card, zone: "CURRENT" });
        if (hero.extra_turn_card) cards.push({ card: hero.extra_turn_card, zone: "EXTRA" });

        return (
          <Fragment key={hero.id}>
            {cards.map(({ card, zone }, index) => {
              // Emmitt's second commit sits beside the first, as it does on the mat.
              const spread = (index - (cards.length - 1) / 2) * TURN_CARD_WIDTH * 0.55;
              const target: PingTarget = { kind: "CARD", hero_id: hero.id, zone };
              return (
                <CardMesh
                  key={`${hero.id}:${zone}`}
                  card={card}
                  heroSlug={heroSlug}
                  position={[position[0] + spread, position[1], position[2]]}
                  rotation={[-Math.PI / 2, 0, 0]}
                  width={TURN_CARD_WIDTH}
                  animateFlip
                  onHoverChange={onCardHover?.(card, heroSlug, target)}
                />
              );
            })}
          </Fragment>
        );
      })}
    </>
  );
}
