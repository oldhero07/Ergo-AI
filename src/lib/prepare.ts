/**
 * Main-thread API over the image-preparation worker(s): give it a File, get a
 * small preview-thumbnail object URL and (for HEIC) an analysis-ready JPEG
 * File back. A tiny pool keeps big drops moving without multiplying peak
 * decode memory; if workers are unavailable the same core runs inline (the
 * pre-worker behavior). Never throws - on total failure callers fall back to
 * the raw object URL and the original file, exactly as before.
 */
import type { PreparedBlobs } from "@/lib/prepareCore";
import type { PrepareRequest, PrepareResponse } from "@/workers/prepareProtocol";

export interface PreparedImage {
  /** Small JPEG object URL for the upload-grid tile (null → use a raw object URL). */
  thumbUrl: string | null;
  /** HEIC only: the photo re-encoded as a JPEG File so analysis skips the wasm decode. */
  analysisFile: File | null;
}

/** The worker itself failed to spawn/crashed - the caller should retry inline.
 * Distinct from a per-image decode error, which must NOT trigger an inline
 * retry (re-running the wasm decode on the main thread is the freeze we fixed). */
class WorkerUnavailable extends Error {}

/** A single decode can wedge libheif without ever throwing or posting back. Cap
 * each request so a pathological file can't leave its grid tile spinning (and
 * the Analyze button disabled) forever - it just falls back to a placeholder. */
const PREPARE_TIMEOUT_MS = 45000;
/** Free the workers' wasm heaps once a batch is idle, so ~190MB/worker of dead
 * libheif memory isn't still resident when analysis warms the GPU models. */
const IDLE_TERMINATE_MS = 20000;

// A second worker only on machines with real headroom. Each worker can hold one
// decoded photo (~190MB for a 48MP image) plus, on non-Apple browsers, a libheif
// wasm heap of similar size - so two concurrent workers already peak near
// ~760MB. We cap at 2 (never 3): the extra parallelism isn't worth another
// ~380MB spike on the low-end machines this is meant to protect.
function poolSize(): number {
  const gb = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  return gb > 4 && cores >= 8 ? 2 : 1;
}

class PreparePool {
  private workers: Worker[] = [];
  private next = 0;
  private pending = new Map<string, { resolve: (b: PreparedBlobs) => void; reject: (e: Error) => void; worker: Worker }>();
  private broken = false;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  private spawn(): Worker {
    const worker = new Worker(new URL("../workers/prepare.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<PrepareResponse>) => {
      const msg = event.data;
      const entry = this.pending.get(msg.id);
      if (!entry) return;
      this.pending.delete(msg.id);
      // A worker-reported decode error is per-image (bad/exotic file): reject
      // with a plain Error so the caller gives up on THIS file rather than
      // re-running the same decode inline on the main thread.
      if (msg.type === "prepared") entry.resolve({ thumbBlob: msg.thumbBlob, analysisBlob: msg.analysisBlob });
      else entry.reject(new Error(msg.message));
      this.scheduleIdleShutdown();
    };
    worker.onerror = () => {
      // Worker infrastructure failed: reject everything in flight (callers run
      // the inline fallback) and stop using workers for this session.
      this.broken = true;
      const entries = [...this.pending.values()];
      this.pending.clear();
      this.teardown();
      for (const e of entries) e.reject(new WorkerUnavailable("The image-preparation worker crashed."));
    };
    return worker;
  }

  /** Drop one specific worker (its decode is presumed permanently wedged - a
   * genuinely hung libheif decode never throws or posts back) and fail every
   * OTHER request currently queued behind it in that worker's own internal
   * serialization chain - they would otherwise wait forever too, since the
   * worker can never advance past the stuck decode. The pool stays usable:
   * run() lazily spawns a replacement on its next call, same as any other
   * lazy-spawn. Without this, keeping a wedged-but-not-crashed worker "alive"
   * just means every future request silently queues up behind a decode that
   * will never complete, for the rest of the tab session. */
  private dropWorker(worker: Worker, reason: string): void {
    worker.terminate();
    this.workers = this.workers.filter((w) => w !== worker);
    for (const [id, entry] of this.pending) {
      if (entry.worker !== worker) continue;
      this.pending.delete(id);
      entry.reject(new Error(reason));
    }
  }

  private teardown(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    for (const w of this.workers) w.terminate();
    this.workers = [];
    this.next = 0;
  }

  /** When nothing is queued, drop the workers after a grace period to free their
   * wasm heaps. run() re-spawns lazily, so the next drop is transparent. */
  private scheduleIdleShutdown(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    if (this.pending.size > 0 || this.broken) return;
    this.idleTimer = setTimeout(() => {
      if (this.pending.size === 0) this.teardown();
    }, IDLE_TERMINATE_MS);
  }

  run(file: File): Promise<PreparedBlobs> {
    if (this.broken || typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") {
      return Promise.reject(new WorkerUnavailable("Image-preparation worker unavailable."));
    }
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    try {
      if (this.workers.length < poolSize()) this.workers.push(this.spawn());
    } catch (err) {
      this.broken = true;
      return Promise.reject(new WorkerUnavailable((err as Error)?.message || "Could not start the image-preparation worker."));
    }
    const worker = this.workers[this.next % this.workers.length];
    this.next++;
    const id = crypto.randomUUID();
    return new Promise<PreparedBlobs>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        // A worker that's actually wedged (not crashed) never fires onerror or
        // onmessage - dropping just this one worker, rather than "keeping it
        // around", is what stops every subsequent request from silently
        // queuing up behind the same dead decode forever.
        this.dropWorker(worker, "Image preparation timed out.");
        reject(new Error("Image preparation timed out."));
        this.scheduleIdleShutdown();
      }, PREPARE_TIMEOUT_MS);
      this.pending.set(id, {
        resolve: (b) => { clearTimeout(timer); resolve(b); },
        reject: (e) => { clearTimeout(timer); reject(e); },
        worker,
      });
      const msg: PrepareRequest = { id, file };
      worker.postMessage(msg);
    });
  }
}

const pool = new PreparePool();

function jpegName(name: string): string {
  return name.replace(/\.(heic|heif)$/i, "") + ".jpg";
}

// The inline fallback runs on the main thread, and a whole batch falls back at
// once when the worker dies - serialize it so 30 photos decode one at a time
// (one decoded image in memory) instead of all concurrently (the old crash).
let inlineChain: Promise<unknown> = Promise.resolve();
function runInline(file: File): Promise<PreparedBlobs> {
  const next = inlineChain.then(async () => {
    const { prepareImageBlobs } = await import("@/lib/prepareCore");
    return prepareImageBlobs(file);
  });
  inlineChain = next.catch(() => undefined);
  return next;
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  let blobs: PreparedBlobs | null = null;
  try {
    blobs = await pool.run(file);
  } catch (err) {
    // Only retry inline when the WORKER is unavailable/crashed - not for a
    // per-image decode error (that would re-run the same failing decode on the
    // main thread, reintroducing the freeze this whole path exists to avoid).
    if (err instanceof WorkerUnavailable) {
      try {
        blobs = await runInline(file);
      } catch {
        blobs = null;
      }
    } else {
      blobs = null; // undecodable / timed out - the grid shows the placeholder
    }
  }
  if (!blobs) return { thumbUrl: null, analysisFile: null };
  return {
    thumbUrl: blobs.thumbBlob ? URL.createObjectURL(blobs.thumbBlob) : null,
    analysisFile: blobs.analysisBlob
      ? new File([blobs.analysisBlob], jpegName(file.name), { type: "image/jpeg" })
      : null,
  };
}
