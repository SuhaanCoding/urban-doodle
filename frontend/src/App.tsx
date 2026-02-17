import Map from "./components/Map";
import AnalysisPanel from "./components/AnalysisPanel";
import { useAnalysis } from "./hooks/useAnalysis";

function App() {
  const { state, layerVisibility, startDrawing, setPolygon, analyze, clear, toggleLayer } =
    useAnalysis();

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <AnalysisPanel
        state={state}
        onDrawStart={startDrawing}
        onAnalyze={analyze}
        onClear={clear}
      />
      <Map
        analysisState={state}
        layerVisibility={layerVisibility}
        onPolygonDrawn={setPolygon}
      />
    </div>
  );
}

export default App;
