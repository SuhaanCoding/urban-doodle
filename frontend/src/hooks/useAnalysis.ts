import { useState } from "react";
import type {
  AnalysisState,
  AnalysisResponse,
  CategoryType,
  LayerVisibility,
  UserPolygon,
} from "../types";

export function useAnalysis() {
  const [state, setState] = useState<AnalysisState>({ status: "idle" });
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    vegetation: true,
    water: true,
    buildings: true,
    roads: true,
    bare_soil: true,
    other: true,
  });

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
          body: JSON.stringify(polygon),
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
    setLayerVisibility({
      vegetation: true,
      water: true,
      buildings: true,
      roads: true,
      bare_soil: true,
      other: true,
    });
  };

  const toggleLayer = (category: CategoryType) => {
    setLayerVisibility((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  return {
    state,
    layerVisibility,
    startDrawing,
    setPolygon,
    analyze,
    clear,
    toggleLayer,
  };
}
