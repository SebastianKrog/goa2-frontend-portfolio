import type { ModelConfig } from "./red_heavy";
import { redHeavy } from "./red_heavy";
import { redMelee } from "./red_melee";
import { redRanged } from "./red_ranged";
import { blueHeavy } from "./blue_heavy";
import { blueMelee } from "./blue_melee";
import { blueRanged } from "./blue_ranged";

export type { ModelConfig };

export const MINION_MODELS: Record<string, ModelConfig> = {
  RED_HEAVY: redHeavy,
  RED_MELEE: redMelee,
  RED_RANGED: redRanged,
  BLUE_HEAVY: blueHeavy,
  BLUE_MELEE: blueMelee,
  BLUE_RANGED: blueRanged,
};

export const minionModelKey = (team: string, type: string) => `${team}_${type}`;
