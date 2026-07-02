/**
 * Pipeline selection: worker-backed on capable browsers, with automatic,
 * permanent downgrade to the proven main-thread path if the worker can't
 * spawn, init, or crashes (WorkerUnavailableError). Ordinary analysis errors
 * (bad image, model download failure) propagate unchanged on either backend.
 *
 * Set localStorage "ergo-force-inline" = "1" to force the main-thread path
 * (used to verify the fallback in testing).
 */
import type { ModelProgress } from "@/lib/poseLandmarker";
import {
  analyzePhoto as inlineAnalyzePhoto,
  analyzeVideo as inlineAnalyzeVideo,
  type AnalyzeVideoOptions,
  type PoseAnalysis,
  type VideoAnalysis,
  type VideoProgress,
} from "@/lib/analyze";
import { WorkerPipeline, WorkerUnavailableError } from "@/lib/pipeline/workerPipeline";

export interface AnalysisPipeline {
  readonly kind: "worker" | "inline";
  analyzePhoto(file: File, onModelProgress?: ModelProgress): Promise<PoseAnalysis>;
  analyzeVideo(
    file: File,
    onProgress?: VideoProgress,
    signal?: AbortSignal,
    options?: AnalyzeVideoOptions,
  ): Promise<VideoAnalysis>;
  /** Best-effort model preload (download + init) before any image arrives. */
  warmUp(onModelProgress?: ModelProgress): Promise<void>;
}

const inlinePipeline: AnalysisPipeline = {
  kind: "inline",
  analyzePhoto: inlineAnalyzePhoto,
  analyzeVideo: inlineAnalyzeVideo,
  async warmUp(onModelProgress?: ModelProgress) {
    try {
      const { getPoseLandmarker } = await import("@/lib/poseLandmarker");
      await getPoseLandmarker(onModelProgress);
      const { getHandLandmarker } = await import("@/lib/handLandmarker");
      await getHandLandmarker();
    } catch {
      /* warmup is best-effort */
    }
  },
};

function workerCapable(): boolean {
  try {
    if (localStorage.getItem("ergo-force-inline") === "1") return false;
  } catch {
    /* private mode etc. - ignore */
  }
  return (
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined" &&
    typeof createImageBitmap !== "undefined"
  );
}

/** Wraps the worker backend and silently, permanently downgrades to inline the
 * first time worker infrastructure fails - users always get a result. */
class AutoPipeline implements AnalysisPipeline {
  private worker: WorkerPipeline | null = new WorkerPipeline();

  get kind(): "worker" | "inline" {
    return this.worker ? "worker" : "inline";
  }

  private downgrade(): void {
    this.worker = null;
  }

  async analyzePhoto(file: File, onModelProgress?: ModelProgress): Promise<PoseAnalysis> {
    if (this.worker) {
      try {
        return await this.worker.analyzePhoto(file, onModelProgress);
      } catch (err) {
        if (!(err instanceof WorkerUnavailableError)) throw err;
        this.downgrade();
      }
    }
    return inlinePipeline.analyzePhoto(file, onModelProgress);
  }

  async analyzeVideo(
    file: File,
    onProgress?: VideoProgress,
    signal?: AbortSignal,
    options?: AnalyzeVideoOptions,
  ): Promise<VideoAnalysis> {
    if (this.worker) {
      try {
        return await this.worker.analyzeVideo(file, onProgress, signal, options);
      } catch (err) {
        if (!(err instanceof WorkerUnavailableError)) throw err;
        this.downgrade();
      }
    }
    return inlinePipeline.analyzeVideo(file, onProgress, signal, options);
  }

  async warmUp(onModelProgress?: ModelProgress): Promise<void> {
    if (this.worker) {
      await this.worker.warmUp(onModelProgress);
      return;
    }
    await inlinePipeline.warmUp(onModelProgress);
  }
}

let pipeline: AnalysisPipeline | null = null;

export function getPipeline(): AnalysisPipeline {
  if (!pipeline) {
    pipeline = workerCapable() ? new AutoPipeline() : inlinePipeline;
  }
  return pipeline;
}
