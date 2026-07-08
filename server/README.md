---
title: Ergo Pose Inference
emoji: 🦴
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# Ergo AI — pose inference service

Stateless pose-estimation API backing [rulaergo.com](https://rulaergo.com). Accepts a photo (or a batch of video frames), returns COCO-WholeBody 133 keypoints with per-point confidence. Runs RTMW (RTMPose wholebody) + YOLOX person detection via ONNX Runtime on CPU.

**Why CPU:** CPU inference is bit-identical across runs and deployments. The same photo always produces the same keypoints — and therefore the same RULA/REBA score — on every device, every time. GPU inference cannot guarantee this.

**Privacy:** images are never stored, logged, or used for training — they are discarded as soon as the response is built.

## Endpoints

- `GET /healthz` → `{status, model_version}` — used by the client to wake the Space and show warm-up progress.
- `POST /analyze` — multipart field `image` (JPEG/PNG, ≤12 MB) → keypoints for the largest detected person.
- `POST /analyze-batch` — multipart field `frames` (≤16 same-size JPEGs) → per-frame keypoints; person detection runs on the first frame only and the box is reused.

Response shape:

```json
{
  "model_version": "rtmw-dw-x-l-cocktail14-256x192@20231122+yolox-m-humanart@c2c7a14a",
  "schema": "coco_wholebody_133/v1",
  "detected": true,
  "bbox": [x, y, w, h],
  "image": {"w": 4032, "h": 3024},
  "keypoints": [[x, y, score], "... 133 entries"]
}
```

`detected: false` (with `bbox`/`keypoints` null) means no person was found in the frame — the only hard failure. Coordinates are in original EXIF-upright image pixel space.

## Reproducibility

- Model zips are SHA-256-pinned in `models.lock` and verified at Docker build; a hash mismatch fails the build.
- All Python dependencies are `==`-pinned in `requirements.txt`.
- `model_version` is returned on every response and embedded in the client's exported reports.

## Development

```
pip install -r requirements.txt
python scripts/download_models.py
uvicorn app:app --port 7860
pytest
```
