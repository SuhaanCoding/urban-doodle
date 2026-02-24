import { useState } from "react";
import type { AnalysisState, LayerVisibility, UserSettings, CategoryType } from "../types";
import LayerToggles from "./LayerToggles";
import StatsCard from "./StatsCard";
import SettingsPanel from "./SettingsPanel";

interface AnalysisPanelProps {
  state: AnalysisState;
  layerVisibility: LayerVisibility;
  settings: UserSettings;
  onDrawStart: () => void;
  onAnalyze: () => void;
  onClear: () => void;
  onToggleLayer: (category: CategoryType) => void;
  onUpdateSettings: (partial: Partial<UserSettings>) => void;
}

export default function AnalysisPanel({
  state,
  layerVisibility,
  settings,
  onDrawStart,
  onAnalyze,
  onClear,
  onToggleLayer,
  onUpdateSettings,
}: AnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState<"results" | "settings">("results");

  const isComplete = state.status === "complete";

  return (
    <div
      style={{
        position: "fixed",
        top: "24px",
        left: "24px",
        width: "340px",
        maxHeight: "calc(100vh - 48px)",
        overflowY: "auto",
        backgroundColor: "#FFFFFF",
        borderRadius: "12px",
        boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        zIndex: 10,
      }}
    >
      <div style={{ padding: "20px 20px 16px" }}>
        <div
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: "#111827",
            letterSpacing: "-0.01em",
            marginBottom: "8px",
          }}
        >
          Urban Doodle
        </div>
        <p
          style={{
            margin: 0,
            fontSize: "13px",
            color: "#6B7280",
            lineHeight: "1.4",
          }}
        >
          {state.status === "idle" && "Draw a zone to analyze land cover"}
          {state.status === "drawing" && "Click to draw vertices. Double-click to finish."}
          {state.status === "ready" && "Zone drawn. Ready to analyze."}
          {state.status === "analyzing" && "Analyzing satellite imagery..."}
          {state.status === "complete" && "Analysis complete"}
          {state.status === "error" && "Analysis failed"}
        </p>
      </div>

      <div style={{ padding: "0 20px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {state.status === "idle" && (
          <button onClick={onDrawStart} style={primaryBtnStyle}>
            Draw Zone
          </button>
        )}

        {state.status === "ready" && (
          <>
            <button onClick={onAnalyze} style={primaryBtnStyle}>
              Analyze Zone
            </button>
            <button onClick={onClear} style={secondaryBtnStyle}>
              Clear
            </button>
          </>
        )}

        {state.status === "analyzing" && (
          <div
            style={{
              padding: "10px 16px",
              backgroundColor: "#F9FAFB",
              borderRadius: "6px",
              textAlign: "center",
              color: "#6B7280",
              fontSize: "13px",
            }}
          >
            Processing...
          </div>
        )}

        {state.status === "complete" && (
          <button onClick={onClear} style={secondaryBtnStyle}>
            Clear & Start Over
          </button>
        )}

        {state.status === "error" && (
          <>
            <div
              style={{
                padding: "10px 12px",
                backgroundColor: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: "6px",
                color: "#DC2626",
                fontSize: "13px",
                lineHeight: "1.4",
              }}
            >
              {state.message}
            </div>
            <button onClick={onClear} style={primaryBtnStyle}>
              Try Again
            </button>
          </>
        )}
      </div>

      {isComplete && (
        <div
          style={{
            borderTop: "1px solid #F3F4F6",
            padding: "12px 20px",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "#374151",
              marginBottom: "8px",
            }}
          >
            Layers
          </div>
          <LayerToggles layerVisibility={layerVisibility} onToggle={onToggleLayer} />
        </div>
      )}

      {isComplete && (
        <div
          style={{
            display: "flex",
            padding: "0 20px",
          }}
        >
          {(["results", "settings"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: "10px 0",
                border: "none",
                background: "none",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: activeTab === tab ? 600 : 400,
                color: activeTab === tab ? "#111827" : "#9CA3AF",
                borderBottom: activeTab === tab ? "2px solid #1F2937" : "2px solid transparent",
                transition: "color 150ms ease, border-color 150ms ease",
                textTransform: "capitalize",
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {isComplete && (
        <div style={{ padding: "20px" }}>
          {activeTab === "results" && <StatsCard metadata={state.result.metadata} />}
          {activeTab === "settings" && (
            <SettingsPanel settings={settings} onChange={onUpdateSettings} />
          )}
        </div>
      )}

      {!isComplete && activeTab === "settings" && (
        <div style={{ padding: "20px" }}>
          <SettingsPanel settings={settings} onChange={onUpdateSettings} />
        </div>
      )}

      {!isComplete && state.status !== "analyzing" && (
        <div style={{ padding: "0 20px 16px" }}>
          <button
            onClick={() => setActiveTab(activeTab === "settings" ? "results" : "settings")}
            style={{
              background: "none",
              border: "none",
              fontSize: "13px",
              color: "#6B7280",
              cursor: "pointer",
              padding: 0,
            }}
          >
            {activeTab === "settings" ? "← Back" : "⚙ Settings"}
          </button>
        </div>
      )}
    </div>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  padding: "10px 20px",
  backgroundColor: "#1F2937",
  color: "#FFFFFF",
  border: "none",
  borderRadius: "6px",
  fontSize: "14px",
  fontWeight: 500,
  cursor: "pointer",
  width: "100%",
  transition: "background-color 150ms ease",
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: "10px 20px",
  backgroundColor: "#FFFFFF",
  color: "#374151",
  border: "1px solid #D1D5DB",
  borderRadius: "6px",
  fontSize: "14px",
  fontWeight: 500,
  cursor: "pointer",
  width: "100%",
  transition: "background-color 150ms ease",
};
