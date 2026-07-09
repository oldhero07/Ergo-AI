"""Per-IP sliding-window rate limiting on the expensive endpoints.

Bursts use junk bodies: they pass the (outer) body-size middleware, consume
rate quota, then 422 cheaply in the route - no inference runs, so these tests
are fast while still exercising the real middleware stack.
"""
import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import app as app_module  # noqa: E402
from app import app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _post_junk(client, ip="203.0.113.7"):
    return client.post(
        "/analyze",
        files={"image": ("x.jpg", b"junk", "image/jpeg")},
        headers={"X-Forwarded-For": ip},
    )


def test_burst_hits_429_with_retry_after(client, monkeypatch):
    monkeypatch.setitem(app_module.RATE_LIMITS, "/analyze", 3)
    for _ in range(3):
        assert _post_junk(client).status_code == 422  # counted, rejected cheaply
    res = _post_junk(client)
    assert res.status_code == 429
    assert "wait" in res.json()["detail"]
    assert int(res.headers["retry-after"]) >= 1


def test_limits_are_per_client_ip(client, monkeypatch):
    monkeypatch.setitem(app_module.RATE_LIMITS, "/analyze", 2)
    for _ in range(2):
        assert _post_junk(client, ip="198.51.100.1").status_code == 422
    assert _post_junk(client, ip="198.51.100.1").status_code == 429
    # A different client is unaffected.
    assert _post_junk(client, ip="198.51.100.2").status_code == 422


def test_batch_endpoint_has_its_own_tighter_limit(client, monkeypatch):
    monkeypatch.setitem(app_module.RATE_LIMITS, "/analyze-batch", 2)
    for _ in range(2):
        res = client.post(
            "/analyze-batch",
            files=[("frames", ("f.jpg", b"junk", "image/jpeg"))],
            headers={"X-Forwarded-For": "203.0.113.9"},
        )
        assert res.status_code == 422
    res = client.post(
        "/analyze-batch",
        files=[("frames", ("f.jpg", b"junk", "image/jpeg"))],
        headers={"X-Forwarded-For": "203.0.113.9"},
    )
    assert res.status_code == 429


def test_health_is_never_rate_limited(client):
    # Wake polling hits /health every few seconds - it must stay unlimited.
    for _ in range(50):
        assert client.get("/health").status_code == 200
