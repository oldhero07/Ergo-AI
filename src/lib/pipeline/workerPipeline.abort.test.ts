import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * This file deliberately has NO static top-level import of workerPipeline.ts
 * (unlike workerPipeline.test.ts) - it needs to mock @/lib/videoFrames before
 * that module graph is ever evaluated, and a static import at file-load time
 * would bind the real sampleVideoFrames into workerPipeline's closure before
 * any per-test vi.doMock could take effect.
 */

/** Answers "init" immediately, and for "analyzeFrame" flips the AbortController
 * BEFORE replying - simulating the user cancelling while the worker is still
 * processing the frame that's already in flight. */
class FakeWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  terminate = vi.fn();
  postMessage: (msg: { type: string; id?: string; timeSec?: number }) => void = () => {};
  constructor(private controller: AbortController) {
    this.postMessage = (msg) => {
      if (msg.type === "init") {
        queueMicrotask(() => this.onmessage?.({ data: { type: "ready" } } as MessageEvent));
        return;
      }
      if (msg.type === "analyzeFrame") {
        this.controller.abort();
        queueMicrotask(() =>
          this.onmessage?.({
            data: {
              type: "frameResult",
              payload: {
                id: msg.id,
                timeSec: msg.timeSec,
                angles: { upperArm: 10, lowerArm: 10, neck: 10, trunk: 10, side: "right", confidence: 0.9 },
                skipReason: null,
                wristFlex: null,
                thumbBlob: new Blob(["x"]),
              },
            },
          } as MessageEvent),
        );
      }
    };
  }
}

describe("analyzeVideo - abort during an in-flight frame request", () => {
  let controller: AbortController;

  beforeEach(() => {
    controller = new AbortController();
    vi.stubGlobal(
      "Worker",
      class extends FakeWorker {
        constructor() {
          super(controller);
        }
      } as unknown as typeof Worker,
    );
    vi.stubGlobal("document", { baseURI: "http://localhost/" });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake");
    vi.doMock("@/lib/videoFrames", () => ({
      sampleVideoFrames: vi.fn(async (_file: File, _opts: unknown, onFrame: (f: unknown) => Promise<void>) => {
        await onFrame({ timeSec: 1, bitmap: {} as ImageBitmap, width: 10, height: 10 });
        return { sampledDurationSec: 1, fps: 1, frameCount: 1, unreadableFrames: 0 };
      }),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.doUnmock("@/lib/videoFrames");
    vi.resetModules();
  });

  it("does not create an object URL (or keep the frame) for a request that resolved after cancellation", async () => {
    const { WorkerPipeline } = await import("@/lib/pipeline/workerPipeline");
    const pipeline = new WorkerPipeline();
    const result = await pipeline.analyzeVideo(new File(["x"], "a.mp4"), undefined, controller.signal);

    expect(result.frames).toHaveLength(0);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
