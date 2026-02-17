import type { AnalysisState } from "../types";

interface AnalysisPanelProps {
  state: AnalysisState;
  onDrawStart: () => void;
  onAnalyze: () => void;
  onClear: () => void;
}

export default function AnalysisPanel({
  state,
  onDrawStart,
  onAnalyze,
  onClear,
}: AnalysisPanelProps) {
  return (
    <div
      style={{
        width: "350px",
        height: "100vh",
        backgroundColor: "#fafafa",
        padding: "24px",
        boxShadow: "2px 0 8px rgba(0,0,0,0.1)",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Header */}
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: "32px",
            fontFamily: "'Freckle Face', cursive",
            fontWeight: "400",
            color: "#f59e0b",
            letterSpacing: "2px",
            textShadow: "2px 2px 4px rgba(0, 0, 0, 0.1)",
          }}
        >
          Urban Doodle
        </h1>
        <p
          style={{
            margin: "8px 0 0 0",
            fontSize: "14px",
            color: "#6b7280",
          }}
        >
          {state.status === "idle" && "Draw a zone to analyze land cover"}
          {state.status === "drawing" &&
            "Click on the map to draw vertices. Double click to finish."}
          {state.status === "ready" && "Zone drawn. Ready to analyze."}
          {state.status === "analyzing" && "Analyzing satellite imagery..."}
          {state.status === "complete" && "Analysis complete"}
          {state.status === "error" && "Analysis failed"}
        </p>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {state.status === "idle" && (
          <button
            onClick={onDrawStart}
            style={{
              padding: "12px 24px",
              backgroundColor: "#f59e0b",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontSize: "16px",
              fontWeight: "500",
              cursor: "pointer",
            }}
          >
            Draw Zone
          </button>
        )}

        {state.status === "ready" && (
          <>
            <button
              onClick={onAnalyze}
              style={{
                padding: "12px 24px",
                backgroundColor: "#f59e0b",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "16px",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              Analyze Zone
            </button>
            <button
              onClick={onClear}
              style={{
                padding: "12px 24px",
                backgroundColor: "white",
                color: "#6b7280",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          </>
        )}

        {state.status === "analyzing" && (
          <div
            style={{
              padding: "12px 24px",
              backgroundColor: "#e5e7eb",
              borderRadius: "6px",
              textAlign: "center",
              color: "#6b7280",
            }}
          >
            Processing...
          </div>
        )}

        {state.status === "complete" && (
          <button
            onClick={onClear}
            style={{
              padding: "12px 24px",
              backgroundColor: "white",
              color: "#6b7280",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer",
            }}
          >
            Clear & Start Over
          </button>
        )}

        {state.status === "error" && (
          <>
            <div
              style={{
                padding: "12px",
                backgroundColor: "#fee2e2",
                borderRadius: "6px",
                color: "#dc2626",
                fontSize: "14px",
              }}
            >
              {state.message}
            </div>
            <button
              onClick={onClear}
              style={{
                padding: "12px 24px",
                backgroundColor: "#f59e0b",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              Try Again
            </button>
          </>
        )}
      </div>

      {/* Results */}
      {state.status === "complete" && (
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "8px",
            padding: "16px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <h3
            style={{
              margin: "0 0 16px 0",
              fontSize: "16px",
              fontWeight: "600",
              color: "#1f2937",
            }}
          >
            Zone Analysis Results
          </h3>

          <div style={{ fontSize: "14px", color: "#6b7280" }}>
            <div style={{ marginBottom: "8px" }}>
              <strong style={{ color: "#1f2937" }}>Total Area:</strong>{" "}
              {state.result.metadata.total_area_sqft.toLocaleString()} sq ft
            </div>
            <div style={{ fontSize: "12px", marginBottom: "16px" }}>
              ({(state.result.metadata.total_area_sqft / 43560).toFixed(2)}{" "}
              acres)
            </div>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {state.result.metadata.vegetation_pct > 0 && (
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>
                    <span style={{ color: "#22c55e", marginRight: "8px" }}>
                      ●
                    </span>
                    Vegetation
                  </span>
                  <span style={{ fontWeight: "500", color: "#1f2937" }}>
                    {state.result.metadata.vegetation_pct.toFixed(1)}%
                  </span>
                </div>
              )}

              {state.result.metadata.water_pct > 0 && (
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>
                    <span style={{ color: "#3b82f6", marginRight: "8px" }}>
                      ●
                    </span>
                    Water
                  </span>
                  <span style={{ fontWeight: "500", color: "#1f2937" }}>
                    {state.result.metadata.water_pct.toFixed(1)}%
                  </span>
                </div>
              )}

              {state.result.metadata.buildings_pct > 0 && (
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>
                    <span style={{ color: "#ef4444", marginRight: "8px" }}>
                      ■
                    </span>
                    Buildings
                  </span>
                  <span style={{ fontWeight: "500", color: "#1f2937" }}>
                    {state.result.metadata.buildings_pct.toFixed(1)}%
                  </span>
                </div>
              )}

              {state.result.metadata.roads_pct > 0 && (
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>
                    <span style={{ color: "#6b7280", marginRight: "8px" }}>
                      ■
                    </span>
                    Roads
                  </span>
                  <span style={{ fontWeight: "500", color: "#1f2937" }}>
                    {state.result.metadata.roads_pct.toFixed(1)}%
                  </span>
                </div>
              )}

              {state.result.metadata.bare_soil_pct > 0 && (
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>
                    <span style={{ color: "#d97706", marginRight: "8px" }}>
                      ●
                    </span>
                    Bare Soil
                  </span>
                  <span style={{ fontWeight: "500", color: "#1f2937" }}>
                    {state.result.metadata.bare_soil_pct.toFixed(1)}%
                  </span>
                </div>
              )}

              {state.result.metadata.other_pct > 0 && (
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>
                    <span style={{ color: "#a3a3a3", marginRight: "8px" }}>
                      □
                    </span>
                    Other
                  </span>
                  <span style={{ fontWeight: "500", color: "#1f2937" }}>
                    {state.result.metadata.other_pct.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>

            <div
              style={{
                marginTop: "16px",
                paddingTop: "16px",
                borderTop: "1px solid #e5e7eb",
                fontSize: "12px",
              }}
            >
              Processed {state.result.metadata.tiles_processed} tiles in{" "}
              {(state.result.metadata.processing_time_ms / 1000).toFixed(1)}s
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
