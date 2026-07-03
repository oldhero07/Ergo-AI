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

/** Hard cap on a single analysis decode. The prepare pass already time-boxes
 * decoding; this gives the analysis pass the same guarantee, so a corrupt or
 * pathological file that makes a decoder hang (rather than reject) can't wedge
 * the whole batch. Generous enough not to trip a slow libheif decode of a real
 * 48MP HEIC on a low-end device. */
const DECODE_TIMEOUT_MS = 30000;

/**
 * Decode a File into an ImageBitmap, honoring EXIF orientation so that the
 * landmarks we compute line up with what the user sees (phone photos are often
 * rotated via EXIF rather than pixel data).
 *
 * The browser's native decoder is tried FIRST, even for HEIC: Apple devices
 * (Safari, and every iOS browser - all WebKit) decode HEIC natively and fast,
 * so the 2.9MB libheif wasm build (which also holds a second ~190MB copy of the
 * image in its own heap per decode) never loads there. Only non-Apple browsers,
 * where native HEIC decoding fails, fall back to heic-to.
 *
 * Time-boxed and translates any decode failure into a plain-language message -
 * a corrupt/truncated/unsupported file yields a clear result card, never a hang.
 */
export async function loadBitmap(file: File): Promise<ImageBitmap> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("This image took too long to decode and was skipped - it may be corrupted.")),
      DECODE_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([decodeFile(file), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function decodeFile(file: File): Promise<ImageBitmap> {
  try {
    return await capBitmap(await createImageBitmap(file, { imageOrientation: "from-image" }));
  } catch {
    // Native decode failed. For HEIC this is the expected non-Apple path; for a
    // non-HEIC file it may be an unlabeled/mis-typed HEIC. Either way, try the
    // libheif build once before giving up.
    try {
      return await capBitmap(await decodeHeic(file));
    } catch {
      throw new Error("This image file appears to be corrupted or in a format the browser can't read.");
    }
  }
}

/** Longest-edge dimension we render/annotate at - keeps canvases and PNGs light. */
export const MAX_RENDER_SIZE = 1280;

export function fitScale(width: number, height: number, max = MAX_RENDER_SIZE): number {
  return Math.min(1, max / Math.max(width, height));
}
