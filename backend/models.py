from typing import Literal, Union

from pydantic import BaseModel


#Incoming

class PolygonGeometry(BaseModel):
    type: Literal["Polygon"]
    coordinates: list[list[list[float]]]

class AnalyzeRequest(BaseModel):
    type: Literal["Feature"]
    geometry: PolygonGeometry
    properties: dict | None = None


#Outgoing

class FeatureGeometry(BaseModel):
    type: Literal["Polygon", "MultiPolygon"]
    coordinates: Union[list[list[list[float]]], list[list[list[list[float]]]]]

class FeatureProperties(BaseModel):
    category: Literal["crz", "impervious", "steep_slope", "demolition"]
    area_sqft: float
    color: str

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
    # Steep slope
    steep_slope_sqft: float
    steep_slope_pct: float
    # Demolition
    demo_sqft: float
    demo_cost_estimate: float
    # Processing
    tiles_processed: int
    processing_time_ms: float

class AnalyzeResponse(BaseModel):
    type: Literal["FeatureCollection"]
    features: list[DetectedFeature]
    metadata: AnalysisMetadata
