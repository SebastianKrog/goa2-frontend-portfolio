import type { TeamBaseConfig } from "./anim/TeamBase";

interface Props {
  cfg: TeamBaseConfig;
  onChange: (partial: Partial<TeamBaseConfig>) => void;
  outlineWidth: number;
  onOutlineWidth: (n: number) => void;
}

const panelStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 16,
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
  gridTemplateColumns: "84px 1fr 52px",
  alignItems: "center",
  gap: 8,
};

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  digits?: number;
  onChange: (n: number) => void;
}

function Slider({ label, value, min, max, step, digits = 2, onChange }: SliderProps) {
  return (
    <div style={rowStyle}>
      <label>{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span>{value.toFixed(digits)}</span>
    </div>
  );
}

export function TeamBaseCalibrationPanel({ cfg, onChange, outlineWidth, onOutlineWidth }: Props) {
  return (
    <div style={panelStyle}>
      <div style={{ fontWeight: 700, opacity: 0.7, letterSpacing: 1 }}>TEAM BASE + OUTLINE</div>
      <Slider label="radius" value={cfg.radius} min={0.2} max={1.0} step={0.005} digits={3} onChange={(n) => onChange({ radius: n })} />
      <Slider label="innerFrac" value={cfg.ringInnerFrac} min={0.5} max={0.99} step={0.005} digits={3} onChange={(n) => onChange({ ringInnerFrac: n })} />
      <Slider label="ringOpac" value={cfg.ringOpacity} min={0} max={1} step={0.01} onChange={(n) => onChange({ ringOpacity: n })} />
      <Slider label="fillOpac" value={cfg.fillOpacity} min={0} max={0.6} step={0.01} onChange={(n) => onChange({ fillOpacity: n })} />
      <Slider label="height" value={cfg.y} min={0} max={0.25} step={0.005} digits={3} onChange={(n) => onChange({ y: n })} />
      <Slider label="outlineW" value={outlineWidth} min={0} max={0.12} step={0.0005} digits={4} onChange={onOutlineWidth} />
      <div style={{ opacity: 0.7, fontSize: 11, marginTop: 4 }}>
        When it looks right, send me these numbers and I'll bake in the defaults.
      </div>
    </div>
  );
}
