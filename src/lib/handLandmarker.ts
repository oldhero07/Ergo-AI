import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from "@mediapipe/tasks-vision";

/**
 * Secondary hand-landmark model used to actually measure the wrist (the Pose
 * model has no finger landmarks). Loaded lazily only when a photo is analyzed,
 * and cached like the pose model so it keeps working offline after first use.
 * If it can't load, callers fall back to an assumed-neutral wrist.
 */
const MODEL_SOURCES = [
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
  `${import.meta.env.BASE_URL}models/hand_landmarker.task`,
];
const MODEL_CACHE = "ergo-models-v1";
const MODEL_CACHE_KEY = "ergo-hand-landmarker";

let landmarkerPromise: Promise<HandLandmarker> | null = null;

async function getModelBytes(): Promise<Uint8Array> {
  try {
    const cache = await caches.open(MODEL_CACHE);
    const hit = await cache.match(MODEL_CACHE_KEY);
    if (hit) return new Uint8Array(await hit.arrayBuffer());
  } catch {
    /* Cache Storage unavailable - fall through to network. */
  }
  let lastError: unknown;
  for (const url of MODEL_SOURCES) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Hand model fetch failed (HTTP ${res.status})`);
      const cacheable = res.clone();
      const bytes = new Uint8Array(await res.arrayBuffer());
      caches
        .open(MODEL_CACHE)
        .then((c) => c.put(MODEL_CACHE_KEY, cacheable))
        .catch(() => {});
      return bytes;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Hand model download failed");
}

async function create(delegate: "GPU" | "CPU"): Promise<HandLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}wasm`);
  const modelAssetBuffer = await getModelBytes();
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetBuffer, delegate },
    runningMode: "IMAGE",
    numHands: 2,
  });
}

export function getHandLandmarker(): Promise<HandLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = create("GPU")
      .catch(() => create("CPU"))
      .catch((err) => {
        landmarkerPromise = null; // allow a later retry
        throw err;
      });
  }
  return landmarkerPromise;
}

export async function detectHands(
  image: ImageBitmap | HTMLImageElement | HTMLCanvasElement,
): Promise<HandLandmarkerResult> {
  const lm = await getHandLandmarker();
  return lm.detect(image);
}
