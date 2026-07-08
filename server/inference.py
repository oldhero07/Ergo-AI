"""Pose inference engine: YOLOX person detection + RTMW wholebody-133 keypoints.

Deterministic by construction: fixed model files (SHA-256 pinned in models.lock),
CPU-only ONNX Runtime, one canonical decode/resize path (see app.py). The same
image bytes always produce the same keypoints, which is the entire reason this
service exists - in-browser GPU inference gave different scores per device.

rtmlib's YOLOX/RTMPose classes are used directly (not the Wholebody solution
wrapper) so that model paths are local pinned files rather than runtime
downloads, and so person selection is explicit here rather than implicit.
"""
from __future__ import annotations

import os

import numpy as np
from rtmlib import YOLOX, RTMPose

MODEL_VERSION = "rtmw-dw-x-l-cocktail14-256x192@20231122+yolox-m-humanart@c2c7a14a"
SCHEMA = "coco_wholebody_133/v1"

MODELS_DIR = os.environ.get("ERGO_MODELS_DIR", os.path.join(os.path.dirname(__file__), "models"))
DET_ONNX = os.path.join(MODELS_DIR, "yolox_m_humanart.onnx")
POSE_ONNX = os.path.join(MODELS_DIR, "rtmw_dw_x_l_256x192.onnx")

# rtmlib "balanced" Wholebody sizes: YOLOX-m @ 640x640, RTMW @ (w=192, h=256).
DET_INPUT_SIZE = (640, 640)
POSE_INPUT_SIZE = (192, 256)


def _largest_bbox(bboxes: np.ndarray) -> list[float]:
    """Select exactly one person BEFORE pose inference: largest box by area.

    Backgrounds often contain other people; the assessment subject is assumed
    to be the dominant figure in a deliberately-taken photo.
    """
    areas = (bboxes[:, 2] - bboxes[:, 0]) * (bboxes[:, 3] - bboxes[:, 1])
    return bboxes[int(np.argmax(areas))].tolist()


class PoseEngine:
    def __init__(self, det_path: str = DET_ONNX, pose_path: str = POSE_ONNX):
        self.det = YOLOX(det_path, model_input_size=DET_INPUT_SIZE, backend="onnxruntime", device="cpu")
        self.pose = RTMPose(pose_path, model_input_size=POSE_INPUT_SIZE, backend="onnxruntime", device="cpu")

    def _detect(self, img_bgr: np.ndarray) -> list[float] | None:
        bboxes = self.det(img_bgr)
        if bboxes is None or len(bboxes) == 0:
            return None
        return _largest_bbox(np.asarray(bboxes, dtype=np.float64))

    def _pose(self, img_bgr: np.ndarray, bbox_xyxy: list[float], scale: float) -> dict:
        keypoints, scores = self.pose(img_bgr, bboxes=[bbox_xyxy])
        kps = keypoints[0]  # (133, 2), pixel coords in the (possibly downscaled) image
        sc = scores[0]  # (133,)
        # Map back to ORIGINAL image pixel space (client drew/reads against the original).
        x1, y1, x2, y2 = bbox_xyxy
        return {
            "detected": True,
            "bbox": [x1 * scale, y1 * scale, (x2 - x1) * scale, (y2 - y1) * scale],
            "keypoints": [
                [float(kps[i, 0] * scale), float(kps[i, 1] * scale), float(sc[i])] for i in range(kps.shape[0])
            ],
        }

    def analyze(self, img_bgr: np.ndarray, scale: float) -> dict:
        """One photo. `scale` maps inference-image pixels back to original pixels."""
        bbox = self._detect(img_bgr)
        if bbox is None:
            # The ONLY hard failure: no person in frame. Everything else scores.
            return {"detected": False, "bbox": None, "keypoints": None}
        return self._pose(img_bgr, bbox, scale)

    def analyze_batch(self, imgs_bgr: list[np.ndarray], scales: list[float]) -> list[dict]:
        """Video frames from one clip. YOLOX runs on frame 0 ONLY; its bbox is
        reused for every subsequent frame in the request (the subject barely
        moves between samples and detection dominates CPU cost). If frame 0 has
        no person, each later frame gets its own detection attempt - the person
        may simply enter the frame late. Frames in one batch must share
        dimensions (enforced by app.py) so the frame-0 bbox is valid for all."""
        results: list[dict] = []
        shared_bbox: list[float] | None = None
        for img, scale in zip(imgs_bgr, scales):
            if shared_bbox is None:
                shared_bbox = self._detect(img)
                if shared_bbox is None:
                    results.append({"detected": False, "bbox": None, "keypoints": None})
                    continue
            results.append(self._pose(img, shared_bbox, scale))
        return results
