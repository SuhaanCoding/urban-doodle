import { useEffect, useRef, useState } from "react";
import MapGL, { Layer, Source, Popup } from "react-map-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import type { Map as MapboxMap } from "mapbox-gl";
import type {
  AnalysisState,
  LayerVisibility,
  DetectedFeature,
  UserPolygon,
} from "../types";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

interface MapProps {
  analysisState: AnalysisState;
  layerVisibility: LayerVisibility;
  onPolygonDrawn: (polygon: UserPolygon) => void; //uses user polygon for better types
}

// Type for the react-map-gl ref (provides access to underlying Mapbox instance)
interface MapGLRef {
  getMap: () => MapboxMap;
}

// Type for map click events from react-map-gl
interface MapClickEvent {
  lngLat: { lng: number; lat: number };
  point: { x: number; y: number };
  originalEvent: MouseEvent;
}

// Type for Mapbox Draw events (when user completes drawing)
interface DrawCreateEvent {
  features: UserPolygon[];
}

//Need to improve this in the future, this is too generic. Maybe use openCV/or neibouring colours or some ML segmentation
const CATEGORY_COLORS: Record<string, string> = {
  vegetation: "#22c55e",
  water: "#3b82f6",
  buildings: "#ef4444",
  roads: "#6b7280",
  bare_soil: "#d97706",
  other: "#a3a3a3",
};

export default function MapComponent({
  analysisState,
  layerVisibility,
  onPolygonDrawn,
}: MapProps) {
  const mapRef = useRef<MapGLRef | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);

  //Used lng/lat to track where user clicks and activates popup based on that
  const [clickedFeature, setClickedFeature] = useState<{
    feature: DetectedFeature;
    lng: number;
    lat: number;
  } | null>(null);

  // Initialize Mapbox Draw
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || drawRef.current) return;

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
      },
      defaultMode: "simple_select",
    });

    map.addControl(draw, "top-left");
    drawRef.current = draw;

    // Listen for polygon creation
    map.on("draw.create", (e: DrawCreateEvent) => {
      // Safety check to ensure the event has features at all
      if (!e.features || e.features.length === 0) {
        console.error("Draw event fired with no features");
        return;
      }

      const feature = e.features[0];

      // Validate polygon
      if (feature.geometry.type !== "Polygon") {
        alert(
          "Invalid shape. Please draw a polygon (closed area), not a line or point.",
        );
        drawRef.current?.deleteAll();
        // Keep in drawing mode so user can try again immediately
        drawRef.current?.changeMode("draw_polygon");
        return;
      }

      // coordinates[0] is the outer ring, last point duplicates first (closed ring)
      const coordinates = feature.geometry.coordinates[0];
      if (coordinates.length < 4) {
        // Need at least 4 points (3 vertices + closing point)
        alert(
          "Polygon too small. Please draw at least 3 points to create a valid area.",
        );
        drawRef.current?.deleteAll();
        // Keep in drawing mode so user can try again immediately
        drawRef.current?.changeMode("draw_polygon");
        return;
      } //Doesnt work though if line is made, NEED TO FIX IN FUTURE. UI GOES DUMB

      // All validations passed! Pass polygon to parent
      onPolygonDrawn(feature);
    });

    return () => {
      if (drawRef.current && map) {
        map.removeControl(drawRef.current);
        drawRef.current = null;
      }
    };
  }, [onPolygonDrawn]);

  // Enable drawing mode when state changes to "drawing"
  useEffect(() => {
    if (analysisState.status === "drawing" && drawRef.current) {
      drawRef.current.changeMode("draw_polygon");
    }
  }, [analysisState.status]);

  // Clear draw when resetting
  useEffect(() => {
    if (analysisState.status === "idle" && drawRef.current) {
      drawRef.current.deleteAll();
    }
  }, [analysisState.status]);

  // Get features from analysis result
  const features =
    analysisState.status === "complete" ? analysisState.result.features : [];

  // Group features by category
  const featuresByCategory: Record<string, DetectedFeature[]> = {};
  features.forEach((feature) => {
    const category = feature.properties.category;
    if (!featuresByCategory[category]) {
      featuresByCategory[category] = [];
    }
    featuresByCategory[category].push(feature);
  });

  // Handle map click to show feature details
  const handleMapClick = (event: MapClickEvent) => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const features = map.queryRenderedFeatures(event.point, {
      layers: Object.keys(CATEGORY_COLORS)
        .map((cat) => `${cat}-fill`)
        .filter((layerId) => {
          try {
            return map.getLayer(layerId) !== undefined;
          } catch {
            return false;
          }
        }),
    });

    if (features.length > 0) {
      const feature = features[0] as any;
      const props = feature.properties;
      setClickedFeature({
        feature: {
          type: "Feature",
          geometry: feature.geometry,
          properties: {
            category: props.category,
            area_sqft: parseFloat(props.area_sqft),
            color: props.color,
          },
        },
        lng: event.lngLat.lng,
        lat: event.lngLat.lat,
      });
    } else {
      setClickedFeature(null);
    }
  };

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <MapGL
        ref={mapRef}
        mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
        initialViewState={{
          longitude: -117.16,
          latitude: 32.72,
          zoom: 15,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        onClick={handleMapClick}
      >
        {/* Render analysis results as layers or defaults to #99999.. if its the other cat*/}
        {Object.entries(featuresByCategory).map(
          ([category, categoryFeatures]) => {
            const isVisible =
              layerVisibility[category as keyof LayerVisibility];
            const color = CATEGORY_COLORS[category] || "#999999";

            return (
              <Source
                key={`source-${category}`}
                id={`source-${category}`}
                type="geojson"
                data={{
                  type: "FeatureCollection",
                  features: categoryFeatures,
                }}
              >
                {/* Fill layer */}
                <Layer
                  id={`${category}-fill`}
                  type="fill"
                  paint={{
                    "fill-color": color,
                    "fill-opacity": 0.4,
                  }}
                  layout={{
                    visibility: isVisible ? "visible" : "none",
                  }}
                />
                {/* Outline layer */}
                <Layer
                  id={`${category}-outline`}
                  type="line"
                  paint={{
                    "line-color": color,
                    "line-width": 1,
                    "line-opacity": 0.8,
                  }}
                  layout={{
                    visibility: isVisible ? "visible" : "none",
                  }}
                />
              </Source>
            );
          },
        )}

        {/* Popup for clicked feature */}
        {clickedFeature && (
          <Popup
            longitude={clickedFeature.lng}
            latitude={clickedFeature.lat}
            onClose={() => setClickedFeature(null)}
            closeOnClick={false}
          >
            <div style={{ padding: "8px" }}>
              <strong style={{ textTransform: "capitalize" }}>
                {clickedFeature.feature.properties.category.replace("_", " ")}
              </strong>
              <div style={{ marginTop: "4px" }}>
                {clickedFeature.feature.properties.area_sqft.toLocaleString()}{" "}
                sq ft
              </div>
              <div style={{ fontSize: "12px", color: "#666" }}>
                {(clickedFeature.feature.properties.area_sqft / 43560).toFixed(
                  3,
                )}{" "}
                acres
              </div>
            </div>
          </Popup>
        )}
      </MapGL>
    </div>
  );
}
