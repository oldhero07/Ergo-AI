/**
 * The analysis pipeline: pose keypoints come from the pinned CPU model on the
 * inference server (see server/), so the same photo scores identically on
 * every device; angle derivation and RULA/REBA/OWAS scoring stay client-side.
 * Modules are loaded lazily so the landing page never pays for them.
 */
import type { PoseAnalysis, VideoAnalysis, VideoProgress, AnalyzeVideoOptions } from "@/lib/analysis";

export interface AnalysisPipeline {
  readonly kind: "remote";
  analyzePhoto(file: File): Promise<PoseAnalysis>;
  analyzeVideo(
    file: File,
    onProgress?: VideoProgress,
    signal?: AbortSignal,
    options?: AnalyzeVideoOptions,
  ): Promise<VideoAnalysis>;
  /** Best-effort server wake so the first Analyze isn't also the cold start. */
  warmUp(): Promise<void>;
}

const remotePipeline: AnalysisPipeline = {
  kind: "remote",
  async analyzePhoto(file: File) {
    const { analyzePhotoRemote } = await import("@/lib/remoteAnalyze");
    return analyzePhotoRemote(file);
  },
  async analyzeVideo(file, onProgress, signal, options) {
    const { analyzeVideoRemote } = await import("@/lib/remoteAnalyze");
    return analyzeVideoRemote(file, onProgress, signal, options);
  },
  async warmUp() {
    try {
      const { warmUpRemote } = await import("@/lib/remoteAnalyze");
      await warmUpRemote();
    } catch {
      /* warmup is best-effort */
    }
  },
};

export function getPipeline(): AnalysisPipeline {
  return remotePipeline;
}
