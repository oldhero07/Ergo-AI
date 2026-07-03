/**
 * Shared image-preparation core, used by the prepare worker and (as a rare
 * fallback) inline on the main thread: decode a photo exactly once (native
 * decoder first, libheif only where HEIC isn't natively supported) and
 * re-encode it as small JPEGs - a grid-preview thumbnail for every file, plus
 * an analysis-sized JPEG for HEIC so a slow wasm decode never has to run again
 * at analysis time. DOM-free (OffscreenCanvas only) so it behaves identically
 * in both contexts.
 */
import { isHeic, MAX_ANALYZE_EDGE } from "@/lib/image";
import { heicTo } from "heic-to";

/** Longest edge of the grid-preview thumbnail. Big enough to double as the
 * PDF's last-resort original-photo fallback, tiny next to a raw camera file. */
export const THUMB_EDGE = 512;
/** Longest edge of the analysis JPEG a HEIC is re-encoded to. Must match the
 * cap loadBitmap applies (MAX_ANALYZE_EDGE) so this pre-encode sails through it
 * untouched - keep them equal by sourcing the one constant. */
export const ANALYSIS_EDGE = MAX_ANALYZE_EDGE;

export interface PreparedBlobs {
  /** Small JPEG for the upload-grid tile (null if encoding failed). */
  thumbBlob: Blob | null;
  /** HEIC only: analysis-ready JPEG re-encode of the photo. */
  analysisBlob: Blob | null;
}

async function decodeToBitmap(file: File): Promise<ImageBitmap> {
  // Native decoder first, even for HEIC: Apple devices (Safari + all iOS
  // browsers) read HEIC natively and fast, so libheif (2.9MB + a ~190MB wasm
  // heap per decode) never loads there. Non-Apple browsers reject HEIC here and
  // fall through to the libheif build below.
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (err) {
    try {
      return (await heicTo({ blob: file, type: "bitmap" })) as ImageBitmap;
    } catch {
      throw err;
    }
  }
}

async function encodeJpeg(bitmap: ImageBitmap, maxEdge: number, quality: number): Promise<Blob | null> {
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    return await canvas.convertToBlob({ type: "image/jpeg", quality });
  } catch {
    return null;
  }
}

export async function prepareImageBlobs(file: File): Promise<PreparedBlobs> {
  const bitmap = await decodeToBitmap(file);
  try {
    return {
      thumbBlob: await encodeJpeg(bitmap, THUMB_EDGE, 0.8),
      analysisBlob: isHeic(file) ? await encodeJpeg(bitmap, ANALYSIS_EDGE, 0.92) : null,
    };
  } finally {
    bitmap.close();
  }
}
