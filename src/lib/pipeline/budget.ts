/**
 * Device-aware quality budget. Low-memory / low-core devices get reduced
 * sampling density and resolution so a long clip can't OOM the tab. This only
 * ever reduces HOW MUCH we sample - never detection thresholds, smoothing
 * behavior, or the model (Pose Heavy stays) - so accuracy semantics are
 * unchanged; the UI surfaces a note whenever a reduced budget is in effect.
 * The videoConfig caps remain the absolute ceiling.
 */
import { SAMPLE_FPS, MAX_FRAMES, MAX_EDGE } from "@/lib/videoConfig";

export interface AnalysisBudget {
  /** Longest edge sampled video frames are downscaled to. */
  maxEdge: number;
  /** Video frames sampled per second. */
  fps: number;
  /** Hard cap on sampled frames per clip. */
  maxFrames: number;
  /** Max photos per batch. */
  maxBatch: number;
  /** True when below the full-quality tier (drives the UI note). */
  reduced: boolean;
}

export function getBudget(): AnalysisBudget {
  // navigator.deviceMemory is Chromium-only; assume a mid-range 4 GB elsewhere.
  const gb = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  if (gb <= 2 || cores <= 2) {
    return { maxEdge: 480, fps: 2, maxFrames: 80, maxBatch: 12, reduced: true };
  }
  if (gb <= 4) {
    return { maxEdge: 640, fps: 3, maxFrames: 120, maxBatch: 20, reduced: true };
  }
  return { maxEdge: MAX_EDGE, fps: SAMPLE_FPS, maxFrames: MAX_FRAMES, maxBatch: 30, reduced: false };
}
