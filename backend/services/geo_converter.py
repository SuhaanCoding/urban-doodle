import math

import cv2
import numpy as np
from shapely.geometry import Polygon, mapping, shape
from shapely.ops import unary_union

#CRZ= critical root zone, #impervious = water blocking, #demolition = cost calculation only for devs
LABEL_GROUPS: dict[str, list[str]] = {
    "crz":        ["tree", "grass"],
    "impervious": ["building", "house", "road", "sidewalk", "pavement", "path", "dirt track"],
    "demolition": ["building", "house"],
}

CATEGORY_COLORS = {
    "crz":         "#ef4444",  # red
    "impervious":  "#6b7280",  # grey
    "demolition":  "#f97316",  # orange
    "steep_slope": "#eab308",  # yellow (need to add for steepslopes)
}

DEMO_COST_PER_SQFT = 13.0 #random estimates
IMPERVIOUS_CAP_PCT = 45.0 


def masks_to_geojson(
    masks: dict[str, np.ndarray],
    tile_bounds: list[float],
    simplify_tolerance: float = 0.00001,
) -> list[dict]:
    """
    Convert pixel space binary masks to a list of Feature dicts
    """
    west, south, east, north = tile_bounds
    features = []

    for label, mask in masks.items():
        if mask is None or not np.any(mask):
            continue

        h, w = mask.shape
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for contour in contours:
            if len(contour) < 3:
                continue

            coords = []
            for point in contour:
                px, py = point[0]
                lng = west + (px / w) * (east - west)
                lat = north - (py / h) * (north - south)
                coords.append((lng, lat))

            coords.append(coords[0])  # close the ring

            if len(coords) < 4:
                continue

            try:
                poly = Polygon(coords)
                if not poly.is_valid:
                    poly = poly.buffer(0)
                if poly.is_empty:
                    continue

                poly = poly.simplify(simplify_tolerance)
                if poly.is_empty:
                    continue

                geom = mapping(poly)
                features.append({
                    "type": "Feature",
                    "geometry": dict(geom),
                    "properties": {
                        "label": label,
                    },
                })
            except Exception:
                continue

    return features


def apply_crz_buffer(features: list[dict]) -> list[dict]:
    """
    Replace raw tree/grass (crz) polygons with their CRZ buffer polygons. 20% value
    """
    buffered = []
    for f in features:
        if f["properties"]["label"] not in ("tree", "grass"):
            continue
        try:
            poly = shape(f["geometry"])
            # Equivalent radius from area, then extend by 20%
            radius = math.sqrt(poly.area / math.pi)
            crz_poly = poly.buffer(radius * 0.2)
            geom = mapping(crz_poly)
            buffered.append({
                "type": "Feature",
                "geometry": dict(geom),
                "properties": {
                    "category": "crz",
                    "color": CATEGORY_COLORS["crz"],
                },
            })
        except Exception:
            continue
    return buffered

#CRZ buffer makes the result kinda poor. Lets keep this as a feature where its a toggle

def merge_and_clip_features(
    all_features: list[dict],
    user_polygon,
) -> tuple[list[dict], dict]:
    """
    Merge features from all tiles by category, clip to the user's drawn polygon,
    calculate areas, and compute feasibility metadata. Returns (final_features, metadata_dict)
    """
    center_lat = user_polygon.centroid.y
    meters_per_deg = 111320 * math.cos(math.radians(center_lat))
    sqm_per_deg2 = meters_per_deg ** 2

    def to_sqft(shapely_area: float) -> float:
        return shapely_area * sqm_per_deg2 * 10.764

    total_area_sqft = to_sqft(user_polygon.area)

    # Group raw geometries by label first
    by_label: dict[str, list] = {}
    for f in all_features:
        label = f["properties"]["label"]
        by_label.setdefault(label, []).append(shape(f["geometry"]))

    # one label can map to multiple categories
    by_category: dict[str, list] = {}
    for label, geoms in by_label.items():
        matched = False
        for category, members in LABEL_GROUPS.items():
            if label in members:
                by_category.setdefault(category, []).extend(geoms)
                matched = True
        if not matched:
            by_category.setdefault(label, []).extend(geoms)

    final_features = []
    category_sqft: dict[str, float] = {}

    for category, geoms in by_category.items():
        buffered = [g.buffer(0.000001) for g in geoms]
        merged = unary_union(buffered)
        clipped = merged.intersection(user_polygon)

        if clipped.is_empty:
            continue

        area_sqft = to_sqft(clipped.area)
        category_sqft[category] = area_sqft

        geom = mapping(clipped)
        final_features.append({
            "type": "Feature",
            "geometry": dict(geom),
            "properties": {
                "category": category,
                "area_sqft": area_sqft,
                "color": CATEGORY_COLORS.get(category, "#888888"),
            },
        })

    # Build metadata
    impervious_sqft = category_sqft.get("impervious", 0.0)
    impervious_pct = (impervious_sqft / total_area_sqft * 100) if total_area_sqft > 0 else 0.0
    remaining_pct = max(0.0, IMPERVIOUS_CAP_PCT - impervious_pct)
    remaining_sqft = max(0.0, total_area_sqft * remaining_pct / 100)

    demo_sqft = category_sqft.get("demolition", 0.0)

    metadata = {
        "total_area_sqft": total_area_sqft,
        "crz_sqft": category_sqft.get("crz", 0.0),
        "impervious_sqft": impervious_sqft,
        "impervious_pct": impervious_pct,
        "impervious_budget_remaining_pct": remaining_pct,
        "impervious_budget_remaining_sqft": remaining_sqft,
        "steep_slope_sqft": 0.0,
        "steep_slope_pct": 0.0,
        "demo_sqft": demo_sqft,
        "demo_cost_estimate": demo_sqft * DEMO_COST_PER_SQFT,
    }

    return final_features, metadata
