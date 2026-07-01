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

/**
 * Draw the original image with MediaPipe's landmarks + connections on top -
 * the canonical "skeleton image" output. Returns a PNG data URL.
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
  ctx.drawImage(source, 0, 0, width, height);

  const du = new DrawingUtils(ctx);
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

  return { dataUrl: canvas.toDataURL("image/png"), width, height };
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
