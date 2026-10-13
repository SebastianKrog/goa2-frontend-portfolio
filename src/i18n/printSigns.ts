import { ValueSign } from "../vendor/goa2-translations/painter/painterTypes";

/**
 * A printed value sign. "4+" marks a value the card's own text can raise, "!"
 * a defense that blocks without a number. The engine resolves the condition at
 * runtime and never models the sign, so a live CardView cannot carry one — the
 * board reads it from the printed catalog instead.
 */
export interface PrintSign {
  primary?: ValueSign;
  modifier?: ValueSign;
}

let signs: Record<string, PrintSign> | null = null;
let ready: Promise<void> | null = null;

function signsUrl(): string {
  return `${import.meta.env.BASE_URL}goa2-translations/print-signs.json`;
}

/** Loads the printed signs once. Safe to call repeatedly. */
export function ensurePrintSignsReady(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    try {
      const response = await fetch(signsUrl());
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      signs = (await response.json()) as Record<string, PrintSign>;
    } catch (reason) {
      // Every lookup falls back to the value alone, so a failed load costs a
      // "+" rather than breaking the board.
      console.warn("Printed value signs unavailable; painting values unsigned.", reason);
      signs = null;
    }
  })();
  return ready;
}

/** Discards the loaded signs so the next ensurePrintSignsReady() refetches. */
export function resetPrintSigns(): void {
  signs = null;
  ready = null;
}

export function getPrintSign(cardId: string): PrintSign | null {
  return signs?.[cardId] ?? null;
}
