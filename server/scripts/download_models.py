"""Download the pinned ONNX model zips, verify/print SHA-256, extract the .onnx
files into server/models/. Run once locally to record hashes into models.lock;
run at Docker build (with --verify) to guarantee the image contains exactly the
pinned bytes.

Usage:
  python scripts/download_models.py            # download + extract + print hashes
  python scripts/download_models.py --verify   # additionally fail if a hash differs from models.lock
"""
from __future__ import annotations

import hashlib
import io
import os
import sys
import urllib.request
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
SERVER_DIR = os.path.dirname(HERE)
MODELS_DIR = os.path.join(SERVER_DIR, "models")
LOCK_PATH = os.path.join(SERVER_DIR, "models.lock")

# rtmlib "balanced" Wholebody pair (see rtmlib/tools/solution/wholebody.py).
MODELS = [
    {
        "name": "yolox_m_humanart",
        "url": "https://download.openmmlab.com/mmpose/v1/projects/rtmposev1/onnx_sdk/yolox_m_8xb8-300e_humanart-c2c7a14a.zip",
        "onnx_out": "yolox_m_humanart.onnx",
    },
    {
        "name": "rtmw_dw_x_l_256x192",
        "url": "https://download.openmmlab.com/mmpose/v1/projects/rtmw/onnx_sdk/rtmw-dw-x-l_simcc-cocktail14_270e-256x192_20231122.zip",
        "onnx_out": "rtmw_dw_x_l_256x192.onnx",
    },
]


def read_lock() -> dict[str, str]:
    hashes: dict[str, str] = {}
    if not os.path.exists(LOCK_PATH):
        return hashes
    with open(LOCK_PATH, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            name, sha = line.split()[:2]
            hashes[name] = sha
    return hashes


def main() -> None:
    verify = "--verify" in sys.argv
    locked = read_lock()
    os.makedirs(MODELS_DIR, exist_ok=True)

    for m in MODELS:
        print(f"downloading {m['name']} ...", flush=True)
        with urllib.request.urlopen(m["url"]) as res:
            data = res.read()
        sha = hashlib.sha256(data).hexdigest()
        print(f"  sha256 {m['name']} = {sha}")
        if verify:
            expected = locked.get(m["name"])
            if expected is None:
                sys.exit(f"models.lock has no hash for {m['name']} - refusing to build unpinned.")
            if sha != expected:
                sys.exit(f"HASH MISMATCH for {m['name']}: expected {expected}, got {sha}")

        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            onnx_members = [n for n in zf.namelist() if n.endswith(".onnx")]
            if len(onnx_members) != 1:
                sys.exit(f"{m['name']}: expected exactly one .onnx in the zip, found {onnx_members}")
            with zf.open(onnx_members[0]) as src, open(os.path.join(MODELS_DIR, m["onnx_out"]), "wb") as dst:
                dst.write(src.read())
        print(f"  extracted -> models/{m['onnx_out']}")

    print("done. If hashes are new, record them in models.lock (zip sha256, not onnx).")


if __name__ == "__main__":
    main()
