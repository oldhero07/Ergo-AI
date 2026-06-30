import { MAX_VIDEO_BYTES, MAX_VIDEO_MB } from "@/lib/videoConfig";

export type VideoValidation = { ok: true } | { ok: false; message: string };

/** True for files we route to the video flow (MIME or extension). */
export function isVideoFile(file: File): boolean {
  return file.type.startsWith("video/") || /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(file.name);
}

/**
 * Gate a file before the video pipeline touches it: must look like a video and
 * be within the size cap. Pure (no DOM) so it's unit-testable and can run before
 * any object URL or decoder is created.
 */
export function validateVideoFile(file: File): VideoValidation {
  if (!isVideoFile(file)) {
    return { ok: false, message: "That file isn't a video. Upload an MP4, MOV, or WebM clip." };
  }
  if (file.size > MAX_VIDEO_BYTES) {
    const mb = Math.round(file.size / (1024 * 1024));
    return {
      ok: false,
      message: `This video is ${mb} MB — the limit is ${MAX_VIDEO_MB} MB. Trim it to a shorter clip of the posture and try again.`,
    };
  }
  if (file.size === 0) {
    return { ok: false, message: "This file is empty." };
  }
  return { ok: true };
}
