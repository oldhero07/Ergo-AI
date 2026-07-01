import type { AssessmentMethod, AssessmentResult, PostureInput, RiskBand } from "@/assessment/types";
import { lookupA, lookupB, lookupC } from "@/assessment/reba/rebaTables";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// --- Group A: trunk, neck, legs ---------------------------------------------

export function neckScore(angle: number, twisted: boolean, sideBend: boolean): number {
  // 0-20° flexion → 1; >20° flexion or any extension → 2.
  let s = angle >= 0 && angle <= 20 ? 1 : 2;
  if (twisted || sideBend) s += 1;
  return clamp(s, 1, 3);
}

export function trunkScore(angle: number, twisted: boolean, sideBend: boolean): number {
  // `angle` is inclination magnitude from vertical (flexion or extension).
  let s: number;
  if (angle < 5) s = 1;
  else if (angle <= 20) s = 2;
  else if (angle <= 60) s = 3;
  else s = 4;
  if (twisted || sideBend) s += 1;
  return clamp(s, 1, 5);
}

/**
 * REBA legs: base 1 (bilateral weight-bearing / walking / sitting) or 2
 * (unilateral / unstable), plus a knee-flexion add (+1 for 30-60°, +2 for >60°)
 * that is skipped when seated/supported - per the official "(not sitting)" note.
 */
export function legsScore(bilateral: boolean, legAngle: number | undefined, seated: boolean): number {
  let s = bilateral ? 1 : 2;
  if (!seated && legAngle !== undefined) {
    if (legAngle > 60) s += 2;
    else if (legAngle >= 30) s += 1;
  }
  return clamp(s, 1, 4);
}

// --- Group B: upper arm, lower arm, wrist -----------------------------------

export function upperArmScore(angle: number, raised: boolean, abducted: boolean, supported: boolean): number {
  let s: number;
  if (angle < -20) s = 2; // extension > 20°
  else if (angle <= 20) s = 1;
  else if (angle <= 45) s = 2;
  else if (angle <= 90) s = 3;
  else s = 4;
  if (raised) s += 1;
  if (abducted) s += 1;
  if (supported) s -= 1; // arm supported / leaning / gravity-assisted
  return clamp(s, 1, 6);
}

export function lowerArmScore(flexion: number): number {
  // 60-100° elbow flexion → 1; otherwise → 2.
  return flexion >= 60 && flexion <= 100 ? 1 : 2;
}

export function wristScore(angle: number, deviatedOrTwisted: boolean): number {
  let s = Math.abs(angle) <= 15 ? 1 : 2;
  if (deviatedOrTwisted) s += 1;
  return clamp(s, 1, 3);
}

// --- Adjustments & banding --------------------------------------------------

/** Whole-task activity score (0-3): static hold, repeated small actions, unstable/rapid changes. */
export function activityScore(input: PostureInput): number {
  return (input.activityStatic ? 1 : 0) + (input.activityRepeated ? 1 : 0) + (input.activityUnstable ? 1 : 0);
}

function band(grand: number): { band: RiskBand; label: string; action: string } {
  if (grand <= 1) return { band: "low", label: "Negligible", action: "Risk is negligible - no action required." };
  if (grand <= 3) return { band: "low", label: "Low risk", action: "Low risk; change may be needed." };
  if (grand <= 7) return { band: "medium", label: "Medium risk", action: "Further investigation is needed; change soon." };
  if (grand <= 10) return { band: "high", label: "High risk", action: "Investigate and implement change." };
  return { band: "veryhigh", label: "Very high risk", action: "Investigate and implement change immediately." };
}

export function computeReba(input: PostureInput): AssessmentResult {
  // Group A - trunk, neck, legs → Table A → + load.
  const nk = neckScore(input.neckAngle, input.neckTwisted, input.neckSideBend);
  const tk = trunkScore(input.trunkAngle, input.trunkTwisted, input.trunkSideBend);
  const lg = legsScore(input.legsBilateral, input.legAngle, input.legsSupported);
  const postureA = lookupA(nk, tk, lg);
  const load = clamp(Math.round(input.load), 0, 2) + (input.loadShock ? 1 : 0);
  const scoreA = postureA + load;

  // Group B - upper arm, lower arm, wrist → Table B → + coupling.
  const ua = upperArmScore(input.upperArmAngle, input.shoulderRaised, input.upperArmAbducted, input.armSupported);
  const la = lowerArmScore(input.lowerArmAngle);
  const wr = wristScore(input.wristAngle, input.wristDeviated || input.wristTwistEnd);
  const postureB = lookupB(la, ua, wr);
  const coupling = clamp(Math.round(input.coupling), 0, 3);
  const scoreB = postureB + coupling;

  // Table C → + activity = REBA grand score.
  const scoreC = lookupC(scoreA, scoreB);
  const activity = activityScore(input);
  const grandScore = clamp(scoreC + activity, 1, 15);
  const b = band(grandScore);

  const notes: string[] = [];
  if (input.legAngle === undefined) notes.push("Legs not visible - scored as bilateral/supported (assumed).");
  if (activity > 0) {
    const parts = [
      input.activityStatic && "static hold >1 min",
      input.activityRepeated && "repeated >4×/min",
      input.activityUnstable && "rapid/unstable changes",
    ].filter(Boolean);
    notes.push(`Activity score +${activity} (${parts.join(", ")}).`);
  }

  return {
    method: "REBA",
    grandScore,
    maxScore: 15,
    riskBand: b.band,
    riskLabel: b.label,
    actionLevel: b.action,
    angles: {
      upperArm: input.upperArmAngle,
      lowerArm: input.lowerArmAngle,
      neck: input.neckAngle,
      trunk: input.trunkAngle,
    },
    groups: [
      {
        name: "Group A · trunk, neck & legs",
        items: [
          { label: "Neck", value: nk, note: `${Math.round(input.neckAngle)}°` },
          { label: "Trunk", value: tk, note: `${Math.round(input.trunkAngle)}°` },
          { label: "Legs", value: lg, note: input.legAngle !== undefined ? `${Math.round(input.legAngle)}° knee` : undefined },
        ],
        posture: postureA,
        muscle: 0,
        force: load,
        score: scoreA,
        scoreLabel: "Trunk, neck & leg score (+load)",
      },
      {
        name: "Group B · arms & wrist",
        items: [
          { label: "Upper arm", value: ua, note: `${Math.round(input.upperArmAngle)}°` },
          { label: "Lower arm", value: la, note: `${Math.round(input.lowerArmAngle)}° flex` },
          { label: "Wrist", value: wr },
        ],
        posture: postureB,
        muscle: 0,
        force: coupling,
        score: scoreB,
        scoreLabel: "Arm & wrist score (+coupling)",
      },
    ],
    notes,
  };
}

export const reba: AssessmentMethod = {
  id: "reba",
  name: "REBA",
  compute: computeReba,
};
