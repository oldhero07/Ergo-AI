/**
 * Worker-backed analysis pipeline (the default on capable browsers). Decoding
 * stays on the UI thread (HTMLVideoElement/HEIC need the DOM); every expensive
 * step - MediaPipe inference, annotation, encoding - runs in the analysis
 * worker. Bitmaps are transferred (zero-copy); results come back as Blobs that
 * become object URLs here (lighter than the base64 data URLs the inline path
 * uses, which were an OOM contributor on large batches).
 */
import { loadBitmap } from "@/lib/image";
import { sampleVideoFrames } from "@/lib/videoFrames";
import { buildAutoInput, computeRula } from "@/assessment/rula/rula";
import { absoluteAssetBase } from "@/lib/assetBase";
import type { ModelProgress } from "@/lib/poseLandmarker";
import type { PoseAnalysis, VideoProgress, AnalyzeVideoOptions } from "@/lib/analyze";
import { assembleVideoAnalysis, type RawVideoFrame, type VideoAnalysis } from "@/lib/pipeline/shared";
import type {
  WorkerRequest,
  WorkerResponse,
  PhotoResultPayload,
  FrameResultPayload,
} from "@/workers/protocol";

/** Worker infrastructure failed (spawn/init/crash) - the caller should fall
 * back to the inline pipeline. Distinct from ordinary analysis errors (bad
 * image, model download failure), which propagate normally on either backend. */
export class WorkerUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkerUnavailableError";
  }
}

const INIT_TIMEOUT_MS = 15000;

type Pending =
  | { kind: "photo"; resolve: (p: PhotoResultPayload) => void; reject: (e: Error) => void }
  | { kind: "frame"; resolve: (p: FrameResultPayload) => void; reject: (e: Error) => void };

export class WorkerPipeline {
  readonly kind = "worker" as const;

  private readyPromise: Promise<Worker> | null = null;
  private pending = new Map<string, Pending>();
  private modelProgressCb: ModelProgress | null = null;

  private spawn(): Promise<Worker> {
    return new Promise<Worker>((resolve, reject) => {
      let worker: Worker;
      try {
        // The one worker-URL pattern Vite can statically analyze - safe with
        // base './' on GitHub Pages (rewritten to a hashed sibling asset).
        worker = new Worker(new URL("../../workers/analysis.worker.ts", import.meta.url), {
          type: "module",
        });
      } catch (err) {
        reject(new WorkerUnavailableError((err as Error)?.message || "Could not start the analysis worker."));
        return;
      }

      const timer = setTimeout(() => {
        worker.terminate();
        reject(new WorkerUnavailableError("The analysis worker did not initialize in time."));
      }, INIT_TIMEOUT_MS);

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.type === "ready") {
          clearTimeout(timer);
          worker.onmessage = (e: MessageEvent<WorkerResponse>) => this.onMessage(e.data);
          resolve(worker);
        }
      };
      worker.onerror = (event) => {
        clearTimeout(timer);
        this.failAll(new WorkerUnavailableError(event.message || "The analysis worker crashed."));
        worker.terminate();
        this.readyPromise = null;
        reject(new WorkerUnavailableError(event.message || "The analysis worker crashed."));
      };

      const init: WorkerRequest = { type: "init", assetBase: absoluteAssetBase() };
      worker.postMessage(init);
    });
  }

  private ensureWorker(): Promise<Worker> {
    if (!this.readyPromise) {
      this.readyPromise = this.spawn().then((worker) => {
        // Post-init crash handling: fail in-flight requests and force respawn.
        worker.onerror = (event) => {
          this.failAll(new WorkerUnavailableError(event.message || "The analysis worker crashed."));
          worker.terminate();
          this.readyPromise = null;
        };
        return worker;
      });
      this.readyPromise.catch(() => {
        this.readyPromise = null;
      });
    }
    return this.readyPromise;
  }

  private onMessage(msg: WorkerResponse): void {
    if (msg.type === "modelProgress") {
      this.modelProgressCb?.(msg.loaded, msg.total);
      return;
    }
    if (msg.type === "photoResult" || msg.type === "frameResult") {
      const entry = this.pending.get(msg.payload.id);
      if (!entry) return;
      this.pending.delete(msg.payload.id);
      if (msg.type === "photoResult" && entry.kind === "photo") entry.resolve(msg.payload);
      else if (msg.type === "frameResult" && entry.kind === "frame") entry.resolve(msg.payload);
      return;
    }
    if (msg.type === "error") {
      if (msg.id) {
        const entry = this.pending.get(msg.id);
        if (entry) {
          this.pending.delete(msg.id);
          entry.reject(new Error(msg.message));
        }
      } else {
        this.failAll(new Error(msg.message));
      }
    }
  }

  private failAll(err: Error): void {
    for (const entry of this.pending.values()) entry.reject(err);
    this.pending.clear();
  }

  private requestPhoto(worker: Worker, bitmap: ImageBitmap): Promise<PhotoResultPayload> {
    const id = crypto.randomUUID();
    return new Promise<PhotoResultPayload>((resolve, reject) => {
      this.pending.set(id, { kind: "photo", resolve, reject });
      const msg: WorkerRequest = { type: "analyzePhoto", id, bitmap };
      worker.postMessage(msg, [bitmap]);
    });
  }

  private requestFrame(worker: Worker, timeSec: number, bitmap: ImageBitmap): Promise<FrameResultPayload> {
    const id = crypto.randomUUID();
    return new Promise<FrameResultPayload>((resolve, reject) => {
      this.pending.set(id, { kind: "frame", resolve, reject });
      const msg: WorkerRequest = { type: "analyzeFrame", id, timeSec, bitmap };
      worker.postMessage(msg, [bitmap]);
    });
  }

  async analyzePhoto(file: File, onModelProgress?: ModelProgress): Promise<PoseAnalysis> {
    const worker = await this.ensureWorker();
    const bitmap = await loadBitmap(file);
    this.modelProgressCb = onModelProgress ?? null;
    try {
      const payload = await this.requestPhoto(worker, bitmap);
      return assemblePhoto(payload);
    } finally {
      this.modelProgressCb = null;
    }
  }

  async analyzeVideo(
    file: File,
    onProgress?: VideoProgress,
    signal?: AbortSignal,
    options?: AnalyzeVideoOptions,
  ): Promise<VideoAnalysis> {
    const worker = await this.ensureWorker();
    const raw: RawVideoFrame[] = [];
    let skippedNoPose = 0;
    let skippedLowConfidence = 0;

    const meta = await sampleVideoFrames(
      file,
      { ...options, onProgress: (d, t) => onProgress?.("sampling", d, t), signal },
      async ({ timeSec, bitmap }) => {
        // Transfer the frame to the worker and wait for its result before the
        // next seek - preserves the one-frame-in-memory invariant.
        const frame = await this.requestFrame(worker, timeSec, bitmap);
        if (!frame.angles) {
          if (frame.skipReason === "lowConfidence") skippedLowConfidence++;
          else skippedNoPose++;
          return;
        }
        raw.push({
          timeSec,
          angles: frame.angles,
          confidence: frame.angles.confidence,
          thumbUrl: frame.thumbBlob ? URL.createObjectURL(frame.thumbBlob) : "",
          wristFlex: frame.wristFlex,
        });
      },
    );

    return assembleVideoAnalysis(raw, meta, { skippedNoPose, skippedLowConfidence });
  }
}

/** Assemble a PoseAnalysis from the worker payload: object URLs for the images,
 * then the exact same scoring calls the inline path makes (buildAutoInput →
 * computeRula) - scoring always happens on the UI thread. */
function assemblePhoto(payload: PhotoResultPayload): PoseAnalysis {
  const skeletonUrl = payload.skeletonBlob ? URL.createObjectURL(payload.skeletonBlob) : "";
  const originalImageUrl = payload.originalBlob ? URL.createObjectURL(payload.originalBlob) : undefined;

  const out: PoseAnalysis = {
    skeletonUrl: skeletonUrl || originalImageUrl || "",
    originalImageUrl,
    landmarks: payload.landmarks,
    worldLandmarks: payload.worldLandmarks,
    width: payload.width,
    height: payload.height,
    detected: payload.detected,
  };
  if (payload.detected && payload.angles) {
    out.angles = payload.angles;
    out.wristMeasured = payload.wristFlex !== null;
    out.input = buildAutoInput(payload.angles, payload.wristFlex !== null ? { wristAngle: payload.wristFlex } : {});
    out.assessment = computeRula(out.input);
  }
  return out;
}
