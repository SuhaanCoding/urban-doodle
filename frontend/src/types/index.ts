// The GeoJSON feature for a single detected polygon
export interface DetectedFeature {
  type: "Feature";
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
  properties: {
    category: CategoryType;
    area_sqft: number;
    color: string;
  };
}

// All possible land cover categories
export type CategoryType =
  | "vegetation"
  | "water"
  | "buildings"
  | "roads"
  | "bare_soil"
  | "other";

// User-drawn polygon from Mapbox Draw
export interface UserPolygon {
  type: "Feature";
  geometry: {
    type: "Polygon";
    coordinates: number[][][]; // [[[lng, lat], [lng, lat], ...]]
  };
  properties?: Record<string, any>;
}

// The full response from the /analyze endpoint
export interface AnalysisResponse {
  type: "FeatureCollection";
  features: DetectedFeature[];
  metadata: AnalysisMetadata;
}

// Summary statistics
export interface AnalysisMetadata {
  total_area_sqft: number;
  vegetation_sqft: number;
  vegetation_pct: number;
  water_sqft: number;
  water_pct: number;
  buildings_sqft: number;
  buildings_pct: number;
  roads_sqft: number;
  roads_pct: number;
  bare_soil_sqft: number;
  bare_soil_pct: number;
  other_sqft: number;
  other_pct: number;
  tiles_processed: number;
  processing_time_ms: number;
}

// Which layers are visible
export type LayerVisibility = Record<CategoryType, boolean>;

// Analysis state machine
export type AnalysisState =
  | { status: "idle" }
  | { status: "drawing" }
  | { status: "ready"; polygon: UserPolygon }
  | { status: "analyzing"; polygon: UserPolygon }
  | { status: "complete"; polygon: UserPolygon; result: AnalysisResponse }
  | { status: "error"; message: string };
