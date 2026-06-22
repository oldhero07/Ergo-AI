/** iPhone/HEIF photos that the browser's native decoder usually can't read. */
function isHeic(file: File): boolean {
  return /image\/(heic|heif)/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

/**
 * iPhones default to HEIC, which Chrome/Firefox/Android can't decode natively.
 * Convert to JPEG via heic2any (lazy-loaded only when needed, so it never bloats
 * the bundle for the common JPEG/PNG case).
 */
async function convertHeicToJpeg(file: File): Promise<Blob> {
  const heic2any = (await import("heic2any")).default as (opts: {
    blob: Blob;
    toType?: string;
    quality?: number;
  }) => Promise<Blob | Blob[]>;
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  return Array.isArray(out) ? out[0] : out;
}

/**
 * Decode a File into an ImageBitmap, honoring EXIF orientation so that the
 * landmarks we compute line up with what the user sees (phone photos are often
 * rotated via EXIF rather than pixel data). Falls back to HEIC→JPEG conversion
 * for iPhone photos that the browser can't decode directly.
 */
export async function loadBitmap(file: File): Promise<ImageBitmap> {
  if (isHeic(file)) {
    try {
      const jpeg = await convertHeicToJpeg(file);
      return await createImageBitmap(jpeg, { imageOrientation: "from-image" });
    } catch {
      // Fall through to the native decoder — Safari on Apple devices can often
      // read HEIC directly even when conversion fails.
    }
  }
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (err) {
    // Last-ditch: maybe it was an unlabeled HEIC. Try conversion once more.
    if (!isHeic(file)) {
      try {
        const jpeg = await convertHeicToJpeg(file);
        return await createImageBitmap(jpeg, { imageOrientation: "from-image" });
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
