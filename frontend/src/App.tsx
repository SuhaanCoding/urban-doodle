import Map from "./components/Map";
import AnalysisPanel from "./components/AnalysisPanel";
import { useAnalysis } from "./hooks/useAnalysis";

function App() {
  const {
    state, layerVisibility, settings,
    startDrawing, setPolygon, analyze, clear,
    toggleLayer, updateSettings,
  } = useAnalysis();

  return (
    <div style={{ width: "100%", height: "100vh", overflow: "hidden", position: "relative" }}>
      <Map
        analysisState={state}
        layerVisibility={layerVisibility}
        onPolygonDrawn={setPolygon}
      />
      <AnalysisPanel
        state={state}
        layerVisibility={layerVisibility}
        settings={settings}
        onDrawStart={startDrawing}
        onAnalyze={analyze}
        onClear={clear}
        onToggleLayer={toggleLayer}
        onUpdateSettings={updateSettings}
      />
    </div>
  );
}

export default App;
