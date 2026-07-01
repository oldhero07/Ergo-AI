import type { Landmark, NormalizedLandmark } from "@mediapipe/tasks-vision";

/** MediaPipe Pose landmark indices we use. */
const LM = {
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

export type Side = "left" | "right";

/** Per-side arm (and leg) angles, so the scorer can pick the worst side. */
export interface SideAngles {
  upperArm: number; // elevation of upper arm from the trunk line
  lowerArm: number; // forearm flexion (180 - elbow angle)
  legAngle?: number; // knee flexion, when the lower body is visible
  visibility: number; // mean visibility of this side's shoulder/elbow/wrist
}

export interface AngleSet {
  upperArm: number; // worst side's upper-arm elevation
  lowerArm: number; // worst side's forearm flexion
  neck: number; // head flexion relative to trunk
  trunk: number; // trunk inclination from vertical
  /** Knee flexion (180 - knee included angle), for REBA legs. Omitted/unreliable
   * when the lower body isn't visible - callers should treat it as optional. */
  legAngle?: number;
  /** The side that was scored (the worse of the two, among visible sides). */
  side: Side;
  /** Both sides' angles, for display/transparency. */
  sides?: { left: SideAngles; right: SideAngles };
  /** Measured lateral flexion (side-bend) from 3D landmarks, when reliable. */
  neckSideBend?: boolean;
  trunkSideBend?: boolean;
  confidence: number; // mean visibility of the scored side's key joints
}

interface P {
  x: number;
  y: number;
}

const vis = (lms: { visibility?: number }[], i: number) => lms[i]?.visibility ?? 0;
const pt = (lms: NormalizedLandmark[], i: number): P => ({ x: lms[i].x, y: lms[i].y });
const mid = (a: P, b: P): P => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Vector from p to q, with y flipped so "up" on screen is +y. */
const sub = (q: P, p: P): P => ({ x: q.x - p.x, y: -(q.y - p.y) });

function angleBetween(u: P, v: P): number {
  const du = Math.hypot(u.x, u.y);
  const dv = Math.hypot(v.x, v.y);
  if (du === 0 || dv === 0) return 0;
  const cos = Math.min(1, Math.max(-1, (u.x * v.x + u.y * v.y) / (du * dv)));
  return (Math.acos(cos) * 180) / Math.PI;
}

const SIDE_IDX = {
  left: { sh: LM.leftShoulder, el: LM.leftElbow, wr: LM.leftWrist, hip: LM.leftHip, kn: LM.leftKnee, an: LM.leftAnkle },
  right: { sh: LM.rightShoulder, el: LM.rightElbow, wr: LM.rightWrist, hip: LM.rightHip, kn: LM.rightKnee, an: LM.rightAnkle },
} as const;

function sideAngles(lms: NormalizedLandmark[], s: Side): SideAngles {
  const i = SIDE_IDX[s];
  const shoulder = pt(lms, i.sh);
  const elbow = pt(lms, i.el);
  const wrist = pt(lms, i.wr);
  const hip = pt(lms, i.hip);

  // Upper arm: angle between shoulder->elbow and shoulder->hip (trunk line down).
  const upperArm = angleBetween(sub(elbow, shoulder), sub(hip, shoulder));
  // Lower arm: forearm flexion = 180 - elbow included angle.
  const lowerArm = 180 - angleBetween(sub(shoulder, elbow), sub(wrist, elbow));

  const kneeVisible = vis(lms, i.kn) > 0.3 && vis(lms, i.an) > 0.3;
  const legAngle = kneeVisible
    ? 180 - angleBetween(sub(hip, pt(lms, i.kn)), sub(pt(lms, i.an), pt(lms, i.kn)))
    : undefined;

  const visibility = (vis(lms, i.sh) + vis(lms, i.el) + vis(lms, i.wr)) / 3;
  return { upperArm, lowerArm, legAngle, visibility };
}

/**
 * Wrist flexion/extension in degrees, from pose forearm + hand landmarks (same
 * image space). Neutral (hand in line with forearm) ~ 0. Returns null when no
 * detected hand sits near the scored wrist. Radial/ulnar deviation is NOT derived
 * (out-of-plane from a single view) - it stays assumed and is flagged in the UI.
 */
export function measureWristFlexion(
  poseLms: NormalizedLandmark[],
  hands: NormalizedLandmark[][],
  side: Side,
): number | null {
  if (!hands || !hands.length) return null;
  const i = SIDE_IDX[side];
  const elbow = pt(poseLms, i.el);
  const wrist = pt(poseLms, i.wr);

  let best: NormalizedLandmark[] | null = null;
  let bestD = Infinity;
  for (const h of hands) {
    if (!h?.[0]) continue;
    const d = Math.hypot(h[0].x - wrist.x, h[0].y - wrist.y);
    if (d < bestD) {
      bestD = d;
      best = h;
    }
  }
  if (!best || bestD > 0.15) return null; // no hand near the scored wrist

  const forearm = sub(wrist, elbow); // elbow -> wrist
  const hand = sub(pt(best, 9), pt(best, 0)); // wrist -> middle-finger MCP
  return angleBetween(forearm, hand);
}

/** Heuristic RULA "load" of an arm so we can pick the worse side without importing
 * the scorer: higher elevation scores worse, and a forearm outside 60-100° adds. */
function armLoad(a: SideAngles): number {
  const elevation = Math.max(a.upperArm, a.upperArm < -20 ? 30 : 0); // extension also scores 2
  const forearmPenalty = a.lowerArm >= 60 && a.lowerArm <= 100 ? 0 : 15;
  return elevation + forearmPenalty;
}

/** Lateral flexion (side-bend) in degrees from 3D world landmarks: the coronal
 * component of a body vector's tilt from vertical. World frame is y-down, x-right,
 * z-depth, so "up" = -y, lateral = x, sagittal = z. */
function lateralFlexionDeg(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const up = -(a.y - b.y);
  const lateral = a.x - b.x;
  if (up <= 0) return 0;
  return (Math.atan2(Math.abs(lateral), up) * 180) / Math.PI;
}

// Only flag a measured side-bend when it's clearly beyond a natural lean and the
// 3D estimate is trustworthy - "measure what's reliable, never guess."
const SIDEBEND_TRUNK_DEG = 15;
const SIDEBEND_NECK_DEG = 18;
const WORLD_VIS_FLOOR = 0.5;

/**
 * Compute the assessment angles from a detected pose. Both arms/legs are scored
 * and the worse (among sufficiently visible) side is reported; neck and trunk use
 * the body midline. When 3D world landmarks are supplied, neck/trunk lateral
 * side-bend is measured too. Returns null if no pose.
 */
export function computeAngles(
  lms: NormalizedLandmark[],
  world?: Landmark[],
  forcedSide?: Side,
): AngleSet | null {
  if (!lms || lms.length < 25) return null;

  const left = sideAngles(lms, "left");
  const right = sideAngles(lms, "right");

  // Eligible = visible enough to trust; among those, the worse arm is scored.
  const eligible: Side[] = [];
  if (left.visibility > 0.3) eligible.push("left");
  if (right.visibility > 0.3) eligible.push("right");
  let side: Side;
  if (forcedSide) side = forcedSide;
  else if (eligible.length === 2) side = armLoad(left) >= armLoad(right) ? "left" : "right";
  else if (eligible.length === 1) side = eligible[0];
  else side = right.visibility >= left.visibility ? "right" : "left";

  const chosen = side === "left" ? left : right;

  // Neck & trunk from the body midline (side-independent).
  const shoulderMid = mid(pt(lms, LM.leftShoulder), pt(lms, LM.rightShoulder));
  const hipMid = mid(pt(lms, LM.leftHip), pt(lms, LM.rightHip));
  const earVis = vis(lms, LM.leftEar) >= vis(lms, LM.rightEar) ? LM.leftEar : LM.rightEar;
  const head = vis(lms, earVis) > 0.3 ? pt(lms, earVis) : pt(lms, LM.nose);
  const neck = angleBetween(sub(head, shoulderMid), sub(shoulderMid, hipMid));
  const trunk = angleBetween(sub(shoulderMid, hipMid), { x: 0, y: 1 });

  // 3D side-bend (measured, conservatively gated on world-landmark confidence).
  let neckSideBend: boolean | undefined;
  let trunkSideBend: boolean | undefined;
  if (world && world.length >= 25) {
    const wShMid = {
      x: (world[LM.leftShoulder].x + world[LM.rightShoulder].x) / 2,
      y: (world[LM.leftShoulder].y + world[LM.rightShoulder].y) / 2,
    };
    const wHipMid = {
      x: (world[LM.leftHip].x + world[LM.rightHip].x) / 2,
      y: (world[LM.leftHip].y + world[LM.rightHip].y) / 2,
    };
    const trunkVisOk =
      Math.min(vis(lms, LM.leftShoulder), vis(lms, LM.rightShoulder), vis(lms, LM.leftHip), vis(lms, LM.rightHip)) >
      WORLD_VIS_FLOOR;
    if (trunkVisOk) trunkSideBend = lateralFlexionDeg(wShMid, wHipMid) > SIDEBEND_TRUNK_DEG;

    const headVisOk = vis(lms, earVis) > WORLD_VIS_FLOOR;
    if (headVisOk) neckSideBend = lateralFlexionDeg(world[earVis], wShMid) > SIDEBEND_NECK_DEG;
  }

  const i = SIDE_IDX[side];
  const confidence = (vis(lms, i.sh) + vis(lms, i.el) + vis(lms, i.wr) + vis(lms, i.hip)) / 4;

  return {
    upperArm: chosen.upperArm,
    lowerArm: chosen.lowerArm,
    neck,
    trunk,
    legAngle: chosen.legAngle,
    side,
    sides: { left, right },
    neckSideBend,
    trunkSideBend,
    confidence,
  };
}
