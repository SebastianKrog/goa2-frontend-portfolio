/// <reference types="node" />
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "MobileGameShell.module.css"), "utf8");

const sheets: HTMLStyleElement[] = [];
function rules() {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  sheets.push(style);
  return [...style.sheet!.cssRules];
}
function declaration(list: CSSRule[], selector: string) {
  const rule = list.find((candidate) => "selectorText" in candidate && candidate.selectorText === selector) as CSSStyleRule;
  if (!rule) throw new Error(`Missing layout rule: ${selector}`);
  return rule.style;
}
afterEach(() => { for (const sheet of sheets.splice(0)) sheet.remove(); });

describe("mobile layout constraints (CSS declarations, not rendered pixels)", () => {
  it("keeps portrait pane and board bounds equal and reserves navigation/safe areas", () => {
    const list = rules();
    expect(declaration(list, ".board").inset).toBe(declaration(list, ".pane").inset);
    expect(declaration(list, ".board").inset).toContain("--mobile-nav-height");
    expect(declaration(list, ".stage").getPropertyValue("--mobile-nav-height")).toContain("safe-area-inset-bottom");
    expect(declaration(list, ".layout").height).toBe("100dvh");
    expect(declaration(list, ".paneContent").overflow).toBe("auto");
    expect(declaration(list, ".paneContent").getPropertyValue("min-height")).toBe("0");
  });

  it("contains board overlays under the pane, and leaves navigation above both", () => {
    const list = rules();
    const board = Number(declaration(list, ".board").getPropertyValue("z-index"));
    const pane = Number(declaration(list, ".pane").getPropertyValue("z-index"));
    const navigation = Number(declaration(list, ".navigation").getPropertyValue("z-index"));
    expect(board).toBeLessThan(pane);
    expect(pane).toBeLessThan(navigation);
  });

  it("uses the same landscape rail reservation for board and pane without hiding the board", () => {
    const list = rules();
    const landscape = list.find((rule) => "conditionText" in rule
      && String(rule.conditionText).includes("orientation: landscape")) as CSSMediaRule;
    const branch = [...landscape.cssRules];
    expect(declaration(branch, ".board, .pane").inset).toContain("--mobile-rail-width");
    expect(declaration(branch, ".navigation").width).toContain("--mobile-rail-width");
    expect(declaration(branch, ".navigation").getPropertyValue("overflow-y")).toBe("auto");
    expect(declaration(list, ".board").display).toBe("flex");
  });
});
