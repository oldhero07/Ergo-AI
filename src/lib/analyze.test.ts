import { describe, expect, it, vi } from "vitest";
import type { Landmark, NormalizedLandmark } from "@mediapipe/tasks-vision";

/** A real (non-degenerate) standing pose: head above shoulders above hips, so
 * it clears Sarnav's pose-validity check (computePoseValidity in angles.ts
 * rejects a collapsed/degenerate fit where the head sits at the shoulders). */
const BASE_2D: Record<number, Partial<NormalizedLandmark>> = {
  0: { x: 0.5, y: 0.2 }, // nose
  7: { x: 0.45, y: 0.2 }, // left ear
  8: { x: 0.55, y: 0.2 }, // right ear
  11: { x: 0.4, y: 0.3 }, // left shoulder
  12: { x: 0.6, y: 0.3 }, // right shoulder
  13: { x: 0.4, y: 0.5 }, // left elbow
  14: { x: 0.6, y: 0.5 }, // right elbow
  15: { x: 0.4, y: 0.66 }, // left wrist
  16: { x: 0.6, y: 0.66 }, // right wrist
  23: { x: 0.45, y: 0.7 }, // left hip
  24: { x: 0.55, y: 0.7 }, // right hip
  25: { x: 0.45, y: 0.85 }, // left knee
  26: { x: 0.55, y: 0.85 }, // right knee
  27: { x: 0.45, y: 0.98 }, // left ankle
  28: { x: 0.55, y: 0.98 }, // right ankle
};
/** Matching world (metric, y-down, hip-centered) landmarks - head above
 * shoulders above hips (y more negative = higher, since world space is
 * y-down) so this clears the pose-validity degenerate-fit check. */
const BASE_WORLD: Record<number, Partial<Landmark>> = {
  7: { x: 0.05, y: -0.75, z: 0 },
  8: { x: -0.05, y: -0.75, z: 0 },
  11: { x: 0.2, y: -0.5, z: 0 },
  12: { x: -0.2, y: -0.5, z: 0 },
  13: { x: 0.25, y: -0.25, z: 0 },
  14: { x: -0.25, y: -0.25, z: 0 },
  15: { x: 0.25, y: 0, z: 0 },
  16: { x: -0.25, y: 0, z: 0 },
  23: { x: 0.1, y: 0, z: 0 },
  24: { x: -0.1, y: 0, z: 0 },
  25: { x: 0.1, y: 0.25, z: 0 },
  26: { x: -0.1, y: 0.25, z: 0 },
  27: { x: 0.1, y: 0.5, z: 0 },
  28: { x: -0.1, y: 0.5, z: 0 },
};

function makeLandmarks(overrides: Record<number, Partial<NormalizedLandmark>> = {}): NormalizedLandmark[] {
  const lms: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));
  for (const [i, v] of Object.entries({ ...BASE_2D, ...overrides })) lms[Number(i)] = { ...lms[Number(i)], ...v };
  return lms;
}

function makeWorld(overrides: Record<number, Partial<Landmark>> = {}): Landmark[] {
  const w: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.9 }));
  for (const [i, v] of Object.entries({ ...BASE_WORLD, ...overrides })) w[Number(i)] = { ...w[Number(i)], ...v };
  return w;
}

const fakeBitmap = { width: 100, height: 100, close: vi.fn() } as unknown as ImageBitmap;

vi.mock("@/lib/image", () => ({
  loadBitmap: vi.fn().mockResolvedValue(fakeBitmap),
}));

vi.mock("@/lib/poseLandmarker", () => ({
  detectPose: vi.fn().mockResolvedValue({
    landmarks: [makeLandmarks()],
    worldLandmarks: [makeWorld()],
  }),
  getActiveDelegate: vi.fn().mockReturnValue("CPU"),
}));

vi.mock("@/lib/handLandmarker", () => ({
  detectHands: vi.fn().mockResolvedValue({ landmarks: [] }),
}));

vi.mock("@/lib/handRoi", () => ({
  detectHandsCropped: vi.fn().mockResolvedValue([]),
}));

describe("analyzePhoto - annotation failure isolation", () => {
  it("still returns a fully scored result when annotateSkeleton throws (mirrors the worker's try/catch)", async () => {
    vi.doMock("@/lib/annotate", () => ({
      annotateSkeleton: vi.fn(() => {
        throw new Error("canvas 2D context unavailable");
      }),
      renderOriginalJpeg: vi.fn().mockReturnValue("data:image/jpeg;base64,ORIGINAL"),
    }));

    const { analyzePhoto } = await import("@/lib/analyze");
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    const out = await analyzePhoto(file);

    expect(out.detected).toBe(true);
    expect(out.assessment).toBeDefined();
    expect(out.angles).toBeDefined();
    // Annotation failed, so the skeleton slot falls back to the plain JPEG,
    // exactly like assemblePhoto's fallback for the worker path.
    expect(out.skeletonUrl).toBe("data:image/jpeg;base64,ORIGINAL");
    expect(out.originalImageUrl).toBe("data:image/jpeg;base64,ORIGINAL");

    vi.doUnmock("@/lib/annotate");
    vi.resetModules();
  });

  it("still returns a fully scored result when renderOriginalJpeg also throws", async () => {
    vi.doMock("@/lib/annotate", () => ({
      annotateSkeleton: vi.fn(() => {
        throw new Error("canvas 2D context unavailable");
      }),
      renderOriginalJpeg: vi.fn(() => {
        throw new Error("canvas 2D context unavailable");
      }),
    }));

    const { analyzePhoto } = await import("@/lib/analyze");
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    const out = await analyzePhoto(file);

    expect(out.detected).toBe(true);
    expect(out.assessment).toBeDefined();
    // Both presentational calls failed - score still lands, image URLs are empty/undefined.
    expect(out.originalImageUrl).toBeUndefined();
    expect(out.skeletonUrl).toBe("");

    vi.doUnmock("@/lib/annotate");
    vi.resetModules();
  });
});

describe("analyzePhoto - wrist-flexion visibility gate", () => {
  it("does not measure wrist flexion when the wrist is visible enough to route detection but not enough to trust", async () => {
    vi.doMock("@/lib/annotate", () => ({
      annotateSkeleton: vi.fn().mockReturnValue({ dataUrl: "data:image/png;base64,SKEL", width: 100, height: 100 }),
      renderOriginalJpeg: vi.fn().mockReturnValue("data:image/jpeg;base64,ORIGINAL"),
    }));
    vi.doMock("@/lib/poseLandmarker", () => ({
      // Both wrists (15/16) below WRIST_VIS_FLOOR (0.3 on main) - even though a
      // hand IS found near them below, the result must not be trusted.
      detectPose: vi.fn().mockResolvedValue({
        landmarks: [makeLandmarks({ 15: { visibility: 0.1 }, 16: { visibility: 0.1 } })],
        worldLandmarks: [makeWorld()],
      }),
      getActiveDelegate: vi.fn().mockReturnValue("CPU"),
    }));
    // A hand IS found near the wrist - if the gate were missing, this would
    // produce a measured (fabricated) angle instead of assumed-neutral.
    vi.doMock("@/lib/handLandmarker", () => ({
      detectHands: vi.fn().mockResolvedValue({
        landmarks: [Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }))],
      }),
    }));
    vi.doMock("@/lib/handRoi", () => ({
      detectHandsCropped: vi.fn().mockResolvedValue([
        Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 })),
      ]),
    }));

    const { analyzePhoto } = await import("@/lib/analyze");
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    const out = await analyzePhoto(file);

    expect(out.detected).toBe(true);
    expect(out.wristMeasured).toBe(false);

    vi.doUnmock("@/lib/annotate");
    vi.doUnmock("@/lib/poseLandmarker");
    vi.doUnmock("@/lib/handLandmarker");
    vi.doUnmock("@/lib/handRoi");
    vi.resetModules();
  });
});
