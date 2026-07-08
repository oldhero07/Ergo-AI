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
import { configureDeterministic, readDeterministicPref } from "@/lib/assetBase";
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
  readonly kind: "worker" | "inline" | "remote";
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
/** Server-inference backend (Phase-2 opt-in via localStorage "ergo-remote"="1"):
 * pose keypoints come from the pinned CPU model on the inference server, so the
 * same photo scores identically on every device. Scoring stays client-side. */
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

function remoteEnabled(): boolean {
  try {
    return localStorage.getItem("ergo-remote") === "1";
  } catch {
    return false;
  }
}

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
    if (remoteEnabled()) {
      pipeline = remotePipeline;
      return pipeline;
    }
    // Set the deterministic-mode flag once for the main-thread (inline) path;
    // the worker path forwards the same pref via its init message.
    configureDeterministic(readDeterministicPref());
    pipeline = workerCapable() ? new AutoPipeline() : inlinePipeline;
  }
  return pipeline;
}
