export const RESOLUTION_QUEUE_KEY = "goa2:resolution-queue";

/** The queue shows unless the player has explicitly collapsed it. */
export function readResolutionQueueCollapsed(storage: Pick<Storage, "getItem">): boolean {
  return storage.getItem(RESOLUTION_QUEUE_KEY) === "collapsed";
}
