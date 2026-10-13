export const COMMITTED_CARDS_KEY = "goa2:committed-cards";

/** The panel shows unless the player has explicitly dismissed it. */
export function readCommittedCardsHidden(storage: Pick<Storage, "getItem">): boolean {
  return storage.getItem(COMMITTED_CARDS_KEY) === "hidden";
}
