import type { GameLayout } from "./mobileLayout";
import type { MobileDialog } from "./useMobileNavigation";
import styles from "./MobileGameShell.module.css";

interface Props {
  onLayoutChange: (layout: GameLayout) => void;
  showRemotePointers: boolean;
  onShowRemotePointersChange: (visible: boolean) => void;
  onOpenDialog: (dialog: MobileDialog) => void;
  canFixState: boolean;
  onRequestPause?: () => void;
}

export function MobileGameSettings({ onLayoutChange, showRemotePointers, onShowRemotePointersChange, onOpenDialog, canFixState, onRequestPause }: Props) {
  return <div className={styles.settings}>
    <label>Layout
      <select aria-label="Game layout" value="mobile"
        onChange={(event) => onLayoutChange(event.target.value as GameLayout)}>
        <option value="mobile">Mobile 2D</option>
        <option value="desktop2d">Desktop 2D</option>
        <option value="desktop3d">Desktop 3D</option>
      </select>
    </label>
    <label><input type="checkbox" checked={showRemotePointers}
      onChange={(event) => onShowRemotePointersChange(event.target.checked)} />
      Show other players' cursors</label>
    <button type="button" onClick={() => onOpenDialog("report")}>Report bug</button>
    <button type="button" onClick={() => onOpenDialog("share")}>Share links</button>
    {canFixState && <button type="button" onClick={() => onOpenDialog("override")}>Fix game state</button>}
    {onRequestPause && <button type="button" onClick={onRequestPause}>Request pause</button>}
  </div>;
}
