import base64
import io

import cv2
import httpx
import numpy as np
from PIL import Image

HF_API_URL = "https://router.huggingface.co/hf-inference/models/nvidia/segformer-b0-finetuned-ade-512-512"

LABELS_TO_DETECT = {
    "tree",
    "grass",
    "road",
    "sidewalk",
    "pavement",
    "path",
    "dirt track",
}


def segment_tile(image_bgr: np.ndarray, hf_token: str) -> dict[str, np.ndarray] | None:
    """
    Send a satellite tile to the HuggingFace SegFormer api and get binary masks back
    """
    # HF API expects raw image bytes — convert BGR → RGB → JPEG
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    buf = io.BytesIO()
    Image.fromarray(image_rgb).save(buf, format="JPEG", quality=90)
    image_bytes = buf.getvalue()

    try:
        response = httpx.post(
            HF_API_URL,
            content=image_bytes,
            headers={
                "Authorization": f"Bearer {hf_token}",
                "Content-Type": "image/jpeg",
            },
            timeout=60.0, #for cold start
        )
        response.raise_for_status()
    except Exception as e:
        print(f"HF failed at exception {e}")
        return None

    segments = response.json()
    if not isinstance(segments, list):
        return None

    h, w = image_bgr.shape[:2]
    masks: dict[str, np.ndarray] = {}

    for segment in segments:
        label = segment.get("label", "").lower()
        mask_b64 = segment.get("mask", "")
        if not mask_b64:
            continue

        # Match label to a detected keyword via list comprehension
        matched = next((kw for kw in LABELS_TO_DETECT if kw in label), None)
        if matched is None:
            continue

        # Decode the png into a grayscale 0-255 image 
        mask_bytes = base64.b64decode(mask_b64)
        mask_pil = Image.open(io.BytesIO(mask_bytes)).convert("L")

        if mask_pil.size != (w, h):
            mask_pil = mask_pil.resize((w, h), Image.NEAREST) #for lower res errors incase

        mask_arr = np.array(mask_pil)

        # uses np to find the maximum val for each arr pos ensuring overlaps bw detections are handled
        if matched in masks:
            masks[matched] = np.maximum(masks[matched], mask_arr)
        else:
            masks[matched] = mask_arr

    return masks if masks else None
