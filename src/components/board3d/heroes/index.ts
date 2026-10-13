export interface HeroConfig {
  gltfPath: string;
  originalGltfPath?: string;
  scale: number;
  xOffset: number;
  yOffset: number;
  zOffset: number;
  rotationDeg: number;
  brightness: number;
}

const defaults = {
  scale: 1.3,
  xOffset: 0,
  yOffset: -0.05,
  zOffset: 0,
  rotationDeg: 0,
  brightness: 1,
};

const ARCHIVED_ORIGINALS = new Set([
  "arien",
  "bain",
  "brogan",
  "brynn",
  "cutter",
  "dodger",
  "emmitt",
  "garrus",
  "gydion",
  "hanu",
  "ignatia",
  "min",
  "misa",
  "mortimer",
  "mrak",
  "nebkher",
  "razzle",
  "rowenna",
  "sabina",
  "silverarrow",
  "snorri",
  "swift",
  "takahide",
  "tali",
  "tigerclaw",
  "trinkets",
  "ursafar",
  "wasp",
  "whisper",
  "widget",
  "wuk",
  "xargatha",
]);

const hero = (name: string, overrides: Partial<HeroConfig> = {}): HeroConfig => ({
  gltfPath: `/models/heroes/${name}.glb`,
  ...(ARCHIVED_ORIGINALS.has(name)
    ? { originalGltfPath: `/models/heroes/original/${name}.glb` }
    : {}),
  ...defaults,
  ...overrides,
});

const legacyHero = (name: string, overrides: Partial<HeroConfig> = {}): HeroConfig => ({
  gltfPath: ARCHIVED_ORIGINALS.has(name)
    ? `/models/heroes/original/${name}.glb`
    : `/models/heroes/${name}.glb`,
  ...defaults,
  ...overrides,
});

export const HERO_MODELS: Record<string, HeroConfig> = {
  arien: hero("arien", { scale: 1.2, rotationDeg: 353, brightness: 2.55 }),
  bain: hero("bain", { rotationDeg: 342 }),
  brogan: hero("brogan", { rotationDeg: 184 }),
  brynn: hero("brynn", { rotationDeg: 90, brightness: 2.5 }),
  cutter: hero("cutter", { rotationDeg: 143 }),
  dodger: hero("dodger", { rotationDeg: 329 }),
  emmitt: hero("emmitt", { rotationDeg: 29 }),
  garrus: hero("garrus", { xOffset: 0.040, yOffset: -0.030, zOffset: -0.045, rotationDeg: 52, brightness: 1.35 }),
  gydion: hero("gydion", { rotationDeg: 39 }),
  hanu: hero("hanu", { xOffset: -0.065, yOffset: -0.295, zOffset: 0.05, rotationDeg: 261 }),
  ignatia: hero("ignatia", { rotationDeg: 155 }),
  min: hero("min", {
    scale: 1.4,
    xOffset: 0,
    yOffset: -0.05,
    zOffset: 0,
    rotationDeg: 184,
  }),
  misa: hero("misa", { rotationDeg: 176 }),
  mortimer: hero("mortimer", { rotationDeg: 33 }),
  mrak: hero("mrak", { rotationDeg: 182 }),
  nebkher: hero("nebkher", { rotationDeg: 45 }),
  razzle: hero("razzle", { rotationDeg: 0 }),
  rowenna: hero("rowenna", { xOffset: -0.010, yOffset: -0.330, zOffset: -0.010, rotationDeg: 16 }),
  sabina: hero("sabina", { rotationDeg: 0 }),
  silverarrow: hero("silverarrow", { rotationDeg: 96 }),
  snorri: hero("snorri", { rotationDeg: 359 }),
  swift: hero("swift", { rotationDeg: 262 }),
  takahide: hero("takahide", { scale: 1.2, rotationDeg: 265, brightness: 1.45 }),
  tali: hero("tali", { rotationDeg: 74 }),
  tigerclaw: hero("tigerclaw", { scale: 1.15, rotationDeg: 82, brightness: 3 }),
  trinkets: hero("trinkets", { rotationDeg: 67 }),
  ursafar: hero("ursafar", { rotationDeg: 0 }),
  wasp: hero("wasp", { rotationDeg: 0 }),
  whisper: hero("whisper", { xOffset: -0.110, yOffset: -0.050, zOffset: 0.025, rotationDeg: 185 }),
  widget: hero("widget", { rotationDeg: 349 }),
  wuk: hero("wuk", { rotationDeg: 256, brightness: 2.35 }),
  xargatha: hero("xargatha", { rotationDeg: 110 }),
};

/**
 * Runtime transforms from master at 0bc2c0e, before the painted-model branch.
 * Keep this table independent from HERO_MODELS: the archived meshes were tuned
 * against these values, while the painted meshes use the calibrations above.
 */
export const LEGACY_HERO_MODELS: Record<string, HeroConfig> = {
  arien: legacyHero("arien", { rotationDeg: 319 }),
  bain: legacyHero("bain", { rotationDeg: 35 }),
  brogan: legacyHero("brogan", { rotationDeg: 218 }),
  brynn: legacyHero("brynn", { rotationDeg: 74 }),
  cutter: legacyHero("cutter", { rotationDeg: 227 }),
  dodger: legacyHero("dodger", { rotationDeg: 20 }),
  emmitt: legacyHero("emmitt"),
  garrus: legacyHero("garrus", { rotationDeg: 123 }),
  gydion: legacyHero("gydion", { rotationDeg: 326 }),
  hanu: legacyHero("hanu", { xOffset: -0.065, yOffset: -0.295, zOffset: 0.05, rotationDeg: 341 }),
  ignatia: legacyHero("ignatia", { rotationDeg: 170 }),
  min: legacyHero("min", { rotationDeg: 34 }),
  misa: legacyHero("misa", { rotationDeg: 190 }),
  mortimer: legacyHero("mortimer", { rotationDeg: 53 }),
  mrak: legacyHero("mrak", { rotationDeg: 178 }),
  nebkher: legacyHero("nebkher", { rotationDeg: 326 }),
  razzle: legacyHero("razzle", { rotationDeg: 12 }),
  rowenna: legacyHero("rowenna", { xOffset: -0.055, yOffset: -0.340, zOffset: -0.060, rotationDeg: 41 }),
  sabina: legacyHero("sabina", { rotationDeg: 23 }),
  silverarrow: legacyHero("silverarrow", { rotationDeg: 275 }),
  snorri: legacyHero("snorri", { rotationDeg: 329 }),
  swift: legacyHero("swift", { rotationDeg: 251 }),
  takahide: legacyHero("takahide", { rotationDeg: 204 }),
  tali: legacyHero("tali", { rotationDeg: 112 }),
  tigerclaw: legacyHero("tigerclaw", { rotationDeg: 70 }),
  trinkets: legacyHero("trinkets", { rotationDeg: 313 }),
  ursafar: legacyHero("ursafar", { rotationDeg: 14 }),
  wasp: legacyHero("wasp", { rotationDeg: 32 }),
  whisper: legacyHero("whisper", { rotationDeg: 138 }),
  widget: legacyHero("widget", { rotationDeg: 304 }),
  wuk: legacyHero("wuk", { rotationDeg: 255 }),
  xargatha: legacyHero("xargatha", { rotationDeg: 94 }),
};

export const heroModelKey = (heroId: string) => {
  const key = heroId.toLowerCase().replace(/^hero_/, "");
  return key.replace(/^razzle_piece_\d+$/, "razzle");
};

export const trinketsTurretModelPath = (useLegacy: boolean) => (
  useLegacy
    ? "/models/heroes/original/turret_trinkets.glb"
    : "/models/heroes/turret_trinkets.glb"
);
