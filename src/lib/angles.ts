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

interface P3 {
  x: number;
  y: number;
  z: number;
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

const sub3D = (q: P3, p: P3): P3 => ({
  x: q.x - p.x,
  y: q.y - p.y,
  z: q.z - p.z,
});

function angleBetween3D(u: P3, v: P3): number {
  const du = Math.hypot(u.x, u.y, u.z);
  const dv = Math.hypot(v.x, v.y, v.z);
  if (du === 0 || dv === 0) return 0;
  const cos = Math.min(1, Math.max(-1, (u.x * v.x + u.y * v.y + u.z * v.z) / (du * dv)));
  return (Math.acos(cos) * 180) / Math.PI;
}

const dot3D = (u: P3, v: P3): number => u.x * v.x + u.y * v.y + u.z * v.z;
const cross3D = (u: P3, v: P3): P3 => ({
  x: u.y * v.z - u.z * v.y,
  y: u.z * v.x - u.x * v.z,
  z: u.x * v.y - u.y * v.x,
});

/**
 * Sign a neck/trunk magnitude as flexion (+, forward) or extension (-, backward).
 * `angleBetween3D` only ever returns 0-180, so without this the extension bins in
 * neckScore/trunkScore (`angle < 0`) were unreachable and a head tipped BACK was
 * mis-scored as neutral. Anatomical "forward" is derived from the body itself so
 * it's camera-independent: forward = up × shoulderAxis, where shoulderAxis points
 * from the (anatomical) left shoulder to the right shoulder and up runs hip→shoulder.
 * A positive projection of the segment onto forward = flexion; negative = extension.
 */
function sagittalSign(segment: P3, up: P3, shoulderAxis: P3): number {
  const forward = cross3D(up, shoulderAxis);
  return dot3D(segment, forward) >= 0 ? 1 : -1;
}

/**
 * Only call the neck "extension" (negative) once it's clearly beyond a neutral
 * upright head. neckScore has a hard cliff - ANY negative angle scores 4 - so a
 * degree or two of backward tilt from landmark noise must NOT flip an upright
 * neck from 1 to 4 (that would recreate the cross-machine score instability).
 */
const NECK_EXT_DEADZONE_DEG = 5;
/** Above this, a "backward" head-to-trunk angle is not real extension - it's the
 * obtuse angle you get when the TORSO is bent far forward (or the nose fallback is
 * used while looking down). Real neck extension is a small backward tilt. Treating
 * a 100°+ angle as extension wrongly triggered neckScore's score-4 cliff. */
const NECK_EXT_MAX_DEG = 45;
/** Physiological flexion cap for display sanity: neck flexion beyond this is not
 * meaningful and only produced absurd readouts like 114°. Score-equivalent - RULA
 * bins everything past 20° the same - so this only tidies the reported number. */
const NECK_FLEX_MAX_DEG = 90;

/** Signed neck angle: + flexion (forward), - extension (backward). A small neutral
 * deadzone keeps near-upright jitter in the flexion bins; extension is only honored
 * within a realistic range so a bent-over torso isn't mislabeled as head extension. */
function signedNeck(mag: number, sign: number): number {
  if (sign < 0 && mag > NECK_EXT_DEADZONE_DEG && mag <= NECK_EXT_MAX_DEG) return -mag;
  return Math.min(mag, NECK_FLEX_MAX_DEG);
}

const SIDE_IDX = {
  left: { sh: LM.leftShoulder, el: LM.leftElbow, wr: LM.leftWrist, hip: LM.leftHip, kn: LM.leftKnee, an: LM.leftAnkle },
  right: { sh: LM.rightShoulder, el: LM.rightElbow, wr: LM.rightWrist, hip: LM.rightHip, kn: LM.rightKnee, an: LM.rightAnkle },
} as const;

function sideAngles(lms: NormalizedLandmark[], s: Side, world?: Landmark[]): SideAngles {
  const i = SIDE_IDX[s];
  const visibility = (vis(lms, i.sh) + vis(lms, i.el) + vis(lms, i.wr)) / 3;

  let upperArm: number;
  let lowerArm: number;
  let legAngle: number | undefined;

  if (world && world.length >= 25 && world[i.sh] && world[i.el] && world[i.wr] && world[i.hip]) {
    const sh3D = world[i.sh];
    const el3D = world[i.el];
    const wr3D = world[i.wr];
    const hip3D = world[i.hip];

    // Upper arm: angle between shoulder->elbow and shoulder->hip (trunk line down).
    upperArm = angleBetween3D(sub3D(el3D, sh3D), sub3D(hip3D, sh3D));
    // Lower arm: forearm flexion = 180 - elbow included angle.
    lowerArm = 180 - angleBetween3D(sub3D(sh3D, el3D), sub3D(wr3D, el3D));

    const kneeVisible = vis(lms, i.kn) > 0.3 && vis(lms, i.an) > 0.3;
    if (kneeVisible && world[i.kn] && world[i.an]) {
      const kn3D = world[i.kn];
      const an3D = world[i.an];
      legAngle = 180 - angleBetween3D(sub3D(hip3D, kn3D), sub3D(an3D, kn3D));
    }
  } else {
    // 2D Fallback - shouldn't happen in normal operation (MediaPipe returns
    // worldLandmarks alongside landmarks for any detected pose); instrumented
    // defensively so a future regression here is visible instead of silent.
    if (typeof console !== "undefined") console.warn("[angles] sideAngles fell back to 2D (no/short worldLandmarks)");
    const shoulder = pt(lms, i.sh);
    const elbow = pt(lms, i.el);
    const wrist = pt(lms, i.wr);
    const hip = pt(lms, i.hip);

    upperArm = angleBetween(sub(elbow, shoulder), sub(hip, shoulder));
    lowerArm = 180 - angleBetween(sub(shoulder, elbow), sub(wrist, elbow));

    const kneeVisible = vis(lms, i.kn) > 0.3 && vis(lms, i.an) > 0.3;
    legAngle = kneeVisible
      ? 180 - angleBetween(sub(hip, pt(lms, i.kn)), sub(pt(lms, i.an), pt(lms, i.kn)))
      : undefined;
  }

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
  // Reject only when no detected hand sits near the scored wrist. 0.2 (of the
  // normalized frame) is deliberately generous: after the ROI crop is remapped to
  // full-frame coords the hand's wrist can land a little off the pose wrist, and
  // too tight a gate was silently discarding real hand detections (the wrist then
  // fell back to assumed-neutral, so the Hand model looked unused).
  if (!best || bestD > 0.2) return null;

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
export const WORLD_VIS_FLOOR = 0.5;

/** True when a landmark's visibility clears `threshold` - the single shared
 * trust check every consumer of a landmark coordinate should use before
 * reading `.x`/`.y`/`.z`, instead of each hand-rolling its own (in)consistent
 * decision. Deliberately single-landmark, not an array helper - callers need
 * different composition (all-visible vs mean-visible vs any-visible). */
export function isVisible(lm: { visibility?: number } | undefined, threshold = WORLD_VIS_FLOOR): boolean {
  return (lm?.visibility ?? 0) > threshold;
}

/** A joint counts as "reliably seen" above this visibility. */
const CONF_VIS_FLOOR = 0.5;

/**
 * Pose validity in 0..1: is a real, whole upper body actually detected?
 *
 * Two independent failure modes of MediaPipe on out-of-envelope photos:
 *
 * 1. PARTIAL BODY - only legs/waist in frame, head+torso cropped off. Some
 *    off-frame anchors get normalized coords outside [0,1] and/or low visibility.
 *    Caught by the in-frame check on the core anchors (head, both shoulders, both
 *    hips).
 * 2. DEGENERATE FIT - MediaPipe crams the whole skeleton onto a partial body with
 *    every landmark in-frame and "visible" (the loom photo: the standing man's
 *    lower body). The in-frame check can't see it, but the 3D world landmarks
 *    collapse - the head sits AT the shoulders (no neck extent). Caught by
 *    requiring the head to sit clearly ABOVE the shoulders along the trunk axis.
 *
 * Deliberately avoids generic proportion/symmetry ratios (round 2): MediaPipe
 * regularizes those, so they both miss hallucinations and punish valid
 * foreshortened/seated poses. Head-above-shoulders is the one thing every real
 * pose keeps and these collapsed fits lose.
 */
const VALIDITY_VIS_FLOOR = 0.5;
/** How far outside the normalized [0,1] image a landmark may sit before it's "off-frame". */
const FRAME_MARGIN = 0.05;
/** Head must sit at least this fraction of the torso length above the shoulders. */
const MIN_NECK_RATIO = 0.1;
/** Below this metric torso length the world fit is collapsed/degenerate. */
const MIN_TORSO_M = 0.1;

export function computePoseValidity(lms: NormalizedLandmark[], world?: Landmark[]): number {
  if (!lms || lms.length < 25) return 0;

  const inFrame = (i: number): boolean => {
    const p = lms[i];
    if (!p) return false;
    if ((p.visibility ?? 0) < VALIDITY_VIS_FLOOR) return false;
    return (
      p.x >= -FRAME_MARGIN && p.x <= 1 + FRAME_MARGIN && p.y >= -FRAME_MARGIN && p.y <= 1 + FRAME_MARGIN
    );
  };

  // (1) In-frame check on the core anchors.
  const headOk = inFrame(LM.nose) || inFrame(LM.leftEar) || inFrame(LM.rightEar);
  const anchors = [headOk, inFrame(LM.leftShoulder), inFrame(LM.rightShoulder), inFrame(LM.leftHip), inFrame(LM.rightHip)];
  let validity = anchors.filter(Boolean).length / anchors.length;

  // (2) Degenerate-fit check (world landmarks): head must be above the shoulders.
  if (world && world.length >= 25 && world[LM.leftShoulder] && world[LM.rightShoulder] && world[LM.leftHip] && world[LM.rightHip]) {
    const mid = (a: P3, b: P3): P3 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
    const shMid = mid(world[LM.leftShoulder], world[LM.rightShoulder]);
    const hipMid = mid(world[LM.leftHip], world[LM.rightHip]);
    const head =
      vis(lms, LM.leftEar) > 0.3 && vis(lms, LM.rightEar) > 0.3 && world[LM.leftEar] && world[LM.rightEar]
        ? mid(world[LM.leftEar], world[LM.rightEar])
        : world[LM.nose] ?? shMid;

    const trunkUp = sub3D(shMid, hipMid); // hip -> shoulder, points up the torso
    const torsoLen = Math.hypot(trunkUp.x, trunkUp.y, trunkUp.z);
    if (torsoLen < MIN_TORSO_M) {
      validity = Math.min(validity, 0.2); // collapsed torso
    } else {
      // Component of (shoulderMid -> head) along the trunk-up axis, as a fraction of torso.
      const neckExtent = dot3D(sub3D(head, shMid), trunkUp) / torsoLen;
      if (neckExtent / torsoLen < MIN_NECK_RATIO) validity = Math.min(validity, 0.2); // head not above shoulders
    }
  }

  return validity;
}

/**
 * Real detection confidence for the scored posture, in 0..1.
 *
 * The old metric was just the mean visibility of four joints, which MediaPipe
 * saturates near 0.99 for anyone in frame - so the UI's "AI Confidence" was
 * effectively a constant ~99% regardless of pose quality (the reported
 * hallucination). This instead combines, over exactly the landmarks the RULA/REBA
 * score depends on:
 *   - coverage: fraction of those joints actually visible (>= CONF_VIS_FLOOR)
 *   - quality:  their mean visibility
 * Multiplying the two makes a partly-occluded or ambiguous pose read genuinely
 * lower (an occluded joint drops both factors), while a cleanly-detected subject
 * still scores high. This is what gates scoring and what the UI/PDF report.
 */
export function computeDetectionConfidence(lms: NormalizedLandmark[], side: Side, world?: Landmark[]): number {
  const s = SIDE_IDX[side];
  const headIdx = vis(lms, LM.leftEar) >= vis(lms, LM.rightEar) ? LM.leftEar : LM.rightEar;
  // Scored arm + both-shoulder/both-hip trunk anchors + head (neck). Deduped.
  const required = [
    ...new Set([
      s.sh, s.el, s.wr, s.hip,
      LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip,
      headIdx,
    ]),
  ];
  const viss = required.map((idx) => vis(lms, idx));
  const seen = viss.filter((v) => v >= CONF_VIS_FLOOR).length;
  const coverage = seen / required.length;
  const quality = viss.reduce((a, b) => a + b, 0) / required.length;
  // Multiply in pose validity so a partial-body detection (cropped/extrapolated)
  // OR a degenerate world fit (head collapsed onto the shoulders) reads low and is
  // dropped by the occlusion gate instead of producing a confident bogus score.
  return coverage * quality * computePoseValidity(lms, world);
}

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

  const left = sideAngles(lms, "left", world);
  const right = sideAngles(lms, "right", world);

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
  let neck: number;
  let trunk: number;

  const earVis = vis(lms, LM.leftEar) >= vis(lms, LM.rightEar) ? LM.leftEar : LM.rightEar;

  if (world && world.length >= 25) {
    const shMid3D = {
      x: (world[LM.leftShoulder].x + world[LM.rightShoulder].x) / 2,
      y: (world[LM.leftShoulder].y + world[LM.rightShoulder].y) / 2,
      z: (world[LM.leftShoulder].z + world[LM.rightShoulder].z) / 2,
    };
    const hipMid3D = {
      x: (world[LM.leftHip].x + world[LM.rightHip].x) / 2,
      y: (world[LM.leftHip].y + world[LM.rightHip].y) / 2,
      z: (world[LM.leftHip].z + world[LM.rightHip].z) / 2,
    };
    const head3D = (vis(lms, LM.leftEar) > 0.3 && vis(lms, LM.rightEar) > 0.3)
      ? {
          x: (world[LM.leftEar].x + world[LM.rightEar].x) / 2,
          y: (world[LM.leftEar].y + world[LM.rightEar].y) / 2,
          z: (world[LM.leftEar].z + world[LM.rightEar].z) / 2,
        }
      : vis(lms, earVis) > 0.3 ? world[earVis] : world[LM.nose];

    // Neck: angle between head-vector (shoulderMid -> head) and trunk-vector (hipMid -> shoulderMid),
    // signed so a head tipped BACK reads as extension (negative) rather than neutral.
    const neckSeg = sub3D(head3D, shMid3D);
    const trunkUp = sub3D(shMid3D, hipMid3D);
    const shoulderAxis = sub3D(world[LM.rightShoulder], world[LM.leftShoulder]);
    neck = signedNeck(angleBetween3D(neckSeg, trunkUp), sagittalSign(neckSeg, trunkUp, shoulderAxis));

    // Trunk: angle between trunk-vector (hipMid -> shoulderMid) and vertical gravity
    // vector pointing UP. Left unsigned: RULA's trunk model is flexion-only (no
    // extension category), so magnitude is correct.
    trunk = angleBetween3D(trunkUp, { x: 0, y: -1, z: 0 });
  } else {
    // 2D Fallback - see the matching note in sideAngles(); instrumented the
    // same way since this is the neck/trunk counterpart of that branch.
    if (typeof console !== "undefined") console.warn("[angles] computeAngles fell back to 2D (no/short worldLandmarks)");
    const shoulderMid = mid(pt(lms, LM.leftShoulder), pt(lms, LM.rightShoulder));
    const hipMid = mid(pt(lms, LM.leftHip), pt(lms, LM.rightHip));
    const head = (vis(lms, LM.leftEar) > 0.3 && vis(lms, LM.rightEar) > 0.3)
      ? mid(pt(lms, LM.leftEar), pt(lms, LM.rightEar))
      : vis(lms, earVis) > 0.3 ? pt(lms, earVis) : pt(lms, LM.nose);

    neck = angleBetween(sub(head, shoulderMid), sub(shoulderMid, hipMid));
    trunk = angleBetween(sub(shoulderMid, hipMid), { x: 0, y: 1 });
  }

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

  const confidence = computeDetectionConfidence(lms, side, world);

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
