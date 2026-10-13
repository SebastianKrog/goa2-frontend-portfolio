import { useEffect, useState } from "react";

export function useAltHeld(): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    // A lone Alt press is the browser's shortcut to focus the menu bar, which
    // blurs the game and can strand the card view on screen. Suppress the
    // default for the bare Alt key (Firefox acts on keyup, Chrome on keydown).
    const down = (e: KeyboardEvent) => {
      if (e.key === "Alt" && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
        e.preventDefault();
        setHeld(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        e.preventDefault();
        setHeld(false);
      }
    };
    const blur = () => setHeld(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);
  return held;
}
