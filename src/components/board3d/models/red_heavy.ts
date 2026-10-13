export interface ModelConfig {
  objPath: string;
  texturePath: string;
  scale: number;        // uniform scale multiplier (1 = use model as-exported)
  xOffset: number;      // horizontal shift in the grid's local X (per-model fine-tune)
  yOffset: number;      // vertical lift above the hex tile, in world units
  zOffset: number;      // horizontal shift in the grid's local Z (per-model fine-tune)
  rotationDeg: number;  // Y rotation applied IN ADDITION to the grid's rotation
}

export const redHeavy: ModelConfig = {
  objPath: "/models/red_heavy.obj",
  texturePath: "/models/red_heavy.jpg",
  scale: 1.65,
  xOffset: 0.065,
  yOffset: 0,
  zOffset: 0.020,
  rotationDeg: 196,
};
