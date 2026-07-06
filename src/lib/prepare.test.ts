import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * A worker that never calls onmessage/onerror back - simulating a genuinely
 * wedged libheif decode (the exact scenario PreparePool's timeout exists to
 * handle). Each instance is recorded so tests can assert the pool actually
 * drops and replaces the specific worker that timed out, instead of leaving
 * every future request queued up behind the same dead one.
 */
let instances: FakeWorker[] = [];
class FakeWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    instances.push(this);
  }
}

describe("PreparePool timeout/respawn", () => {
  beforeEach(() => {
    instances = [];
    vi.useFakeTimers();
    vi.stubGlobal("Worker", FakeWorker as unknown as typeof Worker);
    vi.stubGlobal("OffscreenCanvas", class {} as unknown as typeof OffscreenCanvas);
    // Vitest's default node environment has no `navigator` at all - poolSize()
    // reading navigator.deviceMemory/hardwareConcurrency would throw and get
    // swallowed by run()'s catch block, silently falling through to the inline
    // path instead of exercising PreparePool at all. Stub a plausible value.
    vi.stubGlobal("navigator", { deviceMemory: 4, hardwareConcurrency: 4 });
    let n = 0;
    vi.stubGlobal("crypto", { randomUUID: () => `id-${n++}` });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("terminates and replaces the specific worker that wedged, instead of every future request queuing behind it forever", async () => {
    const { prepareImage } = await import("@/lib/prepare");
    const file = new File(["x"], "a.heic", { type: "image/heic" });

    const first = prepareImage(file);
    expect(instances.length).toBe(1);

    await vi.advanceTimersByTimeAsync(45000);
    // A timed-out prepare never throws - the caller just gets no blobs and
    // falls back to a placeholder (existing, unchanged behavior).
    await expect(first).resolves.toEqual({ thumbUrl: null, analysisFile: null });
    expect(instances[0].terminate).toHaveBeenCalledTimes(1);

    // The next call must not reuse the (terminated) wedged worker - it should
    // lazily spawn a fresh one, same as the very first call did.
    const second = prepareImage(file);
    expect(instances.length).toBe(2);
    expect(instances[1]).not.toBe(instances[0]);

    await vi.advanceTimersByTimeAsync(45000);
    await expect(second).resolves.toEqual({ thumbUrl: null, analysisFile: null });
    expect(instances[1].terminate).toHaveBeenCalledTimes(1);
  });
});
