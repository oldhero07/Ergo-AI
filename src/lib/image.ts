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
    throw new Error("This image file appears to be corrupted or in a format the browser can't read.");
  }
}

/** Longest-edge dimension we render/annotate at - keeps canvases and PNGs light. */
export const MAX_RENDER_SIZE = 1280;

export function fitScale(width: number, height: number, max = MAX_RENDER_SIZE): number {
  return Math.min(1, max / Math.max(width, height));
}

/**
 * Small grid-preview thumbnail as a blob object URL (rendering dozens of
 * full-resolution object URLs is what used to freeze big drops). Returns null
 * on any failure - the caller falls back to the raw file URL.
 */
export async function makeThumbUrl(file: File, maxEdge = 320, quality = 0.75): Promise<string | null> {
  try {
    const bitmap = await loadBitmap(file);
    try {
      const scale = fitScale(bitmap.width, bitmap.height, maxEdge);
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0, w, h);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      return blob ? URL.createObjectURL(blob) : null;
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}
