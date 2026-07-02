/**
 * Pure post-processing shared by BOTH analysis backends (main-thread inline and
 * worker) and by vitest. Everything here is DOM-free math moved verbatim from
 * the original analyze.ts - the worker refactor must not change any numbers.
 */
import type { AngleSet } from "@/lib/angles";
import { buildAutoInput } from "@/assessment/rula/rula";
import type { PostureInput } from "@/assessment/types";

/** Below this mean landmark visibility a frame is unreliable (occlusion) and is dropped. */
export const OCCLUSION_CONFIDENCE = 0.4;
/** Rolling window (seconds) used to smooth per-frame angles before scoring. */
export const SMOOTH_WINDOW_SEC = 2.5;
/** Minimum wrist-landmark visibility before the hand model is attempted on a video frame. */
export const WRIST_VIS_FLOOR = 0.45;

/** One sampled video frame with a detected pose, scored method-agnostically (the
 * UI computes RULA or REBA from `input` on demand). */
export interface VideoFrameResult {
  timeSec: number;
  angles: AngleSet;
  input: PostureInput;
  confidence: number;
  /** Small JPEG (data or blob URL) of the frame, for the worst-frame view and scrubbing. */
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
  /** Detected over the clip and applied to every frame's muscle-use / activity. */
  temporal: { repeated: boolean; sustained: boolean };
}

/** A raw per-frame detection before smoothing/scoring - produced by either backend. */
export interface RawVideoFrame {
  timeSec: number;
  angles: AngleSet;
  confidence: number;
  thumbUrl: string;
  wristFlex: number | null;
}

export interface VideoSampleMeta {
  sampledDurationSec: number;
  fps: number;
  unreadableFrames: number;
}

/** Centered moving average of one angle channel at index `i`, ignoring gaps. */
export function smoothChannel(values: (number | undefined)[], i: number, halfWin: number): number | undefined {
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

/** Count posture cycles via a Schmitt trigger around the mean (±7° hysteresis). */
export function countCycles(sig: number[]): number {
  const mean = sig.reduce((a, b) => a + b, 0) / sig.length;
  const hi = mean + 7;
  const lo = mean - 7;
  let state: "mid" | "low" | "high" = "mid";
  let cycles = 0;
  for (const v of sig) {
    if (v > hi) {
      if (state === "low") cycles++;
      state = "high";
    } else if (v < lo) {
      state = "low";
    }
  }
  return cycles;
}

/**
 * Detect, over the whole clip, whether a posture is repeated (≥4 cycles/min with
 * real amplitude) or held near-static. These are the RULA muscle-use / REBA
 * activity criteria that a single photo can't see - the one thing video adds.
 * (The RULA ">1 min static" rule can't be met on ≤30s clips; we flag clip-scoped
 * evidence, surfaced transparently in the UI.)
 */
export function detectTemporal(
  frames: VideoFrameResult[],
  durationSec: number,
): { repeated: boolean; sustained: boolean } {
  const durMin = Math.max(durationSec / 60, 1 / 60);
  let repeated = false;
  let sustained = false;
  for (const key of ["upperArm", "neck", "trunk"] as const) {
    const sig = frames.map((f) => f.angles[key]).filter((v): v is number => Number.isFinite(v));
    if (sig.length < 4) continue;
    const range = Math.max(...sig) - Math.min(...sig);
    if (range < 8) sustained = true; // this joint barely moved - posture held
    if (range > 15) {
      const cycles = countCycles(sig);
      if (cycles >= 2 && cycles / durMin >= 4) repeated = true;
    }
  }
  return { repeated, sustained };
}

/**
 * Smooth raw per-frame angles over a rolling window, score each frame's input,
 * and apply the clip-level static/repetition flags - the exact post-processing
 * the original analyzeVideo performed inline. Both backends feed their raw
 * frames through this single implementation.
 */
export function assembleVideoAnalysis(
  raw: RawVideoFrame[],
  meta: VideoSampleMeta,
  counts: { skippedNoPose: number; skippedLowConfidence: number },
): VideoAnalysis {
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
  const wf = raw.map((r) => r.wristFlex ?? undefined);

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
    const smoothedWrist = smoothChannel(wf, i, halfWin) ?? 0;
    return {
      timeSec: r.timeSec,
      angles: smoothed,
      input: buildAutoInput(smoothed, { wristAngle: smoothedWrist }),
      confidence: r.confidence,
      thumbUrl: r.thumbUrl,
    };
  });

  // Static/repetition is the factor video can validate that a photo can't. When
  // detected, apply it to every frame so the timeline + scores reflect it.
  const temporal = detectTemporal(frames, meta.sampledDurationSec);
  if (temporal.repeated || temporal.sustained) {
    for (const f of frames) {
      f.input = {
        ...f.input,
        muscleUseA: true,
        muscleUseB: true,
        activityStatic: temporal.sustained,
        activityRepeated: temporal.repeated,
      };
    }
  }

  return {
    frames,
    skippedNoPose: counts.skippedNoPose,
    skippedLowConfidence: counts.skippedLowConfidence,
    unreadableFrames: meta.unreadableFrames,
    sampledDurationSec: meta.sampledDurationSec,
    fps: meta.fps,
    temporal,
  };
}
