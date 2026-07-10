import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { KP, KP_SCORE_FLOOR, computeAngles2D, isOffProfile, wristFlexion2D } from "@/lib/angles2d";
import type { ApiKeypoint } from "@/lib/poseClient";

const FIXTURES = join(__dirname, "..", "test", "fixtures", "keypoints");

function fixture(name: string): { keypoints: ApiKeypoint[]; image: { w: number; h: number } } {
  return JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf-8"));
}

/** Synthetic upright side-view figure (right profile, facing +x), 1000x1000 px.
 * All scores 1. Deliberately simple geometry so expected angles are exact. */
function uprightFigure(): ApiKeypoint[] {
  const kps: ApiKeypoint[] = Array.from({ length: 133 }, () => [0, 0, 0] as ApiKeypoint);
  const set = (i: number, x: number, y: number, s = 1) => (kps[i] = [x, y, s]);
  // Head: ears stacked at x=500, nose forward (facing +x).
  set(KP.nose, 540, 195);
  set(KP.leftEye, 515, 185);
  set(KP.rightEye, 515, 185);
  set(KP.leftEar, 500, 200);
  set(KP.rightEar, 500, 200);
  // Trunk: vertical, shoulders above hips (profile - both sides superimposed).
  set(KP.leftShoulder, 500, 300);
  set(KP.rightShoulder, 500, 300);
  set(KP.leftHip, 500, 600);
  set(KP.rightHip, 500, 600);
  // Arms straight down (0° elevation), elbow at 450, wrist at 580.
  set(KP.leftElbow, 500, 450);
  set(KP.rightElbow, 500, 450);
  set(KP.leftWrist, 500, 580);
  set(KP.rightWrist, 500, 580);
  // Legs straight (180° included angle -> legAngle 0).
  set(KP.leftKnee, 500, 780);
  set(KP.rightKnee, 500, 780);
  set(KP.leftAnkle, 500, 960);
  set(KP.rightAnkle, 500, 960);
  // Hands in line with the forearms (neutral wrist).
  set(KP.leftHandRoot, 500, 585);
  set(KP.leftMiddleMcp, 500, 640);
  set(KP.rightHandRoot, 500, 585);
  set(KP.rightMiddleMcp, 500, 640);
  return kps;
}

/** Mirror a figure horizontally (x -> 1000 - x): right-facing becomes left-facing. */
function mirrored(kps: ApiKeypoint[]): ApiKeypoint[] {
  return kps.map(([x, y, s]) => [1000 - x, y, s] as ApiKeypoint);
}

describe("computeAngles2D on synthetic geometry", () => {
  it("neutral upright figure reads ~0 everywhere (ears above shoulders -> neck 0)", () => {
    const { angles, flags } = computeAngles2D(uprightFigure(), 1000, 1000);
    expect(angles.upperArm).toBeCloseTo(0, 5);
    expect(angles.lowerArm).toBeCloseTo(0, 5);
    expect(angles.trunk).toBeCloseTo(0, 5);
    expect(angles.legAngle).toBeCloseTo(0, 5);
    expect(angles.neck).toBeCloseTo(0, 5);
    expect(flags.upperArm && flags.lowerArm && flags.trunk && flags.legs).toBe(true);
  });

  it("raised arm reads its elevation and drives side selection to the worse arm", () => {
    const kps = uprightFigure();
    // Right arm horizontal forward: elbow at (650, 300) -> 90° from trunk line.
    kps[KP.rightElbow] = [650, 300, 1];
    kps[KP.rightWrist] = [800, 300, 1];
    const { angles } = computeAngles2D(kps, 1000, 1000);
    expect(angles.side).toBe("right");
    expect(angles.upperArm).toBeCloseTo(90, 5);
  });

  it("forward trunk lean reads as trunk angle from vertical", () => {
    const kps = uprightFigure();
    // Shoulders shifted forward 300px at same drop -> 45° lean.
    for (const i of [KP.leftShoulder, KP.rightShoulder] as const) kps[i] = [800, 300, 1];
    const { angles } = computeAngles2D(kps, 1000, 1000);
    expect(angles.trunk).toBeCloseTo(45, 5);
  });

  it("head tipped clearly backward reads as extension (negative)", () => {
    const kps = uprightFigure();
    // Facing +x (nose forward of ears); ears moved BACKWARD (-x) of shoulders ~17°.
    kps[KP.leftEar] = [470, 205, 1];
    kps[KP.rightEar] = [470, 205, 1];
    kps[KP.nose] = [505, 200, 1];
    const { angles } = computeAngles2D(kps, 1000, 1000);
    expect(angles.neck).toBeLessThan(0);
  });

  it("small backward tilt stays in the neutral deadzone (not extension)", () => {
    const kps = uprightFigure();
    kps[KP.leftEar] = [494, 200, 1]; // ~3.4° backward - inside the 5° deadzone
    kps[KP.rightEar] = [494, 200, 1];
    const { angles } = computeAngles2D(kps, 1000, 1000);
    expect(angles.neck).toBeGreaterThanOrEqual(0);
  });

  it("left-facing mirror produces the identical extension reading (sign symmetry)", () => {
    const kps = uprightFigure();
    kps[KP.leftEar] = [470, 205, 1];
    kps[KP.rightEar] = [470, 205, 1];
    kps[KP.nose] = [505, 200, 1];
    const rightFacing = computeAngles2D(kps, 1000, 1000).angles;
    const leftFacing = computeAngles2D(mirrored(kps), 1000, 1000).angles;
    expect(rightFacing.neck).toBeLessThan(0);
    expect(leftFacing.neck).toBeCloseTo(rightFacing.neck, 5);
  });

  it("frontal ambiguous facing never reads as extension (no score-4 cliff trip)", () => {
    // Frontal view: nose directly over the ear midline, head tilted laterally
    // ~15° - a side-bend, not extension. The ambiguity guard must force the
    // flexion sign regardless of which way the tilt happens to lean.
    const kps = uprightFigure();
    kps[KP.leftShoulder] = [400, 300, 1];
    kps[KP.rightShoulder] = [600, 300, 1];
    kps[KP.leftHip] = [440, 600, 1];
    kps[KP.rightHip] = [560, 600, 1];
    kps[KP.leftEar] = [455, 210, 1]; // head tilted toward image-left
    kps[KP.rightEar] = [520, 190, 1];
    kps[KP.nose] = [488, 205, 1]; // nose ≈ ear midline -> facing ambiguous
    const { angles } = computeAngles2D(kps, 1000, 1000);
    expect(angles.neck).toBeGreaterThanOrEqual(0);
  });

  it("out-of-frame (edge-clamped) joints flag measured:false but keep values", () => {
    // Legs cropped out of the photo: the model clamps knee/ankle to the bottom
    // border with decent confidence - a real estimate, but review-worthy.
    const kps = uprightFigure();
    kps[KP.leftKnee] = [500, 999, 0.6];
    kps[KP.rightKnee] = [500, 999, 0.6];
    kps[KP.leftAnkle] = [500, 1000, 0.55];
    kps[KP.rightAnkle] = [500, 1000, 0.55];
    const { angles, flags } = computeAngles2D(kps, 1000, 1000);
    expect(flags.legs).toBe(false); // flagged for review...
    expect(angles.legAngle).toBeDefined(); // ...value still present
    expect(flags.trunk).toBe(true); // in-frame anchors unaffected
  });

  it("low-score joints flag measured:false but still produce values", () => {
    const kps = uprightFigure();
    kps[KP.leftKnee][2] = 0.1;
    kps[KP.rightKnee][2] = 0.1;
    const { angles, flags } = computeAngles2D(kps, 1000, 1000);
    expect(flags.legs).toBe(false); // flagged for review...
    expect(angles.legAngle).toBeDefined(); // ...but never suppressed
    expect(angles.legAngle).toBeCloseTo(0, 5);
  });

  it("every flag covers every joint its value reads (no unguarded joints)", () => {
    const base = () => {
      const kps = uprightFigure();
      // Make the scored side unambiguous (right arm slightly worse).
      kps[KP.rightElbow] = [560, 440, 1];
      kps[KP.rightWrist] = [560, 580, 1];
      return kps;
    };
    // Scored-side HIP is read by the upper-arm trunk line -> must clear its flag.
    let kps = base();
    kps[KP.rightHip][2] = 0.1;
    expect(computeAngles2D(kps, 1000, 1000, "right").flags.upperArm).toBe(false);
    // HIPS are read by the neck's trunkUp -> must clear the neck flag.
    kps = base();
    kps[KP.leftHip][2] = 0.1;
    kps[KP.rightHip][2] = 0.1;
    expect(computeAngles2D(kps, 1000, 1000).flags.neck).toBe(false);
    // NOSE is read by the neck facing sign -> must clear the neck flag.
    kps = base();
    kps[KP.nose][2] = 0.1;
    expect(computeAngles2D(kps, 1000, 1000).flags.neck).toBe(false);
    // ELBOW is read by the wrist's forearm vector -> must clear the wrist flag.
    kps = base();
    kps[KP.rightElbow][2] = 0.1;
    expect(wristFlexion2D(kps, "right", 1000, 1000).measured).toBe(false);
  });

  it("forcedSide overrides the worse-arm heuristic", () => {
    const kps = uprightFigure();
    kps[KP.rightElbow] = [650, 300, 1]; // right is worse
    const { angles } = computeAngles2D(kps, 1000, 1000, "left");
    expect(angles.side).toBe("left");
  });

  it("side-bend is never claimed as measured from a single 2D view", () => {
    const { angles } = computeAngles2D(uprightFigure(), 1000, 1000);
    expect(angles.neckSideBend).toBeUndefined();
    expect(angles.trunkSideBend).toBeUndefined();
  });
});

describe("wristFlexion2D", () => {
  it("neutral hand in line with forearm reads ~0 and measured", () => {
    const { angle, measured } = wristFlexion2D(uprightFigure(), "right", 1000, 1000);
    expect(angle).toBeCloseTo(0, 5);
    expect(measured).toBe(true);
  });

  it("bent hand reads its flexion", () => {
    const kps = uprightFigure();
    kps[KP.rightMiddleMcp] = [555, 585, 1]; // hand ray horizontal, forearm vertical
    const { angle } = wristFlexion2D(kps, "right", 1000, 1000);
    expect(angle).toBeCloseTo(90, 5);
  });

  it("low hand-keypoint score flags unmeasured but still returns the value", () => {
    const kps = uprightFigure();
    kps[KP.rightHandRoot][2] = KP_SCORE_FLOOR - 0.1;
    const { angle, measured } = wristFlexion2D(kps, "right", 1000, 1000);
    expect(measured).toBe(false);
    expect(Number.isFinite(angle)).toBe(true);
  });
});

describe("isOffProfile", () => {
  it("true side view is not off-profile", () => {
    expect(isOffProfile(uprightFigure())).toBe(false);
  });

  it("frontal view (wide shoulders) is off-profile", () => {
    const kps = uprightFigure();
    kps[KP.leftShoulder] = [340, 300, 1];
    kps[KP.rightShoulder] = [660, 300, 1];
    kps[KP.leftHip] = [420, 600, 1];
    kps[KP.rightHip] = [580, 600, 1];
    expect(isOffProfile(kps)).toBe(true);
  });
});

describe("computeAngles2D on real captured fixtures", () => {
  // weaver-loom-1..3 are keypoints captured from real loin-loom field photos
  // (the project's actual subject: floor-seated, backward-leaning, arms
  // elevated) - the hardest case for hip occlusion and trunk reference.
  const names = [
    "office-typing",
    "warehouse-lifting",
    "assembly-standing",
    "weaver-loom-1",
    "weaver-loom-2",
    "weaver-loom-3",
  ];

  it.each(names)("%s produces finite, in-range angles", (name) => {
    const fx = fixture(name);
    const { angles, flags } = computeAngles2D(fx.keypoints, fx.image.w, fx.image.h);
    for (const v of [angles.upperArm, angles.lowerArm, angles.trunk]) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(180);
    }
    expect(angles.neck).toBeGreaterThanOrEqual(-45);
    expect(angles.neck).toBeLessThanOrEqual(90);
    expect(angles.confidence).toBeGreaterThan(0.5);
    // Clean sample photos: core angles should be confidently measured.
    expect(flags.upperArm && flags.lowerArm && flags.neck && flags.trunk).toBe(true);
  });
});
