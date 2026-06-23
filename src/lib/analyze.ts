import type { Landmark, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { detectPose, type ModelProgress } from "@/lib/poseLandmarker";
import { loadBitmap } from "@/lib/image";
import { annotateSkeleton } from "@/lib/annotate";
import { computeAngles, type AngleSet } from "@/lib/angles";
import { buildAutoInput, computeRula } from "@/assessment/rula/rula";
import type { AssessmentResult, PostureInput } from "@/assessment/types";

export interface PoseAnalysis {
  /** Annotated "skeleton" image (original + MediaPipe landmarks), PNG data URL. */
  skeletonUrl: string;
  /** 2D normalized landmarks (image space) for the primary detected pose. */
  landmarks: NormalizedLandmark[];
  /** Metric 3D world landmarks (hip-centered) for the primary detected pose. */
  worldLandmarks: Landmark[];
  width: number;
  height: number;
  detected: boolean;
  error?: string;
  angles?: AngleSet;
  /** The auto-derived RULA input (editable in the adjustments panel). */
  input?: PostureInput;
  assessment?: AssessmentResult;
}

/** Full per-photo pipeline: decode → detect pose → render skeleton → RULA.
 * `onModelProgress` fires while the model downloads on the first call. */
export async function analyzePhoto(file: File, onModelProgress?: ModelProgress): Promise<PoseAnalysis> {
  const bitmap = await loadBitmap(file);
  try {
    const result = await detectPose(bitmap, onModelProgress);
    const detected = result.landmarks.length > 0;
    const { dataUrl, width, height } = annotateSkeleton(bitmap, result);
    const out: PoseAnalysis = {
      skeletonUrl: dataUrl,
      landmarks: result.landmarks[0] ?? [],
      worldLandmarks: result.worldLandmarks[0] ?? [],
      width,
      height,
      detected,
    };
    if (detected) {
      const angles = computeAngles(out.landmarks) ?? undefined;
      if (angles) {
        out.angles = angles;
        out.input = buildAutoInput(angles);
        out.assessment = computeRula(out.input);
      }
    }
    return out;
  } finally {
    bitmap.close();
  }
}
