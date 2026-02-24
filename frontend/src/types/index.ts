export interface FeatureProperties {
  category: CategoryType;
  area_sqft: number;
  color: string;
  // Building tags (demolition + impervious)
  osm_id?: number;
  building_type?: string;
  building_levels?: number;
  building_material?: string;
  year_built?: number;
  is_hazmat?: boolean;
  addr_number?: string;
  addr_street?: string;
  building_name?: string;
  demo_cost_base?: number;
  demo_cost_hazmat?: number;
  demo_cost_total?: number;
  // Road tags (impervious)
  road_type?: string;
  road_name?: string;
  road_surface?: string;
  road_surface_weight?: number;
  // Tree / CRZ tags
  tree_species?: string;
  tree_crown_diameter_ft?: number;
  tree_height_ft?: number;
  is_heritage?: boolean;
  crz_source?: string;
  // Land use
  landuse_type?: string;
  landuse_name?: string;
}

export interface DetectedFeature {
  type: "Feature";
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
  properties: FeatureProperties;
}

export type CategoryType = string;

// User drawn polygon from Mapbox Draw
export interface UserPolygon {
  type: "Feature";
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
  properties?: Record<string, any>;
}

export interface AnalysisResponse {
  type: "FeatureCollection";
  features: DetectedFeature[];
  metadata: AnalysisMetadata;
}

export interface AnalysisMetadata {
  total_area_sqft: number;
  // CRZ
  crz_sqft: number;
  // Impervious cover
  impervious_sqft: number;
  impervious_pct: number;
  impervious_budget_remaining_pct: number;
  impervious_budget_remaining_sqft: number;
  impervious_post_demo_sqft: number;
  impervious_post_demo_pct: number;
  // Demolition
  demo_sqft: number;
  demo_cost_estimate: number;
  demo_cost_base: number;
  demo_cost_hazmat: number;
  building_count: number;
  minor_structures_sqft: number;
  osm_tree_count: number;
  // Land use
  landuse_breakdown: Record<string, number>;
  // Buildable area
  setback_sqft: number;
  buildable_gross_sqft: number;
  buildable_net_sqft: number;
  buildable_post_demo_sqft: number;
  // Development value
  dev_price_per_sqft: number;
  dev_value_gross: number;
  dev_value_net: number;
  // Processing
  tiles_processed: number;
  processing_time_ms: number;
}

export type LayerVisibility = Record<CategoryType, boolean>;

export interface UserSettings {
  impervious_cap_pct: number;
  demo_cost_per_sqft: number;
  demo_material_multipliers: Record<string, number>;
  demo_hazmat_surcharge_per_sqft: number;
  impervious_surface_types: string[];
  include_minor_structures: boolean;
  // Setbacks
  setback_front_ft: number;
  setback_side_ft: number;
  setback_rear_ft: number;
  // Development value
  dev_price_per_sqft: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  impervious_cap_pct: 45,
  demo_cost_per_sqft: 13,
  demo_material_multipliers: {
    concrete: 1.4,
    brick: 1.4,
    wood: 1.0,
    metal: 0.8,
  },
  demo_hazmat_surcharge_per_sqft: 5,
  impervious_surface_types: [
    "building",
    "road",
    "sidewalk",
    "pavement",
    "path",
  ],
  include_minor_structures: false,
  setback_front_ft: 15,
  setback_side_ft: 5,
  setback_rear_ft: 10,
  dev_price_per_sqft: 150,
};

export type AnalysisState =
  | { status: "idle" }
  | { status: "drawing" }
  | { status: "ready"; polygon: UserPolygon }
  | { status: "analyzing"; polygon: UserPolygon }
  | { status: "complete"; polygon: UserPolygon; result: AnalysisResponse }
  | { status: "error"; message: string };
