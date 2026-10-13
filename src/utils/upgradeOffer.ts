import type { UpgradeOption } from "../types/game";

/**
 * Identity of the upgrade offer standing in front of one hero.
 *
 * The upgrade panel keeps the player's pick until this changes. It deliberately
 * ignores the request id: UPGRADE_PHASE is a simultaneous request, and the
 * engine re-issues it every time *any* player confirms, so keying on the id
 * would wipe your selection while another player was still deciding.
 */
export function upgradeOfferKey(offer?: { remaining: number; options: UpgradeOption[] }): string {
  if (!offer) return "";
  const cardIds = offer.options.flatMap((option) => option.card_details.map((card) => card.id));
  return `${offer.remaining}:${cardIds.join(",")}`;
}
