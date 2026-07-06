import { describe, expect, it } from "vitest";
import type { AngleSet } from "@/lib/angles";
import { OCCLUSION_CONFIDENCE } from "@/lib/pipeline/shared";

import { assemblePhoto } from "@/lib/pipeline/workerPipeline";
import type { PhotoResultPayload } from "@/workers/protocol";

function angles(confidence: number): AngleSet {
  return { upperArm: 45, lowerArm: 30, neck: 10, trunk: 5, side: "right", confidence };
}

function payload(overrides: Partial<PhotoResultPayload> = {}): PhotoResultPayload {
  return {
    id: "test",
    detected: true,
    landmarks: [],
    worldLandmarks: [],
    width: 100,
    height: 100,
    angles: angles(0.9),
    wristFlex: null,
    skeletonBlob: null,
    originalBlob: null,
    delegate: "GPU",
    ...overrides,
  };
}

describe("assemblePhoto confidence gate", () => {
  it("scores a high-confidence detection", () => {
    const out = assemblePhoto(payload({ angles: angles(0.9) }));
    expect(out.detected).toBe(true);
    expect(out.angles).toBeDefined();
    expect(out.assessment).toBeDefined();
  });

  it("rejects a below-threshold detection exactly like the inline path", () => {
    const out = assemblePhoto(payload({ angles: angles(OCCLUSION_CONFIDENCE - 0.01) }));
    expect(out.detected).toBe(false);
    expect(out.angles).toBeUndefined();
    expect(out.assessment).toBeUndefined();
  });

  it("scores a detection exactly at the threshold", () => {
    const out = assemblePhoto(payload({ angles: angles(OCCLUSION_CONFIDENCE) }));
    expect(out.detected).toBe(true);
    expect(out.assessment).toBeDefined();
  });

  it("leaves an undetected pose alone regardless of angles", () => {
    const out = assemblePhoto(payload({ detected: false, angles: null }));
    expect(out.detected).toBe(false);
    expect(out.angles).toBeUndefined();
  });
});
