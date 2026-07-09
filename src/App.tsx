import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw, History, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Uploader } from "@/components/Uploader";
import { Landing } from "@/components/Landing";
import { ComputeAnimation } from "@/components/ComputeAnimation";
import { COMPUTE_LOOP_MS } from "@/hooks/useComputeTimeline";
import { useServerHealth } from "@/hooks/useServerHealth";
import { Button } from "@/components/ui/button";
import type { VideoAnalysis } from "@/lib/analysis";
import { getPipeline } from "@/lib/pipeline";
import {
  clearSession,
  loadSession,
  saveSession,
  shrinkToDataUrl,
  type SessionSnapshot,
} from "@/lib/sessionStore";
import { makeThumbUrl } from "@/lib/image";
import { validateVideoFile } from "@/lib/videoFile";
import { VideoResults } from "@/components/VideoResults";
import { DEFAULT_VIDEO_SETTINGS, type VideoSettingsValues } from "@/components/VideoSettings";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PhaseTransition } from "@/components/PhaseTransition";
import type { AnalysisMode } from "@/types";
import { exportPdfReport } from "@/lib/pdf";
import { getMethod } from "@/assessment/registry";
import { NioshCalculator } from "@/components/NioshCalculator";
import { downloadText, exportJson, photoCsv } from "@/lib/exportData";
import type { PostureInput } from "@/assessment/types";
import type { UploadItem } from "@/types";
import { ReportDetails } from "@/components/ReportDetails";
import { PhotoResultsScreen, type ResultMap } from "@/screens/PhotoResultsScreen";

type Phase = "landing" | "idle" | "computing" | "results" | "video" | "niosh";

// One fixed batch cap for every device: inference runs server-side, so device
// memory no longer constrains how much a session can score.
const MAX_BATCH = 30;

/** Revoke any blob: object URLs a result set holds. */
function revokeResultUrls(results: ResultMap): void {
  for (const r of Object.values(results)) {
    if (r.skeletonUrl?.startsWith("blob:")) URL.revokeObjectURL(r.skeletonUrl);
    if (r.originalImageUrl?.startsWith("blob:")) URL.revokeObjectURL(r.originalImageUrl);
  }
}

/** Revoke per-frame thumbnail object URLs of a video analysis. */
function revokeVideoUrls(analysis: VideoAnalysis | null): void {
  if (!analysis) return;
  for (const f of analysis.frames) {
    if (f.thumbUrl?.startsWith("blob:")) URL.revokeObjectURL(f.thumbUrl);
  }
}

export default function App() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [phase, setPhase] = useState<Phase>("landing");
  const [results, setResults] = useState<ResultMap>({});
  const [methodId, setMethodId] = useState<string>("rula");
  const [mode, setMode] = useState<AnalysisMode>("photo");
  const [reportMeta, setReportMeta] = useState<{
    assessor: string;
    organization: string;
    subject: string;
    logoDataUrl?: string;
  }>({ assessor: "", organization: "", subject: "" });
  const [showAnimation, setShowAnimation] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string>("video");
  const [videoAnalysis, setVideoAnalysis] = useState<VideoAnalysis | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const [videoSettings, setVideoSettings] = useState<VideoSettingsValues>(DEFAULT_VIDEO_SETTINGS);
  const skipResolveRef = useRef<(() => void) | null>(null);
  const videoAbortRef = useRef<AbortController | null>(null);
  const [restorable, setRestorable] = useState<SessionSnapshot | null>(null);
  // Wakes the inference server on load and drives the warming/unreachable
  // banner. Informational only - analysis is never gated on it (a cold host
  // holds the first request until it's up).
  const { health: serverHealth, retry: retryServer } = useServerHealth();
  // "Photo n of m" progress for the compute screen (upload + inference are
  // now one server round-trip per photo, so per-photo is the honest unit).
  const [photoProgress, setPhotoProgress] = useState<{ done: number; total: number } | null>(null);
  // Cache of small per-item thumbs so snapshot re-saves (adjustments/method
  // switches) don't re-encode images every time.
  const snapshotThumbsRef = useRef<Map<string, string>>(new Map());
  // Ids of items currently in the queue - lets a late thumbnail result detect
  // that its item was removed and revoke the orphaned thumb URL.
  const liveIdsRef = useRef<Set<string>>(new Set());

  // Nudge the inference server awake the moment the user reaches the uploader,
  // so the first Analyze click doesn't also pay the cold start.
  const warmedRef = useRef(false);
  useEffect(() => {
    if (phase !== "idle" || warmedRef.current) return;
    warmedRef.current = true;
    void getPipeline().warmUp();
  }, [phase]);

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
        // Everything dropped/selected was a non-image (PDF, video, doc, …).
        setNotice(
          skipped > 0
            ? `That file isn't a supported image. Upload a JPG or PNG.`
            : null,
        );
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
        setNotice(`Added ${toAdd.length} photo${toAdd.length > 1 ? "s" : ""} - skipped ${skipped} non-image file${skipped > 1 ? "s" : ""}.`);
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

  // Manual escape hatch: a photo the user judges mis-detected can be excluded from
  // the report/exports/batch mean while staying visible in the results list. The
  // auto-gate rejects clear hallucinations, but out-of-envelope shots (top-down,
  // partial body) can still slip through - this lets the user drop them.
  const [excludedIds, setExcludedIds] = useState<Set<string>>(() => new Set());
  const toggleExclude = useCallback((id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
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

  const useSample = useCallback(async (key: "office" | "warehouse" | "assembly") => {
    try {
      const filename =
        key === "office"
          ? "office-typing.jpg"
          : key === "warehouse"
            ? "warehouse-lifting.jpg"
            : "assembly-standing.jpg";
      const displayLabel =
        key === "office"
          ? "office-typing.jpg"
          : key === "warehouse"
            ? "warehouse-lifting.jpg"
            : "assembly-standing.jpg";
      const res = await fetch(`${import.meta.env.BASE_URL}samples/${filename}`);
      if (!res.ok) return;
      const blob = await res.blob();
      addFiles([new File([blob], displayLabel, { type: blob.type || "image/jpeg" })]);
    } catch {
      /* sample not bundled - ignore */
    }
  }, [addFiles]);

  // Floor so the compute animation always gets a full cycle on screen, even when
  // detection resolves near-instantly (warm model, small/cached photo). Derived
  // from the real GSAP timeline duration so it can't drift out of sync with it.
  const MIN_COMPUTE_MS = Math.max(4500, COMPUTE_LOOP_MS);

  // Block analysis until every queued photo has a preview thumbnail, so a
  // result card (or the saved-session thumbnail) never renders blank/broken.
  const preparing = items.some((it) => it.converting);

  const runAnalysis = useCallback(async () => {
    if (!items.length) return; // nothing queued - ignore stray clicks
    if (items.some((it) => it.converting)) return; // photos still preparing
    setPhase("computing");
    setShowAnimation(true);
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

    const floor = new Promise<void>((resolve) => {
      const remaining = MIN_COMPUTE_MS - (performance.now() - startedAt);
      const timer = setTimeout(resolve, Math.max(0, remaining));
      skipResolveRef.current = () => {
        clearTimeout(timer);
        resolve();
      };
    });

    await Promise.all([work, floor]);
    skipResolveRef.current = null;
    setPhotoProgress(null);
    setResults((prev) => {
      revokeResultUrls(prev);
      return out;
    });
    snapshotThumbsRef.current.clear();
    setPhase("results");
  }, [items]);

  // Persist a compact snapshot of the scored session (crash/refresh recovery).
  // Debounced so adjustment-panel tweaks don't hammer IndexedDB; thumbs are
  // encoded once per item and cached.
  useEffect(() => {
    if (phase !== "results" || !items.length) return;
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
  }, [phase, items, results, methodId]);

  // Rebuild a results view from a persisted snapshot. Original photos are not
  // stored (privacy/quota), so images show the saved skeleton thumbnails.
  const restoreSession = useCallback((snap: SessionSnapshot) => {
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
    setPhase("results");
  }, []);

  // Video path: decode → sample frames → pose → per-frame scores → timeline view.
  // Runs as its own flow (one clip at a time), separate from the photo batch.
  const runVideoAnalysis = useCallback(
    async (file: File) => {
      // Gate the file before any object URL or decoder is created (size/type cap).
      const check = validateVideoFile(file);
      if (!check.ok) {
        setVideoError(check.message);
        setPhase("idle");
        return;
      }

      // Concurrency guard: cancel any analysis already in flight before starting.
      videoAbortRef.current?.abort();
      const controller = new AbortController();
      videoAbortRef.current = controller;

      setVideoError(null);
      setVideoAnalysis(null);
      setVideoName(file.name);
      setVideoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      setPhase("computing");
      setShowAnimation(true);
      setVideoProgress(0);
      const startedAt = performance.now();

      let analysis: VideoAnalysis | null = null;
      let err: string | null = null;
      let aborted = false;
      const work = (async () => {
        try {
          analysis = await getPipeline().analyzeVideo(
            file,
            (_stage, done, total) => {
              setVideoProgress(total > 0 ? Math.min(100, Math.round((done / total) * 100)) : null);
            },
            controller.signal,
            { fps: videoSettings.fps, maxFrames: videoSettings.durationSec * videoSettings.fps, maxEdge: videoSettings.maxEdge, maxDurationSec: videoSettings.durationSec },
          );
        } catch (e) {
          if ((e as Error).name === "AbortError" || controller.signal.aborted) aborted = true;
          else err = (e as Error).message || "Could not analyze the video.";
        }
      })();

      const floor = new Promise<void>((resolve) => {
        const remaining = MIN_COMPUTE_MS - (performance.now() - startedAt);
        const timer = setTimeout(resolve, Math.max(0, remaining));
        skipResolveRef.current = () => {
          clearTimeout(timer);
          resolve();
        };
      });

      await Promise.all([work, floor]);
      skipResolveRef.current = null;
      // A newer run (or a cancel) superseded this one - let that owner drive state.
      if (videoAbortRef.current !== controller) return;
      videoAbortRef.current = null;
      setVideoProgress(null);
      if (aborted) {
        setPhase("idle"); // cancelled: quietly return to the uploader, no error
      } else if (err || !analysis) {
        setVideoError(err ?? "Could not analyze the video.");
        setPhase("idle");
      } else {
        setVideoAnalysis(analysis);
        setPhase("video");
      }
    },
    [MIN_COMPUTE_MS, videoSettings],
  );

  // Cancel an in-flight video analysis and return to the uploader.
  const cancelVideoAnalysis = useCallback(() => {
    videoAbortRef.current?.abort();
    videoAbortRef.current = null;
    skipResolveRef.current?.();
    setVideoProgress(null);
    setPhase("idle");
  }, []);

  // "Skip" drops the decorative floor and the animation itself (falls back to a
  // plain spinner) - it can't skip the real detection work still in flight.
  const skipAnimation = useCallback(() => {
    setShowAnimation(false);
    skipResolveRef.current?.();
  }, []);

  // Tear down any video session: abort an in-flight run and revoke its object URL.
  const clearVideo = useCallback(() => {
    videoAbortRef.current?.abort();
    videoAbortRef.current = null;
    setVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setVideoAnalysis((prev) => {
      revokeVideoUrls(prev);
      return null;
    });
    setVideoError(null);
    setVideoProgress(null);
  }, []);

  // Switch between the photo and video entry flows: change mode and clear the
  // current queue / any in-flight video so the two flows never bleed together.
  const switchAnalysisMode = useCallback(
    (m: AnalysisMode) => {
      setMode(m);
      setNotice(null);
      setVideoError(null);
      clearItems();
      clearVideo();
    },
    [clearItems, clearVideo],
  );

  // Full reset to a clean slate: clear photos + results, revoke blob URLs (so
  // memory isn't leaked across runs), and drop any export/animation flags. This
  // is what "Start over" does - each session begins fresh, nothing lingers.
  const reset = useCallback(() => {
    liveIdsRef.current.clear();
    setItems((prev) => {
      prev.forEach((p) => p.url && URL.revokeObjectURL(p.url));
      return [];
    });
    setResults((prev) => {
      revokeResultUrls(prev);
      return {};
    });
    snapshotThumbsRef.current.clear();
    void clearSession();
    setRestorable(null);
    setExportError(null);
    setExporting(false);
    setShowAnimation(true);
    setNotice(null);
    clearVideo();
    setPhase("idle");
  }, [clearVideo]);

  // Back to the landing page: same clean-slate teardown as `reset`, but lands on
  // the intro screen rather than the uploader. Used by the header logo/title.
  const goHome = useCallback(() => {
    liveIdsRef.current.clear();
    setItems((prev) => {
      prev.forEach((p) => p.url && URL.revokeObjectURL(p.url));
      return [];
    });
    setResults((prev) => {
      revokeResultUrls(prev);
      return {};
    });
    setExportError(null);
    setExporting(false);
    setShowAnimation(true);
    setNotice(null);
    clearVideo();
    // The snapshot survives "go home" (unlike "start over"), so re-offer it.
    void loadSession().then(setRestorable);
    setPhase("landing");
  }, [clearVideo]);

  // Recompute live when the adjustments panel changes a non-visible factor,
  // using whichever method (RULA/REBA) is currently selected.
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
  const switchMethod = useCallback((id: string) => {
    setMethodId(id);
    const compute = getMethod(id).compute;
    setResults((prev) => {
      const next: ResultMap = {};
      for (const [key, r] of Object.entries(prev)) {
        next[key] = r.input ? { ...r, assessment: compute(r.input) } : r;
      }
      return next;
    });
  }, []);

  // Open the NIOSH lifting calculator. (Geometry prefill from pose retired
  // with the 3D landmarks - lift distances in cm need metric data a single
  // 2D photo cannot honestly provide; the assessor measures and enters them.)
  const openNiosh = useCallback(() => {
    setPhase("niosh");
  }, []);

  const closeNiosh = useCallback(() => {
    setPhase(Object.keys(results).length ? "results" : "landing");
  }, [results]);

  // Raw data exports for spreadsheets / downstream analysis.
  const exportCsv = useCallback(() => {
    const rows = items
      .filter((it) => results[it.id] && !excludedIds.has(it.id))
      .map((it) => ({ fileName: it.file.name, analysis: results[it.id] }));
    if (!rows.length) return;
    downloadText(`ergo-ai-${methodId}-data.csv`, "text/csv", photoCsv(rows, methodId));
  }, [items, results, methodId, excludedIds]);

  const exportJsonFile = useCallback(() => {
    const included = items.filter((it) => results[it.id] && !excludedIds.has(it.id));
    const payload = {
      app: "ergo-ai",
      generatedAt: new Date().toISOString(),
      method: methodId,
      // Exact pose-model build for provenance: any future score comparison is
      // attributable to a specific model, not a mystery.
      modelVersion: included.map((it) => results[it.id].modelVersion).find(Boolean) ?? null,
      meta: { assessor: reportMeta.assessor, organization: reportMeta.organization, subject: reportMeta.subject },
      items: included.map((it) => {
        const r = results[it.id];
        return {
          fileName: it.file.name,
          detected: r.detected,
          error: r.error,
          angles: r.angles,
          wristMeasured: r.wristMeasured,
          measuredFlags: r.measuredFlags,
          offProfile: r.offProfile,
          input: r.input,
          assessment: r.assessment,
        };
      }),
    };
    if (!payload.items.length) return;
    downloadText(`ergo-ai-${methodId}-data.json`, "application/json", exportJson(payload));
  }, [items, results, methodId, reportMeta, excludedIds]);

  const exportPdf = useCallback(async () => {
    setExporting(true);
    setExportError(null);
    try {
      const reportItems = items
        .filter((it) => results[it.id] && !excludedIds.has(it.id))
        .map((it) => ({ fileName: it.file.name, originalUrl: it.url, analysis: results[it.id] }));
      await exportPdfReport(reportItems, reportMeta);
    } catch (e) {
      setExportError((e as Error).message || "Could not generate the PDF.");
    } finally {
      setExporting(false);
    }
  }, [items, results, reportMeta, excludedIds]);

  // Photos counted in the report/batch (user-excluded ones dropped), and the worst
  // scored photo among them (for the "worst posture" badge).
  const includedItems = items.filter((it) => !excludedIds.has(it.id));
  const worstIncludedId = includedItems
    .filter((it) => results[it.id]?.assessment)
    .sort((a, b) => (results[b.id]!.assessment!.grandScore ?? 0) - (results[a.id]!.assessment!.grandScore ?? 0))[0]?.id;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="container flex items-center justify-between py-3.5">
          <button
            type="button"
            onClick={goHome}
            className="flex items-center gap-2.5 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Ergo AI - home"
          >
            <Logo className="h-9 w-9 shrink-0" />
            <div>
              <h1 className="text-lg font-semibold leading-none tracking-tight">Ergo AI</h1>
              <p className="text-xs text-muted-foreground">RULA &amp; REBA ergonomic assessment</p>
            </div>
          </button>
          <ThemeToggle />
        </div>
      </header>

      <main className="container py-10">
        <PhaseTransition phaseKey={phase}>
        {phase === "landing" && (
          <>
            {restorable && (
              <div className="mx-auto mb-6 flex max-w-3xl items-center justify-between gap-3 rounded-xl border bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-2.5 text-sm">
                  <History className="h-4 w-4 shrink-0 text-primary" />
                  <span>
                    Restore your last session? {restorable.items.length} photo
                    {restorable.items.length > 1 ? "s" : ""} scored{" "}
                    {new Date(restorable.savedAt).toLocaleString()}.
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button size="sm" onClick={() => restoreSession(restorable)}>
                    Restore
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Dismiss restore"
                    onClick={() => {
                      setRestorable(null);
                      void clearSession();
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            <Landing
              onStart={(m) => {
                setMode(m);
                setPhase("idle");
              }}
            />
            <p className="mt-8 text-center text-sm text-muted-foreground">
              Manual lifting task instead?{" "}
              <button
                type="button"
                onClick={openNiosh}
                className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Open the NIOSH lifting calculator →
              </button>
            </p>
          </>
        )}

        {phase === "niosh" && (
          <div className="animate-in fade-in duration-500">
            <NioshCalculator onBack={closeNiosh} reportMeta={reportMeta} />
          </div>
        )}

        {phase === "idle" && (
          <div>
            <Uploader
              mode={mode}
              onSwitchMode={switchAnalysisMode}
              items={items}
              onAddFiles={addFiles}
              onVideo={runVideoAnalysis}
              onRemove={removeItem}
              onClear={clearItems}
              onAnalyze={runAnalysis}
              onUseSample={useSample}
              videoSettings={videoSettings}
              onVideoSettingsChange={setVideoSettings}
              notice={notice}
              maxBatch={MAX_BATCH}
              preparing={preparing}
            />
            {videoError && (
              <p className="mx-auto mt-4 max-w-3xl rounded-xl bg-red-50 px-4 py-2 text-center text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">
                Could not analyze the video: {videoError}
              </p>
            )}
            {serverHealth === "warming" && (
              <p className="hud-readout mx-auto mt-4 flex max-w-3xl items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                Waking the analysis engine - a first visit can take a couple of minutes. You can queue photos meanwhile.
              </p>
            )}
            {serverHealth === "unreachable" && (
              <p className="mx-auto mt-4 flex max-w-3xl items-center justify-center gap-3 rounded-xl bg-amber-50 px-4 py-2 text-center text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                The analysis server can't be reached - check your connection.
                <Button size="sm" variant="outline" onClick={retryServer}>
                  Retry
                </Button>
              </p>
            )}
            <p className="mx-auto mt-6 max-w-lg text-center text-sm text-muted-foreground">
              {mode === "video"
                ? "Tip: a short, steady side-view clip of the working posture reads best."
                : "Tip: a clear, full-body side view of the working posture reads best."}
            </p>
          </div>
        )}

        {phase === "computing" && (
          <div className="animate-in fade-in duration-500">
            {showAnimation ? (
              <ComputeAnimation
                note={
                  serverHealth === "warming"
                    ? "Waking the analysis server - a first visit can take a couple of minutes. Your photos are queued and will be scored as soon as it's up."
                    : videoProgress !== null
                      ? `Analyzing video - ${videoProgress}% (sampling frames)`
                      : photoProgress && photoProgress.total > 1
                        ? `Analyzing photo ${Math.min(photoProgress.done + 1, photoProgress.total)} of ${photoProgress.total}`
                        : undefined
                }
                onSkip={mode === "video" ? undefined : skipAnimation}
              />
            ) : (
              <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  {serverHealth === "warming"
                    ? "Waking the analysis server - this can take a couple of minutes on a first visit…"
                    : videoProgress !== null
                      ? `Analyzing video - ${videoProgress}%`
                      : photoProgress && photoProgress.total > 1
                        ? `Analyzing photo ${Math.min(photoProgress.done + 1, photoProgress.total)} of ${photoProgress.total}`
                        : "Still working…"}
                </p>
              </div>
            )}
            {videoProgress !== null && (
              <div className="mt-6 flex justify-center">
                <Button variant="outline" onClick={cancelVideoAnalysis}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}

        {phase === "video" && videoUrl && videoAnalysis && (
          <div className="animate-in fade-in duration-500">
            <div className="mx-auto mb-4 flex w-full max-w-4xl justify-end">
              <Button variant="outline" onClick={reset}>
                <RotateCcw className="h-4 w-4" /> Start over
              </Button>
            </div>
            <div className="mx-auto w-full max-w-4xl">
              <ReportDetails meta={reportMeta} onChange={setReportMeta} />
            </div>
            <VideoResults
              videoUrl={videoUrl}
              fileName={videoName}
              analysis={videoAnalysis}
              methodId={methodId}
              onMethodChange={setMethodId}
              reportMeta={reportMeta}
            />
          </div>
        )}

        {phase === "results" && (
          <PhotoResultsScreen
            items={items}
            results={results}
            methodId={methodId}
            excludedIds={excludedIds}
            includedItems={includedItems}
            worstIncludedId={worstIncludedId}
            reportMeta={reportMeta}
            onReportMetaChange={setReportMeta}
            exporting={exporting}
            exportError={exportError}
            onSwitchMethod={switchMethod}
            onOpenNiosh={openNiosh}
            onExportPdf={() => void exportPdf()}
            onExportCsv={exportCsv}
            onExportJson={exportJsonFile}
            onReset={reset}
            onToggleExclude={toggleExclude}
            onUpdateInput={updateInput}
          />
        )}
        </PhaseTransition>
      </main>

      <footer className="border-t">
        <div className="container flex flex-col items-center gap-1 py-6 text-center text-xs text-muted-foreground">
          <p>
            Photos are analyzed in memory on our inference server and immediately discarded - never
            stored, never used for training. Scores, reports and adjustments stay in your browser.
          </p>
          {phase !== "landing" && (
          <p>
            RULA and REBA scores are a lower-bound estimate from a single camera view, not a substitute
            for a trained assessor.
          </p>
          )}
        </div>
      </footer>
    </div>
  );
}
