"""Ergo AI pose-inference API. Stateless: decode -> infer -> respond, all in
memory. Nothing is ever written to disk; uploads are never stored or logged.

The canonical decode lives HERE and only here (determinism contract):
Pillow decode -> ImageOps.exif_transpose (cv2.imread would silently ignore
EXIF and break trunk-vs-vertical angles on phone photos) -> LANCZOS downscale
when the longest edge exceeds MAX_EDGE -> RGB->BGR numpy for rtmlib. Keypoints
are mapped back to original pixel space before responding.
"""
from __future__ import annotations

import io
from contextlib import asynccontextmanager

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps, UnidentifiedImageError

from inference import MODEL_VERSION, SCHEMA, PoseEngine

MAX_UPLOAD_BYTES = 12 * 1024 * 1024
MAX_BATCH_FRAMES = 16
MAX_EDGE = 1536
ALLOWED_FORMATS = {"JPEG", "PNG"}

ALLOWED_ORIGINS = [
    "https://rulaergo.com",
    "https://www.rulaergo.com",
    "https://oldhero07.github.io",
    "http://localhost:5173",
    "http://localhost:4173",
]

engine: PoseEngine | None = None


@asynccontextmanager
async def _lifespan(_: FastAPI):
    global engine
    engine = PoseEngine()
    yield


app = FastAPI(title="Ergo AI pose inference", docs_url=None, redoc_url=None, lifespan=_lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def _decode(data: bytes) -> tuple[np.ndarray, int, int, float]:
    """Bytes -> (BGR array for inference, original w, original h, scale-back factor)."""
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds the 12 MB limit.")
    try:
        img = Image.open(io.BytesIO(data))
        fmt = img.format
        img = ImageOps.exif_transpose(img)
        img = img.convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status_code=422, detail="Could not decode the image.")
    if fmt not in ALLOWED_FORMATS:
        raise HTTPException(status_code=415, detail="Only JPEG and PNG are supported.")
    w0, h0 = img.size
    scale = 1.0
    if max(w0, h0) > MAX_EDGE:
        scale = max(w0, h0) / MAX_EDGE
        img = img.resize((round(w0 / scale), round(h0 / scale)), Image.LANCZOS)
    # Explicit RGB->BGR for rtmlib/OpenCV convention; contiguous for ONNX Runtime.
    arr = np.ascontiguousarray(np.asarray(img)[:, :, ::-1])
    return arr, w0, h0, scale


def _result(payload: dict, w: int, h: int) -> dict:
    return {
        "model_version": MODEL_VERSION,
        "schema": SCHEMA,
        "image": {"w": w, "h": h},
        **payload,
    }


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok" if engine is not None else "loading", "model_version": MODEL_VERSION}


@app.post("/analyze")
async def analyze(image: UploadFile = File(...)) -> dict:
    data = await image.read()
    arr, w, h, scale = _decode(data)
    assert engine is not None
    return _result(engine.analyze(arr, scale), w, h)


@app.post("/analyze-batch")
async def analyze_batch(frames: list[UploadFile] = File(...)) -> dict:
    if len(frames) > MAX_BATCH_FRAMES:
        raise HTTPException(status_code=413, detail=f"At most {MAX_BATCH_FRAMES} frames per request.")
    decoded: list[tuple[np.ndarray, int, int, float]] = []
    for f in frames:
        decoded.append(_decode(await f.read()))
    dims = {(w, h) for _, w, h, _ in decoded}
    if len(dims) > 1:
        raise HTTPException(status_code=422, detail="All frames in a batch must share dimensions.")
    assert engine is not None
    results = engine.analyze_batch([d[0] for d in decoded], [d[3] for d in decoded])
    return {
        "model_version": MODEL_VERSION,
        "results": [_result(r, w, h) for r, (_, w, h, _) in zip(results, decoded)],
    }
