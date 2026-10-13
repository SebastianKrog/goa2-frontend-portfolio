export interface TransformConfig {
  scale: number;
  xOffset: number;
  yOffset: number;
  zOffset: number;
  rotationDeg: number;
  brightness?: number;
}

interface Props {
  modelKeys: string[];
  selectedKey: string;
  model: TransformConfig;
  onSelectKey: (key: string) => void;
  onChange: (partial: Partial<TransformConfig>) => void;
  heroUnits?: Array<{
    id: string;
    heroKey: string;
    displayKey: string;
    team: string;
  }>;
  heroModelKeys?: string[];
  selectedHeroUnitId?: string;
  onSelectHeroUnit?: (id: string) => void;
  onChangeHeroModel?: (modelKey: string) => void;
  heroAssetVariant?: "current" | "original";
  heroHasOriginalAsset?: boolean;
  onChangeHeroAssetVariant?: (variant: "current" | "original") => void;
  onResetHeroModel?: () => void;
  focused?: boolean;
}

const panelStyle: React.CSSProperties = {
  position: "fixed",
  top: 80,
  left: 310,
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
  width: 320,
  maxWidth: "calc(100vw - 32px)",
  boxSizing: "border-box",
  maxHeight: "calc(100vh - 100px)",
  overflowY: "auto",
};

const rowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "78px 1fr 60px",
  alignItems: "center",
  gap: 8,
};

const selectStyle: React.CSSProperties = {
  background: "rgba(0, 0, 0, 0.4)",
  color: "#fff",
  border: "1px solid rgba(255, 255, 255, 0.25)",
  borderRadius: 4,
  padding: "4px 6px",
  fontFamily: "monospace",
  fontSize: 12,
};

export function ModelCalibrationPanel({
  modelKeys,
  selectedKey,
  model,
  onSelectKey,
  onChange,
  heroUnits = [],
  heroModelKeys = [],
  selectedHeroUnitId = "",
  onSelectHeroUnit,
  onChangeHeroModel,
  heroAssetVariant = "current",
  heroHasOriginalAsset = false,
  onChangeHeroAssetVariant,
  onResetHeroModel,
  focused = false,
}: Props) {
  const selectedHeroUnit = heroUnits.find((unit) => unit.id === selectedHeroUnitId);

  return (
    <div style={{ ...panelStyle, left: focused ? 16 : panelStyle.left }}>
      {selectedHeroUnit && (
        <>
          <div style={{ fontWeight: 700, opacity: 0.7, letterSpacing: 1 }}>
            LIVE HERO PREVIEW
          </div>

          <label>
            Board unit
            <select
              aria-label="Board unit"
              style={{ ...selectStyle, display: "block", width: "100%", marginTop: 4 }}
              value={selectedHeroUnitId}
              onChange={(event) => onSelectHeroUnit?.(event.target.value)}
            >
              {heroUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.id} · {unit.team}
                </option>
              ))}
            </select>
          </label>

          <label>
            Display model
            <select
              aria-label="Display model"
              style={{ ...selectStyle, display: "block", width: "100%", marginTop: 4 }}
              value={selectedHeroUnit.displayKey}
              onChange={(event) => onChangeHeroModel?.(event.target.value)}
            >
              {heroModelKeys.map((key) => (
                <option key={key} value={key}>{key}</option>
              ))}
            </select>
          </label>

          <label>
            Asset version
            <select
              aria-label="Asset version"
              style={{ ...selectStyle, display: "block", width: "100%", marginTop: 4 }}
              value={heroAssetVariant}
              onChange={(event) => {
                onChangeHeroAssetVariant?.(event.target.value as "current" | "original");
              }}
            >
              <option value="current">Current model</option>
              <option value="original" disabled={!heroHasOriginalAsset}>
                Archived pre-paint model
              </option>
            </select>
          </label>

          <button
            type="button"
            style={selectStyle}
            disabled={selectedHeroUnit.displayKey === selectedHeroUnit.heroKey}
            onClick={onResetHeroModel}
          >
            Reset to board hero ({selectedHeroUnit.heroKey})
          </button>

          <div style={{ opacity: 0.7, fontSize: 11 }}>
            Visual only. Original assets load on demand and do not change the game state.
          </div>

          <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.14)", margin: "2px 0" }} />
        </>
      )}

      <div style={{ fontWeight: 700, opacity: 0.7, letterSpacing: 1 }}>
        MODEL CALIBRATION
      </div>

      <select
        aria-label="Transform model"
        style={selectStyle}
        value={selectedKey}
        onChange={(e) => onSelectKey(e.target.value)}
      >
        {modelKeys.map((k) => (
          <option key={k} value={k}>{k}</option>
        ))}
      </select>

      <div style={rowStyle}>
        <label>scale</label>
        <input
          type="range" min={0.1} max={10} step={0.05}
          value={model.scale}
          onChange={(e) => onChange({ scale: parseFloat(e.target.value) })}
        />
        <span>{model.scale.toFixed(2)}</span>
      </div>

      {selectedKey.startsWith("HERO_") && (
        <div style={rowStyle}>
          <label>brightness</label>
          <input
            type="range" min={0.25} max={3} step={0.05}
            value={model.brightness ?? 1}
            onChange={(e) => onChange({ brightness: parseFloat(e.target.value) })}
          />
          <span>{(model.brightness ?? 1).toFixed(2)}×</span>
        </div>
      )}

      <div style={rowStyle}>
        <label>xOffset</label>
        <input
          type="range" min={-0.5} max={0.5} step={0.005}
          value={model.xOffset}
          onChange={(e) => onChange({ xOffset: parseFloat(e.target.value) })}
        />
        <span>{model.xOffset.toFixed(3)}</span>
      </div>

      <div style={rowStyle}>
        <label>yOffset</label>
        <input
          type="range" min={-0.5} max={1} step={0.005}
          value={model.yOffset}
          onChange={(e) => onChange({ yOffset: parseFloat(e.target.value) })}
        />
        <span>{model.yOffset.toFixed(3)}</span>
      </div>

      <div style={rowStyle}>
        <label>zOffset</label>
        <input
          type="range" min={-0.5} max={0.5} step={0.005}
          value={model.zOffset}
          onChange={(e) => onChange({ zOffset: parseFloat(e.target.value) })}
        />
        <span>{model.zOffset.toFixed(3)}</span>
      </div>

      <div style={rowStyle}>
        <label>rotation°</label>
        <input
          type="range" min={0} max={359} step={1}
          value={model.rotationDeg}
          onChange={(e) => onChange({ rotationDeg: parseFloat(e.target.value) })}
        />
        <span>{model.rotationDeg}°</span>
      </div>

      <div style={{ opacity: 0.7, fontSize: 11, marginTop: 4 }}>
        Send me the values when aligned and I'll bake them per model.
      </div>
    </div>
  );
}
