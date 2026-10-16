import { useEffect, useRef, type ReactNode } from "react";
import { MOBILE_PANES, type MobilePane } from "./useMobileNavigation";
import styles from "./MobileGameShell.module.css";

const PANE_LABELS: Record<MobilePane, string> = {
  board: "Board", heroes: "Heroes", hand: "Hand", deck: "Deck", log: "Log", settings: "Settings",
};

interface Props {
  mobile: boolean;
  desktopClassName: string;
  sidebar: ReactNode;
  pane: MobilePane;
  onTogglePane: (pane: Exclude<MobilePane, "board">) => void;
  onClose: () => void;
  renderPane: (pane: Exclude<MobilePane, "board">) => ReactNode;
  children: ReactNode;
}

/** Layout slots only: the live session and all game actions belong to GameView. */
export function MobileGameShell({ mobile, desktopClassName, sidebar, pane, onTogglePane, onClose, renderPane, children }: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const previousPane = useRef<MobilePane>("board");

  useEffect(() => {
    if (!mobile) return;
    if (pane !== "board") panelRef.current?.focus();
    else if (previousPane.current !== "board") {
      navRef.current?.querySelector<HTMLButtonElement>(`[data-pane="${previousPane.current}"]`)?.focus();
    }
    previousPane.current = pane;
  }, [mobile, pane]);

  if (!mobile) return <div className={desktopClassName}>{children}{sidebar}</div>;

  return (
    <main className={styles.stage} aria-label="Mobile game">
      {/* Never conditionally mount or hide this slot: SVG camera dimensions stay stable. */}
      <div className={styles.board} inert={pane !== "board"} aria-hidden={pane !== "board" ? true : undefined}>
        {children}
      </div>
      {pane !== "board" && (
        <section className={styles.pane} aria-labelledby="mobile-pane-heading" tabIndex={-1} ref={panelRef}>
          <div className={styles.paneHeader}>
            <h1 id="mobile-pane-heading">{PANE_LABELS[pane]}</h1>
            <button type="button" onClick={onClose} aria-label="Return to Board">Board</button>
          </div>
          <div className={styles.paneContent}>{renderPane(pane)}</div>
        </section>
      )}
      <nav className={styles.navigation} aria-label="Game views" ref={navRef}>
        {MOBILE_PANES.map((item) => (
          <button key={item} type="button" data-pane={item} aria-pressed={pane === item}
            onClick={() => onTogglePane(item)}>{PANE_LABELS[item]}</button>
        ))}
      </nav>
    </main>
  );
}
