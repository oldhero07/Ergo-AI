"""Determinism + golden regression tests.

Two guarantees, tested separately:
1. Run-to-run determinism (environment-independent): the same bytes through the
   engine twice must produce bit-identical keypoints. This is the property the
   whole service exists to provide.
2. Golden regression (environment-pinned): responses must exactly match the
   committed goldens captured in the SAME environment. Regenerate after an
   intentional model/dependency change with:  REGEN_GOLDENS=1 pytest
   Goldens are canonical for the Docker image; a locally-captured golden may
   legitimately differ from Docker's (different onnxruntime build) - regenerate
   inside the container when in doubt.
"""
import json
import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app  # noqa: E402

FIXTURES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")
GOLDENS = os.path.join(FIXTURES, "goldens")
SAMPLES = ["office-typing.jpg", "warehouse-lifting.jpg", "assembly-standing.jpg", "weaver-sample.jpg"]


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _analyze(client, name: str) -> dict:
    with open(os.path.join(FIXTURES, name), "rb") as f:
        res = client.post("/analyze", files={"image": (name, f.read(), "image/jpeg")})
    assert res.status_code == 200
    return res.json()


@pytest.mark.parametrize("name", SAMPLES)
def test_run_to_run_determinism(client, name):
    first = _analyze(client, name)
    second = _analyze(client, name)
    assert first == second, f"{name}: two runs on identical bytes differed - determinism broken"


@pytest.mark.parametrize("name", SAMPLES)
def test_golden_exact_match(client, name):
    golden_path = os.path.join(GOLDENS, name.replace(".jpg", ".json"))
    result = _analyze(client, name)
    if os.environ.get("REGEN_GOLDENS") == "1":
        os.makedirs(GOLDENS, exist_ok=True)
        with open(golden_path, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=1)
        pytest.skip(f"regenerated {golden_path}")
    if not os.path.exists(golden_path):
        pytest.fail(f"missing golden {golden_path} - run once with REGEN_GOLDENS=1")
    with open(golden_path, encoding="utf-8") as f:
        golden = json.load(f)
    assert result == golden, f"{name}: response differs from committed golden"
