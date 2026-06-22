import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

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
} as const;

export type Side = "left" | "right";

export interface AngleSet {
  upperArm: number; // elevation of upper arm from the trunk line
  lowerArm: number; // forearm flexion (180 − elbow angle)
  neck: number; // head flexion relative to trunk
  trunk: number; // trunk inclination from vertical
  side: Side;
  confidence: number; // mean visibility of the chosen side's key joints
}

interface P {
  x: number;
  y: number;
}

const vis = (lms: NormalizedLandmark[], i: number) => lms[i]?.visibility ?? 0;
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

function pickSide(lms: NormalizedLandmark[]): Side {
  const left = vis(lms, LM.leftShoulder) + vis(lms, LM.leftElbow) + vis(lms, LM.leftWrist) + vis(lms, LM.leftHip);
  const right =
    vis(lms, LM.rightShoulder) + vis(lms, LM.rightElbow) + vis(lms, LM.rightWrist) + vis(lms, LM.rightHip);
  return right >= left ? "right" : "left";
}

/**
 * Compute the sagittal-plane RULA angles from 2D normalized landmarks. A side
 * view (as in loom photos) gives the truest reading. Returns null if no pose.
 */
export function computeAngles(lms: NormalizedLandmark[], forcedSide?: Side): AngleSet | null {
  if (!lms || lms.length < 25) return null;
  const side = forcedSide ?? pickSide(lms);
  const i =
    side === "right"
      ? { sh: LM.rightShoulder, el: LM.rightElbow, wr: LM.rightWrist, hip: LM.rightHip, ear: LM.rightEar }
      : { sh: LM.leftShoulder, el: LM.leftElbow, wr: LM.leftWrist, hip: LM.leftHip, ear: LM.leftEar };

  const shoulder = pt(lms, i.sh);
  const elbow = pt(lms, i.el);
  const wrist = pt(lms, i.wr);
  const hip = pt(lms, i.hip);
  const ear = vis(lms, i.ear) > 0.3 ? pt(lms, i.ear) : pt(lms, LM.nose);
  const shoulderMid = mid(pt(lms, LM.leftShoulder), pt(lms, LM.rightShoulder));
  const hipMid = mid(pt(lms, LM.leftHip), pt(lms, LM.rightHip));

  // Upper arm: angle between shoulder→elbow and shoulder→hip (trunk line down).
  const upperArm = angleBetween(sub(elbow, shoulder), sub(hip, shoulder));

  // Lower arm: forearm flexion = 180 − elbow included angle.
  const elbowAngle = angleBetween(sub(shoulder, elbow), sub(wrist, elbow));
  const lowerArm = 180 - elbowAngle;

  // Neck: head elevation vs trunk-up line.
  const neck = angleBetween(sub(ear, shoulder), sub(shoulder, hip));

  // Trunk: inclination of the trunk line from true vertical.
  const trunk = angleBetween(sub(shoulderMid, hipMid), { x: 0, y: 1 });

  const confidence =
    (vis(lms, i.sh) + vis(lms, i.el) + vis(lms, i.wr) + vis(lms, i.hip)) / 4;

  return { upperArm, lowerArm, neck, trunk, side, confidence };
}
