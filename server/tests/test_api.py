"""API contract tests: status codes, CORS, EXIF handling, batch rules.

Require the pinned models to be present in server/models/ (run
scripts/download_models.py once first) - the FastAPI startup hook loads them.
"""
import io
import os
import sys

import pytest
from fastapi.testclient import TestClient
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import MAX_BATCH_FRAMES, app  # noqa: E402

FIXTURES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _jpeg_bytes(w=64, h=48, exif_orientation=None) -> bytes:
    img = Image.new("RGB", (w, h), (40, 90, 160))
    buf = io.BytesIO()
    if exif_orientation:
        exif = Image.Exif()
        exif[0x0112] = exif_orientation
        img.save(buf, "JPEG", exif=exif)
    else:
        img.save(buf, "JPEG")
    return buf.getvalue()


def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert "rtmw" in body["model_version"]


def test_cors_allows_prod_origin(client):
    res = client.get("/health", headers={"Origin": "https://rulaergo.com"})
    assert res.headers.get("access-control-allow-origin") == "https://rulaergo.com"


def test_cors_rejects_unknown_origin(client):
    res = client.get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in res.headers


def test_analyze_returns_contract_shape(client):
    with open(os.path.join(FIXTURES, "office-typing.jpg"), "rb") as f:
        res = client.post("/analyze", files={"image": ("p.jpg", f.read(), "image/jpeg")})
    assert res.status_code == 200
    body = res.json()
    assert body["schema"] == "coco_wholebody_133/v1"
    assert body["detected"] is True
    assert len(body["bbox"]) == 4
    assert len(body["keypoints"]) == 133
    assert all(len(kp) == 3 for kp in body["keypoints"])
    assert body["image"]["w"] > 0 and body["image"]["h"] > 0


def test_no_person_is_detected_false_not_error(client):
    res = client.post("/analyze", files={"image": ("empty.jpg", _jpeg_bytes(640, 480), "image/jpeg")})
    assert res.status_code == 200
    body = res.json()
    assert body["detected"] is False
    assert body["bbox"] is None and body["keypoints"] is None


def test_exif_orientation_applied(client):
    # Orientation 6 = rotate 90 CW: a 64x48 file must decode as 48x64 upright.
    res = client.post(
        "/analyze", files={"image": ("rot.jpg", _jpeg_bytes(64, 48, exif_orientation=6), "image/jpeg")}
    )
    assert res.status_code == 200
    assert res.json()["image"] == {"w": 48, "h": 64}


def test_oversized_upload_413(client):
    res = client.post("/analyze", files={"image": ("big.jpg", b"\xff" * (12 * 1024 * 1024 + 1), "image/jpeg")})
    assert res.status_code == 413


def test_unsupported_format_415(client):
    img = Image.new("RGB", (32, 32))
    buf = io.BytesIO()
    img.save(buf, "GIF")
    res = client.post("/analyze", files={"image": ("a.gif", buf.getvalue(), "image/gif")})
    assert res.status_code == 415


def test_undecodable_422(client):
    res = client.post("/analyze", files={"image": ("junk.jpg", b"not an image at all", "image/jpeg")})
    assert res.status_code == 422


def test_decompression_bomb_422(client):
    # A tiny PNG declaring 100 MP (> the 64 MP cap) must be rejected before
    # convert("RGB") can allocate ~300 MB for it.
    img = Image.new("1", (10_000, 10_000))
    buf = io.BytesIO()
    img.save(buf, "PNG")
    assert len(buf.getvalue()) < 1024 * 1024  # cheap for the attacker...
    res = client.post("/analyze", files={"image": ("bomb.png", buf.getvalue(), "image/png")})
    assert res.status_code == 422  # ...rejected before it gets expensive for us


def test_missing_content_length_411(client):
    # Streaming bodies without Content-Length don't get to bypass the ingress cap.
    res = client.post(
        "/analyze",
        content=iter([b"x" * 1024]),
        headers={"Content-Type": "multipart/form-data; boundary=x", "Transfer-Encoding": "chunked"},
    )
    assert res.status_code == 411


def test_batch_frame_cap_413(client):
    frame = _jpeg_bytes()
    files = [("frames", (f"f{i}.jpg", frame, "image/jpeg")) for i in range(MAX_BATCH_FRAMES + 1)]
    res = client.post("/analyze-batch", files=files)
    assert res.status_code == 413


def test_batch_mixed_dimensions_422(client):
    files = [
        ("frames", ("a.jpg", _jpeg_bytes(64, 48), "image/jpeg")),
        ("frames", ("b.jpg", _jpeg_bytes(48, 64), "image/jpeg")),
    ]
    res = client.post("/analyze-batch", files=files)
    assert res.status_code == 422


def test_batch_returns_per_frame_results(client):
    with open(os.path.join(FIXTURES, "office-typing.jpg"), "rb") as f:
        frame = f.read()
    files = [("frames", (f"f{i}.jpg", frame, "image/jpeg")) for i in range(3)]
    res = client.post("/analyze-batch", files=files)
    assert res.status_code == 200
    body = res.json()
    assert len(body["results"]) == 3
    assert all(r["detected"] for r in body["results"])
    # bbox reuse: all three frames are identical, so keypoints must be identical too.
    assert body["results"][0]["keypoints"] == body["results"][1]["keypoints"]
