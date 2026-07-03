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

/** Longest edge fed to analysis. Detection resizes to a much smaller model
 * input and annotation renders at MAX_RENDER_SIZE, so decoding a 24-48MP photo
 * at full resolution only cost memory and worker-transfer time. */
export const MAX_ANALYZE_EDGE = 2048;

/** Downscale a decoded bitmap to MAX_ANALYZE_EDGE (no-op when already smaller).
 * Downscaling is a memory optimization, never a correctness requirement: if a
 * browser rejects the resize options (older engines) or the resize throws, fall
 * back to the full-resolution bitmap rather than failing the whole decode. */
async function capBitmap(bitmap: ImageBitmap): Promise<ImageBitmap> {
  const scale = fitScale(bitmap.width, bitmap.height, MAX_ANALYZE_EDGE);
  if (scale >= 1) return bitmap;
  try {
    const scaled = await createImageBitmap(bitmap, {
      resizeWidth: Math.max(1, Math.round(bitmap.width * scale)),
      resizeHeight: Math.max(1, Math.round(bitmap.height * scale)),
      resizeQuality: "high",
    });
    bitmap.close();
    return scaled;
  } catch {
    return bitmap; // resize unsupported/failed - analyze at full resolution
  }
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
      return await capBitmap(await decodeHeic(file));
    } catch {
      // Fall through to the native decoder - Safari on Apple devices can often
      // read HEIC directly even when conversion fails.
    }
  }
  try {
    return await capBitmap(await createImageBitmap(file, { imageOrientation: "from-image" }));
  } catch (err) {
    // Last-ditch: maybe it was an unlabeled HEIC. Try the HEIC decoder once more.
    if (!isHeic(file)) {
      try {
        return await capBitmap(await decodeHeic(file));
      } catch {
        /* ignore - throw the original, more descriptive error below */
      }
    }
    throw err;
  }
}

/** Longest-edge dimension we render/annotate at - keeps canvases and PNGs light. */
export const MAX_RENDER_SIZE = 1280;

export function fitScale(width: number, height: number, max = MAX_RENDER_SIZE): number {
  return Math.min(1, max / Math.max(width, height));
}
