/**
 * Assessment angles from COCO-WholeBody 133 keypoints (server inference), in
 * the 2D sagittal (image) plane. This is the methodologically standard way to
 * apply RULA/REBA to a side-view photo; the capture guidance asks for a profile
 * shot, and an off-profile warning flags foreshortening instead of guessing.
 *
 * CONFIDENCE PHILOSOPHY (governs everything here): RTMPose keypoints are real
 * geometric measurements even at low confidence - unlike MediaPipe it does not
 * hallucinate placements for occluded joints. A low score therefore NEVER
 * suppresses an angle; it only clears that angle's `measured` flag so the UI
 * highlights it for expert review/override. The only hard failure is the
 * person detector finding nobody (handled upstream in remoteAnalyze).
 *
 * Emits the same `AngleSet` shape as angles.ts so `buildAutoInput()` and the
 * scoring engines are untouched; the per-angle flags travel in a PARALLEL
 * `AngleMeasuredFlags` object consumed only by UI/PDF layers.
 */
import type { ApiKeypoint } from "@/lib/poseClient";

export type Side = "left" | "right";

/** Per-side arm (and leg) angles, so the scorer can pick the worst side. */
export interface SideAngles {
  upperArm: number; // elevation of upper arm from the trunk line
  lowerArm: number; // forearm flexion (180 - elbow angle)
  legAngle?: number; // knee flexion
  visibility: number; // mean keypoint score of this side's shoulder/elbow/wrist
}

export interface AngleSet {
  upperArm: number; // worst side's upper-arm elevation
  lowerArm: number; // worst side's forearm flexion
  neck: number; // head flexion relative to trunk (negative = extension)
  trunk: number; // trunk inclination from vertical
  /** Knee flexion (180 - knee included angle), for REBA legs. */
  legAngle?: number;
  /** The side that was scored (the worse of the two, among visible sides). */
  side: Side;
  /** Both sides' angles, for display/transparency. */
  sides?: { left: SideAngles; right: SideAngles };
  /** Lateral flexion (side-bend). Not derivable from a single 2D view - stays
   * undefined and is presented as an editable assumption. */
  neckSideBend?: boolean;
  trunkSideBend?: boolean;
  confidence: number; // display-only coverage x quality of the scored joints
}

/**
 * Semantic name -> COCO-WholeBody index. THE single source of truth - never
 * inline an index. Verified against the official COCO-WholeBody layout:
 * body 0-16 (COCO-17), feet 17-22, face 23-90, left hand 91-111, right hand
 * 112-132. Hand blocks start at the hand root (wrist) and follow MediaPipe
 * Hands ordering within each finger (thumb 1-4, index 5-8, middle 9-12, ...).
 */
export const KP = {
  nose: 0,
  leftEye: 1,
  rightEye: 2,
  leftEar: 3,
  rightEar: 4,
  leftShoulder: 5,
  rightShoulder: 6,
  leftElbow: 7,
  rightElbow: 8,
  leftWrist: 9,
  rightWrist: 10,
  leftHip: 11,
  rightHip: 12,
  leftKnee: 13,
  rightKnee: 14,
  leftAnkle: 15,
  rightAnkle: 16,
  leftHandRoot: 91,
  leftMiddleMcp: 100, // hand root + 9
  rightHandRoot: 112,
  rightMiddleMcp: 121, // hand root + 9
} as const;

/** Below this keypoint score an angle is flagged `measured: false` (review me).
 * The VALUE is still computed and used - flag, never suppress. */
export const KP_SCORE_FLOOR = 0.3;

/** Per-angle "was this derived from confidently-seen joints" flags. Parallel to
 * AngleSet, consumed only by the UI/PDF - scoring engines never see it. */
export interface AngleMeasuredFlags {
  upperArm: boolean;
  lowerArm: boolean;
  wrist: boolean;
  neck: boolean;
  trunk: boolean;
  legs: boolean;
}

interface P {
  x: number;
  y: number;
}

const pt = (kps: ApiKeypoint[], i: number): P => ({ x: kps[i][0], y: kps[i][1] });
const score = (kps: ApiKeypoint[], i: number): number => kps[i]?.[2] ?? 0;
const mid = (a: P, b: P): P => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
/** Vector p -> q with y flipped so "up" in the image is +y. */
const sub = (q: P, p: P): P => ({ x: q.x - p.x, y: -(q.y - p.y) });

function angleBetween(u: P, v: P): number {
  const du = Math.hypot(u.x, u.y);
  const dv = Math.hypot(v.x, v.y);
  if (du === 0 || dv === 0) return 0;
  const cos = Math.min(1, Math.max(-1, (u.x * v.x + u.y * v.y) / (du * dv)));
  return (Math.acos(cos) * 180) / Math.PI;
}

// Neck signing constants - carried over unchanged from angles.ts (they encode
// scoring-cliff protections, not 3D-specific behavior).
const NECK_EXT_DEADZONE_DEG = 5;
const NECK_EXT_MAX_DEG = 45;
const NECK_FLEX_MAX_DEG = 90;

function signedNeck(mag: number, sign: number): number {
  if (sign < 0 && mag > NECK_EXT_DEADZONE_DEG && mag <= NECK_EXT_MAX_DEG) return -mag;
  return Math.min(mag, NECK_FLEX_MAX_DEG);
}

const SIDE_IDX = {
  left: {
    sh: KP.leftShoulder,
    el: KP.leftElbow,
    wr: KP.leftWrist,
    hip: KP.leftHip,
    kn: KP.leftKnee,
    an: KP.leftAnkle,
    handRoot: KP.leftHandRoot,
    middleMcp: KP.leftMiddleMcp,
  },
  right: {
    sh: KP.rightShoulder,
    el: KP.rightElbow,
    wr: KP.rightWrist,
    hip: KP.rightHip,
    kn: KP.rightKnee,
    an: KP.rightAnkle,
    handRoot: KP.rightHandRoot,
    middleMcp: KP.rightMiddleMcp,
  },
} as const;

function sideAngles2D(kps: ApiKeypoint[], s: Side): SideAngles {
  const i = SIDE_IDX[s];
  const visibility = (score(kps, i.sh) + score(kps, i.el) + score(kps, i.wr)) / 3;

  const shoulder = pt(kps, i.sh);
  const elbow = pt(kps, i.el);
  const wrist = pt(kps, i.wr);
  const hip = pt(kps, i.hip);

  // Upper arm: elevation from the trunk line (shoulder->hip runs down the trunk).
  const upperArm = angleBetween(sub(elbow, shoulder), sub(hip, shoulder));
  // Lower arm: forearm flexion = 180 - elbow included angle.
  const lowerArm = 180 - angleBetween(sub(shoulder, elbow), sub(wrist, elbow));
  // Knee flexion - ALWAYS computed (flag-not-suppress); the legs measured-flag
  // tells the UI when to highlight it for review.
  const legAngle = 180 - angleBetween(sub(hip, pt(kps, i.kn)), sub(pt(kps, i.an), pt(kps, i.kn)));

  return { upperArm, lowerArm, legAngle, visibility };
}

/** Same worse-arm heuristic as angles.ts (elevation + forearm-outside-60-100 penalty). */
function armLoad(a: SideAngles): number {
  const elevation = Math.max(a.upperArm, a.upperArm < -20 ? 30 : 0);
  const forearmPenalty = a.lowerArm >= 60 && a.lowerArm <= 100 ? 0 : 15;
  return elevation + forearmPenalty;
}

/**
 * Wrist flexion/extension from the SAME wholebody inference: forearm
 * (elbow->wrist) vs hand ray (hand-root->middle-MCP). No second model needed.
 * Returns the angle plus whether it was confidently measured; the proximity
 * check (hand root near the body wrist, relative to frame size) guards against
 * the rare hand-block drift, matching the old measureWristFlexion gate.
 */
export function wristFlexion2D(
  kps: ApiKeypoint[],
  side: Side,
  imgW: number,
  imgH: number,
): { angle: number; measured: boolean } {
  const i = SIDE_IDX[side];
  const elbow = pt(kps, i.el);
  const wrist = pt(kps, i.wr);
  const root = pt(kps, i.handRoot);
  const mcp = pt(kps, i.middleMcp);

  const forearm = sub(wrist, elbow);
  const hand = sub(mcp, root);
  const angle = angleBetween(forearm, hand);

  // Same 0.2-of-normalized-frame proximity gate as the old two-model pipeline.
  // The elbow is in the flag because the forearm vector reads it (audit: a
  // joint used by the value must be covered by its measured flag).
  const proximity = Math.hypot((root.x - wrist.x) / imgW, (root.y - wrist.y) / imgH);
  const measured =
    proximity <= 0.2 &&
    Math.min(score(kps, i.handRoot), score(kps, i.middleMcp), score(kps, i.wr), score(kps, i.el)) >=
      KP_SCORE_FLOOR;
  return { angle, measured };
}

/**
 * Off-profile (foreshortening) heuristic: in a true side view the shoulders
 * nearly superimpose, so their horizontal separation is small relative to the
 * torso length. Well off-profile shots under-read sagittal angles - the UI
 * warns (never suppresses) above this ratio.
 *
 * Threshold calibrated empirically on the 77-photo loin-loom field corpus:
 * shoulder-separation/torso ratios there run min 0.25 / median 0.61 / p90 0.84
 * (fully frontal ~0.7-0.8). 0.40 would warn on 95% of real photos (alarm
 * fatigue); 0.55 keeps genuine side-view captures (all bundled samples) clean
 * while still firing on clearly angled/frontal shots where the under-read is
 * severe (~beyond 40-45 degrees of yaw).
 */
export const OFF_PROFILE_RATIO = 0.55;

export function isOffProfile(kps: ApiKeypoint[]): boolean {
  const shL = pt(kps, KP.leftShoulder);
  const shR = pt(kps, KP.rightShoulder);
  const hipMid = mid(pt(kps, KP.leftHip), pt(kps, KP.rightHip));
  const torso = Math.hypot(
    mid(shL, shR).x - hipMid.x,
    mid(shL, shR).y - hipMid.y,
  );
  if (torso === 0) return false;
  return Math.abs(shL.x - shR.x) / torso > OFF_PROFILE_RATIO;
}

/** Display-only confidence in 0..1: coverage x quality over the joints the
 * score depends on. Never gates anything (flag-not-suppress). */
export function detectionConfidence2D(kps: ApiKeypoint[], side: Side): number {
  const s = SIDE_IDX[side];
  const headIdx = score(kps, KP.leftEar) >= score(kps, KP.rightEar) ? KP.leftEar : KP.rightEar;
  const required = [
    ...new Set([
      s.sh, s.el, s.wr, s.hip,
      KP.leftShoulder, KP.rightShoulder, KP.leftHip, KP.rightHip,
      headIdx,
    ]),
  ];
  const scores = required.map((idx) => Math.min(1, Math.max(0, score(kps, idx))));
  const seen = scores.filter((v) => v >= KP_SCORE_FLOOR).length;
  const coverage = seen / required.length;
  const quality = scores.reduce((a, b) => a + b, 0) / required.length;
  return coverage * quality;
}

export interface Angles2DResult {
  angles: AngleSet;
  flags: AngleMeasuredFlags;
  wristAngle: number;
  offProfile: boolean;
}

/**
 * Full angle derivation for one detection. `kps` are the 133 keypoints in
 * original pixel space; `imgW`/`imgH` the original image dimensions.
 */
export function computeAngles2D(
  kps: ApiKeypoint[],
  imgW: number,
  imgH: number,
  forcedSide?: Side,
): Angles2DResult {
  const left = sideAngles2D(kps, "left");
  const right = sideAngles2D(kps, "right");

  // Side selection - unchanged shape from angles.ts: among sides whose arm
  // joints clear the floor, score the worse arm; otherwise the better-seen side.
  const eligible: Side[] = [];
  if (left.visibility > KP_SCORE_FLOOR) eligible.push("left");
  if (right.visibility > KP_SCORE_FLOOR) eligible.push("right");
  let side: Side;
  if (forcedSide) side = forcedSide;
  else if (eligible.length === 2) side = armLoad(left) >= armLoad(right) ? "left" : "right";
  else if (eligible.length === 1) side = eligible[0];
  else side = right.visibility >= left.visibility ? "right" : "left";

  const chosen = side === "left" ? left : right;
  const i = SIDE_IDX[side];

  // Neck & trunk from the body midline.
  const shoulderMid = mid(pt(kps, KP.leftShoulder), pt(kps, KP.rightShoulder));
  const hipMid = mid(pt(kps, KP.leftHip), pt(kps, KP.rightHip));
  const earVis = score(kps, KP.leftEar) >= score(kps, KP.rightEar) ? KP.leftEar : KP.rightEar;
  const bothEars = score(kps, KP.leftEar) >= KP_SCORE_FLOOR && score(kps, KP.rightEar) >= KP_SCORE_FLOOR;
  const head = bothEars ? mid(pt(kps, KP.leftEar), pt(kps, KP.rightEar)) : pt(kps, earVis);

  const neckSeg = sub(head, shoulderMid);
  const trunkUp = sub(shoulderMid, hipMid);

  // 2D sagittal sign for neck extension: "forward" is the horizontal the person
  // faces, derived from nose-vs-ears; the trunk-perpendicular pointing that way
  // is the 2D analog of angles.ts's up x shoulderAxis. When facing is ambiguous
  // (near-frontal view: nose barely offset from the ear midline), the sign
  // itself is forced to flexion - a frontal head tilt is lateral bend, not
  // extension, and must not trip neckScore's any-negative-scores-4 cliff.
  const noseDx = pt(kps, KP.nose).x - mid(pt(kps, KP.leftEar), pt(kps, KP.rightEar)).x;
  const torsoLen = Math.hypot(trunkUp.x, trunkUp.y);
  const facingAmbiguous = Math.abs(noseDx) < torsoLen * 0.05;
  const facing = Math.sign(noseDx) || 1;
  const forward: P = facing > 0 ? { x: trunkUp.y, y: -trunkUp.x } : { x: -trunkUp.y, y: trunkUp.x };
  const sagSign = facingAmbiguous || neckSeg.x * forward.x + neckSeg.y * forward.y >= 0 ? 1 : -1;
  const neck = signedNeck(angleBetween(neckSeg, trunkUp), sagSign);

  // Trunk inclination from image vertical (server already applied EXIF upright).
  const trunk = angleBetween(trunkUp, { x: 0, y: 1 });

  const wrist = wristFlexion2D(kps, side, imgW, imgH);

  // Each flag covers EXACTLY the joints its value's derivation reads - a joint
  // used but unflagged is this repo's historical unguarded-visibility bug in
  // its new form (audit findings: upper arm uses the hip for the trunk line;
  // neck uses the hips via trunkUp and the nose via the facing sign).
  const trunkAnchorsOk =
    Math.min(
      score(kps, KP.leftShoulder),
      score(kps, KP.rightShoulder),
      score(kps, KP.leftHip),
      score(kps, KP.rightHip),
    ) >= KP_SCORE_FLOOR;
  const flags: AngleMeasuredFlags = {
    upperArm: Math.min(score(kps, i.sh), score(kps, i.el), score(kps, i.hip)) >= KP_SCORE_FLOOR,
    lowerArm: Math.min(score(kps, i.sh), score(kps, i.el), score(kps, i.wr)) >= KP_SCORE_FLOOR,
    wrist: wrist.measured,
    neck: Math.min(score(kps, earVis), score(kps, KP.nose)) >= KP_SCORE_FLOOR && trunkAnchorsOk,
    trunk: trunkAnchorsOk,
    legs: Math.min(score(kps, i.hip), score(kps, i.kn), score(kps, i.an)) >= KP_SCORE_FLOOR,
  };

  const angles: AngleSet = {
    upperArm: chosen.upperArm,
    lowerArm: chosen.lowerArm,
    neck,
    trunk,
    legAngle: chosen.legAngle,
    side,
    sides: { left, right },
    // Lateral side-bend is a coronal-plane measurement - not derivable from a
    // sagittal view. Stays undefined -> buildAutoInput defaults false, and the
    // UI presents it as an assumption the assessor can override.
    neckSideBend: undefined,
    trunkSideBend: undefined,
    confidence: detectionConfidence2D(kps, side),
  };

  return { angles, flags, wristAngle: wrist.angle, offProfile: isOffProfile(kps) };
}
