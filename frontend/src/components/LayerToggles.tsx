import type { LayerVisibility, CategoryType } from "../types";

interface LayerTogglesProps {
  layerVisibility: LayerVisibility;
  onToggle: (category: CategoryType) => void;
}

const LAYERS = [
  { key: "crz", label: "Critical Root Zones", color: "#ef4444" },
  { key: "impervious", label: "Impervious Cover", color: "#6b7280" },
  { key: "demolition", label: "Demolition", color: "#f97316" },
  { key: "landuse", label: "Land Use (OSM)", color: "#3b82f6" },
];

export default function LayerToggles({
  layerVisibility,
  onToggle,
}: LayerTogglesProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {LAYERS.map(({ key, label, color }) => {
        const visible = layerVisibility[key] !== false;
        return (
          <div
            key={key}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "5px 0",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "2px",
                  backgroundColor: color,
                  opacity: visible ? 1 : 0.3,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: "13px",
                  color: visible ? "#374151" : "#9CA3AF",
                  transition: "color 150ms ease",
                }}
              >
                {label}
              </span>
            </div>
            <button
              onClick={() => onToggle(key)}
              aria-label={`Toggle ${label}`}
              style={{
                width: "26px",
                height: "15px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: visible ? "#10B981" : "#D1D5DB",
                cursor: "pointer",
                position: "relative",
                flexShrink: 0,
                transition: "background-color 200ms ease",
              }}
            >
              <div
                style={{
                  width: "11px",
                  height: "11px",
                  borderRadius: "50%",
                  backgroundColor: "white",
                  position: "absolute",
                  top: "2px",
                  left: visible ? "13px" : "2px",
                  transition: "left 200ms ease",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                }}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}
