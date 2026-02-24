import { useEffect, useRef, useState, useCallback } from "react";
import MapGL, { Layer, Source, Popup } from "react-map-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import type {
  AnalysisState,
  LayerVisibility,
  DetectedFeature,
  FeatureProperties,
  UserPolygon,
} from "../types";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

interface MapProps {
  analysisState: AnalysisState;
  layerVisibility: LayerVisibility;
  onPolygonDrawn: (polygon: UserPolygon) => void;
}

interface MapClickEvent {
  lngLat: { lng: number; lat: number };
  point: { x: number; y: number };
  originalEvent: MouseEvent;
}

interface DrawCreateEvent {
  features: UserPolygon[];
}

const ROAD_TYPE_LABELS: Record<string, string> = {
  motorway: "Highway",
  primary: "Primary Road",
  secondary: "Secondary Road",
  tertiary: "Tertiary Road",
  residential: "Residential Road",
  service: "Service Road / Driveway",
  footway: "Footpath",
  cycleway: "Cycle Path",
  path: "Path",
  track: "Unpaved Track",
  living_street: "Living Street",
  trunk: "Trunk Road",
};

const BUILDING_TYPE_LABELS: Record<string, string> = {
  residential: "Residential",
  commercial: "Commercial",
  industrial: "Industrial",
  retail: "Retail",
  garage: "Garage",
  shed: "Shed / Minor Structure",
  yes: "Building",
  apartments: "Apartments",
  house: "House",
  office: "Office",
};

const CATEGORY_COLORS: Record<string, string> = {
  tree: "#16a34a",
  grass: "#86efac",
  building: "#f97316",
  house: "#fb923c",
  road: "#6799ff",
  sidewalk: "#aac8fc",
  pavement: "#d1d5db",
  path: "#8cc5ff",
  "dirt track": "#d97706",
  crz: "#44ef88",
  impervious: "#739ff7",
  demolition: "#ff995e",
  landuse: "#3b82f6",
};

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

function fmtCost(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${Math.round(n)}`;
}

function humanizeRoad(type: string): string {
  return ROAD_TYPE_LABELS[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

function humanizeBuilding(type: string): string {
  return (
    BUILDING_TYPE_LABELS[type] || type.charAt(0).toUpperCase() + type.slice(1)
  );
}

// mapbox queryRenderedFeatures returns everything as strings, so we have to parse it back
function parseProps(raw: Record<string, any>): FeatureProperties {
  return {
    category: raw.category,
    area_sqft: parseFloat(raw.area_sqft) || 0,
    color: raw.color,
    osm_id: raw.osm_id ? parseInt(raw.osm_id) : undefined,
    building_type: raw.building_type || undefined,
    building_levels: raw.building_levels
      ? parseInt(raw.building_levels)
      : undefined,
    building_material: raw.building_material || undefined,
    year_built: raw.year_built ? parseInt(raw.year_built) : undefined,
    is_hazmat:
      raw.is_hazmat === "true"
        ? true
        : raw.is_hazmat === "false"
        ? false
        : undefined,
    addr_number: raw.addr_number || undefined,
    addr_street: raw.addr_street || undefined,
    building_name: raw.building_name || undefined,
    demo_cost_base: raw.demo_cost_base
      ? parseFloat(raw.demo_cost_base)
      : undefined,
    demo_cost_hazmat: raw.demo_cost_hazmat
      ? parseFloat(raw.demo_cost_hazmat)
      : undefined,
    demo_cost_total: raw.demo_cost_total
      ? parseFloat(raw.demo_cost_total)
      : undefined,
    road_type: raw.road_type || undefined,
    road_name: raw.road_name || undefined,
    road_surface: raw.road_surface || undefined,
    road_surface_weight: raw.road_surface_weight
      ? parseFloat(raw.road_surface_weight)
      : undefined,
    tree_species: raw.tree_species || undefined,
    tree_crown_diameter_ft: raw.tree_crown_diameter_ft
      ? parseFloat(raw.tree_crown_diameter_ft)
      : undefined,
    tree_height_ft: raw.tree_height_ft
      ? parseFloat(raw.tree_height_ft)
      : undefined,
    is_heritage: raw.is_heritage === "true" ? true : undefined,
    crz_source: raw.crz_source || undefined,
    landuse_type: raw.landuse_type || undefined,
    landuse_name: raw.landuse_name || undefined,
  };
}

function HoverTooltip({ props }: { props: FeatureProperties }) {
  const cat = props.category;

  if (cat === "demolition") {
    const line1 =
      props.addr_number && props.addr_street
        ? `${props.addr_number} ${props.addr_street}`
        : humanizeBuilding(props.building_type || "yes");
    const floors = props.building_levels
      ? `${props.building_levels} floor${props.building_levels > 1 ? "s" : ""}`
      : null;
    const line2 = [humanizeBuilding(props.building_type || "yes"), floors]
      .filter(Boolean)
      .join(" · ");
    const line3 = `${fmt(props.area_sqft)} sq ft · ~${fmtCost(
      props.demo_cost_total || 0,
    )} demo`;

    return (
      <>
        <div
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "#111827",
            marginBottom: "2px",
          }}
        >
          {line1}
        </div>
        <div style={{ fontSize: "13px", color: "#6B7280" }}>{line2}</div>
        <div style={{ fontSize: "13px", color: "#9CA3AF" }}>{line3}</div>
      </>
    );
  }

  if (cat === "impervious" && props.road_type) {
    const line1 = props.road_name || humanizeRoad(props.road_type);
    const line2 = [
      humanizeRoad(props.road_type),
      props.road_surface?.charAt(0).toUpperCase() +
        (props.road_surface?.slice(1) || ""),
    ]
      .filter(Boolean)
      .join(" · ");
    const weight = props.road_surface_weight ?? 1;
    const line3 =
      weight === 1
        ? "100% impervious"
        : weight === 0.5
        ? "50% impervious (gravel)"
        : "0% impervious";

    return (
      <>
        <div
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "#111827",
            marginBottom: "2px",
          }}
        >
          {line1}
        </div>
        <div style={{ fontSize: "13px", color: "#6B7280" }}>{line2}</div>
        <div style={{ fontSize: "13px", color: "#9CA3AF" }}>{line3}</div>
      </>
    );
  }

  if (cat === "crz") {
    const species = props.tree_species || "Tree";
    const line1 = props.is_heritage ? `${species} — Heritage` : species;
    const line2 = props.tree_crown_diameter_ft
      ? `Crown: ${props.tree_crown_diameter_ft} ft · CRZ radius: ${(
          props.tree_crown_diameter_ft / 2
        ).toFixed(0)} ft`
      : props.crz_source === "osm"
      ? "OSM CRZ data"
      : "Estimated CRZ";
    const line3 = `${fmt(props.area_sqft)} sq ft protected`;

    return (
      <>
        <div
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "#111827",
            marginBottom: "2px",
          }}
        >
          {line1}
        </div>
        <div style={{ fontSize: "13px", color: "#6B7280" }}>{line2}</div>
        <div style={{ fontSize: "13px", color: "#9CA3AF" }}>{line3}</div>
      </>
    );
  }

  if (cat === "landuse") {
    const type = props.landuse_type || "Unknown";
    const label = type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return (
      <>
        <div
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "#111827",
            marginBottom: "2px",
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: "13px", color: "#6B7280" }}>
          {props.landuse_name || "Predominant Land Use (OSM)"}
        </div>
        <div style={{ fontSize: "13px", color: "#9CA3AF" }}>
          {fmt(props.area_sqft)} sq ft
        </div>
      </>
    );
  }

  // Fallback
  return (
    <>
      <div
        style={{
          fontSize: "14px",
          fontWeight: 600,
          color: "#111827",
          marginBottom: "2px",
          textTransform: "capitalize",
        }}
      >
        {cat.replace("_", " ")}
      </div>
      <div style={{ fontSize: "13px", color: "#6B7280" }}>
        {fmt(props.area_sqft)} sq ft
      </div>
    </>
  );
}

function PopupContent({ props }: { props: FeatureProperties }) {
  const cat = props.category;

  const popupStyle: React.CSSProperties = {
    padding: "16px",
    minWidth: "220px",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  };
  const headerStyle: React.CSSProperties = {
    fontSize: "16px",
    fontWeight: 600,
    color: "#111827",
    marginBottom: "2px",
  };
  const subheaderStyle: React.CSSProperties = {
    fontSize: "13px",
    color: "#6B7280",
    marginBottom: "12px",
  };

  if (cat === "demolition") {
    const header =
      props.addr_number && props.addr_street
        ? `${props.addr_number} ${props.addr_street}`
        : props.building_name || humanizeBuilding(props.building_type || "yes");
    return (
      <div style={popupStyle}>
        <div style={headerStyle}>{header}</div>
        <div style={subheaderStyle}>
          {humanizeBuilding(props.building_type || "yes")}
        </div>
        <Row
          label="Floors"
          value={props.building_levels?.toString() || "Unknown"}
        />
        <Row
          label="Material"
          value={
            props.building_material
              ? props.building_material.charAt(0).toUpperCase() +
                props.building_material.slice(1)
              : "Unknown"
          }
        />
        <Row
          label="Year built"
          value={props.year_built?.toString() || "Unknown"}
        />
        {props.is_hazmat && (
          <Row
            label="Hazmat"
            value="Pre-1978 — lead/asbestos risk"
            valueStyle={{ color: "#EF4444" }}
          />
        )}
        <Row label="Area" value={`${fmt(props.area_sqft)} sq ft`} />
        <PopupDivider />
        <div
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "#111827",
            marginBottom: "6px",
          }}
        >
          Cost Breakdown
        </div>
        <Row label="Base cost" value={fmtCost(props.demo_cost_base || 0)} />
        {(props.demo_cost_hazmat ?? 0) > 0 && (
          <Row
            label="Hazmat surcharge"
            value={fmtCost(props.demo_cost_hazmat!)}
          />
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            fontSize: "14px",
            fontWeight: 600,
            color: "#111827",
            borderTop: "1px solid #E5E7EB",
            marginTop: "6px",
            paddingTop: "6px",
          }}
        >
          <span>Total estimate</span>
          <span>{fmtCost(props.demo_cost_total || 0)}</span>
        </div>
        {props.osm_id && (
          <div
            style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "10px" }}
          >
            OSM ID: {props.osm_id}
          </div>
        )}
      </div>
    );
  }

  if (cat === "impervious" && props.road_type) {
    const header = props.road_name || "Unnamed Road";
    const weight = props.road_surface_weight ?? 1;
    const weightLabel =
      weight === 1
        ? "100% — fully impervious"
        : weight === 0.5
        ? "50% — partially pervious"
        : "0% — pervious";
    return (
      <div style={popupStyle}>
        <div style={headerStyle}>{header}</div>
        <div style={subheaderStyle}>{humanizeRoad(props.road_type)}</div>
        <Row
          label="Surface"
          value={
            props.road_surface
              ? props.road_surface.charAt(0).toUpperCase() +
                props.road_surface.slice(1)
              : "Unknown"
          }
        />
        <Row label="Impervious weight" value={weightLabel} />
        <Row label="Area" value={`${fmt(props.area_sqft)} sq ft`} />
      </div>
    );
  }

  if (cat === "crz") {
    const header = props.tree_species || "Tree";
    return (
      <div style={popupStyle}>
        <div style={headerStyle}>
          {header}
          {props.is_heritage && (
            <span
              style={{
                fontSize: "11px",
                color: "#EF4444",
                marginLeft: "6px",
                fontWeight: 500,
              }}
            >
              Heritage Species
            </span>
          )}
        </div>
        <div style={subheaderStyle}>
          Critical Root Zone ·{" "}
          {props.crz_source === "osm" ? "OSM data" : "Estimated"}
        </div>
        <Row
          label="Crown diameter"
          value={
            props.tree_crown_diameter_ft
              ? `${props.tree_crown_diameter_ft} ft`
              : "Unknown"
          }
        />
        <Row
          label="CRZ radius"
          value={
            props.tree_crown_diameter_ft
              ? `${(props.tree_crown_diameter_ft / 2).toFixed(0)} ft`
              : "Estimated"
          }
        />
        <Row
          label="Height"
          value={
            props.tree_height_ft ? `${props.tree_height_ft} ft` : "Unknown"
          }
        />
        <Row label="Protected area" value={`${fmt(props.area_sqft)} sq ft`} />
        {props.is_heritage && (
          <div
            style={{
              fontSize: "11px",
              color: "#9CA3AF",
              marginTop: "10px",
              fontStyle: "italic",
            }}
          >
            This species may be protected by local ordinance
          </div>
        )}
      </div>
    );
  }

  if (cat === "landuse") {
    const type = props.landuse_type || "Unknown";
    const label = type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return (
      <div style={popupStyle}>
        <div style={headerStyle}>{label}</div>
        <div style={subheaderStyle}>Predominant Land Use · OSM</div>
        {props.landuse_name && <Row label="Name" value={props.landuse_name} />}
        <Row label="Area" value={`${fmt(props.area_sqft)} sq ft`} />
        <div
          style={{
            fontSize: "11px",
            color: "#9CA3AF",
            marginTop: "10px",
            fontStyle: "italic",
          }}
        >
          Approximate — not legal zoning data
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div style={popupStyle}>
      <div style={{ ...headerStyle, textTransform: "capitalize" }}>
        {cat.replace("_", " ")}
      </div>
      <div style={{ fontSize: "13px", color: "#6B7280", marginTop: "4px" }}>
        {fmt(props.area_sqft)} sq ft
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: string;
  valueStyle?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        fontSize: "13px",
        padding: "3px 0",
      }}
    >
      <span style={{ color: "#6B7280" }}>{label}</span>
      <span style={{ color: "#111827", fontWeight: 500, ...valueStyle }}>
        {value}
      </span>
    </div>
  );
}

function PopupDivider() {
  return (
    <div
      style={{ height: "1px", backgroundColor: "#E5E7EB", margin: "10px 0" }}
    />
  );
}

export default function MapComponent({
  analysisState,
  layerVisibility,
  onPolygonDrawn,
}: MapProps) {
  const mapRef = useRef<any>(null);
  const drawRef = useRef<MapboxDraw | null>(null);

  const [clickedFeature, setClickedFeature] = useState<{
    props: FeatureProperties;
    lng: number;
    lat: number;
  } | null>(null);

  const [hoverInfo, setHoverInfo] = useState<{
    props: FeatureProperties;
    x: number;
    y: number;
  } | null>(null);

  // wire up draw controls once on mount
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || drawRef.current) return;

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
      defaultMode: "simple_select",
    });

    map.addControl(draw, "top-right");
    drawRef.current = draw;

    map.on("draw.create", (e: DrawCreateEvent) => {
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];

      if (feature.geometry.type !== "Polygon") {
        alert(
          "Invalid shape. Please draw a polygon (closed area), not a line or point.",
        );
        drawRef.current?.deleteAll();
        drawRef.current?.changeMode("draw_polygon");
        return;
      }

      const coordinates = feature.geometry.coordinates[0];
      if (coordinates.length < 4) {
        alert(
          "Polygon too small. Please draw at least 3 points to create a valid area.",
        );
        drawRef.current?.deleteAll();
        drawRef.current?.changeMode("draw_polygon");
        return;
      }

      onPolygonDrawn(feature);
    });

    return () => {
      if (drawRef.current && map) {
        map.removeControl(drawRef.current);
        drawRef.current = null;
      }
    };
  }, [onPolygonDrawn]);

  useEffect(() => {
    if (analysisState.status === "drawing" && drawRef.current) {
      drawRef.current.changeMode("draw_polygon");
    }
  }, [analysisState.status]);

  useEffect(() => {
    if (analysisState.status === "idle" && drawRef.current) {
      drawRef.current.deleteAll();
    }
  }, [analysisState.status]);

  const features =
    analysisState.status === "complete" ? analysisState.result.features : [];

  const featuresByCategory: Record<string, DetectedFeature[]> = {};
  features.forEach((feature) => {
    const category = feature.properties.category;
    if (!featuresByCategory[category]) featuresByCategory[category] = [];
    featuresByCategory[category].push(feature);
  });

  const getActiveLayers = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return [];
    return Object.keys(CATEGORY_COLORS)
      .map((cat) => `${cat}-fill`)
      .filter((id) => {
        try {
          return map.getLayer(id) !== undefined;
        } catch {
          return false;
        }
      });
  }, []);

  const handleMouseMove = useCallback(
    (event: MapClickEvent) => {
      const map = mapRef.current?.getMap();
      if (!map) return;

      const layers = getActiveLayers();
      if (layers.length === 0) {
        setHoverInfo(null);
        return;
      }

      const hits = map.queryRenderedFeatures(event.point as [number, number], {
        layers,
      });
      if (hits.length > 0) {
        const props = parseProps(hits[0].properties);
        setHoverInfo({ props, x: event.point.x, y: event.point.y });
        map.getCanvas().style.cursor = "pointer";
      } else {
        setHoverInfo(null);
        map.getCanvas().style.cursor = "";
      }
    },
    [getActiveLayers],
  );

  const handleMouseLeave = useCallback(() => {
    setHoverInfo(null);
    const map = mapRef.current?.getMap();
    if (map) map.getCanvas().style.cursor = "";
  }, []);

  const handleMapClick = useCallback(
    (event: MapClickEvent) => {
      const map = mapRef.current?.getMap();
      if (!map) return;

      const layers = getActiveLayers();
      if (layers.length === 0) {
        setClickedFeature(null);
        return;
      }

      const hits = map.queryRenderedFeatures(event.point as [number, number], {
        layers,
      });
      if (hits.length > 0) {
        const props = parseProps(hits[0].properties);
        setClickedFeature({
          props,
          lng: event.lngLat.lng,
          lat: event.lngLat.lat,
        });
      } else {
        setClickedFeature(null);
      }
    },
    [getActiveLayers],
  );

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      <MapGL
        ref={mapRef}
        mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
        initialViewState={{ longitude: -117.16, latitude: 32.72, zoom: 15 }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        onClick={handleMapClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onLoad={() => {}}
      >
        {Object.entries(featuresByCategory).map(
          ([category, categoryFeatures]) => {
            const isVisible = layerVisibility[category] !== false;
            const color = CATEGORY_COLORS[category] || "#999999";
            return (
              <Source
                key={`source-${category}`}
                id={`source-${category}`}
                type="geojson"
                data={{ type: "FeatureCollection", features: categoryFeatures }}
              >
                <Layer
                  id={`${category}-fill`}
                  type="fill"
                  paint={{ "fill-color": color, "fill-opacity": 0.2 }}
                  layout={{ visibility: isVisible ? "visible" : "none" }}
                />
                <Layer
                  id={`${category}-outline`}
                  type="line"
                  paint={{
                    "line-color": color,
                    "line-width": 1,
                    "line-opacity": 0.5,
                  }}
                  layout={{ visibility: isVisible ? "visible" : "none" }}
                />
              </Source>
            );
          },
        )}

        {clickedFeature && (
          <Popup
            longitude={clickedFeature.lng}
            latitude={clickedFeature.lat}
            onClose={() => setClickedFeature(null)}
            closeOnClick={false}
            maxWidth="320px"
          >
            <div style={{ padding: "4px" }}>
              <PopupContent props={clickedFeature.props} />
            </div>
          </Popup>
        )}
      </MapGL>

      {hoverInfo && !clickedFeature && (
        <div
          style={{
            position: "absolute",
            left: hoverInfo.x + 16,
            top: hoverInfo.y + 16,
            backgroundColor: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: "8px",
            padding: "12px 16px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            lineHeight: "1.5",
            pointerEvents: "none",
            zIndex: 10,
            maxWidth: "280px",
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          }}
        >
          <HoverTooltip props={hoverInfo.props} />
        </div>
      )}
    </div>
  );
}
