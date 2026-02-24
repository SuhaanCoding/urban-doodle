import time
import textwrap
import httpx
from shapely.geometry import Polygon, LineString, Point, mapping

# Ordered list of public Overpass endpoints, incase it 429's
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

# time to wait before trying the next endpoint after a 429
RETRY_DELAYS = [5, 15, 30]

#  bbox tuple to parsed feature list
# cleared on server restart, prevents repeat Overpass calls for the same area
_osm_cache: dict[str, list[dict]] = {}

MINOR_STRUCTURE_TYPES = {
    "garage", "garages", "shed", "carport", "hut", "roof",
    "kiosk", "outhouse", "shelter", "greenhouse", "barn", "cabin",
}


def _parse_year(raw: str | None) -> int | None:
    if not raw:
        return None
    for token in raw.replace("-", " ").split():
        if token.isdigit() and len(token) == 4:
            return int(token)
    return None


def _parse_levels(raw: str | None) -> int | None:
    if not raw:
        return None
    try:
        return max(1, round(float(raw)))
    except ValueError:
        return None


SURFACE_WEIGHTS: dict[str, float] = {
    "asphalt":        1.0,
    "concrete":       1.0,
    "paving_stones":  1.0,
    "sett":           1.0,
    "cobblestone":    1.0,
    "metal":          1.0,
    "wood":           1.0,
    "gravel":         0.5,
    "fine_gravel":    0.5,
    "compacted":      0.5,
    "pebblestone":    0.5,
    "dirt":           0.0,
    "unpaved":        0.0,
    "grass":          0.0,
    "ground":         0.0,
    "mud":            0.0,
    "sand":           0.0,
    "earth":          0.0,
}

PAVED_BY_DEFAULT = {
    "motorway", "trunk", "primary", "secondary", "tertiary",
    "residential", "service", "living_street",
}

SKIP_HIGHWAY_TYPES = {"footway", "cycleway", "path", "steps", "track", "proposed", "construction"}

# Heritage tree species — flagged in CRZ popups
HERITAGE_SPECIES = {"quercus", "oak", "sequoia", "redwood", "cedar", "platanus", "sycamore"}

# Metres to feet conversion
M_TO_FT = 3.28084


def _surface_weight(surface: str | None, highway: str) -> float:
    if surface:
        return SURFACE_WEIGHTS.get(surface.lower(), 0.5)
    if highway in PAVED_BY_DEFAULT:
        return 1.0
    return 0.5



def fetch_osm_features(bbox: tuple, timeout: int = 30) -> list[dict]:
    """
    Fetch buildings, roads, trees, and landuse in a single Overpass query.
    Tries multiple public endpoints with delay-based fallback on 429.
    Results are cached in-process by bbox to avoid repeat calls during a session.

    bbox: (west, south, east, north)
    Raises RuntimeError if all endpoints fail (caller surfaces this as HTTP 400).
    """
    cache_key = str(bbox)
    if cache_key in _osm_cache:
        print(f"[OSM] Cache hit for bbox {bbox}")
        return _osm_cache[cache_key]

    west, south, east, north = bbox
    query = textwrap.dedent(f"""
        [out:json][timeout:{timeout}];
        (
          way["building"]({south},{west},{north},{east});
          way["highway"]({south},{west},{north},{east});
          node["natural"="tree"]({south},{west},{north},{east});
          way["landuse"]({south},{west},{north},{east});
        );
        out body;
        >;
        out skel qt;
    """)

    last_err: Exception | None = None
    for attempt, endpoint in enumerate(OVERPASS_ENDPOINTS):
        try:
            print(f"[OSM] Attempt {attempt + 1}/{len(OVERPASS_ENDPOINTS)} → {endpoint}")
            response = httpx.post(
                endpoint,
                data={"data": query},
                timeout=float(timeout + 5),
            )
            if response.status_code == 429:
                delay = RETRY_DELAYS[attempt] if attempt < len(RETRY_DELAYS) else 30
                print(f"[OSM] 429 rate-limited by {endpoint}, waiting {delay}s before next endpoint")
                time.sleep(delay)
                continue
            response.raise_for_status()
        except Exception as e:
            last_err = e
            print(f"[OSM] Error from {endpoint}: {e}")
            continue

        features = _parse_response(response.json())
        _osm_cache[cache_key] = features
        print(f"[OSM] Success: {len(features)} features from {endpoint}")
        return features

    raise RuntimeError(
        f"Overpass API unavailable after {len(OVERPASS_ENDPOINTS)} attempts. "
        f"Last error: {last_err}. Try again in a few minutes."
    )


def _parse_response(data: dict) -> list[dict]:
    """Parse raw Overpass JSON into GeoJSON feature dicts."""
    nodes = {
        el["id"]: (el["lon"], el["lat"])
        for el in data.get("elements", [])
        if el["type"] == "node"
    }

    features = []
    for el in data.get("elements", []):
        tags = el.get("tags", {})

        if el["type"] == "way":
            has_building = bool(tags.get("building"))
            has_highway = bool(tags.get("highway"))
            has_landuse = bool(tags.get("landuse"))

            if has_building:
                feature = _process_building(el, tags, nodes)
                if feature:
                    features.append(feature)
            elif has_highway:
                feature = _process_road(el, tags, nodes)
                if feature:
                    features.append(feature)
            elif has_landuse:
                feature = _process_landuse(el, tags, nodes)
                if feature:
                    features.append(feature)

        elif el["type"] == "node" and tags.get("natural") == "tree":
            feature = _process_tree(el, tags)
            if feature:
                features.append(feature)

    return features


def _process_building(el: dict, tags: dict, nodes: dict) -> dict | None:
    coords = [nodes[nid] for nid in el.get("nodes", []) if nid in nodes]
    if len(coords) < 4:
        return None

    try:
        poly = Polygon(coords)
        if not poly.is_valid:
            poly = poly.buffer(0)
        if poly.is_empty:
            return None
    except Exception:
        return None

    building_type = tags.get("building", "yes").lower()
    is_minor = building_type in MINOR_STRUCTURE_TYPES

    levels = _parse_levels(tags.get("building:levels"))
    if levels is None and tags.get("height"):
        try:
            levels = max(1, round(float(tags["height"]) / 3))
        except ValueError:
            pass

    material = tags.get("building:material", "").lower() or None
    year_built = _parse_year(tags.get("start_date") or tags.get("year_built"))
    is_hazmat = (year_built < 1978) if year_built is not None else None

    return {
        "type": "Feature",
        "geometry": dict(mapping(poly)),
        "properties": {
            "label": "building",
            "osm_id": el["id"],
            "building_type": building_type,
            "building_levels": levels,
            "building_material": material,
            "year_built": year_built,
            "is_hazmat": is_hazmat,
            "addr_number": tags.get("addr:housenumber") or None,
            "addr_street": tags.get("addr:street") or None,
            "building_name": tags.get("name") or None,
            "is_minor": is_minor,
        },
    }


def _process_road(el: dict, tags: dict, nodes: dict) -> dict | None:
    highway = tags.get("highway", "").lower()
    if not highway or highway in SKIP_HIGHWAY_TYPES:
        return None

    coords = [nodes[nid] for nid in el.get("nodes", []) if nid in nodes]
    if len(coords) < 2:
        return None

    try:
        line = LineString(coords)
        if line.is_empty:
            return None
    except Exception:
        return None

    surface = tags.get("surface", "").lower() or None
    weight = _surface_weight(surface, highway)

    width_m = None
    raw_width = tags.get("width") or tags.get("est_width")
    if raw_width:
        try:
            width_m = float(raw_width.split()[0])
        except (ValueError, IndexError):
            pass

    return {
        "type": "Feature",
        "geometry": dict(mapping(line)),
        "properties": {
            "label": "road",
            "osm_id": el["id"],
            "road_type": highway,
            "road_name": tags.get("name") or None,
            "road_surface": surface,
            "road_surface_weight": weight,
            "width_m": width_m,
        },
    }


def _process_landuse(el: dict, tags: dict, nodes: dict) -> dict | None:
    """Process a landuse way into a polygon feature."""
    coords = [nodes[nid] for nid in el.get("nodes", []) if nid in nodes]
    if len(coords) < 4:
        return None

    try:
        poly = Polygon(coords)
        if not poly.is_valid:
            poly = poly.buffer(0)
        if poly.is_empty:
            return None
    except Exception:
        return None

    return {
        "type": "Feature",
        "geometry": dict(mapping(poly)),
        "properties": {
            "label": "landuse",
            "osm_id": el["id"],
            "landuse_type": tags.get("landuse", "unknown").lower(),
            "landuse_name": tags.get("name") or None,
        },
    }


def _process_tree(el: dict, tags: dict) -> dict | None:
    """Process a natural=tree node into a point feature with CRZ-relevant tags."""
    if "lon" not in el or "lat" not in el:
        return None

    point = Point(el["lon"], el["lat"])

    # Parse diameter_crown (metres to feet)
    crown_diameter_ft = None
    raw_crown = tags.get("diameter_crown")
    if raw_crown:
        try:
            crown_diameter_ft = float(raw_crown.split()[0]) * M_TO_FT
        except (ValueError, IndexError):
            pass

    # Parse height (metres to feet)
    height_ft = None
    raw_height = tags.get("height")
    if raw_height:
        try:
            height_ft = float(raw_height.split()[0]) * M_TO_FT
        except (ValueError, IndexError):
            pass

    # Species + heritage check
    species = tags.get("species") or tags.get("genus") or None
    is_heritage = False
    if species:
        species_lower = species.lower()
        is_heritage = any(h in species_lower for h in HERITAGE_SPECIES)

    return {
        "type": "Feature",
        "geometry": dict(mapping(point)),
        "properties": {
            "label": "tree",
            "osm_id": el["id"],
            "tree_species": species,
            "tree_crown_diameter_ft": crown_diameter_ft,
            "tree_height_ft": height_ft,
            "is_heritage": is_heritage,
            "crz_source": "osm",
        },
    }
