from typing import Literal, Optional, Union

from pydantic import BaseModel


# Incoming

class PolygonGeometry(BaseModel):
    type: Literal["Polygon"]
    coordinates: list[list[list[float]]]

class UserSettings(BaseModel):
    impervious_cap_pct: float = 45.0
    demo_cost_per_sqft: float = 13.0
    demo_material_multipliers: dict[str, float] = {
        "concrete": 1.4,
        "brick":    1.4,
        "wood":     1.0,
        "metal":    0.8,
    }
    demo_hazmat_surcharge_per_sqft: float = 5.0
    impervious_surface_types: list[str] = [
        "building", "road", "sidewalk", "pavement", "path"
    ]
    include_minor_structures: bool = False
    # Setbacks
    setback_front_ft: float = 15.0
    setback_side_ft: float = 5.0
    setback_rear_ft: float = 10.0
    # Development value
    dev_price_per_sqft: float = 150.0

class AnalyzeRequest(BaseModel):
    type: Literal["Feature"]
    geometry: PolygonGeometry
    properties: dict | None = None
    settings: UserSettings = UserSettings()


# Outgoing

class FeatureGeometry(BaseModel):
    type: Literal["Polygon", "MultiPolygon"]
    coordinates: Union[list[list[list[float]]], list[list[list[list[float]]]]]

class FeatureProperties(BaseModel):
    category: str
    area_sqft: float
    color: str
    # Building tags (demolition + impervious)
    osm_id: Optional[int] = None
    building_type: Optional[str] = None          # residential / commercial / garage / shed / yes
    building_levels: Optional[int] = None
    building_material: Optional[str] = None      # brick / wood / concrete / metal
    year_built: Optional[int] = None
    is_hazmat: Optional[bool] = None             # True if year_built < 1978
    addr_number: Optional[str] = None
    addr_street: Optional[str] = None
    building_name: Optional[str] = None
    demo_cost_base: Optional[float] = None
    demo_cost_hazmat: Optional[float] = None
    demo_cost_total: Optional[float] = None
    # Road tags (impervious)
    road_type: Optional[str] = None              # highway tag: residential / service / footway etc
    road_name: Optional[str] = None
    road_surface: Optional[str] = None           # asphalt / concrete / gravel / dirt
    road_surface_weight: Optional[float] = None  # 1.0 / 0.5 / 0.0
    # Tree / CRZ tags
    tree_species: Optional[str] = None
    tree_crown_diameter_ft: Optional[float] = None
    tree_height_ft: Optional[float] = None
    is_heritage: Optional[bool] = None
    crz_source: Optional[str] = None             # "osm" or "estimated"
    # Land use
    landuse_type: Optional[str] = None
    landuse_name: Optional[str] = None

class DetectedFeature(BaseModel):
    type: Literal["Feature"]
    geometry: FeatureGeometry
    properties: FeatureProperties

class AnalysisMetadata(BaseModel):
    total_area_sqft: float
    # CRZ
    crz_sqft: float
    # Impervious cover
    impervious_sqft: float
    impervious_pct: float
    impervious_budget_remaining_pct: float
    impervious_budget_remaining_sqft: float
    impervious_post_demo_sqft: float = 0.0
    impervious_post_demo_pct: float = 0.0
    # Demolition
    demo_sqft: float
    demo_cost_estimate: float
    demo_cost_base: float = 0.0
    demo_cost_hazmat: float = 0.0
    building_count: int = 0
    minor_structures_sqft: float = 0.0
    osm_tree_count: int = 0
    # Land use
    landuse_breakdown: dict[str, float] = {}
    # Buildable area
    setback_sqft: float = 0.0
    buildable_gross_sqft: float = 0.0
    buildable_net_sqft: float = 0.0
    buildable_post_demo_sqft: float = 0.0
    # Development value
    dev_price_per_sqft: float = 150.0
    dev_value_gross: float = 0.0
    dev_value_net: float = 0.0
    # Processing
    tiles_processed: int
    processing_time_ms: float

class AnalyzeResponse(BaseModel):
    type: Literal["FeatureCollection"]
    features: list[DetectedFeature]
    metadata: AnalysisMetadata
