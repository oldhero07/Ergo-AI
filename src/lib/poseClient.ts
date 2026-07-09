/**
 * Typed client for the pose-inference API (see server/app.py). The client
 * sends ORIGINAL file bytes - never a canvas re-encode - because browser JPEG
 * encoders differ per device and the whole point of server inference is that
 * the same photo produces identical keypoints (and scores) everywhere. The
 * server performs the single canonical decode/downscale.
 */

/** The deployed inference service (Cloud Run, us-central1, scale-to-zero).
 * Overridable for local dev via .env.local (VITE_POSE_API_URL). */
const DEFAULT_POSE_API = "https://ergo-pose-599737870578.us-central1.run.app";

export function poseApiBase(): string {
  return (import.meta.env.VITE_POSE_API_URL as string | undefined) ?? DEFAULT_POSE_API;
}

/** [x, y, score] - x/y in ORIGINAL (EXIF-upright) image pixel space. */
export type ApiKeypoint = [number, number, number];

export interface AnalyzeResult {
  model_version: string;
  schema: string;
  detected: boolean;
  /** [x, y, w, h] in original pixel space; null when detected is false. */
  bbox: [number, number, number, number] | null;
  image: { w: number; h: number };
  keypoints: ApiKeypoint[] | null;
}

export interface AnalyzeBatchResult {
  model_version: string;
  results: AnalyzeResult[];
}

export interface HealthzResult {
  status: string;
  model_version: string;
}

/** Matches the server's cap; checked client-side for a friendly early message. */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
/** Matches the server's per-request frame cap for /analyze-batch. */
export const MAX_BATCH_FRAMES = 16;

async function postForm(path: string, form: FormData, signal?: AbortSignal): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${poseApiBase()}${path}`, { method: "POST", body: form, signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new Error("Could not reach the analysis server. Check your connection and try again.");
  }
  if (!res.ok) {
    let detail = "";
    try {
      detail = ((await res.json()) as { detail?: string }).detail ?? "";
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail || `Analysis server error (HTTP ${res.status}).`);
  }
  return res;
}

export async function apiAnalyzePhoto(file: File | Blob, signal?: AbortSignal): Promise<AnalyzeResult> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("This photo is over 12 MB. Please resize or re-export it and try again.");
  }
  const form = new FormData();
  form.append("image", file, file instanceof File ? file.name : "photo.jpg");
  const res = await postForm("/analyze", form, signal);
  return (await res.json()) as AnalyzeResult;
}

export async function apiAnalyzeBatch(frames: Blob[], signal?: AbortSignal): Promise<AnalyzeBatchResult> {
  if (frames.length > MAX_BATCH_FRAMES) {
    throw new Error(`At most ${MAX_BATCH_FRAMES} frames per batch.`);
  }
  const form = new FormData();
  for (let i = 0; i < frames.length; i++) form.append("frames", frames[i], `f${i}.jpg`);
  const res = await postForm("/analyze-batch", form, signal);
  return (await res.json()) as AnalyzeBatchResult;
}

/** One quick health probe; resolves false instead of throwing (poll-friendly). */
export async function apiHealth(timeoutMs = 8000): Promise<HealthzResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${poseApiBase()}/health`, { signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as HealthzResult;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
