import {
  DrawingUtils,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { fitScale } from "@/lib/image";

export interface AnnotatedImage {
  dataUrl: string;
  width: number;
  height: number;
}

const CONNECTOR_COLOR = "#10b981"; // emerald
const LANDMARK_COLOR = "#f43f5e"; // rose

/** The 2D context surface both HTMLCanvasElement and OffscreenCanvas provide. */
type Canvas2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * Shared drawing core: original image + MediaPipe landmarks/connections.
 * Works on either a DOM canvas context (main thread) or an
 * OffscreenCanvasRenderingContext2D (analysis worker) - DrawingUtils only
 * calls standard 2D-context methods, so the offscreen context is compatible.
 */
function drawSkeleton(
  ctx: Canvas2D,
  source: ImageBitmap,
  result: PoseLandmarkerResult,
  width: number,
  height: number,
): void {
  ctx.drawImage(source, 0, 0, width, height);

  const du = new DrawingUtils(ctx as CanvasRenderingContext2D);
  const lineWidth = Math.max(2, Math.round(width / 220));
  const radius = Math.max(2, Math.round(width / 260));

  for (const landmarks of result.landmarks) {
    du.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
      color: CONNECTOR_COLOR,
      lineWidth,
    });
    du.drawLandmarks(landmarks, {
      color: LANDMARK_COLOR,
      fillColor: LANDMARK_COLOR,
      lineWidth: 1,
      radius,
    });
  }
}

/**
 * Draw the original image with MediaPipe's landmarks + connections on top -
 * the canonical "skeleton image" output. Returns a PNG data URL.
 * Main-thread variant (DOM canvas).
 */
export function annotateSkeleton(
  source: ImageBitmap,
  result: PoseLandmarkerResult,
): AnnotatedImage {
  const scale = fitScale(source.width, source.height);
  const width = Math.round(source.width * scale);
  const height = Math.round(source.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  drawSkeleton(ctx, source, result, width, height);

  return { dataUrl: canvas.toDataURL("image/png"), width, height };
}

/** Worker variant: same drawing, encoded to a PNG Blob via OffscreenCanvas. */
export async function annotateSkeletonBlob(
  source: ImageBitmap,
  result: PoseLandmarkerResult,
): Promise<{ blob: Blob; width: number; height: number }> {
  const scale = fitScale(source.width, source.height);
  const width = Math.round(source.width * scale);
  const height = Math.round(source.height * scale);

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  drawSkeleton(ctx, source, result, width, height);

  return { blob: await canvas.convertToBlob({ type: "image/png" }), width, height };
}

/**
 * Draw an already-decoded bitmap to a downscaled JPEG data URL. Because the
 * bitmap is decoded (HEIC already converted upstream by `loadBitmap`), this
 * gives a "clean original" that renders in any browser - used for the PDF's
 * Original-photo slot, which otherwise can't embed a raw iPhone HEIC file.
 */
export function renderOriginalJpeg(source: ImageBitmap, quality = 0.85): string {
  const scale = fitScale(source.width, source.height);
  const width = Math.round(source.width * scale);
  const height = Math.round(source.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

/** Worker variant of `renderOriginalJpeg`: JPEG Blob via OffscreenCanvas. */
export async function renderOriginalJpegBlob(source: ImageBitmap, quality = 0.85): Promise<Blob> {
  const scale = fitScale(source.width, source.height);
  const width = Math.round(source.width * scale);
  const height = Math.round(source.height * scale);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0, width, height);
  return canvas.convertToBlob({ type: "image/jpeg", quality });
}
