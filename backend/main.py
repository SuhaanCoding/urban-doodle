import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import cv2
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from shapely.geometry import shape

from models import (
    AnalysisMetadata,
    AnalyzeRequest,
    AnalyzeResponse,
    DetectedFeature,
    FeatureGeometry,
    FeatureProperties,
)
from services.tile_fetcher import compute_tile_grid, fetch_satellite_tile
from services.segmentation import segment_tile
from services.geo_converter import masks_to_geojson, apply_crz_buffer, merge_and_clip_features
from services.osm_buildings import fetch_osm_buildings

load_dotenv() 
MAPBOX_TOKEN = os.getenv("MAPBOX_ACCESS_TOKEN", "")
HF_TOKEN = os.getenv("HF_ACCESS_TOKEN", "")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def process_tile(tile: dict) -> list[dict]:
    """Fetch one satellite tile, segment it, return raw GeoJSON feature dicts"""
    image = fetch_satellite_tile(tile, tile_size=512, mapbox_token=MAPBOX_TOKEN)
    if image is None:
        return []

    masks = segment_tile(image, HF_TOKEN)
    if masks is None:
        return []

    return masks_to_geojson(masks, tile["bounds"])

@app.get("/")
def read_root():
    return {"message": "Cedar Feasibility Suite API, POST /analyze"}


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(body: AnalyzeRequest) -> AnalyzeResponse:
    if not MAPBOX_TOKEN:
        raise HTTPException(500, "MAPBOX_ACCESS_TOKEN not set in .env")
    if not HF_TOKEN:
        raise HTTPException(500, "HF_ACCESS_TOKEN not set in .env")

    start_time = time.time()

    try:
        user_polygon = shape(body.geometry.model_dump())
        bbox = user_polygon.bounds  # (west, south, east, north)

        tiles = compute_tile_grid(bbox, zoom=18, tile_size=512)
        if len(tiles) > 50:
            raise HTTPException(400, "Analysis zone too large, please draw a smaller area")

        #OSM, ML is inaccurate in comparison but the tradeoff I saw was historical consistency
        osm_features = fetch_osm_buildings(bbox)

        # Fetch + segment all tiles in parallel
        all_features: list[dict] = []
        with ThreadPoolExecutor(max_workers=50) as executor:
            futures = [executor.submit(process_tile, tile) for tile in tiles]
            for future in as_completed(futures):
                all_features.extend(future.result())

        all_features.extend(osm_features)

        # Merge everything across tiles and clip to user polygon
        final_features, metadata = merge_and_clip_features(
            all_features, user_polygon
        )

        processing_time_ms = (time.time() - start_time) * 1000

        # Convert raw feature dicts to Pydantic models
        detected = [
            DetectedFeature(
                type="Feature",
                geometry=FeatureGeometry(
                    type=f["geometry"]["type"],
                    coordinates=f["geometry"]["coordinates"],
                ),
                properties=FeatureProperties(
                    category=f["properties"]["category"],
                    area_sqft=f["properties"]["area_sqft"],
                    color=f["properties"]["color"],
                ),
            )
            for f in final_features
        ]

        return AnalyzeResponse(
            type="FeatureCollection",
            features=detected,
            metadata=AnalysisMetadata(
                **metadata,
                tiles_processed=len(tiles),
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
