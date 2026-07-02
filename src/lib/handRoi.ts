import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { detectHands } from "@/lib/handLandmarker";

/**
 * Crop the area around the wrist and run the hand landmarker on it for max
 * speed, mapping the landmarks back to full-image coordinates. Falls back to a
 * full-frame scan when the crop finds no hand (e.g. fingers extended past the
 * box), so speed never costs accuracy. DOM-free: runs on the main thread and
 * inside the analysis worker (`createImageBitmap` exists in both).
 */
export async function detectHandsCropped(
  bitmap: ImageBitmap,
  wristX: number,
  wristY: number,
  boxSizeFraction = 0.35, // Increased from 0.25 to prevent finger clipping
): Promise<NormalizedLandmark[][]> {
  const w = bitmap.width;
  const h = bitmap.height;
  const size = Math.round(Math.min(w, h) * boxSizeFraction);
  if (size <= 0) return [];
  const cx = wristX * w;
  const cy = wristY * h;
  let sx = Math.round(cx - size / 2);
  let sy = Math.round(cy - size / 2);
  sx = Math.max(0, Math.min(w - size, sx));
  sy = Math.max(0, Math.min(h - size, sy));

  try {
    const cropped = await createImageBitmap(bitmap, sx, sy, size, size);
    try {
      const handsResult = await detectHands(cropped);
      if (handsResult && handsResult.landmarks && handsResult.landmarks.length > 0) {
        const ox = sx / w;
        const oy = sy / h;
        const sw = size / w;
        const sh = size / h;
        return handsResult.landmarks.map((landmarks) =>
          landmarks.map((pt) => ({
            ...pt,
            x: ox + pt.x * sw,
            y: oy + pt.y * sh,
          }))
        );
      }
    } finally {
      cropped.close();
    }
  } catch {
    /* crop decode failed - let fallback handle it */
  }

  // --- QUALITY ASSURANCE FALLBACK ---
  // If cropped detection failed to find a hand (e.g. hand was extended outside the crop box),
  // immediately fall back to scanning the full image frame so we never compromise on accuracy.
  try {
    const fullHandsResult = await detectHands(bitmap);
    return fullHandsResult?.landmarks || [];
  } catch {
    return [];
  }
}
