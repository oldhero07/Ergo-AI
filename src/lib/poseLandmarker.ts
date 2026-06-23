import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";

type Delegate = "GPU" | "CPU";

/** Reports model-download progress. `total` is 0 when the server omits a length. */
export type ModelProgress = (loaded: number, total: number) => void;

/**
 * Model sources, tried in order. Google's official CDN is dramatically faster on
 * many networks (full 30 MB Heavy model in seconds vs minutes from GitHub Pages),
 * so it's primary; the self-hosted copy in /models is the fallback if the CDN is
 * blocked or unreachable.
 */
const MODEL_SOURCES = [
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task",
  `${import.meta.env.BASE_URL}models/pose_landmarker_heavy.task`,
];
const MODEL_CACHE = "ergo-models-v1";
/** Source-independent cache key, so a model cached from one source is reused even if the source list changes. */
const MODEL_CACHE_KEY = "ergo-pose-landmarker-heavy";

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
    /* Cache Storage unavailable — fall through to a network fetch. */
  }

  let lastError: unknown;
  for (const url of MODEL_SOURCES) {
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
