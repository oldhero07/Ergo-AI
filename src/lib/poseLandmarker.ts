import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { getAssetBase, isDeterministic } from "@/lib/assetBase";

type Delegate = "GPU" | "CPU";
let activeDelegate: Delegate | null = null;

/** Which delegate the shared PoseLandmarker actually ended up using (GPU, or
 * CPU if the GPU delegate failed to initialize on this device, or if
 * deterministic mode forced it). null before the first detection. Diagnostic
 * only - GPU and CPU produce subtly different floating-point landmark
 * coordinates for the same image, so this is exposed to make cross-device
 * angle discrepancies attributable rather than mysterious. */
export function getActiveDelegate(): Delegate | null {
  return activeDelegate;
}

/** Reports model-download progress. `total` is 0 when the server omits a length. */
export type ModelProgress = (loaded: number, total: number) => void;

/**
 * Model sources, tried in order. The self-hosted copy in /models is now PRIMARY:
 * it's byte-identical on every machine (checked into the repo), which is what
 * makes results reproducible across devices/browsers. The CDN is the fallback for
 * a cold cache, and it's pinned to an explicit version (`/1/`) rather than
 * `latest` - `latest` could resolve to different weights on two machines (or two
 * dates) and get cached forever, producing the Mac-vs-Windows score divergence.
 */
const modelSources = () => [
  `${getAssetBase()}models/pose_landmarker_heavy.task`,
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task",
];
/** Cache generation - bump to invalidate a poisoned `latest` model cached before pinning. */
const MODEL_CACHE = "ergo-models-v2";
/** Source-independent cache key, so a model cached from one source is reused even if the source list changes. */
const MODEL_CACHE_KEY = "ergo-pose-landmarker-heavy-v2";

let landmarkerPromise: Promise<PoseLandmarker> | null = null;
let modelBytesPromise: Promise<Uint8Array> | null = null;

/** Fetch one URL, streaming with progress; returns the bytes and a clone safe to cache. */
async function fetchWithProgress(
  url: string,
  onProgress?: ModelProgress,
): Promise<{ bytes: Uint8Array; cacheable: Response | null }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Model fetch failed (HTTP ${res.status}) from ${url}`);

  // Clone before reading so the untouched response can be cached for next time.
  let cacheable: Response | null = null;
  try {
    cacheable = res.clone();
  } catch {
    cacheable = null;
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
  return { bytes, cacheable };
}

/**
 * Resolve the model bytes: reuse the Cache Storage copy if present (one-time
 * download across sessions); otherwise try each source in turn, streaming with
 * progress, and persist the first success. Falls back gracefully when Cache
 * Storage is unavailable (e.g. private mode).
 */
async function downloadModelBytes(onProgress?: ModelProgress): Promise<Uint8Array> {
  try {
    const cache = await caches.open(MODEL_CACHE);
    const hit = await cache.match(MODEL_CACHE_KEY);
    if (hit) {
      const buf = new Uint8Array(await hit.arrayBuffer());
      onProgress?.(buf.byteLength, buf.byteLength);
      return buf;
    }
  } catch {
    /* Cache Storage unavailable - fall through to a network fetch. */
  }

  let lastError: unknown;
  for (const url of modelSources()) {
    try {
      const { bytes, cacheable } = await fetchWithProgress(url, onProgress);
      if (cacheable) {
        caches
          .open(MODEL_CACHE)
          .then((cache) => cache.put(MODEL_CACHE_KEY, cacheable as Response))
          .catch(() => {
            /* Persisting is best-effort. */
          });
      }
      return bytes;
    } catch (err) {
      lastError = err;
      onProgress?.(0, 0); // reset the bar before trying the next source
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Model download failed");
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
  const vision = await FilesetResolver.forVisionTasks(`${getAssetBase()}wasm`);
  const modelAssetBuffer = await getModelBytes(onProgress);
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetBuffer, delegate },
    runningMode: "IMAGE",
    numPoses: 1,
    // Raised 0.5 -> 0.7 so MediaPipe rejects marginal/partial fits at the source
    // (e.g. a whole skeleton crammed onto a bystander's legs) rather than returning
    // a confident bogus pose. Conservative enough that a clearly-detected subject
    // still passes.
    minPoseDetectionConfidence: 0.7,
    minPosePresenceConfidence: 0.7,
    minTrackingConfidence: 0.5,
    outputSegmentationMasks: false,
  });
}

/** Lazily create a single shared PoseLandmarker (Heavy model). GPU with CPU
 * fallback normally; CPU-only in deterministic mode (reproducible across machines). */
export function getPoseLandmarker(onProgress?: ModelProgress): Promise<PoseLandmarker> {
  if (!landmarkerPromise) {
    const attempt = isDeterministic()
      ? create("CPU", onProgress).then((landmarker) => {
          activeDelegate = "CPU";
          return landmarker;
        })
      : create("GPU", onProgress)
          .then((landmarker) => {
            activeDelegate = "GPU";
            return landmarker;
          })
          .catch(() =>
            create("CPU", onProgress).then((landmarker) => {
              activeDelegate = "CPU";
              return landmarker;
            }),
          );
    landmarkerPromise = attempt.catch((err) => {
      landmarkerPromise = null; // allow a later retry
      activeDelegate = null;
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
