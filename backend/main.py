import os
import time
from typing import Literal, Union

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from shapely.geometry import shape

# from services.tile_fetcher import compute_tile_grid, fetch_tile_image
# from services.segmentation import segment_image
# from services.geo_converter import masks_to_geojson, merge_and_clip_features

load_dotenv()
MAPBOX_TOKEN = os.getenv("MAPBOX_ACCESS_TOKEN", "")


#incoming data model

class PolygonGeometry(BaseModel):
    type: Literal["Polygon"]
    coordinates: list[list[list[float]]]

class AnalyzeRequest(BaseModel):
    type: Literal["Feature"]
    geometry: PolygonGeometry
    properties: dict | None = None

#outgoing data model

class FeatureGeometry(BaseModel):
    type: Literal["Polygon", "MultiPolygon"]
    coordinates: Union[list[list[list[float]]], list[list[list[list[float]]]]]

class FeatureProperties(BaseModel):
    category: Literal["vegetation", "water", "buildings", "roads", "bare_soil", "other"]
    area_sqft: float
    color: str

class DetectedFeature(BaseModel):
    type: Literal["Feature"]
    geometry: FeatureGeometry
    properties: FeatureProperties

class AnalysisMetadata(BaseModel):
    total_area_sqft: float
    vegetation_sqft: float
    vegetation_pct: float
    water_sqft: float
    water_pct: float
    buildings_sqft: float
    buildings_pct: float
    roads_sqft: float
    roads_pct: float
    bare_soil_sqft: float
    bare_soil_pct: float
    other_sqft: float
    other_pct: float
    tiles_processed: int
    processing_time_ms: float

class AnalyzeResponse(BaseModel):
    type: Literal["FeatureCollection"]
    features: list[DetectedFeature]
    metadata: AnalysisMetadata

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"message": "AI Site Scout API, POST /analyze"}


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(body: AnalyzeRequest) -> AnalyzeResponse:
    if not MAPBOX_TOKEN:
        raise HTTPException(500, "MAPBOX_ACCESS_TOKEN not set in .env")

    start_time = time.time()

    try:
        user_polygon = shape(body.geometry.model_dump())
        processing_time_ms = (time.time() - start_time) * 1000

        #dummy response
        return AnalyzeResponse(
            type="FeatureCollection",
            features=[],
            metadata=AnalysisMetadata(
                total_area_sqft=0,
                vegetation_sqft=0, vegetation_pct=0,
                water_sqft=0, water_pct=0,
                buildings_sqft=0, buildings_pct=0,
                roads_sqft=0, roads_pct=0,
                bare_soil_sqft=0, bare_soil_pct=0,
                other_sqft=0, other_pct=0,
                tiles_processed=0,
                processing_time_ms=processing_time_ms,
            ),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
