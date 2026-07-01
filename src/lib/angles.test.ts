import { describe, expect, it } from "vitest";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { computeAngles } from "@/lib/angles";

/** 33-length landmark array with a sensible default, overridable per index. */
function makeLandmarks(overrides: Record<number, Partial<NormalizedLandmark>>): NormalizedLandmark[] {
  const lms: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.4 }));
  for (const [i, v] of Object.entries(overrides)) lms[Number(i)] = { x: 0.5, y: 0.5, z: 0, visibility: 0.9, ...v };
  return lms;
}

describe("computeAngles side selection", () => {
  it("scores the worse arm when left and right differ", () => {
    const lms = makeLandmarks({
      11: { x: 0.4, y: 0.3 }, // left shoulder
      12: { x: 0.6, y: 0.3 }, // right shoulder
      23: { x: 0.42, y: 0.7 }, // left hip
      24: { x: 0.58, y: 0.7 }, // right hip
      // left arm hanging (neutral)
      13: { x: 0.4, y: 0.5 },
      15: { x: 0.4, y: 0.66 },
      // right arm raised out to the side (worse)
      14: { x: 0.78, y: 0.24 },
      16: { x: 0.88, y: 0.2 },
      0: { x: 0.5, y: 0.24 }, // nose
    });

    const a = computeAngles(lms);
    expect(a).not.toBeNull();
    expect(a!.side).toBe("right");
    expect(a!.sides!.right.upperArm).toBeGreaterThan(a!.sides!.left.upperArm);
    expect(a!.upperArm).toBeGreaterThan(45); // the raised arm's elevation is scored
  });

  it("falls back to the more visible side when only one is eligible", () => {
    const lms = makeLandmarks({
      11: { x: 0.4, y: 0.3, visibility: 0.1 }, // left barely visible
      13: { x: 0.4, y: 0.5, visibility: 0.1 },
      15: { x: 0.4, y: 0.66, visibility: 0.1 },
      12: { x: 0.6, y: 0.3 },
      14: { x: 0.72, y: 0.28 },
      16: { x: 0.8, y: 0.26 },
      23: { x: 0.42, y: 0.7 },
      24: { x: 0.58, y: 0.7 },
    });
    const a = computeAngles(lms);
    expect(a!.side).toBe("right");
  });
});
