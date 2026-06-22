/**
 * Decode a File into an ImageBitmap, honoring EXIF orientation so that the
 * landmarks we compute line up with what the user sees (phone photos are often
 * rotated via EXIF rather than pixel data).
 */
export async function loadBitmap(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

/** Longest-edge dimension we render/annotate at — keeps canvases and PNGs light. */
export const MAX_RENDER_SIZE = 1280;

export function fitScale(width: number, height: number, max = MAX_RENDER_SIZE): number {
  return Math.min(1, max / Math.max(width, height));
}
