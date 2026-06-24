/** iPhone/HEIF photos that the browser's native decoder usually can't read. */
export function isHeic(file: File): boolean {
  return /image\/(heic|heif)/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

/**
 * Decode a HEIC/HEIF file straight to an ImageBitmap via heic-to (a modern
 * libheif build, lazy-loaded only when needed). Unlike the old heic2any/libheif,
 * this decodes Apple's newer HDR "tmap"/gain-map HEICs that iPhones now produce.
 * libheif applies the container's rotation, so the bitmap is already upright.
 */
async function decodeHeic(file: File): Promise<ImageBitmap> {
  const { heicTo } = await import("heic-to");
  return (await heicTo({ blob: file, type: "bitmap" })) as ImageBitmap;
}

/**
 * Decode a File into an ImageBitmap, honoring EXIF orientation so that the
 * landmarks we compute line up with what the user sees (phone photos are often
 * rotated via EXIF rather than pixel data). HEIC/HEIF go through heic-to; if that
 * fails we still try the native decoder (Safari can read HEIC directly).
 */
export async function loadBitmap(file: File): Promise<ImageBitmap> {
  if (isHeic(file)) {
    try {
      return await decodeHeic(file);
    } catch {
      // Fall through to the native decoder — Safari on Apple devices can often
      // read HEIC directly even when conversion fails.
    }
  }
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (err) {
    // Last-ditch: maybe it was an unlabeled HEIC. Try the HEIC decoder once more.
    if (!isHeic(file)) {
      try {
        return await decodeHeic(file);
      } catch {
        /* ignore — throw the original, more descriptive error below */
      }
    }
    throw err;
  }
}

/** Longest-edge dimension we render/annotate at — keeps canvases and PNGs light. */
export const MAX_RENDER_SIZE = 1280;

export function fitScale(width: number, height: number, max = MAX_RENDER_SIZE): number {
  return Math.min(1, max / Math.max(width, height));
}
