import type { Landmark, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { detectPose, type ModelProgress } from "@/lib/poseLandmarker";
import { loadBitmap } from "@/lib/image";
import { annotateSkeleton, renderOriginalJpeg } from "@/lib/annotate";
import { computeAngles, measureWristFlexion, type AngleSet } from "@/lib/angles";
import { detectHands } from "@/lib/handLandmarker";
import { detectHandsCropped } from "@/lib/handRoi";
import { buildAutoInput, computeRula } from "@/assessment/rula/rula";
import type { AssessmentResult, PostureInput } from "@/assessment/types";
import { sampleVideoFrames } from "@/lib/videoFrames";
import {
  OCCLUSION_CONFIDENCE,
  WRIST_VIS_FLOOR,
  assembleVideoAnalysis,
  type RawVideoFrame,
  type VideoAnalysis,
  type VideoFrameResult,
} from "@/lib/pipeline/shared";

// Post-processing types now live in pipeline/shared.ts (used by both the
// inline and worker backends); re-exported here so existing imports keep working.
export type { VideoAnalysis, VideoFrameResult };

export interface PoseAnalysis {
  /** Annotated "skeleton" image (original + MediaPipe landmarks), PNG data or blob URL. */
  skeletonUrl: string;
  /** Clean original re-encoded to a JPEG data/blob URL - HEIC-safe, so the PDF can
   * always embed it even when the source was an iPhone .heic the browser can't
   * decode in an <img>. Absent only when decoding itself failed. */
  originalImageUrl?: string;
  /** 2D normalized landmarks (image space) for the primary detected pose. */
  landmarks: NormalizedLandmark[];
  /** Metric 3D world landmarks (hip-centered) for the primary detected pose. */
  worldLandmarks: Landmark[];
  width: number;
  height: number;
  detected: boolean;
  error?: string;
  angles?: AngleSet;
  /** Wrist flexion was actually measured from a detected hand (vs assumed neutral). */
  wristMeasured?: boolean;
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
      originalImageUrl: renderOriginalJpeg(bitmap),
      landmarks: result.landmarks[0] ?? [],
      worldLandmarks: result.worldLandmarks[0] ?? [],
      width,
      height,
      detected,
    };
    if (detected) {
      const angles = computeAngles(out.landmarks, out.worldLandmarks) ?? undefined;
      if (angles) {
        out.angles = angles;
        // Measure the wrist from a second (hand) model when possible; never let
        // its absence or failure block the score - fall back to assumed neutral.
        // ROI-first around the scored wrist (better for small/distant hands);
        // detectHandsCropped falls back to a full-frame scan internally.
        let wristFlex: number | null = null;
        try {
          const wristIdx = angles.side === "left" ? 15 : 16;
          const wrist = out.landmarks[wristIdx];
          const hands =
            wrist && (wrist.visibility ?? 0) > 0.3
              ? await detectHandsCropped(bitmap, wrist.x, wrist.y)
              : (await detectHands(bitmap)).landmarks;
          wristFlex = measureWristFlexion(out.landmarks, hands, angles.side);
        } catch {
          /* hand model unavailable - wrist stays assumed neutral */
        }
        out.wristMeasured = wristFlex !== null;
        out.input = buildAutoInput(angles, wristFlex !== null ? { wristAngle: wristFlex } : {});
        out.assessment = computeRula(out.input);
      }
    }
    return out;
  } finally {
    bitmap.close();
  }
}

export type VideoProgress = (stage: "sampling", done: number, total: number) => void;

export interface AnalyzeVideoOptions {
  fps?: number;
  maxFrames?: number;
  maxEdge?: number;
}

/** Render a small JPEG thumbnail of a frame bitmap (for the timeline/worst-frame UI). */
function thumbnail(bitmap: ImageBitmap, maxEdge = 320, quality = 0.7): string {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Full video pipeline (main-thread backend): sample frames → detect pose per
 * frame → derive angles → shared smoothing/temporal post-processing. Frames
 * with no pose are skipped (not smoothed/interpolated). The UI scores each
 * frame with the active method and builds the risk-over-time view.
 */
export async function analyzeVideo(
  file: File,
  onProgress?: VideoProgress,
  signal?: AbortSignal,
  options?: AnalyzeVideoOptions,
): Promise<VideoAnalysis> {
  const raw: RawVideoFrame[] = [];
  let skippedNoPose = 0;
  let skippedLowConfidence = 0;

  const meta = await sampleVideoFrames(
    file,
    { ...options, onProgress: (d, t) => onProgress?.("sampling", d, t), signal },
    async ({ timeSec, bitmap }) => {
      const result = await detectPose(bitmap);
      const landmarks = result.landmarks[0];
      if (!landmarks) {
        skippedNoPose++;
        return;
      }
      const angles = computeAngles(landmarks, result.worldLandmarks[0]);
      if (!angles) {
        skippedNoPose++;
        return;
      }
      // Occlusion handling: drop frames where the subject is partly out of frame
      // rather than feed misleading angles into the timeline/smoothing.
      if (angles.confidence < OCCLUSION_CONFIDENCE) {
        skippedLowConfidence++;
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

      raw.push({ timeSec, angles, confidence: angles.confidence, thumbUrl: thumbnail(bitmap), wristFlex });
    },
  );

  return assembleVideoAnalysis(raw, meta, { skippedNoPose, skippedLowConfidence });
}
