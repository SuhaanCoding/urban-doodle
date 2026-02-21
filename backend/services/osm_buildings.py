import textwrap
import httpx
from shapely.geometry import Polygon, mapping

OVERPASS_URL = "https://overpass-api.de/api/interpreter"


def fetch_osm_buildings(bbox: tuple, timeout: int = 25) -> list[dict]:
    """
    Gets all buildings data in a bound and returns the data of all buildings there. 
    """
    west, south, east, north = bbox
    query = textwrap.dedent(f"""
        [out:json][timeout:{timeout}];
        (
            way["building"]({south},{west},{north},{east});
        );
        out body;
        >;
        out skel qt;
    """) #added textwrap just to remove leading whitespaces
    try:
        response = httpx.post(OVERPASS_URL, data={"data": query}, timeout=float(timeout + 5))
        response.raise_for_status()
    except Exception:
        return []

    data = response.json()
    # Build node_id. However OSM gives a lot more data so going to work on integrating all that for calcs
    nodes = {el["id"]: (el["lon"], el["lat"])
             for el in data.get("elements", []) if el["type"] == "node"}

    features = []
    for el in data.get("elements", []):
        if el["type"] != "way":
            continue
        coords = [nodes[nid] for nid in el.get("nodes", []) if nid in nodes]
        if len(coords) < 4:
            continue
        try:
            poly = Polygon(coords)
            if not poly.is_valid:
                poly = poly.buffer(0)
            if poly.is_empty:
                continue
            features.append({
                "type": "Feature",
                "geometry": dict(mapping(poly)),
                "properties": {"label": "building"},
            })
        except Exception:
            continue

    return features
