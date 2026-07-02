/**
 * Crash/refresh recovery: after a photo batch lands, a compact snapshot of the
 * results (angles, inputs, scores, small thumbnails - never the original
 * photos, for privacy and quota) is persisted to IndexedDB. If the tab dies,
 * the next visit offers a one-click restore of the scored session.
 *
 * Video sessions are not snapshotted in v1: the results view is built around
 * the (non-persistable) video blob URL.
 */
import { get, set, del } from "idb-keyval";
import type { AngleSet } from "@/lib/angles";
import type { PostureInput } from "@/assessment/types";

const KEY = "ergo-session-v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // offer restores for 24h
const THUMB_EDGE = 240;

export interface SnapshotItem {
  fileName: string;
  detected: boolean;
  error?: string;
  angles?: AngleSet;
  input?: PostureInput;
  wristMeasured?: boolean;
  /** Small JPEG data URL of the skeleton render (restore preview). */
  thumb?: string;
}

export interface SessionSnapshot {
  savedAt: number;
  methodId: string;
  items: SnapshotItem[];
}

/** Downscale any image URL (data/blob) to a small JPEG data URL; null on failure.
 * Uses fetch + createImageBitmap rather than an Image element - `img.decode()`
 * can hang indefinitely on blob URLs in some browsers. */
export async function shrinkToDataUrl(url: string, maxEdge = THUMB_EDGE): Promise<string | null> {
  if (!url) return null;
  let bitmap: ImageBitmap | null = null;
  try {
    const blob = await (await fetch(url)).blob();
    bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}

/** Persist a snapshot; best-effort and never throws (quota, private mode…). */
export async function saveSession(snapshot: SessionSnapshot): Promise<void> {
  try {
    await set(KEY, snapshot);
  } catch {
    /* best-effort */
  }
}

/** Load a restorable snapshot, or null when absent/stale/unreadable. */
export async function loadSession(): Promise<SessionSnapshot | null> {
  try {
    const snap = (await get(KEY)) as SessionSnapshot | undefined;
    if (!snap || !Array.isArray(snap.items) || !snap.items.length) return null;
    if (Date.now() - snap.savedAt > MAX_AGE_MS) {
      void del(KEY);
      return null;
    }
    return snap;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await del(KEY);
  } catch {
    /* best-effort */
  }
}
