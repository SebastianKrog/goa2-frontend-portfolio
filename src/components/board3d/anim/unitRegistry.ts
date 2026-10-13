import * as THREE from "three";

/**
 * Live registry of each unit's current position in **board-group local space**
 * (the same space hexes are computed in, inside the `originX/originZ` +
 * rotation group). `AnimatedUnit` writes its eased position here every frame;
 * transient event-driven effects (combat lunges, impact flashes, floating
 * numbers) read it to place themselves on the right unit — even while that unit
 * is mid-slide.
 *
 * Effects must therefore be rendered inside the same board group for the
 * coordinates to line up.
 */
const positions = new Map<string, THREE.Vector3>();

/** Register/refresh a unit's live position. The vector is stored by reference
 * so readers always see the latest frame without re-registering. */
export function registerUnitPosition(id: string, vec: THREE.Vector3): void {
  positions.set(id, vec);
}

export function unregisterUnitPosition(id: string): void {
  positions.delete(id);
}

/** Returns the unit's live position vector, or undefined if not on the board. */
export function getUnitPosition(id: string | null | undefined): THREE.Vector3 | undefined {
  if (!id) return undefined;
  return positions.get(id);
}
