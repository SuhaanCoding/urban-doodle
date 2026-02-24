import math

import cv2
import numpy as np
from shapely.geometry import Polygon, mapping, shape
from shapely.ops import unary_union

# crz = tree protection zones, impervious = hard surfaces that block drainage, demolition = cost calc for devs
LABEL_GROUPS: dict[str, list[str]] = {
    "crz":        ["tree", "grass"],
    "impervious": ["building", "house", "road", "sidewalk", "pavement", "path", "dirt track"],
    "demolition": ["building", "house"],
}

CATEGORY_COLORS = {
    "crz":        "#ef4444",  # red
    "impervious": "#6b7280",  # grey
    "demolition": "#f97316",  # orange
    "landuse":    "#3b82f6",  # blue
}

FT_PER_M = 3.28084

# Labels that go to demolition, kept separate from the merge pipeline
DEMOLITION_LABELS = set(LABEL_GROUPS["demolition"])

# OSM roads kept individual so hover/click can show road name, type, surface
ROAD_LABELS = {"road"}


# Default road widths in metres by highway type, used when OSM width tag is missing
DEFAULT_ROAD_WIDTH_M: dict[str, float] = {
    "motorway":     12.0,
    "trunk":        10.0,
    "primary":       8.0,
    "secondary":     7.0,
    "tertiary":      6.0,
    "residential":   5.0,
    "service":       4.0,
    "living_street": 4.0,
}
DEFAULT_WIDTH_M = 5.0


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

def merge_and_clip_features(all_features: list[dict],user_polygon, settings=None,) -> tuple[list[dict], dict]:
    """
    Merge features from all tiles by category, clip to the user's drawn polygon,
    calculate areas, and compute feasibility metadata. Returns (final_features, metadata_dict). 
    to have consistency building costs r seperate while polygons r combined
    """

    # Unpack settings, fall back to defaults if none provided
    if settings is None:
        impervious_cap_pct = 45.0
        demo_cost_per_sqft = 13.0
        demo_material_mults = {"concrete": 1.4, "brick": 1.4, "wood": 1.0, "metal": 0.8}
        demo_hazmat_surcharge = 5.0
        impervious_surface_types = ["building", "road", "sidewalk", "pavement", "path"]
        include_minor = False
        setback_front_ft = 15.0
        setback_side_ft = 5.0
        setback_rear_ft = 10.0
        dev_price_per_sqft = 150.0
    else:
        impervious_cap_pct = settings.impervious_cap_pct
        demo_cost_per_sqft = settings.demo_cost_per_sqft
        demo_material_mults = settings.demo_material_multipliers
        demo_hazmat_surcharge = settings.demo_hazmat_surcharge_per_sqft
        impervious_surface_types = settings.impervious_surface_types
        include_minor = settings.include_minor_structures
        setback_front_ft = settings.setback_front_ft
        setback_side_ft = settings.setback_side_ft
        setback_rear_ft = settings.setback_rear_ft
        dev_price_per_sqft = settings.dev_price_per_sqft

    center_lat = user_polygon.centroid.y
    meters_per_deg = 111320 * math.cos(math.radians(center_lat))
    sqm_per_deg2 = meters_per_deg ** 2

    def to_sqft(shapely_area: float) -> float:
        return shapely_area * sqm_per_deg2 * 10.764

    total_area_sqft = to_sqft(user_polygon.area)

    # Setback: buffer polygon inward by average setback distance
    avg_setback_ft = (setback_front_ft + setback_side_ft + setback_rear_ft) / 3
    avg_setback_m = avg_setback_ft / FT_PER_M
    avg_setback_deg = avg_setback_m / meters_per_deg
    inner_polygon = user_polygon.buffer(-avg_setback_deg)
    if inner_polygon.is_empty or inner_polygon.area <= 0:
        setback_sqft = total_area_sqft
    else:
        setback_sqft = max(0.0, total_area_sqft - to_sqft(inner_polygon.area))

    # buildings and roads stay individual so popups can show per feature data, everything else gets merged
    demolition_raw = []
    road_raw = []
    landuse_raw = []
    other_features = []
    for f in all_features:
        label = f["properties"].get("label")
        if label in DEMOLITION_LABELS:
            demolition_raw.append(f)
        elif label in ROAD_LABELS and f["properties"].get("road_type"):
            road_raw.append(f)
        elif label == "landuse":
            landuse_raw.append(f)
        else:
            other_features.append(f)

    final_features: list[dict] = []
    category_sqft: dict[str, float] = {}

    demo_cost_base_total = 0.0
    demo_cost_hazmat_total = 0.0
    demo_sqft_total = 0.0
    building_count = 0
    minor_structures_sqft = 0.0

    for f in demolition_raw:
        props = f["properties"]
        try:
            poly = shape(f["geometry"]).buffer(0.000001)
            clipped = poly.intersection(user_polygon)
            if clipped.is_empty:
                continue
        except Exception:
            continue

        area_sqft = to_sqft(clipped.area)
        is_minor = props.get("is_minor", False)

        if is_minor and not include_minor:
            minor_structures_sqft += area_sqft
            continue

        levels = props.get("building_levels") or 1
        material = (props.get("building_material") or "").lower()
        material_mult = demo_material_mults.get(material, 1.0)
        is_hazmat = props.get("is_hazmat")  # True / False / None

        cost_base = area_sqft * demo_cost_per_sqft * material_mult * levels
        cost_hazmat = (area_sqft * demo_hazmat_surcharge) if is_hazmat else 0.0
        cost_total = cost_base + cost_hazmat

        demo_cost_base_total += cost_base
        demo_cost_hazmat_total += cost_hazmat
        demo_sqft_total += area_sqft
        building_count += 1

        final_features.append({
            "type": "Feature",
            "geometry": dict(mapping(clipped)),
            "properties": {
                "category": "demolition",
                "area_sqft": area_sqft,
                "color": CATEGORY_COLORS["demolition"],
                "osm_id": props.get("osm_id"),
                "building_type": props.get("building_type"),
                "building_levels": props.get("building_levels"),
                "building_material": props.get("building_material"),
                "year_built": props.get("year_built"),
                "is_hazmat": is_hazmat,
                "addr_number": props.get("addr_number"),
                "addr_street": props.get("addr_street"),
                "building_name": props.get("building_name"),
                "demo_cost_base": round(cost_base, 2),
                "demo_cost_hazmat": round(cost_hazmat, 2),
                "demo_cost_total": round(cost_total, 2),
            },
        })

    category_sqft["demolition"] = demo_sqft_total

    # roads: merge into one polygon so overlapping buffers don't stack opacity at intersections
    road_sqft_total = 0.0
    road_clipped_geoms = []

    for f in road_raw:
        props = f["properties"]

        if "road" not in impervious_surface_types:
            continue

        try:
            geom = shape(f["geometry"])
            if geom.geom_type in ("LineString", "MultiLineString"):
                width_m = props.get("width_m") or DEFAULT_ROAD_WIDTH_M.get(
                    props.get("road_type", ""), DEFAULT_WIDTH_M
                )
                half_width_deg = (width_m / 2) / meters_per_deg
                geom = geom.buffer(half_width_deg)

            clipped = geom.buffer(0.000001).intersection(user_polygon)
            if clipped.is_empty:
                continue
        except Exception:
            continue

        area_sqft = to_sqft(clipped.area)
        weight = props.get("road_surface_weight", 1.0)
        road_sqft_total += area_sqft * weight
        road_clipped_geoms.append(clipped)

    if road_clipped_geoms:
        merged_roads = unary_union(road_clipped_geoms)
        if not merged_roads.is_empty:
            final_features.append({
                "type": "Feature",
                "geometry": dict(mapping(merged_roads)),
                "properties": {
                    "category": "impervious",
                    "area_sqft": to_sqft(merged_roads.area),
                    "color": CATEGORY_COLORS["impervious"],
                },
            })

    # group by label to category, merge per category
    by_label: dict[str, list] = {}
    for f in other_features:
        label = f["properties"].get("label", "")
        geom = shape(f["geometry"])

        if geom.geom_type in ("LineString", "MultiLineString"):
            width_m = f["properties"].get("width_m") or DEFAULT_ROAD_WIDTH_M.get(
                f["properties"].get("road_type", ""), DEFAULT_WIDTH_M
            )
            half_width_deg = (width_m / 2) / meters_per_deg
            geom = geom.buffer(half_width_deg)

        by_label.setdefault(label, []).append(geom)

    by_category: dict[str, list] = {}
    for label, geoms in by_label.items():
        if label in LABEL_GROUPS["impervious"] and label not in impervious_surface_types:
            continue
        matched = False
        for category, members in LABEL_GROUPS.items():
            if category == "demolition":
                continue  # already handled above
            if label in members:
                by_category.setdefault(category, []).extend(geoms)
                matched = True
        if not matched:
            by_category.setdefault(label, []).extend(geoms)

    for category, geoms in by_category.items():
        buffered = [g.buffer(0.000001) for g in geoms]
        merged   = unary_union(buffered)
        clipped  = merged.intersection(user_polygon)

        if clipped.is_empty:
            continue

        area_sqft = to_sqft(clipped.area)
        category_sqft[category] = area_sqft

        final_features.append({
            "type": "Feature",
            "geometry": dict(mapping(clipped)),
            "properties": {
                "category": category,
                "area_sqft": area_sqft,
                "color": CATEGORY_COLORS.get(category, "#888888"),
            },
        })
    # landuse kept separate by type so we can show a breakdown in the sidebar
    landuse_breakdown: dict[str, float] = {}
    by_landuse_type: dict[str, list] = {}

    for f in landuse_raw:
        props = f["properties"]
        ltype = props.get("landuse_type", "unknown")
        try:
            poly = shape(f["geometry"]).buffer(0.000001)
            clipped = poly.intersection(user_polygon)
            if clipped.is_empty:
                continue
        except Exception:
            continue
        by_landuse_type.setdefault(ltype, []).append((clipped, props))

    for ltype, items in by_landuse_type.items():
        geoms = [item[0] for item in items]
        merged = unary_union(geoms)
        if merged.is_empty:
            continue
        # Geometrycollection breaks Pydantic validation so skip those
        if merged.geom_type not in ("Polygon", "MultiPolygon"):
            continue
        area_sqft = to_sqft(merged.area)
        landuse_breakdown[ltype] = round(area_sqft, 1)

        lname = next((item[1].get("landuse_name") for item in items if item[1].get("landuse_name")), None)
        final_features.append({
            "type": "Feature",
            "geometry": dict(mapping(merged)),
            "properties": {
                "category": "landuse",
                "area_sqft": area_sqft,
                "color": CATEGORY_COLORS["landuse"],
                "landuse_type": ltype,
                "landuse_name": lname,
            },
        })

    # Add individual road sqft to whatever merged impervious came from Segformer
    impervious_sqft = category_sqft.get("impervious", 0.0) + road_sqft_total
    impervious_pct = (impervious_sqft / total_area_sqft * 100) if total_area_sqft > 0 else 0.0
    remaining_pct = max(0.0, impervious_cap_pct - impervious_pct)
    remaining_sqft = max(0.0, total_area_sqft * remaining_pct / 100)

    impervious_post_demo_sqft = max(0.0, impervious_sqft - demo_sqft_total)
    impervious_post_demo_pct = (impervious_post_demo_sqft / total_area_sqft * 100) if total_area_sqft > 0 else 0.0


    crz_sqft = category_sqft.get("crz", 0.0)
    # steepslope_sqft is 0 here (filled in by main.py after elevation) accounted in metadata
    buildable_gross = max(0.0, total_area_sqft - crz_sqft)
    buildable_net = max(0.0, buildable_gross - setback_sqft)
    buildable_post_demo = buildable_net + demo_sqft_total  # cleared demo area becomes buildable

    demo_cost_total_val = demo_cost_base_total + demo_cost_hazmat_total
    dev_value_gross = buildable_net * dev_price_per_sqft
    dev_value_net = max(0.0, dev_value_gross - demo_cost_total_val)

    metadata = {
        "total_area_sqft": total_area_sqft,
        "crz_sqft": crz_sqft,
        "impervious_sqft": impervious_sqft,
        "impervious_pct": impervious_pct,
        "impervious_budget_remaining_pct": remaining_pct,
        "impervious_budget_remaining_sqft": remaining_sqft,
        "impervious_post_demo_sqft": impervious_post_demo_sqft,
        "impervious_post_demo_pct": impervious_post_demo_pct,
        "demo_sqft": demo_sqft_total,
        "demo_cost_estimate": round(demo_cost_total_val, 2),
        "demo_cost_base": round(demo_cost_base_total, 2),
        "demo_cost_hazmat": round(demo_cost_hazmat_total, 2),
        "building_count": building_count,
        "minor_structures_sqft": minor_structures_sqft,
        "osm_tree_count": 0,
        # Landuse
        "landuse_breakdown": landuse_breakdown,
        # Buildable area
        "setback_sqft": round(setback_sqft, 1),
        "buildable_gross_sqft": round(buildable_gross, 1),
        "buildable_net_sqft": round(buildable_net, 1),
        "buildable_post_demo_sqft": round(buildable_post_demo, 1),
        # Development value
        "dev_price_per_sqft": dev_price_per_sqft,
        "dev_value_gross": round(dev_value_gross, 2),
        "dev_value_net": round(dev_value_net, 2),
    }

    return final_features, metadata
