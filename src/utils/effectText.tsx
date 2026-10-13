import React from "react";
import { CARD_ICONS } from "./cardIcons";

const ICON_TOKEN_RE = /(?<!:):([a-z_]+):(?!:)/g;

function renderLineWithIcons(line: string, lineIndex: number): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  ICON_TOKEN_RE.lastIndex = 0;

  while ((match = ICON_TOKEN_RE.exec(line)) !== null) {
    const tokenName = match[1];
    const def = CARD_ICONS[tokenName];
    if (!def) continue;

    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index));
    }

    parts.push(
      <img
        key={`${lineIndex}-${match.index}`}
        src={def.iconPath}
        alt={tokenName.replace("_", " ")}
        style={{ height: "1em", verticalAlign: "middle", margin: "0 1px", ...def.iconStyle }}
      />
    );

    lastIndex = ICON_TOKEN_RE.lastIndex;
  }

  if (lastIndex < line.length) {
    parts.push(line.slice(lastIndex));
  }

  return parts;
}

export function formatEffectText(text: string): React.ReactNode {
  const lines = text.split("\n");

  return lines.map((line, i) => (
    <React.Fragment key={i}>
      {i > 0 && <br />}
      {renderLineWithIcons(line, i)}
    </React.Fragment>
  ));
}
