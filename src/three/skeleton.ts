import type { Landmark } from "@mediapipe/tasks-vision";

/**
 * Mapping from MediaPipe world landmarks to a three.js scene.
 *
 * MediaPipe world landmarks are metric (meters), hip-centered, with x right,
 * y DOWN, z toward the camera. three.js is y-up right-handed, so the
 * conversion negates y and z. No scaling - one scene unit = one meter.
 */
export type Vec3 = [number, number, number];

export const toScene = (lm: Landmark): Vec3 => [lm.x, -lm.y, -lm.z];

/** Landmark indices (MediaPipe Pose, 33-point topology). */
export const LM = {
  nose: 0,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;

/** The joints the viewer renders (the ones the assessment actually scores).
 * The head is NOT a landmark here - it renders as a synthetic sphere at
 * `headRef` (the ear midpoint the neck angle is measured to), so the neck
 * bone and the head visual always connect. */
export const JOINT_IDS: number[] = [
  LM.leftShoulder,
  LM.rightShoulder,
  LM.leftElbow,
  LM.rightElbow,
  LM.leftWrist,
  LM.rightWrist,
  LM.leftHip,
  LM.rightHip,
  LM.leftKnee,
  LM.rightKnee,
  LM.leftAnkle,
  LM.rightAnkle,
];

/** A renderable bone: two endpoints plus the assessment component it belongs to. */
export interface Bone {
  a: number | "shoulderMid" | "hipMid" | "headRef";
  b: number | "shoulderMid" | "hipMid" | "headRef";
  /** Which scored component colors this bone (see riskColors.ts). */
  component: "upperArm" | "lowerArm" | "trunk" | "neck" | "legs" | "frame";
  side?: "left" | "right";
}

/** Bone list: real landmark segments plus the synthetic trunk/neck midlines
 * that mirror how angles.ts actually measures trunk and neck. */
export const BONES: Bone[] = [
  { a: LM.leftShoulder, b: LM.leftElbow, component: "upperArm", side: "left" },
  { a: LM.rightShoulder, b: LM.rightElbow, component: "upperArm", side: "right" },
  { a: LM.leftElbow, b: LM.leftWrist, component: "lowerArm", side: "left" },
  { a: LM.rightElbow, b: LM.rightWrist, component: "lowerArm", side: "right" },
  { a: LM.leftShoulder, b: LM.rightShoulder, component: "trunk" },
  { a: LM.leftHip, b: LM.rightHip, component: "trunk" },
  { a: "shoulderMid", b: "hipMid", component: "trunk" },
  { a: "shoulderMid", b: "headRef", component: "neck" },
  { a: LM.leftHip, b: LM.leftKnee, component: "legs", side: "left" },
  { a: LM.rightHip, b: LM.rightKnee, component: "legs", side: "right" },
  { a: LM.leftKnee, b: LM.leftAnkle, component: "legs", side: "left" },
  { a: LM.rightKnee, b: LM.rightAnkle, component: "legs", side: "right" },
];

/** Joint → component map for coloring the joint spheres. */
export function jointComponent(id: number): Bone["component"] {
  switch (id) {
    case LM.leftShoulder:
    case LM.rightShoulder:
    case LM.leftElbow:
    case LM.rightElbow:
      return "upperArm";
    case LM.leftWrist:
    case LM.rightWrist:
      return "lowerArm";
    case LM.nose:
      return "neck";
    case LM.leftHip:
    case LM.rightHip:
      return "trunk";
    default:
      return "legs";
  }
}

export interface SkeletonPoints {
  /** Scene-space position for each of the 33 landmarks. */
  points: Vec3[];
  shoulderMid: Vec3;
  hipMid: Vec3;
  /** Head reference (ear midpoint, falling back to the nose) - matches angles.ts. */
  headRef: Vec3;
  /** Lowest y in the scene (foot level) for placing the ground grid. */
  floorY: number;
}

const mid = (a: Vec3, b: Vec3): Vec3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

/** Precompute scene positions + synthetic midpoints from world landmarks. */
export function buildSkeleton(world: Landmark[]): SkeletonPoints | null {
  if (!world || world.length < 29) return null;
  const points = world.map(toScene);
  const shoulderMid = mid(points[LM.leftShoulder], points[LM.rightShoulder]);
  const hipMid = mid(points[LM.leftHip], points[LM.rightHip]);
  const leftEarVis = world[LM.leftEar]?.visibility ?? 0;
  const rightEarVis = world[LM.rightEar]?.visibility ?? 0;
  const headRef =
    leftEarVis > 0.3 && rightEarVis > 0.3
      ? mid(points[LM.leftEar], points[LM.rightEar])
      : points[LM.nose];
  const floorY = Math.min(...points.map((p) => p[1]));
  return { points, shoulderMid, hipMid, headRef, floorY };
}

/** Resolve a bone endpoint (landmark index or synthetic key) to a position. */
export function resolvePoint(sk: SkeletonPoints, key: Bone["a"]): Vec3 {
  if (key === "shoulderMid") return sk.shoulderMid;
  if (key === "hipMid") return sk.hipMid;
  if (key === "headRef") return sk.headRef;
  return sk.points[key];
}
