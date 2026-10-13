interface Props {
  hexSize: number;
  originX: number;
  originZ: number;
  rotationDeg: number;
  tokenY: number;
  turretScale: number;
  turretY: number;
  turretRotationDeg: number;
  onHexSize: (n: number) => void;
  onOriginX: (n: number) => void;
  onOriginZ: (n: number) => void;
  onRotationDeg: (n: number) => void;
  onTokenY: (n: number) => void;
  onTurretScale: (n: number) => void;
  onTurretY: (n: number) => void;
  onTurretRotationDeg: (n: number) => void;
}

const panelStyle: React.CSSProperties = {
  position: "fixed",
  top: 80,
  left: 16,
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
};

const rowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "70px 1fr 60px",
  alignItems: "center",
  gap: 8,
};

export function CalibrationPanel({
  hexSize, originX, originZ, rotationDeg, tokenY,
  turretScale, turretY, turretRotationDeg,
  onHexSize, onOriginX, onOriginZ, onRotationDeg, onTokenY,
  onTurretScale, onTurretY, onTurretRotationDeg,
}: Props) {
  return (
    <div style={panelStyle}>
      <div style={{ fontWeight: 700, opacity: 0.7, letterSpacing: 1 }}>HEX CALIBRATION</div>

      <div style={rowStyle}>
        <label>hexSize</label>
        <input
          type="range"
          min={0.1}
          max={1.2}
          step={0.005}
          value={hexSize}
          onChange={(e) => onHexSize(parseFloat(e.target.value))}
        />
        <span>{hexSize.toFixed(3)}</span>
      </div>

      <div style={rowStyle}>
        <label>origin.x</label>
        <input
          type="range"
          min={-5}
          max={5}
          step={0.01}
          value={originX}
          onChange={(e) => onOriginX(parseFloat(e.target.value))}
        />
        <span>{originX.toFixed(2)}</span>
      </div>

      <div style={rowStyle}>
        <label>origin.z</label>
        <input
          type="range"
          min={-5}
          max={5}
          step={0.01}
          value={originZ}
          onChange={(e) => onOriginZ(parseFloat(e.target.value))}
        />
        <span>{originZ.toFixed(2)}</span>
      </div>

      <div style={rowStyle}>
        <label>rotation°</label>
        <input
          type="range"
          min={0}
          max={359}
          step={1}
          value={rotationDeg}
          onChange={(e) => onRotationDeg(parseFloat(e.target.value))}
        />
        <span>{rotationDeg}°</span>
      </div>

      <div style={rowStyle}>
        <label>token.y</label>
        <input
          type="range"
          min={-0.3}
          max={0.5}
          step={0.005}
          value={tokenY}
          onChange={(e) => onTokenY(parseFloat(e.target.value))}
        />
        <span>{tokenY.toFixed(3)}</span>
      </div>

      <div style={rowStyle}>
        <label>turret.scale</label>
        <input
          type="range"
          min={0.2}
          max={4}
          step={0.01}
          value={turretScale}
          onChange={(e) => onTurretScale(parseFloat(e.target.value))}
        />
        <span>{turretScale.toFixed(2)}</span>
      </div>

      <div style={rowStyle}>
        <label>turret.y</label>
        <input
          type="range"
          min={-0.5}
          max={0.5}
          step={0.005}
          value={turretY}
          onChange={(e) => onTurretY(parseFloat(e.target.value))}
        />
        <span>{turretY.toFixed(3)}</span>
      </div>

      <div style={rowStyle}>
        <label>turret.rot°</label>
        <input
          type="range"
          min={0}
          max={359}
          step={1}
          value={turretRotationDeg}
          onChange={(e) => onTurretRotationDeg(parseFloat(e.target.value))}
        />
        <span>{turretRotationDeg}°</span>
      </div>

      <div style={{ opacity: 0.7, fontSize: 11, marginTop: 4 }}>
        When aligned, send me these numbers and I'll bake them into the map config.
      </div>
    </div>
  );
}
