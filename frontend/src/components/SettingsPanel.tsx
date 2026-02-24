import type { UserSettings } from "../types";

interface SettingsPanelProps {
  settings: UserSettings;
  onChange: (settings: UserSettings) => void;
}

const SURFACE_OPTIONS = [
  { key: "building", label: "Buildings" },
  { key: "road", label: "Roads (asphalt/concrete)" },
  { key: "sidewalk", label: "Sidewalks & pavement" },
  { key: "pavement", label: "Paved areas" },
  { key: "path", label: "Paths & driveways" },
];

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderRadius: "8px",
        padding: "20px",
        marginBottom: "16px",
      }}
    >
      {children}
    </div>
  );
}

function CardHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "14px",
        fontWeight: 600,
        color: "#111827",
        marginBottom: "16px",
      }}
    >
      {children}
    </div>
  );
}

function InputLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "13px",
        fontWeight: 500,
        color: "#374151",
        marginBottom: "4px",
      }}
    >
      {children}
    </div>
  );
}

function InputRow({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: "14px" }}>{children}</div>;
}

function NumberInputWithSuffix({
  value,
  onChange,
  suffix,
  min,
  max,
  step,
}: {
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        min={min}
        max={max}
        step={step}
        style={{
          width: "80px",
          padding: "8px 12px",
          border: "1px solid #D1D5DB",
          borderRadius: "6px",
          fontSize: "14px",
          textAlign: "right",
          color: "#111827",
        }}
      />
      {suffix && (
        <span style={{ fontSize: "13px", color: "#6B7280" }}>{suffix}</span>
      )}
    </div>
  );
}

export default function SettingsPanel({
  settings,
  onChange,
}: SettingsPanelProps) {
  const update = (partial: Partial<UserSettings>) => {
    onChange({ ...settings, ...partial });
  };

  return (
    <div>
      <Card>
        <CardHeading>Impervious Cover</CardHeading>
        <InputRow>
          <InputLabel>Cap percentage</InputLabel>
          <NumberInputWithSuffix
            value={settings.impervious_cap_pct}
            onChange={(v) => update({ impervious_cap_pct: v })}
            suffix="%"
            min={1}
            max={100}
          />
        </InputRow>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "#374151",
            marginBottom: "8px",
          }}
        >
          Surface types
        </div>
        {SURFACE_OPTIONS.map(({ key, label }) => (
          <label
            key={key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "6px",
              fontSize: "14px",
              color: "#374151",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={settings.impervious_surface_types.includes(key)}
              onChange={(e) => {
                const types = e.target.checked
                  ? [...settings.impervious_surface_types, key]
                  : settings.impervious_surface_types.filter((t) => t !== key);
                update({ impervious_surface_types: types });
              }}
            />
            {label}
          </label>
        ))}
      </Card>

      <Card>
        <CardHeading>Demolition Cost</CardHeading>
        <InputRow>
          <InputLabel>Base cost per sq ft</InputLabel>
          <NumberInputWithSuffix
            value={settings.demo_cost_per_sqft}
            onChange={(v) => update({ demo_cost_per_sqft: v })}
            suffix="$/ft²"
            min={0}
          />
        </InputRow>
        <InputRow>
          <InputLabel>Hazmat surcharge per sq ft</InputLabel>
          <NumberInputWithSuffix
            value={settings.demo_hazmat_surcharge_per_sqft}
            onChange={(v) => update({ demo_hazmat_surcharge_per_sqft: v })}
            suffix="$/ft²"
            min={0}
          />
        </InputRow>
        <details>
          <summary
            style={{
              fontSize: "13px",
              fontWeight: 500,
              color: "#374151",
              cursor: "pointer",
              marginBottom: "8px",
              userSelect: "none",
            }}
          >
            Material multipliers
          </summary>
          <div style={{ paddingTop: "8px" }}>
            {Object.entries(settings.demo_material_multipliers).map(
              ([material, mult]) => (
                <div
                  key={material}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "13px",
                      color: "#374151",
                      textTransform: "capitalize",
                    }}
                  >
                    {material}
                  </span>
                  <NumberInputWithSuffix
                    value={mult}
                    onChange={(v) =>
                      update({
                        demo_material_multipliers: {
                          ...settings.demo_material_multipliers,
                          [material]: v,
                        },
                      })
                    }
                    suffix="×"
                    min={0}
                    step={0.1}
                  />
                </div>
              ),
            )}
          </div>
        </details>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginTop: "10px",
            fontSize: "14px",
            color: "#374151",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={settings.include_minor_structures}
            onChange={(e) =>
              update({ include_minor_structures: e.target.checked })
            }
          />
          Include minor structures (garages, sheds)
        </label>
      </Card>

      {/* Setbacks */}
      <Card>
        <CardHeading>Setbacks</CardHeading>
        {(
          [
            { key: "setback_front_ft", label: "Front setback" },
            { key: "setback_side_ft", label: "Side setback" },
            { key: "setback_rear_ft", label: "Rear setback" },
          ] as const
        ).map(({ key, label }) => (
          <InputRow key={key}>
            <InputLabel>{label}</InputLabel>
            <NumberInputWithSuffix
              value={settings[key]}
              onChange={(v) => update({ [key]: v })}
              suffix="ft"
              min={0}
            />
          </InputRow>
        ))}
        <div style={{ fontSize: "12px", color: "#9CA3AF" }}>
          Used to calculate net buildable area
        </div>
      </Card>

      {/* Development Value */}
      <Card>
        <CardHeading>Development Value</CardHeading>
        <InputRow>
          <InputLabel>Price per sq ft</InputLabel>
          <NumberInputWithSuffix
            value={settings.dev_price_per_sqft}
            onChange={(v) => update({ dev_price_per_sqft: v })}
            suffix="$/ft²"
            min={0}
          />
        </InputRow>
        <div style={{ fontSize: "12px", color: "#9CA3AF" }}>
          Gross value = net buildable × price/sqft
        </div>
      </Card>

      <div
        style={{
          fontSize: "12px",
          color: "#9CA3AF",
          fontStyle: "italic",
          marginTop: "4px",
        }}
      >
        Changes take effect on next analysis
      </div>
    </div>
  );
}
