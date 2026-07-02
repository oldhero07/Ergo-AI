/**
 * Message protocol between the UI thread and the analysis worker. Bitmaps
 * travel UI → worker as transferables (zero-copy); images travel back as
 * encoded Blobs (structured-clone cheap), which the UI turns into object URLs.
 */
import type { Landmark, NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { AngleSet } from "@/lib/angles";

export type WorkerRequest =
  | {
      type: "init";
      /** Absolute base URL that /wasm and /models resolve against (the worker's
       * own import.meta BASE_URL resolves against the hashed asset path, not
       * the page, so the UI thread computes this). */
      assetBase: string;
    }
  | { type: "analyzePhoto"; id: string; bitmap: ImageBitmap }
  | { type: "analyzeFrame"; id: string; timeSec: number; bitmap: ImageBitmap };

export interface PhotoResultPayload {
  id: string;
  detected: boolean;
  landmarks: NormalizedLandmark[];
  worldLandmarks: Landmark[];
  width: number;
  height: number;
  angles: AngleSet | null;
  /** Measured wrist flexion (deg) or null when no hand was detected. */
  wristFlex: number | null;
  skeletonBlob: Blob | null;
  originalBlob: Blob | null;
}

export interface FrameResultPayload {
  id: string;
  timeSec: number;
  /** null → no usable pose in this frame (see `skipReason`). */
  angles: AngleSet | null;
  skipReason: "noPose" | "lowConfidence" | null;
  wristFlex: number | null;
  thumbBlob: Blob | null;
}

export type WorkerResponse =
  | { type: "ready" }
  | { type: "modelProgress"; loaded: number; total: number }
  | { type: "photoResult"; payload: PhotoResultPayload }
  | { type: "frameResult"; payload: FrameResultPayload }
  | { type: "error"; id: string | null; message: string };
