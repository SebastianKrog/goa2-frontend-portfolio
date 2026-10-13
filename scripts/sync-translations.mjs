#!/usr/bin/env node
// Vendors the painter and card catalog from the goa2-translations repo.
//
// goa2-translations is a separate, unpublished repo (private: true, dist/
// gitignored), so its `exports` map cannot be installed as a dependency. The
// files below are copied in and committed so the frontend builds standalone on
// Cloudflare without a sibling checkout.
//
//   node scripts/sync-translations.mjs [--from <path>] [--check]
//
// --check exits non-zero when anything would change, for CI drift detection.

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VENDOR_DIR = join(FRONTEND, "src/vendor/goa2-translations");
const PUBLIC_DIR = join(FRONTEND, "public/goa2-translations");

// Directory structure is preserved so cardPainter.ts's `../types` keeps
// resolving without rewriting the specifier itself.
const CODE = [
  ["src/types.ts", "types.ts"],
  ["src/painter/painterTypes.ts", "painter/painterTypes.ts"],
  ["src/painter/cardPainter.ts", "painter/cardPainter.ts"],
  ["src/painter/vendor/linebreak.js", "painter/vendor/linebreak.js"],
  ["src/painter/vendor/linebreak.d.ts", "painter/vendor/linebreak.d.ts"],
];

const DATA = [
  ["data/locales/en.json", "locales/en.json"],
  ["data/locales/pt-BR.json", "locales/pt-BR.json"],
  ["data/locales/zh-Hans.json", "locales/zh-Hans.json"],
];

// Value signs are a printing convention, not game state: "4+" marks an attack
// the card's own text can raise. The backend never models them, so a live
// CardView cannot carry one and the board has to read them from the printed
// data. Projecting the signs out of cards.json keeps the mechanics themselves
// coming from the backend, per the note above.
const DERIVED = [["data/cards.json", "print-signs.json", projectPrintSigns]];

function projectPrintSigns(raw) {
  const cards = Object.values(JSON.parse(raw).cards ?? {}).flatMap((card) =>
    Array.isArray(card) ? card : [card],
  );
  const signs = {};
  for (const card of cards) {
    const entry = {};
    if (card.primaryValueSign && card.primaryValueSign !== "NONE") {
      entry.primary = card.primaryValueSign;
    }
    if (card.modifierValueSign && card.modifierValueSign !== "NONE") {
      entry.modifier = card.modifierValueSign;
    }
    if (Object.keys(entry).length > 0) signs[card.id] = entry;
  }
  // The field names come from the Stats source, so a rename upstream would
  // otherwise write a well-formed empty map and silently drop every sign.
  if (Object.keys(signs).length === 0) {
    throw new Error("No value signs found in cards.json; has the field been renamed?");
  }
  const drawn = new Set(["PLUS", "MINUS", "EXCLAMATION"]);
  for (const [id, entry] of Object.entries(signs)) {
    for (const value of Object.values(entry)) {
      if (!drawn.has(value)) {
        throw new Error(`${id} prints ${value}, which the painter cannot draw`);
      }
    }
  }
  return `${JSON.stringify(signs, null, 2)}\n`;
}

// Deliberately not vendored:
//   paintCard.ts  the frontend keeps its own adapter, mapping a live CardView
//                 (facedown masking, runtime-derived modifiers) rather than a
//                 static LocalizedCard.
//   catalog.ts    createCardCatalog needs cards.json mechanics and throws on a
//                 missing translation. Card mechanics arrive live from the
//                 backend and a miss must fall back to effect_text, so
//                 src/i18n/cardText.ts resolves against the locale files alone.
//   cards.json    same reason — the live CardView is the source for mechanics.
//   painter.css   its Modesto @font-face points at the package's own assets/
//                 layout; board3d/cards/cardFonts.css declares that face for
//                 this repo and imports the separately vendored Noto CSS.

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const fromIndex = args.indexOf("--from");
const SOURCE = resolve(
  fromIndex === -1
    ? process.env.GOA2_TRANSLATIONS_DIR ?? join(FRONTEND, "../goa2-translations")
    : args[fromIndex + 1],
);

if (!existsSync(join(SOURCE, "data/cards.json"))) {
  console.error(`Not a goa2-translations checkout: ${SOURCE}`);
  console.error("Pass --from <path> or set GOA2_TRANSLATIONS_DIR.");
  process.exit(1);
}

// Noto Sans SC is split into unicode-range subsets. Copy the complete set so
// later Chinese translations cannot introduce a glyph the frontend does not
// ship; browsers still download only the subsets needed by the visible text.
const NOTO_SOURCE = "assets/fonts/noto-sans-sc";
const NOTO_DESTINATION = "fonts/noto-sans-sc";
const ASSETS = [
  [join(NOTO_SOURCE, "LICENSE"), join(NOTO_DESTINATION, "LICENSE")],
  [join(NOTO_SOURCE, "wght.css"), join(NOTO_DESTINATION, "wght.css")],
  ...readdirSync(join(SOURCE, NOTO_SOURCE, "files"))
    .filter((name) => name.endsWith(".woff2"))
    .sort()
    .map((name) => [
      join(NOTO_SOURCE, "files", name),
      join(NOTO_DESTINATION, "files", name),
    ]),
];

// Bundler-mode resolution does not map `./foo.js` onto `./foo.ts`, and no other
// file in src/ carries extensions on relative imports.
function stripJsExtensions(source) {
  return source.replace(
    /(from\s+['"]\.\.?\/[^'"]+)\.js(['"])/g,
    (match, specifier, quote) =>
      specifier.endsWith("/vendor/linebreak") ? match : `${specifier}${quote}`,
  );
}

const changed = [];

// Read before the manifest is rewritten below; prune() diffs against it.
const previous = (() => {
  const path = join(VENDOR_DIR, "VENDORED.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
})();

function emit(destRoot, relative, contents) {
  const destination = join(destRoot, relative);
  const previous = existsSync(destination) ? readFileSync(destination) : null;
  const next = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
  if (previous?.equals(next)) return;
  changed.push(relative);
  if (checkOnly) return;
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, next);
}

for (const [from, to] of CODE) {
  const raw = readFileSync(join(SOURCE, from), "utf8");
  const body = to.endsWith(".ts") ? stripJsExtensions(raw) : raw;
  emit(VENDOR_DIR, to, `${banner(from)}${body}`);
}

for (const [from, to] of DATA) {
  emit(PUBLIC_DIR, to, readFileSync(join(SOURCE, from), "utf8"));
}

for (const [from, to] of ASSETS) {
  emit(VENDOR_DIR, to, readFileSync(join(SOURCE, from)));
}

for (const [from, to, project] of DERIVED) {
  emit(PUBLIC_DIR, to, project(readFileSync(join(SOURCE, from), "utf8")));
}

function banner(from) {
  return `// Vendored from goa2-translations (${from}). Do not edit — see scripts/sync-translations.mjs.\n`;
}

function sourceCommit() {
  try {
    return execFileSync("git", ["-C", SOURCE, "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

// Sprite names live in painterTypes.ts but the PNGs ship with the frontend, so
// a rename upstream would silently paint nothing.
// cardPainter.ts maps radius_silver onto the area_silver sheet.
const SPRITE_ALIASES = new Set(["radius_silver"]);

function missingSprites() {
  const available = new Set(
    readdirSync(join(FRONTEND, "public/cards/sheets"))
      .filter((name) => name.endsWith(".png"))
      .map((name) => name.slice(0, -4)),
  );
  const declared = readFileSync(join(SOURCE, "src/painter/painterTypes.ts"), "utf8");
  const names = new Set();
  for (const list of ["defaultEmoji", "imageNames"]) {
    const block = declared.match(new RegExp(`export const ${list} = \\[([\\s\\S]*?)\\]`));
    if (block === null) {
      console.warn(`Could not read the ${list} sprite list; skipping that check.`);
      continue;
    }
    for (const quoted of block[1].matchAll(/"([a-z0-9_]+)"/g)) names.add(quoted[1]);
  }
  return [...names]
    .filter((name) => !available.has(name) && !SPRITE_ALIASES.has(name))
    .sort();
}

const manifest = JSON.stringify(
  {
    source: "goa2-translations",
    commit: sourceCommit(),
    syncedAt: new Date().toISOString().slice(0, 10),
    files: [...CODE.map(([, to]) => `src/vendor/goa2-translations/${to}`),
            ...DATA.map(([, to]) => `public/goa2-translations/${to}`),
            ...ASSETS.map(([, to]) => `src/vendor/goa2-translations/${to}`),
            ...DERIVED.map(([, to]) => `public/goa2-translations/${to}`)],
  },
  null,
  2,
);
emit(VENDOR_DIR, "VENDORED.json", `${manifest}\n`);

// Files dropped from the lists above would otherwise linger and keep compiling.
function prune(previousManifest) {
  const kept = new Set([
    ...CODE.map(([, to]) => `src/vendor/goa2-translations/${to}`),
    ...DATA.map(([, to]) => `public/goa2-translations/${to}`),
    ...ASSETS.map(([, to]) => `src/vendor/goa2-translations/${to}`),
    ...DERIVED.map(([, to]) => `public/goa2-translations/${to}`),
  ]);
  for (const file of previousManifest?.files ?? []) {
    if (kept.has(file) || !existsSync(join(FRONTEND, file))) continue;
    changed.push(`${file} (removed)`);
    if (!checkOnly) rmSync(join(FRONTEND, file));
  }
}

prune(previous);

const missing = missingSprites();
if (missing.length > 0) {
  console.warn(`Sprite PNGs referenced by the painter but absent from public/cards/sheets:`);
  for (const name of missing) console.warn(`  ${name}`);
}

if (checkOnly) {
  if (changed.length > 0) {
    console.error(`Vendored files are stale (${changed.length}):`);
    for (const file of changed) console.error(`  ${file}`);
    process.exit(1);
  }
  console.log("Vendored files are up to date.");
} else {
  console.log(
    changed.length === 0
      ? "Already up to date."
      : `Updated ${changed.length} file(s):\n${changed.map((f) => `  ${f}`).join("\n")}`,
  );
}
