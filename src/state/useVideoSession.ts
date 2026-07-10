import { useCallback, useRef, useState } from "react";
import type { VideoAnalysis } from "@/lib/analysis";
import { getPipeline } from "@/lib/pipeline";
import { validateVideoFile } from "@/lib/videoFile";
import { DEFAULT_VIDEO_SETTINGS, type VideoSettingsValues } from "@/components/VideoSettings";
import type { ComputeGate } from "@/state/useComputeGate";
import type { AnalyzeStage } from "@/state/AppStateContext";

/** Revoke per-frame thumbnail object URLs of a video analysis. */
function revokeVideoUrls(analysis: VideoAnalysis | null): void {
  if (!analysis) return;
  for (const f of analysis.frames) {
    if (f.thumbUrl?.startsWith("blob:")) URL.revokeObjectURL(f.thumbUrl);
  }
}

interface VideoSessionDeps {
  gate: ComputeGate;
  setStage: (s: AnalyzeStage) => void;
}

/**
 * The video domain: one clip at a time, decoded and frame-sampled through the
 * server pipeline. Owns the clip object URL, the per-frame thumb URLs, and the
 * abort controller for the in-flight run.
 */
export function useVideoSession({ gate, setStage }: VideoSessionDeps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string>("video");
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [settings, setSettings] = useState<VideoSettingsValues>(DEFAULT_VIDEO_SETTINGS);
  const abortRef = useRef<AbortController | null>(null);

  // Video path: decode -> sample frames -> pose -> per-frame scores -> timeline
  // view. Runs as its own flow (one clip at a time), separate from photos.
  const runVideoAnalysis = useCallback(
    async (file: File) => {
      // Gate the file before any object URL or decoder is created (size/type cap).
      const check = validateVideoFile(file);
      if (!check.ok) {
        setError(check.message);
        setStage("idle");
        return;
      }

      // Concurrency guard: cancel any analysis already in flight before starting.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setError(null);
      setAnalysis(null);
      setVideoName(file.name);
      setVideoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      setStage("computing");
      gate.resetAnimation();
      setProgress(0);
      const startedAt = performance.now();

      let result: VideoAnalysis | null = null;
      let err: string | null = null;
      let aborted = false;
      const work = (async () => {
        try {
          result = await getPipeline().analyzeVideo(
            file,
            (_stage, done, total) => {
              setProgress(total > 0 ? Math.min(100, Math.round((done / total) * 100)) : null);
            },
            controller.signal,
            {
              fps: settings.fps,
              maxFrames: settings.durationSec * settings.fps,
              maxEdge: settings.maxEdge,
              maxDurationSec: settings.durationSec,
            },
          );
        } catch (e) {
          if ((e as Error).name === "AbortError" || controller.signal.aborted) aborted = true;
          else err = (e as Error).message || "Could not analyze the video.";
        }
      })();

      await Promise.all([work, gate.makeFloor(startedAt)]);
      gate.releaseFloor();
      // A newer run (or a cancel) superseded this one - let that owner drive state.
      if (abortRef.current !== controller) return;
      abortRef.current = null;
      setProgress(null);
      if (aborted) {
        setStage("idle"); // cancelled: quietly return to the uploader, no error
      } else if (err || !result) {
        setError(err ?? "Could not analyze the video.");
        setStage("idle");
      } else {
        setAnalysis(result);
        setStage("video");
      }
    },
    [gate, setStage, settings],
  );

  // Cancel an in-flight video analysis and return to the uploader.
  const cancelVideoAnalysis = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    gate.skipFloor();
    setProgress(null);
    setStage("idle");
  }, [gate, setStage]);

  // Tear down any video session: abort an in-flight run and revoke its object URL.
  const clearVideo = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setAnalysis((prev) => {
      revokeVideoUrls(prev);
      return null;
    });
    setError(null);
    setProgress(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    videoUrl,
    videoName,
    analysis,
    error,
    progress,
    settings,
    setSettings,
    runVideoAnalysis,
    cancelVideoAnalysis,
    clearVideo,
    clearError,
  };
}

export type VideoSession = ReturnType<typeof useVideoSession>;
