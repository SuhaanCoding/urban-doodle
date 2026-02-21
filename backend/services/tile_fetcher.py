import math

import cv2
import httpx
import numpy as np


def _lng_lat_to_tile(lng: float, lat: float, zoom: int) -> tuple[int, int]:
    n = 2 ** zoom
    x = int((lng + 180) / 360 * n) #conversion to x/y
    lat_rad = math.radians(lat)
    y = int((1 - math.log(math.tan(lat_rad) + 1 / math.cos(lat_rad)) / math.pi) / 2 * n) 
    return x, y

#actually wrote a paper about conversion of lat/long into real world distances in highschool lol

def _tile_to_lng_lat(x: int, y: int, zoom: int) -> tuple[float, float]:
    n = 2 ** zoom
    lng = x / n * 360 - 180
    lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * y / n)))
    lat = math.degrees(lat_rad)
    return lng, lat


def compute_tile_grid(bbox: tuple, zoom: int = 18, tile_size: int = 512) -> list[dict]:
    """
    NW is the top corner, SE bottom corner so we calculating everything in between since corners keep consistency
    """
    west, south, east, north = bbox

    x_min, y_min = _lng_lat_to_tile(west, north, zoom)  # NW corner
    x_max, y_max = _lng_lat_to_tile(east, south, zoom)  # SE corner

    tiles = []
    for x in range(x_min, x_max + 1):
        for y in range(y_min, y_max + 1):
            tile_west, tile_north = _tile_to_lng_lat(x, y, zoom)
            tile_east, tile_south = _tile_to_lng_lat(x + 1, y + 1, zoom)
            tiles.append({
                "x": x,
                "y": y,
                "zoom": zoom,
                "bounds": [tile_west, tile_south, tile_east, tile_north],
                "center": [(tile_west + tile_east) / 2, (tile_north + tile_south) / 2], #could honestly remove this, redundant
            })

    return tiles


def fetch_satellite_tile(tile: dict, tile_size: int, mapbox_token: str) -> np.ndarray | None: #using ndarray cuz used by cv2
    """
    fetch a satellite imagery tile 
    """
    x, y, zoom = tile["x"], tile["y"], tile["zoom"]

    # doubles the pixel dimensions 256x256 -> 512x512
    url = (
        f"https://api.mapbox.com/v4/mapbox.satellite/{zoom}/{x}/{y}@2x.jpg90?access_token={mapbox_token}"
    )

    try:
        response = httpx.get(url, timeout=15.0)
        response.raise_for_status()
    except Exception:
        return None

    image_bytes = np.frombuffer(response.content, dtype=np.uint8)
    image = cv2.imdecode(image_bytes, cv2.IMREAD_COLOR)  # BGR
    if image is None:
        return None

    if image.shape[0] != tile_size or image.shape[1] != tile_size:
        image = cv2.resize(image, (tile_size, tile_size)) 

    return image
