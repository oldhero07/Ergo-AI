/**
 * Single source of truth for the uploaded-video pipeline's caps and timeouts.
 * Tuning these is a one-line change; they bound memory, runtime, and hang risk.
 */

/** Reject videos larger than this. A memory backstop — the blob still sits in RAM
 * while the <video> reads it. Generous because we sample frame-by-frame (we never
 * hold the whole clip decoded), so this guards pathological multi-GB drops, not
 * normal phone clips. */
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB

/** Only the first N seconds of a clip are analyzed. */
export const MAX_DURATION_SEC = 30;
/** Frames sampled per second of clip (≈ enough to catch posture changes). */
export const SAMPLE_FPS = 4;
/** Hard cap on sampled frames regardless of fps/duration. */
export const MAX_FRAMES = 150;
/** Longest edge each frame is downscaled to before pose detection. */
export const MAX_EDGE = 720;

/** Max wait for a single seek to land before treating the frame as unreadable. */
export const SEEK_TIMEOUT_MS = 8000;
/** Max wait for the video's metadata to load before giving up on the file. */
export const METADATA_TIMEOUT_MS = 15000;
/** Abort the whole analysis after this many consecutive unreadable frames. */
export const MAX_CONSECUTIVE_FRAME_FAILURES = 5;

/** Human-readable size for messages, e.g. 500 → "500 MB". */
export const MAX_VIDEO_MB = Math.round(MAX_VIDEO_BYTES / (1024 * 1024));
