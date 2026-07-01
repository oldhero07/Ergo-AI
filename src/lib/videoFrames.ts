/**
 * Sample frames from an uploaded video file by seeking a hidden <video> element
 * and drawing each frame to a canvas. Offline (not real-time): we walk the clip
 * at a fixed rate and hand each frame to `onFrame` one at a time, so only a
 * single decoded frame is ever in memory. Caps keep large clips from exhausting
 * the tab (mirrors the MAX_BATCH rationale on the photo path).
 *
 * Hardened against the ways a video can wedge the tab: every seek and the
 * metadata load are time-boxed (a corrupt frame or unsupported codec can fire
 * neither `seeked` nor `error`), undecodable formats are rejected up front, a
 * few bad frames are skipped rather than fatal, and the whole run is abortable.
 */

import {
  SAMPLE_FPS,
  MAX_DURATION_SEC,
  MAX_FRAMES,
  MAX_EDGE,
  SEEK_TIMEOUT_MS,
  METADATA_TIMEOUT_MS,
  MAX_CONSECUTIVE_FRAME_FAILURES,
} from "@/lib/videoConfig";

export interface SampledFrame {
  /** Presentation time of this frame within the clip, in seconds. */
  timeSec: number;
  /** Decoded frame, downscaled to `maxEdge`. Caller owns it - close it when done. */
  bitmap: ImageBitmap;
  width: number;
  height: number;
}

export interface VideoSampleOptions {
  fps?: number;
  maxDurationSec?: number;
  maxFrames?: number;
  maxEdge?: number;
  onProgress?: (done: number, total: number) => void;
  /** Abort the run cooperatively (checked before every seek). */
  signal?: AbortSignal;
}

export interface VideoSampleResult {
  sampledDurationSec: number;
  fps: number;
  frameCount: number;
  /** Frames that couldn't be read (seek timed out / decode failed) and were skipped. */
  unreadableFrames: number;
}

class AbortError extends Error {
  constructor() {
    super("Analysis cancelled.");
    this.name = "AbortError";
  }
}
const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new AbortError();
};

/** Resolve once the seek lands; reject on error or after `SEEK_TIMEOUT_MS`. */
function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let timer = 0;
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    const onSeeked = () => {
      cleanup();
      // A macrotask tick lets the freshly-seeked frame settle before we read it.
      // (Deliberately not requestAnimationFrame - rAF is throttled/paused in
      // background tabs, which would stall the whole sampling loop.)
      setTimeout(resolve, 0);
    };
    const onError = () => {
      cleanup();
      reject(new Error("Failed to seek the video."));
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out reading a video frame."));
    }, SEEK_TIMEOUT_MS);
    video.currentTime = t;
  });
}

/** Wait for metadata, time-boxed so a file that never loads can't hang the run. */
function loadMetadata(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    let timer = 0;
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
    };
    const onLoaded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Could not read this video file."));
    };
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("error", onError);
    timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out loading this video."));
    }, METADATA_TIMEOUT_MS);
  });
}

/**
 * Walk the clip, invoking `onFrame` for each readable frame in order. Resolves
 * once every sampled time is processed. `onFrame` is awaited before the next
 * seek, so the caller can run pose detection without frames piling up in memory.
 */
export async function sampleVideoFrames(
  file: File,
  opts: VideoSampleOptions,
  onFrame: (frame: SampledFrame) => Promise<void>,
): Promise<VideoSampleResult> {
  const {
    fps = SAMPLE_FPS,
    maxDurationSec = MAX_DURATION_SEC,
    maxFrames = MAX_FRAMES,
    maxEdge = MAX_EDGE,
    onProgress,
    signal,
  } = opts;

  throwIfAborted(signal);

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  // Off-screen rather than fully detached - some browsers (notably mobile
  // Safari) seek/draw more reliably when the element is in the document.
  video.setAttribute("aria-hidden", "true");
  video.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none";
  video.src = url;
  document.body.appendChild(video);

  try {
    await loadMetadata(video);
    throwIfAborted(signal);

    const fullDuration = video.duration;
    if (!Number.isFinite(fullDuration) || fullDuration <= 0) {
      throw new Error("This video has no readable duration.");
    }
    // No decodable video track (audio-only, or a codec the browser can't decode
    // such as HEVC/AV1) - metadata loads but there are no pixels to sample.
    if (!video.videoWidth || !video.videoHeight) {
      throw new Error("Couldn't decode this video format. Try exporting it as MP4 (H.264).");
    }

    const duration = Math.min(fullDuration, maxDurationSec);
    const interval = 1 / fps;
    const times: number[] = [];
    for (let t = 0; t < duration && times.length < maxFrames; t += interval) times.push(t);
    if (!times.length) times.push(0);

    const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Failed to acquire a 2D canvas context.");

    let unreadableFrames = 0;
    let consecutiveFailures = 0;
    for (let i = 0; i < times.length; i++) {
      throwIfAborted(signal);
      try {
        await seekTo(video, times[i]);
        ctx.drawImage(video, 0, 0, width, height);
        const bitmap = await createImageBitmap(canvas);
        try {
          await onFrame({ timeSec: times[i], bitmap, width, height });
        } finally {
          bitmap.close();
        }
        consecutiveFailures = 0;
      } catch (err) {
        if (err instanceof AbortError) throw err;
        // A single unreadable frame (seek timeout / decode glitch) shouldn't kill
        // a good clip - skip it. But a fundamentally broken/unsupported file fails
        // every frame, so bail after a short run of consecutive failures.
        unreadableFrames++;
        consecutiveFailures++;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FRAME_FAILURES) {
          throw new Error("Couldn't read frames from this video. Try a different file or export it as MP4.");
        }
      }
      onProgress?.(i + 1, times.length);
    }

    return { sampledDurationSec: duration, fps, frameCount: times.length, unreadableFrames };
  } finally {
    video.removeAttribute("src");
    video.load();
    video.remove();
    URL.revokeObjectURL(url);
  }
}
