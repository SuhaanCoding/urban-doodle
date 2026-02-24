import { useState } from "react";
import type {
  AnalysisState,
  AnalysisResponse,
  CategoryType,
  LayerVisibility,
  UserPolygon,
  UserSettings,
} from "../types";
import { DEFAULT_SETTINGS } from "../types";

export function useAnalysis() {
  const [state, setState] = useState<AnalysisState>({ status: "idle" });
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({});
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  const startDrawing = () => setState({ status: "drawing" });

  const setPolygon = (polygon: UserPolygon) =>
    setState({ status: "ready", polygon });

  const analyze = async () => {
    if (state.status !== "ready") return;
    const polygon = state.polygon;
    setState({ status: "analyzing", polygon });

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/analyze`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: polygon.type,
            geometry: polygon.geometry,
            properties: polygon.properties,
            settings,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        setState({
          status: "error",
          message: error.detail || "Analysis failed",
        });
        return;
      }

      const result: AnalysisResponse = await response.json();
      setState({ status: "complete", polygon, result });
    } catch (err) {
      setState({
        status: "error",
        message: "Failed to connect to analysis server. Make sure the backend is running on port 8000.",
      });
    }
  };

  const clear = () => {
    setState({ status: "idle" });
    setLayerVisibility({});
  };

  const toggleLayer = (category: CategoryType) => {
    setLayerVisibility((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const updateSettings = (partial: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  return {
    state,
    layerVisibility,
    settings,
    startDrawing,
    setPolygon,
    analyze,
    clear,
    toggleLayer,
    updateSettings,
  };
}
