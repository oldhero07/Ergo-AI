/**
 * Server-inference analysis backend: uploads the ORIGINAL photo bytes to the
 * pose API, derives 2D sagittal angles client-side, and scores with the
 * unchanged assessment engines. Produces the same `PoseAnalysis` /
 * `VideoAnalysis` shapes as the legacy on-device path so every downstream
 * consumer (results UI, exports, session restore) works untouched.
 */
import type { PoseAnalysis, VideoProgress, AnalyzeVideoOptions } from "@/lib/analysis";
import { apiAnalyzeBatch, apiAnalyzePhoto, apiHealth, type AnalyzeResult, type ApiKeypoint } from "@/lib/poseClient";
import { computeAngles2D } from "@/lib/angles2d";
import { annotateSkeleton2D, renderOriginalJpeg2D } from "@/lib/annotate2d";
import { loadBitmap } from "@/lib/image";
import { buildAutoInput, computeRula } from "@/assessment/rula/rula";
import { sampleVideoFrames } from "@/lib/videoFrames";
import { assembleVideoAnalysis, type RawVideoFrame, type VideoAnalysis } from "@/lib/video/assemble";

/** Scale server keypoints (original pixel space) into a possibly-downscaled
 * local bitmap's space so the overlay lines up. */
function toBitmapSpace(kps: ApiKeypoint[], originalW: number, bitmapW: number): ApiKeypoint[] {
  const f = bitmapW / originalW;
  if (f === 1) return kps;
  return kps.map(([x, y, s]) => [x * f, y * f, s] as ApiKeypoint);
}

function scoreFromKeypoints(out: PoseAnalysis, res: AnalyzeResult): void {
  if (!res.detected || !res.keypoints) return;
  const { angles, flags, wristAngle, offProfile } = computeAngles2D(res.keypoints, res.image.w, res.image.h);
  out.angles = angles;
  out.measuredFlags = flags;
  out.offProfile = offProfile;
  out.wristMeasured = flags.wrist;
  // Flag-never-suppress: the wrist value is always the measured geometry; the
  // flag (not the value) tells the UI whether to highlight it for review.
  out.input = buildAutoInput(angles, { wristAngle });
  out.assessment = computeRula(out.input);
}

export async function analyzePhotoRemote(file: File): Promise<PoseAnalysis> {
  const res = await apiAnalyzePhoto(file);

  const out: PoseAnalysis = {
    skeletonUrl: "",
    landmarks: [],
    worldLandmarks: [],
    width: res.image.w,
    height: res.image.h,
    detected: res.detected,
    modelVersion: res.model_version,
  };

  // Annotation is presentational - never fail the analysis over it.
  try {
    const bitmap = await loadBitmap(file);
    try {
      const kpsLocal = res.keypoints ? toBitmapSpace(res.keypoints, res.image.w, bitmap.width) : null;
      const annotated = annotateSkeleton2D(bitmap, kpsLocal);
      out.skeletonUrl = annotated.dataUrl;
      out.width = annotated.width;
      out.height = annotated.height;
      out.originalImageUrl = renderOriginalJpeg2D(bitmap);
    } finally {
      bitmap.close();
    }
  } catch {
    /* keep the score even if the local decode/draw fails */
  }
  if (!out.skeletonUrl) out.skeletonUrl = out.originalImageUrl ?? "";

  scoreFromKeypoints(out, res);
  return out;
}

/** Frames per /analyze-batch request (server cap is 16; 15 keeps headroom). */
const BATCH_SIZE = 15;
/** JPEG quality for sampled video frames sent to the server. */
const FRAME_QUALITY = 0.8;

function frameToJpeg(bitmap: ImageBitmap, quality = FRAME_QUALITY): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("canvas 2d unavailable"));
  ctx.drawImage(bitmap, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("jpeg encode failed"))), "image/jpeg", quality);
  });
}

/** Small JPEG for the timeline/worst-frame UI (same as the legacy path). */
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

export async function analyzeVideoRemote(
  file: File,
  onProgress?: VideoProgress,
  signal?: AbortSignal,
  options?: AnalyzeVideoOptions,
): Promise<VideoAnalysis> {
  const raw: RawVideoFrame[] = [];
  let skippedNoPose = 0;
  let offProfileFrames = 0;
  const flagFalseCounts: Record<string, number> = {};

  interface Pending {
    timeSec: number;
    blob: Blob;
    thumbUrl: string;
    w: number;
    h: number;
  }
  let pending: Pending[] = [];

  // One transient server blip (cold start, 5xx, network hiccup) must not
  // discard a whole clip's worth of already-scored batches - retry the batch
  // a couple of times with backoff before giving up.
  const sendBatch = async (blobs: Blob[]) => {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await apiAnalyzeBatch(blobs, signal);
      } catch (err) {
        if ((err as Error).name === "AbortError" || signal?.aborted) throw err;
        lastErr = err;
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
    throw lastErr;
  };

  const flush = async () => {
    if (!pending.length) return;
    const batch = pending;
    pending = [];
    const res = await sendBatch(batch.map((p) => p.blob));
    for (let j = 0; j < batch.length; j++) {
      const r = res.results[j];
      if (!r?.detected || !r.keypoints) {
        skippedNoPose++;
        continue;
      }
      const { angles, wristAngle, flags, offProfile } = computeAngles2D(r.keypoints, r.image.w, r.image.h);
      if (offProfile) offProfileFrames++;
      for (const [k, v] of Object.entries(flags)) if (!v) flagFalseCounts[k] = (flagFalseCounts[k] ?? 0) + 1;
      raw.push({
        timeSec: batch[j].timeSec,
        angles,
        confidence: angles.confidence,
        thumbUrl: batch[j].thumbUrl,
        // Flag-never-suppress, identical to the photo path: the measured wrist
        // VALUE always flows into scoring; wristMeasured carries the flag.
        wristFlex: wristAngle,
        wristMeasured: flags.wrist,
      });
    }
  };

  const meta = await sampleVideoFrames(
    file,
    { ...options, onProgress: (d, t) => onProgress?.("sampling", d, t), signal },
    async ({ timeSec, bitmap }) => {
      pending.push({
        timeSec,
        blob: await frameToJpeg(bitmap),
        thumbUrl: thumbnail(bitmap),
        w: bitmap.width,
        h: bitmap.height,
      });
      if (pending.length >= BATCH_SIZE) await flush();
    },
  );
  await flush();

  // No low-confidence gate in the server path (flag-never-suppress); the field
  // remains for UI compatibility and honest reporting of what was skipped.
  const analysis = assembleVideoAnalysis(raw, meta, { skippedNoPose, skippedLowConfidence: 0 });
  analysis.offProfile = raw.length > 0 && offProfileFrames > raw.length / 2;
  if (raw.length > 0) {
    // An angle is flagged for the clip when it was unreliable in MOST frames -
    // a single occluded frame shouldn't discredit a whole clip's measurement.
    const majority = (k: string) => (flagFalseCounts[k] ?? 0) <= raw.length / 2;
    analysis.measuredFlags = {
      upperArm: majority("upperArm"),
      lowerArm: majority("lowerArm"),
      wrist: majority("wrist"),
      neck: majority("neck"),
      trunk: majority("trunk"),
      legs: majority("legs"),
    };
  }
  return analysis;
}

/** Best-effort warm-up: wake the Space so the first Analyze isn't the wake. */
export async function warmUpRemote(): Promise<void> {
  await apiHealth();
}
