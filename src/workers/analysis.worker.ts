/// <reference lib="webworker" />
/**
 * Analysis worker: hosts the MediaPipe Pose + Hand landmarkers and runs every
 * expensive per-image step (inference, skeleton annotation, JPEG/PNG encode)
 * off the UI thread. Scoring (buildAutoInput → RULA/REBA), smoothing and
 * temporal detection stay on the UI thread - this worker moves WHERE detection
 * runs, never WHAT is computed: it calls the exact same modules as the inline
 * path (poseLandmarker, handLandmarker, angles, handRoi, annotate).
 *
 * Requests are processed strictly one at a time (the UI awaits each response
 * before sending the next bitmap), preserving the one-frame-in-memory
 * invariant of the original pipeline.
 */
import { detectPose } from "@/lib/poseLandmarker";
import { detectHands } from "@/lib/handLandmarker";
import { detectHandsCropped } from "@/lib/handRoi";
import { computeAngles, measureWristFlexion } from "@/lib/angles";
import { annotateSkeletonBlob, renderOriginalJpegBlob } from "@/lib/annotate";
import { configureAssetBase } from "@/lib/assetBase";
import { OCCLUSION_CONFIDENCE, WRIST_VIS_FLOOR } from "@/lib/pipeline/shared";
import type { WorkerRequest, WorkerResponse, PhotoResultPayload, FrameResultPayload } from "@/workers/protocol";

declare const self: DedicatedWorkerGlobalScope;

/**
 * MediaPipe's wasm loader is a classic script (`var ModuleFactory = ...`); in a
 * MODULE worker `importScripts` throws and a bare dynamic import would scope
 * the factory to the module instead of the global object ("ModuleFactory not
 * set"). The bundle checks for a user-supplied `self.import` hook first, so we
 * provide one that fetches the script and evaluates it in the worker's global
 * scope (indirect eval), where the `var` lands on `self` as MediaPipe expects.
 */
(self as unknown as { import: (url: string) => Promise<void> }).import = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load wasm loader (HTTP ${res.status}) from ${url}`);
  const code = await res.text();
  (0, eval)(code);
};

const post = (msg: WorkerResponse) => self.postMessage(msg);

/** Render a small JPEG thumbnail of a frame bitmap (worker/OffscreenCanvas variant). */
async function thumbnailBlob(bitmap: ImageBitmap, maxEdge = 320, quality = 0.7): Promise<Blob | null> {
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    return await canvas.convertToBlob({ type: "image/jpeg", quality });
  } catch {
    return null;
  }
}

/** Photo pipeline: detect pose → annotate → angles → full-frame hand/wrist. */
async function analyzePhoto(id: string, bitmap: ImageBitmap): Promise<void> {
  try {
    const result = await detectPose(bitmap, (loaded, total) => post({ type: "modelProgress", loaded, total }));
    const detected = result.landmarks.length > 0;

    let skeletonBlob: Blob | null = null;
    let width = bitmap.width;
    let height = bitmap.height;
    try {
      const annotated = await annotateSkeletonBlob(bitmap, result);
      skeletonBlob = annotated.blob;
      width = annotated.width;
      height = annotated.height;
    } catch {
      /* annotation is presentational - never fail the analysis over it */
    }
    let originalBlob: Blob | null = null;
    try {
      originalBlob = await renderOriginalJpegBlob(bitmap);
    } catch {
      /* same: PDF falls back to the upload URL */
    }

    const landmarks = result.landmarks[0] ?? [];
    const worldLandmarks = result.worldLandmarks[0] ?? [];
    const angles = detected ? (computeAngles(landmarks, worldLandmarks) ?? null) : null;

    // Measure the wrist from the hand model when possible; never let its
    // absence or failure block the score - the UI falls back to assumed neutral.
    let wristFlex: number | null = null;
    if (angles) {
      try {
        const hands = await detectHands(bitmap);
        wristFlex = measureWristFlexion(landmarks, hands.landmarks, angles.side);
      } catch {
        /* hand model unavailable - wrist stays assumed neutral */
      }
    }

    const payload: PhotoResultPayload = {
      id,
      detected,
      landmarks,
      worldLandmarks,
      width,
      height,
      angles,
      wristFlex,
      skeletonBlob,
      originalBlob,
    };
    post({ type: "photoResult", payload });
  } finally {
    bitmap.close();
  }
}

/** Video-frame pipeline: detect pose → occlusion gate → ROI hand/wrist → thumb. */
async function analyzeFrame(id: string, timeSec: number, bitmap: ImageBitmap): Promise<void> {
  try {
    const result = await detectPose(bitmap);
    const landmarks = result.landmarks[0];
    if (!landmarks) {
      post({ type: "frameResult", payload: skipped(id, timeSec, "noPose") });
      return;
    }
    const angles = computeAngles(landmarks, result.worldLandmarks[0]);
    if (!angles) {
      post({ type: "frameResult", payload: skipped(id, timeSec, "noPose") });
      return;
    }
    // Occlusion handling: drop frames where the subject is partly out of frame
    // rather than feed misleading angles into the timeline/smoothing.
    if (angles.confidence < OCCLUSION_CONFIDENCE) {
      post({ type: "frameResult", payload: skipped(id, timeSec, "lowConfidence") });
      return;
    }

    // Calculate wrist flexion for the assessed side if wrist visibility is high enough
    let wristFlex: number | null = null;
    const wristIdx = angles.side === "left" ? 15 : 16; // LM.leftWrist / LM.rightWrist
    const wristVis = landmarks[wristIdx]?.visibility ?? 0;
    if (wristVis > WRIST_VIS_FLOOR) {
      try {
        const mappedHands = await detectHandsCropped(bitmap, landmarks[wristIdx].x, landmarks[wristIdx].y);
        wristFlex = measureWristFlexion(landmarks, mappedHands, angles.side);
      } catch {
        /* ignore hand tracking errors on this frame */
      }
    }

    const payload: FrameResultPayload = {
      id,
      timeSec,
      angles,
      skipReason: null,
      wristFlex,
      thumbBlob: await thumbnailBlob(bitmap),
    };
    post({ type: "frameResult", payload });
  } finally {
    bitmap.close();
  }
}

function skipped(id: string, timeSec: number, reason: "noPose" | "lowConfidence"): FrameResultPayload {
  return { id, timeSec, angles: null, skipReason: reason, wristFlex: null, thumbBlob: null };
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  void (async () => {
    try {
      if (msg.type === "init") {
        configureAssetBase(msg.assetBase);
        post({ type: "ready" });
      } else if (msg.type === "analyzePhoto") {
        await analyzePhoto(msg.id, msg.bitmap);
      } else if (msg.type === "analyzeFrame") {
        await analyzeFrame(msg.id, msg.timeSec, msg.bitmap);
      }
    } catch (err) {
      const id = msg.type === "analyzePhoto" || msg.type === "analyzeFrame" ? msg.id : null;
      post({ type: "error", id, message: (err as Error)?.message || "Analysis failed in the worker." });
    }
  })();
};
