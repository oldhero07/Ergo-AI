import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";

type Delegate = "GPU" | "CPU";

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

async function create(delegate: Delegate): Promise<PoseLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}wasm`);
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `${import.meta.env.BASE_URL}models/pose_landmarker_heavy.task`,
      delegate,
    },
    runningMode: "IMAGE",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputSegmentationMasks: false,
  });
}

/** Lazily create a single shared PoseLandmarker (Heavy model). GPU with CPU fallback. */
export function getPoseLandmarker(): Promise<PoseLandmarker> {
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

export async function detectPose(
  image: ImageBitmap | HTMLImageElement | HTMLCanvasElement,
): Promise<PoseLandmarkerResult> {
  const landmarker = await getPoseLandmarker();
  return landmarker.detect(image);
}
