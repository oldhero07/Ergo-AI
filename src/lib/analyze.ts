import type { Landmark, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { detectPose, type ModelProgress } from "@/lib/poseLandmarker";
import { loadBitmap } from "@/lib/image";
import { annotateSkeleton, renderOriginalJpeg } from "@/lib/annotate";
import { computeAngles, type AngleSet } from "@/lib/angles";
import { buildAutoInput, computeRula } from "@/assessment/rula/rula";
import type { AssessmentResult, PostureInput } from "@/assessment/types";
import { sampleVideoFrames } from "@/lib/videoFrames";

export interface PoseAnalysis {
  /** Annotated "skeleton" image (original + MediaPipe landmarks), PNG data URL. */
  skeletonUrl: string;
  /** Clean original re-encoded to a JPEG data URL — HEIC-safe, so the PDF can
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

/** One sampled video frame with a detected pose, scored method-agnostically (the
 * UI computes RULA or REBA from `input` on demand). */
export interface VideoFrameResult {
  timeSec: number;
  angles: AngleSet;
  input: PostureInput;
  confidence: number;
  /** Small JPEG data URL of the frame, for the worst-frame view and scrubbing. */
  thumbUrl: string;
}

export interface VideoAnalysis {
  frames: VideoFrameResult[];
  /** Sampled frames that had no detectable pose (skipped). */
  skippedNoPose: number;
  /** Sampled frames dropped because landmark visibility was below the occlusion floor. */
  skippedLowConfidence: number;
  /** Frames that couldn't be decoded (seek timeout / glitch) and were skipped. */
  unreadableFrames: number;
  sampledDurationSec: number;
  fps: number;
}

export type VideoProgress = (stage: "sampling", done: number, total: number) => void;

/** Below this mean landmark visibility a frame is unreliable (occlusion) and is dropped. */
const OCCLUSION_CONFIDENCE = 0.4;
/** Rolling window (seconds) used to smooth per-frame angles before scoring. */
const SMOOTH_WINDOW_SEC = 2.5;

interface RawVideoFrame {
  timeSec: number;
  angles: AngleSet;
  confidence: number;
  thumbUrl: string;
}

/** Centered moving average of one angle channel at index `i`, ignoring gaps. */
function smoothChannel(values: (number | undefined)[], i: number, halfWin: number): number | undefined {
  let sum = 0;
  let n = 0;
  for (let j = Math.max(0, i - halfWin); j <= Math.min(values.length - 1, i + halfWin); j++) {
    const v = values[j];
    if (v !== undefined && Number.isFinite(v)) {
      sum += v;
      n++;
    }
  }
  return n ? sum / n : undefined;
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
 * Full video pipeline (lean V1): sample frames → detect pose per frame → derive
 * angles + a method-agnostic PostureInput. Frames with no pose are skipped (not
 * smoothed/interpolated yet — that's the temporal-tracking follow-up). The UI
 * scores each frame with the active method and builds the risk-over-time view.
 */
export async function analyzeVideo(
  file: File,
  onProgress?: VideoProgress,
  signal?: AbortSignal,
): Promise<VideoAnalysis> {
  const raw: RawVideoFrame[] = [];
  let skippedNoPose = 0;
  let skippedLowConfidence = 0;

  const meta = await sampleVideoFrames(
    file,
    { onProgress: (d, t) => onProgress?.("sampling", d, t), signal },
    async ({ timeSec, bitmap }) => {
      const result = await detectPose(bitmap);
      const landmarks = result.landmarks[0];
      if (!landmarks) {
        skippedNoPose++;
        return;
      }
      const angles = computeAngles(landmarks);
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
      raw.push({ timeSec, angles, confidence: angles.confidence, thumbUrl: thumbnail(bitmap) });
    },
  );

  // Smooth the raw angles over a rolling window before scoring, so the timeline
  // reflects sustained posture rather than single-frame detection jitter. We
  // smooth angles (continuous), not the categorical scores (step functions).
  const halfWin = Math.max(1, Math.round((SMOOTH_WINDOW_SEC * meta.fps) / 2));
  const channel = (key: "upperArm" | "lowerArm" | "neck" | "trunk" | "legAngle") =>
    raw.map((r) => r.angles[key] as number | undefined);
  const ua = channel("upperArm");
  const la = channel("lowerArm");
  const nk = channel("neck");
  const tk = channel("trunk");
  const lg = channel("legAngle");

  const frames: VideoFrameResult[] = raw.map((r, i) => {
    const smoothed: AngleSet = {
      upperArm: smoothChannel(ua, i, halfWin) ?? r.angles.upperArm,
      lowerArm: smoothChannel(la, i, halfWin) ?? r.angles.lowerArm,
      neck: smoothChannel(nk, i, halfWin) ?? r.angles.neck,
      trunk: smoothChannel(tk, i, halfWin) ?? r.angles.trunk,
      legAngle: smoothChannel(lg, i, halfWin),
      side: r.angles.side,
      confidence: r.confidence,
    };
    return { timeSec: r.timeSec, angles: smoothed, input: buildAutoInput(smoothed), confidence: r.confidence, thumbUrl: r.thumbUrl };
  });

  return {
    frames,
    skippedNoPose,
    skippedLowConfidence,
    unreadableFrames: meta.unreadableFrames,
    sampledDurationSec: meta.sampledDurationSec,
    fps: meta.fps,
  };
}
