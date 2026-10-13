import type { Hex } from "../../../types/game";

export interface MapConfig {
  name: string;
  imagePath: string;
  /** World units the image spans horizontally; height follows the image aspect. */
  imageSize: number;
  hexSize: number;              // hex radius in world units
  origin: { x: number; z: number };  // where hex (0,0,0) sits on the plane
  rotationDeg: number;          // grid rotation around Y axis, degrees
  /**
   * One hex and the normalised image point (0..1, top-left origin) the map
   * editor aligned it to. Checked in dev to catch any drift between the
   * editor's model of the board and how the board actually renders. Optional:
   * maps calibrated before the editor emitted it simply are not checked.
   */
  check?: { hex: Hex; u: number; v: number };
}
