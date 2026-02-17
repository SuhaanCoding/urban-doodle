import os
import time

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from shapely.geometry import shape

from models import (
    AnalyzeRequest,
    AnalyzeResponse,
    AnalysisMetadata,
    DetectedFeature,
    FeatureGeometry,
    FeatureProperties,
)

# from services.tile_fetcher import compute_tile_grid, fetch_satellite_tile, fetch_terrain_tile
# from services.segmentation import segment_tile, extract_masks
# from services.geo_converter import masks_to_geojson, apply_crz_buffer, merge_and_clip_features
# from services.elevation import decode_terrain_rgb, compute_slope_mask

load_dotenv()
MAPBOX_TOKEN = os.getenv("MAPBOX_ACCESS_TOKEN", "")
HF_TOKEN = os.getenv("HF_ACCESS_TOKEN", "")

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
    return {"message": "Cedar Feasibility Suite API — POST /analyze"}


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(body: AnalyzeRequest) -> AnalyzeResponse:
    if not MAPBOX_TOKEN:
        raise HTTPException(500, "MAPBOX_ACCESS_TOKEN not set in .env")
    if not HF_TOKEN:
        raise HTTPException(500, "HF_ACCESS_TOKEN not set in .env")

    start_time = time.time()

    try:
        user_polygon = shape(body.geometry.model_dump())
        processing_time_ms = (time.time() - start_time) * 1000

        # Pipeline not yet wired
        return AnalyzeResponse(
            type="FeatureCollection",
            features=[],
            metadata=AnalysisMetadata(
                total_area_sqft=0,
                crz_sqft=0,
                impervious_sqft=0, impervious_pct=0,
                impervious_budget_remaining_pct=45.0,
                impervious_budget_remaining_sqft=0,
                steep_slope_sqft=0, steep_slope_pct=0,
                demo_sqft=0, demo_cost_estimate=0,
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
