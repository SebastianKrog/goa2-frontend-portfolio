import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TimeControlConfig } from "../../types/game";
import { STANDARD_TIME_CONTROL } from "../../utils/timeControl";
import { TimeControlSettings } from "./TimeControlSettings";

function render(value: TimeControlConfig | null, readOnly = false) {
  return renderToStaticMarkup(
    <TimeControlSettings value={value} onChange={() => {}} readOnly={readOnly} />,
  );
}

describe("TimeControlSettings", () => {
  it("offers no clock fields for an untimed match", () => {
    const html = render(null);
    expect(html).toContain("Use match clocks");
    expect(html).not.toContain("Enforce timeouts");
  });

  it("shows the enforcement toggle for the standard preset", () => {
    const html = render({ ...STANDARD_TIME_CONTROL });
    expect(html).toContain("Enforce timeouts");
    expect(html).toContain("Standard preset");
  });

  it("marks an enforced setup as custom", () => {
    const html = render({ ...STANDARD_TIME_CONTROL, enforce_timeouts: true });
    expect(html).toContain("Custom values");
  });

  it("names the mode in the read-only summary", () => {
    expect(render({ ...STANDARD_TIME_CONTROL }, true)).toContain("Advisory");
    expect(
      render({ ...STANDARD_TIME_CONTROL, enforce_timeouts: true }, true),
    ).toContain("Enforced");
  });
});
