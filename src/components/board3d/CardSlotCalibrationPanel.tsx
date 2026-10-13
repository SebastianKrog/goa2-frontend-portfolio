interface Props {
  cardWidth: number;
  slotY: number;
  slotFirstX: number;
  slotSpacing: number;
  commitY: number;
  discardX: number;
  discardStackY: number;
  discardStackLift: number;
  ultimateX: number;
  ultimateY: number;
  deckX: number;
  deckY: number;
  statusX: number;
  statusY: number;
  itemY: number;
  runeY: number;
  runeSize: number;
  spellbookX: number;
  spellbookY: number;
  castFirstX: number;
  castSpacing: number;
  spellWidth: number;
  wishX: number;
  wishY: number;
  onCardWidth: (n: number) => void;
  onSlotY: (n: number) => void;
  onSlotFirstX: (n: number) => void;
  onSlotSpacing: (n: number) => void;
  onCommitY: (n: number) => void;
  onDiscardX: (n: number) => void;
  onDiscardStackY: (n: number) => void;
  onDiscardStackLift: (n: number) => void;
  onUltimateX: (n: number) => void;
  onUltimateY: (n: number) => void;
  onDeckX: (n: number) => void;
  onDeckY: (n: number) => void;
  onStatusX: (n: number) => void;
  onStatusY: (n: number) => void;
  onItemY: (n: number) => void;
  onRuneY: (n: number) => void;
  onRuneSize: (n: number) => void;
  onSpellbookX: (n: number) => void;
  onSpellbookY: (n: number) => void;
  onCastFirstX: (n: number) => void;
  onCastSpacing: (n: number) => void;
  onSpellWidth: (n: number) => void;
  onWishX: (n: number) => void;
  onWishY: (n: number) => void;
}

const panelStyle: React.CSSProperties = {
  position: "fixed",
  top: 80,
  right: 16,
  background: "rgba(20, 16, 12, 0.92)",
  border: "1px solid rgba(255, 255, 255, 0.18)",
  borderRadius: 8,
  padding: "12px 14px",
  color: "#fff",
  fontFamily: "monospace",
  fontSize: 12,
  zIndex: 100,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  minWidth: 260,
  maxHeight: "calc(100vh - 100px)",
  overflowY: "auto",
};

const rowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "78px 1fr 60px",
  alignItems: "center",
  gap: 8,
};

export function CardSlotCalibrationPanel({
  cardWidth, slotY, slotFirstX, slotSpacing, commitY, discardX, discardStackY, discardStackLift,
  ultimateX, ultimateY, deckX, deckY, statusX, statusY, itemY, runeY, runeSize,
  spellbookX, spellbookY, castFirstX, castSpacing, spellWidth, wishX, wishY,
  onCardWidth, onSlotY, onSlotFirstX, onSlotSpacing, onCommitY, onDiscardX, onDiscardStackY, onDiscardStackLift,
  onUltimateX, onUltimateY, onDeckX, onDeckY, onStatusX, onStatusY, onItemY, onRuneY, onRuneSize,
  onSpellbookX, onSpellbookY, onCastFirstX, onCastSpacing, onSpellWidth, onWishX, onWishY,
}: Props) {
  return (
    <div style={panelStyle}>
      <div style={{ fontWeight: 700, opacity: 0.7, letterSpacing: 1 }}>CARD SLOT CALIBRATION</div>

      <div style={rowStyle}>
        <label>card width</label>
        <input
          type="range"
          min={0.3}
          max={1.5}
          step={0.005}
          value={cardWidth}
          onChange={(e) => onCardWidth(parseFloat(e.target.value))}
        />
        <span>{cardWidth.toFixed(3)}</span>
      </div>

      <div style={rowStyle}>
        <label>slot Y</label>
        <input
          type="range"
          min={-1.5}
          max={1.5}
          step={0.005}
          value={slotY}
          onChange={(e) => onSlotY(parseFloat(e.target.value))}
        />
        <span>{slotY.toFixed(3)}</span>
      </div>

      <div style={rowStyle}>
        <label>first slot X</label>
        <input
          type="range"
          min={-3}
          max={0}
          step={0.005}
          value={slotFirstX}
          onChange={(e) => onSlotFirstX(parseFloat(e.target.value))}
        />
        <span>{slotFirstX.toFixed(3)}</span>
      </div>

      <div style={rowStyle}>
        <label>slot spacing</label>
        <input
          type="range"
          min={0.3}
          max={1.5}
          step={0.005}
          value={slotSpacing}
          onChange={(e) => onSlotSpacing(parseFloat(e.target.value))}
        />
        <span>{slotSpacing.toFixed(3)}</span>
      </div>

      <div style={rowStyle}>
        <label>commit Y</label>
        <input
          type="range"
          min={-3}
          max={3}
          step={0.01}
          value={commitY}
          onChange={(e) => onCommitY(parseFloat(e.target.value))}
        />
        <span>{commitY.toFixed(2)}</span>
      </div>

      <div style={rowStyle}>
        <label>discard X</label>
        <input
          type="range"
          min={0}
          max={3}
          step={0.005}
          value={discardX}
          onChange={(e) => onDiscardX(parseFloat(e.target.value))}
        />
        <span>{discardX.toFixed(3)}</span>
      </div>

      <div style={rowStyle}>
        <label>stack ΔY</label>
        <input
          type="range"
          min={-0.1}
          max={0.1}
          step={0.001}
          value={discardStackY}
          onChange={(e) => onDiscardStackY(parseFloat(e.target.value))}
        />
        <span>{discardStackY.toFixed(3)}</span>
      </div>

      <div style={rowStyle}>
        <label>stack lift</label>
        <input
          type="range"
          min={0}
          max={0.02}
          step={0.0005}
          value={discardStackLift}
          onChange={(e) => onDiscardStackLift(parseFloat(e.target.value))}
        />
        <span>{discardStackLift.toFixed(4)}</span>
      </div>

      <div style={rowStyle}>
        <label>ultimate X</label>
        <input
          type="range"
          min={-3}
          max={3}
          step={0.005}
          value={ultimateX}
          onChange={(e) => onUltimateX(parseFloat(e.target.value))}
        />
        <span>{ultimateX.toFixed(3)}</span>
      </div>

      <div style={rowStyle}>
        <label>ultimate Y</label>
        <input
          type="range"
          min={-1.5}
          max={1.5}
          step={0.005}
          value={ultimateY}
          onChange={(e) => onUltimateY(parseFloat(e.target.value))}
        />
        <span>{ultimateY.toFixed(3)}</span>
      </div>

      <div style={rowStyle}>
        <label>deck X</label>
        <input
          type="range"
          min={-3}
          max={3}
          step={0.005}
          value={deckX}
          onChange={(e) => onDeckX(parseFloat(e.target.value))}
        />
        <span>{deckX.toFixed(3)}</span>
      </div>

      <div style={rowStyle}>
        <label>deck Y</label>
        <input
          type="range"
          min={-1.5}
          max={1.5}
          step={0.005}
          value={deckY}
          onChange={(e) => onDeckY(parseFloat(e.target.value))}
        />
        <span>{deckY.toFixed(3)}</span>
      </div>

      <div style={rowStyle}>
        <label>status X</label>
        <input
          type="range"
          min={-3}
          max={3}
          step={0.005}
          value={statusX}
          onChange={(e) => onStatusX(parseFloat(e.target.value))}
        />
        <span>{statusX.toFixed(3)}</span>
      </div>

      <div style={rowStyle}>
        <label>status Y</label>
        <input
          type="range"
          min={-1.5}
          max={1.5}
          step={0.005}
          value={statusY}
          onChange={(e) => onStatusY(parseFloat(e.target.value))}
        />
        <span>{statusY.toFixed(3)}</span>
      </div>

      <div style={rowStyle}>
        <label>item Y</label>
        <input
          type="range"
          min={-1.5}
          max={1.5}
          step={0.005}
          value={itemY}
          onChange={(e) => onItemY(parseFloat(e.target.value))}
        />
        <span>{itemY.toFixed(3)}</span>
      </div>

      <div style={rowStyle}>
        <label>rune Y</label>
        <input
          type="range"
          min={-1.5}
          max={1.5}
          step={0.005}
          value={runeY}
          onChange={(e) => onRuneY(parseFloat(e.target.value))}
        />
        <span>{runeY.toFixed(3)}</span>
      </div>

      <div style={rowStyle}>
        <label>rune size</label>
        <input
          type="range"
          min={0.1}
          max={0.8}
          step={0.005}
          value={runeSize}
          onChange={(e) => onRuneSize(parseFloat(e.target.value))}
        />
        <span>{runeSize.toFixed(3)}</span>
      </div>

      <div style={{ fontWeight: 700, opacity: 0.7, letterSpacing: 1, marginTop: 6 }}>SPELL ZONES</div>

      <div style={rowStyle}>
        <label>spellbook X</label>
        <input
          type="range"
          min={-5}
          max={3}
          step={0.005}
          value={spellbookX}
          onChange={(e) => onSpellbookX(parseFloat(e.target.value))}
        />
        <span>{spellbookX.toFixed(3)}</span>
      </div>

      <div style={rowStyle}>
        <label>spellbook Y</label>
        <input
          type="range"
          min={-3}
          max={1.5}
          step={0.005}
          value={spellbookY}
          onChange={(e) => onSpellbookY(parseFloat(e.target.value))}
        />
        <span>{spellbookY.toFixed(3)}</span>
      </div>

      <div style={rowStyle}>
        <label>cast first X</label>
        <input
          type="range"
          min={-5}
          max={3}
          step={0.005}
          value={castFirstX}
          onChange={(e) => onCastFirstX(parseFloat(e.target.value))}
        />
        <span>{castFirstX.toFixed(3)}</span>
      </div>

      <div style={rowStyle}>
        <label>cast ΔX</label>
        <input
          type="range"
          min={0.2}
          max={1.8}
          step={0.005}
          value={castSpacing}
          onChange={(e) => onCastSpacing(parseFloat(e.target.value))}
        />
        <span>{castSpacing.toFixed(3)}</span>
      </div>

      <div style={rowStyle}>
        <label>spell width</label>
        <input
          type="range"
          min={0.3}
          max={1.8}
          step={0.005}
          value={spellWidth}
          onChange={(e) => onSpellWidth(parseFloat(e.target.value))}
        />
        <span>{spellWidth.toFixed(3)}</span>
      </div>

      <div style={rowStyle}>
        <label>wish X</label>
        <input
          type="range"
          min={-3}
          max={3}
          step={0.005}
          value={wishX}
          onChange={(e) => onWishX(parseFloat(e.target.value))}
        />
        <span>{wishX.toFixed(3)}</span>
      </div>

      <div style={rowStyle}>
        <label>wish Y</label>
        <input
          type="range"
          min={-3}
          max={1.5}
          step={0.005}
          value={wishY}
          onChange={(e) => onWishY(parseFloat(e.target.value))}
        />
        <span>{wishY.toFixed(3)}</span>
      </div>

      <div style={{ opacity: 0.7, fontSize: 11, marginTop: 4 }}>
        When aligned, send me these numbers and I'll bake them in.
      </div>
    </div>
  );
}
