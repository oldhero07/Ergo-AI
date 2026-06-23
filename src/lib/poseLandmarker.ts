import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";

type Delegate = "GPU" | "CPU";

/** Reports model-download progress. `total` is 0 when the server omits a length. */
export type ModelProgress = (loaded: number, total: number) => void;

const MODEL_URL = `${import.meta.env.BASE_URL}models/pose_landmarker_heavy.task`;
const MODEL_CACHE = "ergo-models-v1";

let landmarkerPromise: Promise<PoseLandmarker> | null = null;
let modelBytesPromise: Promise<Uint8Array> | null = null;

/**
 * Fetch the ~29 MB model with streamed progress, and persist it in the Cache
 * Storage API so it's downloaded only once — even across sessions and on hosts
 * (like GitHub Pages) that don't send long-lived cache headers. Falls back
 * gracefully when streaming or Cache Storage isn't available (e.g. private mode).
 */
async function downloadModelBytes(onProgress?: ModelProgress): Promise<Uint8Array> {
  try {
    const cache = await caches.open(MODEL_CACHE);
    const hit = await cache.match(MODEL_URL);
    if (hit) {
      const buf = new Uint8Array(await hit.arrayBuffer());
      onProgress?.(buf.byteLength, buf.byteLength);
      return buf;
    }
  } catch {
    /* Cache Storage unavailable — fall through to a plain fetch. */
  }

  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`Model download failed (HTTP ${res.status})`);

  // Clone now (before the body is read) so the untouched response can be cached
  // for next time, while we read the original stream to report progress.
  let toCache: Response | null = null;
  try {
    toCache = res.clone();
  } catch {
    toCache = null;
  }

  const total = Number(res.headers.get("content-length")) || 0;
  let bytes: Uint8Array;

  if (res.body) {
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      onProgress?.(loaded, total);
    }
    bytes = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
  } else {
    bytes = new Uint8Array(await res.arrayBuffer());
    onProgress?.(bytes.byteLength, bytes.byteLength);
  }

  if (toCache) {
    caches
      .open(MODEL_CACHE)
      .then((cache) => cache.put(MODEL_URL, toCache as Response))
      .catch(() => {
        /* Persisting is best-effort; analysis still works without it. */
      });
  }
  return bytes;
}

/** Download (or reuse) the model bytes once, shared across GPU/CPU creation attempts. */
function getModelBytes(onProgress?: ModelProgress): Promise<Uint8Array> {
  if (!modelBytesPromise) {
    modelBytesPromise = downloadModelBytes(onProgress).catch((err) => {
      modelBytesPromise = null; // allow a later retry
      throw err;
    });
  }
  return modelBytesPromise;
}

async function create(delegate: Delegate, onProgress?: ModelProgress): Promise<PoseLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}wasm`);
  const modelAssetBuffer = await getModelBytes(onProgress);
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetBuffer, delegate },
    runningMode: "IMAGE",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputSegmentationMasks: false,
  });
}

/** Lazily create a single shared PoseLandmarker (Heavy model). GPU with CPU fallback. */
export function getPoseLandmarker(onProgress?: ModelProgress): Promise<PoseLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = create("GPU", onProgress)
      .catch(() => create("CPU", onProgress))
      .catch((err) => {
        landmarkerPromise = null; // allow a later retry
        throw err;
      });
  }
  return landmarkerPromise;
}

export async function detectPose(
  image: ImageBitmap | HTMLImageElement | HTMLCanvasElement,
  onProgress?: ModelProgress,
): Promise<PoseLandmarkerResult> {
  const landmarker = await getPoseLandmarker(onProgress);
  return landmarker.detect(image);
}
