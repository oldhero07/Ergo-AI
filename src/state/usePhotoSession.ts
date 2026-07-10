import { useCallback, useEffect, useRef, useState } from "react";
import type { PoseAnalysis } from "@/lib/analysis";
import { getPipeline } from "@/lib/pipeline";
import {
  clearSession,
  loadSession,
  saveSession,
  shrinkToDataUrl,
  type SessionSnapshot,
} from "@/lib/sessionStore";
import { makeThumbUrl } from "@/lib/image";
import { getMethod } from "@/assessment/registry";
import type { PostureInput } from "@/assessment/types";
import type { AnalysisMode, UploadItem } from "@/types";
import type { ComputeGate } from "@/state/useComputeGate";
import type { AnalyzeStage } from "@/state/AppStateContext";

export type ResultMap = Record<string, PoseAnalysis>;

// One fixed batch cap for every device: inference runs server-side, so device
// memory no longer constrains how much a session can score.
export const MAX_BATCH = 30;

/** Revoke any blob: object URLs a result set holds. */
function revokeResultUrls(results: ResultMap): void {
  for (const r of Object.values(results)) {
    if (r.skeletonUrl?.startsWith("blob:")) URL.revokeObjectURL(r.skeletonUrl);
    if (r.originalImageUrl?.startsWith("blob:")) URL.revokeObjectURL(r.originalImageUrl);
  }
}

interface PhotoSessionDeps {
  gate: ComputeGate;
  stage: AnalyzeStage;
  setStage: (s: AnalyzeStage) => void;
  methodId: string;
  setMethodId: (id: string) => void;
  setMode: (m: AnalysisMode) => void;
}

/**
 * The photo-batch domain: upload queue, per-photo inference results, scoring
 * method, exclusions, and the persisted session snapshot (crash/refresh
 * recovery). Owns every blob URL it creates and revokes them on removal/reset.
 */
export function usePhotoSession({ gate, stage, setStage, methodId, setMethodId, setMode }: PhotoSessionDeps) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [results, setResults] = useState<ResultMap>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [restorable, setRestorable] = useState<SessionSnapshot | null>(null);
  // "Photo n of m" progress for the compute screen (upload + inference are
  // one server round-trip per photo, so per-photo is the honest unit).
  const [photoProgress, setPhotoProgress] = useState<{ done: number; total: number } | null>(null);
  // Cache of small per-item thumbs so snapshot re-saves (adjustments/method
  // switches) don't re-encode images every time.
  const snapshotThumbsRef = useRef<Map<string, string>>(new Map());
  // Ids of items currently in the queue - lets a late thumbnail result detect
  // that its item was removed and revoke the orphaned thumb URL.
  const liveIdsRef = useRef<Set<string>>(new Set());

  // Manual escape hatch: a photo the user judges mis-detected can be excluded
  // from the report/exports/batch mean while staying visible in the results
  // list.
  const [excludedIds, setExcludedIds] = useState<Set<string>>(() => new Set());
  const toggleExclude = useCallback((id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Offer to restore the last scored session (crash/refresh recovery).
  useEffect(() => {
    let alive = true;
    void loadSession().then((snap) => {
      if (alive && snap) setRestorable(snap);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Build a small grid thumbnail per queued photo (rendering 30 full-resolution
  // object URLs is what froze/crashed big drops). Failure is non-fatal: the raw
  // file URL still renders for any browser-readable image.
  const prepareItem = useCallback(async (id: string, file: File) => {
    const thumbUrl = await makeThumbUrl(file);
    if (!liveIdsRef.current.has(id)) {
      if (thumbUrl) URL.revokeObjectURL(thumbUrl);
      return;
    }
    const url = thumbUrl ?? URL.createObjectURL(file);
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, url, converting: false } : it)));
  }, []);

  const addFiles = useCallback(
    (files: File[]) => {
      // Accept only JPEG/PNG - the formats the inference server decodes - so a
      // drag-dropped WebP/GIF gets the same friendly early skip the picker's
      // accept attribute provides, instead of a server 415 after upload.
      const imgs = files.filter(
        (f) => /image\/(jpeg|png)/i.test(f.type) || /\.(jpe?g|png)$/i.test(f.name),
      );
      const skipped = files.length - imgs.length;
      if (!imgs.length) {
        setNotice(skipped > 0 ? `That file isn't a supported image. Upload a JPG or PNG.` : null);
        return;
      }

      const overallRoom = Math.max(0, MAX_BATCH - items.length);
      const toAdd = imgs.slice(0, overallRoom);
      const skippedOverall = imgs.length - toAdd.length;

      if (skippedOverall > 0) {
        setNotice(
          toAdd.length === 0
            ? `Caution: Only ${MAX_BATCH} photos allowed at once - please remove some to add more.`
            : `Caution: Only ${MAX_BATCH} photos allowed at once - added ${toAdd.length}, skipped ${skippedOverall}.`,
        );
      } else if (skipped > 0) {
        setNotice(
          `Added ${toAdd.length} photo${toAdd.length > 1 ? "s" : ""} - skipped ${skipped} non-image file${skipped > 1 ? "s" : ""}.`,
        );
      } else {
        setNotice(null);
      }
      if (!toAdd.length) return;
      const newItems = toAdd.map((f) => ({
        id: crypto.randomUUID(),
        file: f,
        url: "", // filled in once the preview thumb is ready (spinner meanwhile)
        converting: true,
      }));
      for (const it of newItems) liveIdsRef.current.add(it.id);
      setItems((prev) => [...prev, ...newItems]);
      for (const it of newItems) void prepareItem(it.id, it.file);
    },
    [items, prepareItem],
  );

  const removeItem = useCallback((id: string) => {
    setNotice(null);
    liveIdsRef.current.delete(id);
    setItems((prev) => {
      const it = prev.find((p) => p.id === id);
      if (it?.url) URL.revokeObjectURL(it.url);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const clearItems = useCallback(() => {
    setNotice(null);
    liveIdsRef.current.clear();
    setItems((prev) => {
      prev.forEach((p) => p.url && URL.revokeObjectURL(p.url));
      return [];
    });
  }, []);

  const useSample = useCallback(
    async (key: "office" | "warehouse" | "assembly") => {
      try {
        const filename =
          key === "office" ? "office-typing.jpg" : key === "warehouse" ? "warehouse-lifting.jpg" : "assembly-standing.jpg";
        const res = await fetch(`${import.meta.env.BASE_URL}samples/${filename}`);
        if (!res.ok) return;
        const blob = await res.blob();
        addFiles([new File([blob], filename, { type: blob.type || "image/jpeg" })]);
      } catch {
        /* sample not bundled - ignore */
      }
    },
    [addFiles],
  );

  // Block analysis until every queued photo has a preview thumbnail, so a
  // result card (or the saved-session thumbnail) never renders blank/broken.
  const preparing = items.some((it) => it.converting);

  const runAnalysis = useCallback(async () => {
    if (!items.length) return; // nothing queued - ignore stray clicks
    if (items.some((it) => it.converting)) return; // photos still preparing
    setStage("computing");
    gate.resetAnimation();
    const startedAt = performance.now();
    const out: ResultMap = {};

    setPhotoProgress({ done: 0, total: items.length });
    const work = (async () => {
      const pipeline = getPipeline();
      for (const [idx, it] of items.entries()) {
        setPhotoProgress({ done: idx, total: items.length });
        try {
          out[it.id] = await pipeline.analyzePhoto(it.file);
        } catch (e) {
          out[it.id] = {
            skeletonUrl: it.url,
            landmarks: [],
            worldLandmarks: [],
            width: 0,
            height: 0,
            detected: false,
            error: (e as Error).message,
          };
        }
      }
    })();

    await Promise.all([work, gate.makeFloor(startedAt)]);
    gate.releaseFloor();
    setPhotoProgress(null);
    setResults((prev) => {
      revokeResultUrls(prev);
      return out;
    });
    snapshotThumbsRef.current.clear();
    setStage("results");
  }, [items, gate, setStage]);

  // Persist a compact snapshot of the scored session (crash/refresh recovery).
  // Debounced so adjustment-panel tweaks don't hammer IndexedDB; thumbs are
  // encoded once per item and cached.
  useEffect(() => {
    if (stage !== "results" || !items.length) return;
    const timer = setTimeout(() => {
      void (async () => {
        const thumbs = snapshotThumbsRef.current;
        const snapItems = await Promise.all(
          items.map(async (it) => {
            const r = results[it.id];
            let thumb = thumbs.get(it.id);
            if (!thumb && r?.skeletonUrl) {
              thumb = (await shrinkToDataUrl(r.skeletonUrl)) ?? undefined;
              if (thumb) thumbs.set(it.id, thumb);
            }
            return {
              fileName: it.file.name,
              detected: r?.detected ?? false,
              error: r?.error,
              angles: r?.angles,
              input: r?.input,
              wristMeasured: r?.wristMeasured,
              measuredFlags: r?.measuredFlags,
              offProfile: r?.offProfile,
              modelVersion: r?.modelVersion,
              thumb,
            };
          }),
        );
        await saveSession({ savedAt: Date.now(), methodId, items: snapItems });
      })();
    }, 800);
    return () => clearTimeout(timer);
  }, [stage, items, results, methodId]);

  // Rebuild a results view from a persisted snapshot. Original photos are not
  // stored (privacy/quota), so images show the saved skeleton thumbnails.
  const restoreSession = useCallback(
    (snap: SessionSnapshot) => {
      const compute = getMethod(snap.methodId).compute;
      const restoredItems: UploadItem[] = [];
      const restoredResults: ResultMap = {};
      for (const s of snap.items) {
        const id = crypto.randomUUID();
        restoredItems.push({
          id,
          file: new File([], s.fileName, { type: "image/jpeg" }),
          url: s.thumb ?? "",
        });
        restoredResults[id] = {
          skeletonUrl: s.thumb ?? "",
          originalImageUrl: s.thumb,
          landmarks: [],
          worldLandmarks: [],
          width: 0,
          height: 0,
          detected: s.detected,
          error: s.error,
          angles: s.angles,
          wristMeasured: s.wristMeasured,
          measuredFlags: s.measuredFlags,
          offProfile: s.offProfile,
          modelVersion: s.modelVersion,
          input: s.input,
          assessment: s.input ? compute(s.input) : undefined,
        };
      }
      liveIdsRef.current = new Set(restoredItems.map((it) => it.id));
      setItems(restoredItems);
      setResults(restoredResults);
      setMethodId(snap.methodId);
      setMode("photo");
      setRestorable(null);
      snapshotThumbsRef.current.clear();
      for (const s of snap.items) {
        // Seed the thumb cache so re-saves reuse the stored thumbnails.
        const item = restoredItems[snap.items.indexOf(s)];
        if (s.thumb) snapshotThumbsRef.current.set(item.id, s.thumb);
      }
      setStage("results");
    },
    [setMethodId, setMode, setStage],
  );

  const dismissRestore = useCallback(() => {
    setRestorable(null);
    void clearSession();
  }, []);

  // Recompute live when the adjustments panel changes a non-visible factor,
  // using whichever method (RULA/REBA/OWAS) is currently selected.
  const updateInput = useCallback(
    (id: string, next: PostureInput) => {
      const compute = getMethod(methodId).compute;
      setResults((prev) => {
        const r = prev[id];
        if (!r) return prev;
        return { ...prev, [id]: { ...r, input: next, assessment: compute(next) } };
      });
    },
    [methodId],
  );

  // Switch assessment method: re-score every result from its (method-agnostic)
  // PostureInput. Inputs are preserved, so toggling back and forth is lossless.
  const switchMethod = useCallback(
    (id: string) => {
      setMethodId(id);
      const compute = getMethod(id).compute;
      setResults((prev) => {
        const next: ResultMap = {};
        for (const [key, r] of Object.entries(prev)) {
          next[key] = r.input ? { ...r, assessment: compute(r.input) } : r;
        }
        return next;
      });
    },
    [setMethodId],
  );

  /** Clean-slate teardown: clear photos + results, revoke blob URLs, drop the
   * persisted snapshot. This is what "Start over" does. */
  const clearPhotoSession = useCallback(() => {
    liveIdsRef.current.clear();
    setItems((prev) => {
      prev.forEach((p) => p.url && URL.revokeObjectURL(p.url));
      return [];
    });
    setResults((prev) => {
      revokeResultUrls(prev);
      return {};
    });
    setExcludedIds(new Set());
    snapshotThumbsRef.current.clear();
    void clearSession();
    setRestorable(null);
    setNotice(null);
  }, []);

  // Photos counted in the report/batch (user-excluded ones dropped), and the
  // worst scored photo among them (for the "worst posture" badge).
  const includedItems = items.filter((it) => !excludedIds.has(it.id));
  const worstIncludedId = includedItems
    .filter((it) => results[it.id]?.assessment)
    .sort((a, b) => (results[b.id]!.assessment!.grandScore ?? 0) - (results[a.id]!.assessment!.grandScore ?? 0))[0]?.id;

  const hasResults = Object.keys(results).length > 0;

  return {
    items,
    results,
    notice,
    restorable,
    photoProgress,
    excludedIds,
    includedItems,
    worstIncludedId,
    hasResults,
    preparing,
    addFiles,
    removeItem,
    clearItems,
    useSample,
    runAnalysis,
    restoreSession,
    dismissRestore,
    updateInput,
    switchMethod,
    toggleExclude,
    clearPhotoSession,
  };
}

export type PhotoSession = ReturnType<typeof usePhotoSession>;
