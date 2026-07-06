import { describe, expect, it } from "vitest";
import type { Landmark, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { computeAngles, computeDetectionConfidence, computePoseValidity } from "@/lib/angles";

/** 33-length landmark array with a sensible default, overridable per index. */
function makeLandmarks(overrides: Record<number, Partial<NormalizedLandmark>>): NormalizedLandmark[] {
  const lms: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.4 }));
  for (const [i, v] of Object.entries(overrides)) lms[Number(i)] = { x: 0.5, y: 0.5, z: 0, visibility: 0.9, ...v };
  return lms;
}

/** 33-length metric world-landmark array (y-down, x-image-right, z-depth). */
function makeWorld(overrides: Record<number, Partial<Landmark>>): Landmark[] {
  const w: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.9 }));
  for (const [i, v] of Object.entries(overrides)) w[Number(i)] = { x: 0, y: 0, z: 0, visibility: 0.9, ...v };
  return w;
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

describe("computeDetectionConfidence", () => {
  it("is high for a cleanly-visible subject", () => {
    const lms = makeLandmarks({ 11: {}, 12: {}, 13: {}, 14: {}, 15: {}, 16: {}, 23: {}, 24: {}, 7: {}, 8: {} });
    expect(computeDetectionConfidence(lms, "right")).toBeGreaterThan(0.8);
  });

  it("drops sharply when the scored joints are occluded (not a constant ~99%)", () => {
    const occluded = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.1 }));
    const conf = computeDetectionConfidence(occluded, "right");
    expect(conf).toBeLessThan(0.3);
    // The whole point: an occluded pose must read lower than a clean one.
    const clean = makeLandmarks({ 11: {}, 12: {}, 14: {}, 16: {}, 23: {}, 24: {}, 8: {} });
    expect(computeDetectionConfidence(clean, "right")).toBeGreaterThan(conf + 0.4);
  });
});

describe("neck flexion vs extension sign (3D)", () => {
  // Person facing camera: shoulders above hips, ears above shoulders.
  const base = {
    11: { x: 0.4, y: 0.3 }, 12: { x: 0.6, y: 0.3 }, // shoulders
    13: { x: 0.4, y: 0.5 }, 14: { x: 0.6, y: 0.5 }, // elbows
    15: { x: 0.4, y: 0.66 }, 16: { x: 0.6, y: 0.66 }, // wrists
    23: { x: 0.45, y: 0.7 }, 24: { x: 0.55, y: 0.7 }, // hips
    7: { x: 0.45, y: 0.2 }, 8: { x: 0.55, y: 0.2 }, // ears (both visible)
  };
  const worldBase = {
    11: { x: 0.2, y: -0.5, z: 0 }, 12: { x: -0.2, y: -0.5, z: 0 },
    13: { x: 0.25, y: -0.25, z: 0 }, 14: { x: -0.25, y: -0.25, z: 0 },
    15: { x: 0.25, y: 0, z: 0 }, 16: { x: -0.25, y: 0, z: 0 },
    23: { x: 0.1, y: 0, z: 0 }, 24: { x: -0.1, y: 0, z: 0 },
  };

  it("scores a head tipped BACK as extension (negative)", () => {
    const lms = makeLandmarks(base);
    const world = makeWorld({ ...worldBase, 7: { x: 0.05, y: -0.8, z: 0.15 }, 8: { x: -0.05, y: -0.8, z: 0.15 } });
    const a = computeAngles(lms, world);
    expect(a!.neck).toBeLessThan(0);
  });

  it("scores a head dropped FORWARD as flexion (positive)", () => {
    const lms = makeLandmarks(base);
    const world = makeWorld({ ...worldBase, 7: { x: 0.05, y: -0.8, z: -0.15 }, 8: { x: -0.05, y: -0.8, z: -0.15 } });
    const a = computeAngles(lms, world);
    expect(a!.neck).toBeGreaterThan(0);
  });

  it("keeps a near-upright head positive (deadzone: no cliff to extension score 4)", () => {
    const lms = makeLandmarks(base);
    // Head almost directly above the shoulders with a hair of backward tilt (<5°).
    const world = makeWorld({ ...worldBase, 7: { x: 0.0, y: -0.85, z: 0.01 }, 8: { x: -0.0, y: -0.85, z: 0.01 } });
    const a = computeAngles(lms, world);
    expect(a!.neck).toBeGreaterThanOrEqual(0);
    expect(Math.abs(a!.neck)).toBeLessThan(5);
  });

  it("treats an obtuse head-to-trunk angle as flexion, not 114° extension", () => {
    const lms = makeLandmarks(base);
    // Head thrown far back/low → large obtuse angle (bent-torso artifact), not real extension.
    const world = makeWorld({ ...worldBase, 7: { x: 0.05, y: -0.55, z: 0.5 }, 8: { x: -0.05, y: -0.55, z: 0.5 } });
    const a = computeAngles(lms, world);
    expect(a!.neck).toBeGreaterThan(0); // stays flexion (positive), no score-4 cliff
    expect(a!.neck).toBeLessThanOrEqual(90); // clamped to physiological cap
  });
});

describe("trunk angle (3D)", () => {
  // Regression coverage for a tautological trunk-angle bug: an earlier version
  // derived the "gravity up" reference vector from the same shoulder/hip
  // landmarks being measured against it, so trunk = angle(trunkVector,
  // -trunkVector) always evaluated to ~180 deg regardless of actual posture.
  // The fix compares against a fixed vertical vector instead. Asserting a
  // single correct-looking value isn't enough to catch this bug class - a
  // formula that always returns the same constant can still pass one test
  // case by coincidence. These cases assert distinct expected values for
  // distinct synthetic postures, so a collapsed-to-a-constant formula fails.
  const flatLandmarks = makeLandmarks({});

  /** World landmarks for a torso tilted by `shoulderOffset` from the hips (at
   * the origin). y is down, so {x:0,y:-0.5,z:0} is a shoulder 0.5m directly
   * above the hips (upright); adding a z (or x) component tilts the trunk. */
  function worldWithTrunk(shoulderOffset: { x: number; y: number; z: number }): Landmark[] {
    // Only x (shoulder width) is split symmetrically between the two shoulder
    // landmarks - y/z are the shoulder-midpoint's actual offset from the hips,
    // so they must NOT be halved or the resulting mid point (and therefore the
    // trunk lean) is wrong.
    return makeWorld({
      11: { x: shoulderOffset.x / 2, y: shoulderOffset.y, z: shoulderOffset.z },
      12: { x: -shoulderOffset.x / 2, y: shoulderOffset.y, z: shoulderOffset.z },
      23: { x: 0.1, y: 0, z: 0 },
      24: { x: -0.1, y: 0, z: 0 },
    });
  }

  it("reads ~0° for a perfectly upright trunk", () => {
    const a = computeAngles(flatLandmarks, worldWithTrunk({ x: 0, y: -0.5, z: 0 }));
    expect(a!.trunk).toBeLessThan(2);
  });

  it("reads ~45° for a 45° forward lean", () => {
    const a = computeAngles(flatLandmarks, worldWithTrunk({ x: 0, y: -0.3536, z: -0.3536 }));
    expect(a!.trunk).toBeGreaterThan(43);
    expect(a!.trunk).toBeLessThan(47);
  });

  it("reads ~90° for a fully horizontal trunk", () => {
    const a = computeAngles(flatLandmarks, worldWithTrunk({ x: 0, y: 0, z: -0.5 }));
    expect(a!.trunk).toBeGreaterThan(88);
    expect(a!.trunk).toBeLessThan(92);
  });

  it("does not collapse to a constant regardless of posture (tautological gravity-vector regression guard)", () => {
    const upright = computeAngles(flatLandmarks, worldWithTrunk({ x: 0, y: -0.5, z: 0 }));
    const leaning = computeAngles(flatLandmarks, worldWithTrunk({ x: 0, y: -0.3536, z: -0.3536 }));
    const horizontal = computeAngles(flatLandmarks, worldWithTrunk({ x: 0, y: 0, z: -0.5 }));
    // Three clearly different postures must produce three clearly different
    // angles - a formula that always outputs the same value (e.g. the ~180°
    // tautology) fails this even if that constant happened to look plausible
    // for any one posture in isolation.
    expect(Math.abs(upright!.trunk - leaning!.trunk)).toBeGreaterThan(30);
    expect(Math.abs(leaning!.trunk - horizontal!.trunk)).toBeGreaterThan(30);
    expect(upright!.trunk).toBeLessThan(170);
    expect(leaning!.trunk).toBeLessThan(170);
    expect(horizontal!.trunk).toBeLessThan(170);
  });
});

describe("computePoseValidity (reject partial-body hallucinations)", () => {
  // Core anchors all in-frame and visible: nose, both shoulders, both hips.
  const fullBody = {
    0: { x: 0.5, y: 0.15 }, // nose
    11: { x: 0.4, y: 0.3 }, 12: { x: 0.6, y: 0.3 }, // shoulders
    23: { x: 0.45, y: 0.6 }, 24: { x: 0.55, y: 0.6 }, // hips
  };

  it("passes a full body with head + shoulders + hips in frame", () => {
    expect(computePoseValidity(makeLandmarks(fullBody))).toBe(1);
  });

  it("rejects a partial body whose head + shoulders are cropped off the top", () => {
    // Legs/hips in frame, but head + shoulders extrapolated ABOVE the image (y < 0).
    const partial = makeLandmarks({
      0: { x: 0.3, y: -0.4 }, // nose off-frame (above)
      7: { x: 0.3, y: -0.45 }, 8: { x: 0.35, y: -0.45 }, // ears off-frame
      11: { x: 0.3, y: -0.2 }, 12: { x: 0.4, y: -0.2 }, // shoulders off-frame
      23: { x: 0.35, y: 0.5 }, 24: { x: 0.45, y: 0.5 }, // hips in frame
    });
    const v = computePoseValidity(partial);
    expect(v).toBeLessThan(0.5); // only hips valid → 2/5
    // And that drags detection confidence below the occlusion gate.
    expect(computeDetectionConfidence(partial, "right")).toBeLessThan(0.4);
  });

  it("still rejects when core anchors are present but not visible", () => {
    const invisible = makeLandmarks({
      0: { x: 0.5, y: 0.15, visibility: 0.1 },
      11: { x: 0.4, y: 0.3, visibility: 0.1 }, 12: { x: 0.6, y: 0.3, visibility: 0.1 },
      23: { x: 0.45, y: 0.6, visibility: 0.1 }, 24: { x: 0.55, y: 0.6, visibility: 0.1 },
    });
    expect(computePoseValidity(invisible)).toBe(0);
  });

  // Degenerate world fit: every anchor is in-frame & visible (so the 2D check
  // passes), but the 3D landmarks collapse the head onto the shoulders - the
  // hallmark of MediaPipe cramming a skeleton onto a partial body.
  const inFrameLms = {
    0: { x: 0.5, y: 0.15 }, 7: { x: 0.45, y: 0.28 }, 8: { x: 0.55, y: 0.28 },
    11: { x: 0.4, y: 0.3 }, 12: { x: 0.6, y: 0.3 }, 23: { x: 0.45, y: 0.6 }, 24: { x: 0.55, y: 0.6 },
  };

  it("rejects a degenerate fit where the head collapses onto the shoulders", () => {
    const world = makeWorld({
      11: { x: 0.2, y: -0.5, z: 0 }, 12: { x: -0.2, y: -0.5, z: 0 },
      23: { x: 0.12, y: 0, z: 0 }, 24: { x: -0.12, y: 0, z: 0 }, // torso 0.5 m
      7: { x: 0.05, y: -0.5, z: 0 }, 8: { x: -0.05, y: -0.5, z: 0 }, // ears at shoulder height → no neck
    });
    expect(computePoseValidity(makeLandmarks(inFrameLms), world)).toBeLessThanOrEqual(0.2);
  });

  it("keeps a normal pose (head clearly above shoulders) valid", () => {
    const world = makeWorld({
      11: { x: 0.2, y: -0.5, z: 0 }, 12: { x: -0.2, y: -0.5, z: 0 },
      23: { x: 0.12, y: 0, z: 0 }, 24: { x: -0.12, y: 0, z: 0 },
      7: { x: 0.05, y: -0.75, z: 0 }, 8: { x: -0.05, y: -0.75, z: 0 }, // ears well above shoulders
    });
    expect(computePoseValidity(makeLandmarks(inFrameLms), world)).toBe(1);
  });
});
