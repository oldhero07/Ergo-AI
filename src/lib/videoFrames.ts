/**
 * Sample frames from an uploaded video file by seeking a hidden <video> element
 * and drawing each frame to a canvas. Offline (not real-time): we walk the clip
 * at a fixed rate and hand each frame to `onFrame` one at a time, so only a
 * single decoded frame is ever in memory. Caps keep large clips from exhausting
 * the tab (mirrors the MAX_BATCH rationale on the photo path).
 */

export interface SampledFrame {
  /** Presentation time of this frame within the clip, in seconds. */
  timeSec: number;
  /** Decoded frame, downscaled to `maxEdge`. Caller owns it — close it when done. */
  bitmap: ImageBitmap;
  width: number;
  height: number;
}

export interface VideoSampleOptions {
  /** Target frames sampled per second of clip (default 4 ≈ catches posture changes). */
  fps?: number;
  /** Only the first N seconds are analyzed (default 30). */
  maxDurationSec?: number;
  /** Hard cap on sampled frames regardless of fps/duration (default 150). */
  maxFrames?: number;
  /** Longest edge each frame is downscaled to before detection (default 720). */
  maxEdge?: number;
  onProgress?: (done: number, total: number) => void;
}

function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    const onSeeked = () => {
      cleanup();
      // A macrotask tick lets the freshly-seeked frame settle before we read it.
      // (Deliberately not requestAnimationFrame — rAF is throttled/paused in
      // background tabs, which would stall the whole sampling loop.)
      setTimeout(resolve, 0);
    };
    const onError = () => {
      cleanup();
      reject(new Error("Failed to seek the video."));
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = t;
  });
}

/**
 * Walk the clip, invoking `onFrame` for each sampled frame in order. Resolves
 * once every frame is processed. `onFrame` is awaited before the next seek, so
 * the caller can run pose detection without frames piling up in memory.
 */
export async function sampleVideoFrames(
  file: File,
  opts: VideoSampleOptions,
  onFrame: (frame: SampledFrame) => Promise<void>,
): Promise<{ sampledDurationSec: number; fps: number; frameCount: number }> {
  const { fps = 4, maxDurationSec = 30, maxFrames = 150, maxEdge = 720, onProgress } = opts;

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not read this video file."));
    });

    const fullDuration = video.duration;
    if (!Number.isFinite(fullDuration) || fullDuration <= 0) {
      throw new Error("This video has no readable duration.");
    }
    const duration = Math.min(fullDuration, maxDurationSec);

    const interval = 1 / fps;
    const times: number[] = [];
    for (let t = 0; t < duration && times.length < maxFrames; t += interval) times.push(t);
    if (!times.length) times.push(0);

    const vw = video.videoWidth || 1;
    const vh = video.videoHeight || 1;
    const scale = Math.min(1, maxEdge / Math.max(vw, vh));
    const width = Math.max(1, Math.round(vw * scale));
    const height = Math.max(1, Math.round(vh * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Failed to acquire a 2D canvas context.");

    for (let i = 0; i < times.length; i++) {
      await seekTo(video, times[i]);
      ctx.drawImage(video, 0, 0, width, height);
      const bitmap = await createImageBitmap(canvas);
      try {
        await onFrame({ timeSec: times[i], bitmap, width, height });
      } finally {
        bitmap.close();
      }
      onProgress?.(i + 1, times.length);
    }

    return { sampledDurationSec: duration, fps, frameCount: times.length };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
