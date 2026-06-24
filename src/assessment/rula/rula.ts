import type { AngleSet } from "@/lib/angles";
import type { AssessmentMethod, AssessmentResult, PostureInput, RiskBand } from "@/assessment/types";
import { lookupA, lookupB, lookupC } from "@/assessment/rula/rulaTables";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function upperArmScore(angle: number, raised: boolean, abducted: boolean, supported: boolean): number {
  let s: number;
  if (angle < -20) s = 2; // extension > 20°
  else if (angle <= 20) s = 1;
  else if (angle <= 45) s = 2;
  else if (angle <= 90) s = 3;
  else s = 4;
  if (raised) s += 1;
  if (abducted) s += 1;
  if (supported) s -= 1;
  return clamp(s, 1, 6);
}

export function lowerArmScore(flexion: number, crossMidline: boolean): number {
  let s = flexion >= 60 && flexion <= 100 ? 1 : 2;
  if (crossMidline) s += 1;
  return clamp(s, 1, 3);
}

export function wristScore(angle: number, deviated: boolean): number {
  const a = Math.abs(angle);
  let s: number;
  if (a < 5) s = 1;
  else if (a <= 15) s = 2;
  else s = 3;
  if (deviated) s += 1;
  return clamp(s, 1, 4);
}

export function neckScore(angle: number, twisted: boolean, sideBend: boolean): number {
  let s: number;
  if (angle < 0) s = 4; // extension
  else if (angle <= 10) s = 1;
  else if (angle <= 20) s = 2;
  else s = 3;
  if (twisted) s += 1;
  if (sideBend) s += 1;
  return clamp(s, 1, 6);
}

export function trunkScore(angle: number, twisted: boolean, sideBend: boolean): number {
  let s: number;
  if (angle < 5) s = 1;
  else if (angle <= 20) s = 2;
  else if (angle <= 60) s = 3;
  else s = 4;
  if (twisted) s += 1;
  if (sideBend) s += 1;
  return clamp(s, 1, 6);
}

export function legsScore(supported: boolean): number {
  return supported ? 1 : 2;
}

function band(grand: number): { band: RiskBand; label: string; action: string } {
  if (grand <= 2) return { band: "low", label: "Acceptable", action: "Posture is acceptable if not held or repeated for long periods." };
  if (grand <= 4) return { band: "medium", label: "Investigate", action: "Further investigation is needed; changes may be required." };
  if (grand <= 6) return { band: "high", label: "Change soon", action: "Investigate further and change the task soon." };
  return { band: "veryhigh", label: "Change now", action: "Investigate and implement change immediately." };
}

/** Build an auto PostureInput from pose angles, with documented default assumptions. */
export function buildAutoInput(angles: AngleSet, overrides: Partial<PostureInput> = {}): PostureInput {
  return {
    upperArmAngle: angles.upperArm,
    lowerArmAngle: angles.lowerArm,
    wristAngle: 0,
    neckAngle: angles.neck,
    trunkAngle: angles.trunk,
    shoulderRaised: false,
    upperArmAbducted: false,
    armSupported: false,
    lowerArmCrossMidline: false,
    wristDeviated: false,
    wristTwistEnd: false,
    neckTwisted: false,
    neckSideBend: false,
    trunkTwisted: false,
    trunkSideBend: false,
    legsSupported: true,
    muscleUseA: false,
    forceA: 0,
    muscleUseB: false,
    forceB: 0,
    // REBA-specific defaults. `legAngle` flows through from pose when the lower
    // body is visible; otherwise it stays undefined and REBA treats legs as
    // supported. Load/coupling/activity default to the neutral (zero) case.
    legAngle: angles.legAngle,
    legsBilateral: true,
    load: 0,
    loadShock: false,
    coupling: 0,
    activityStatic: false,
    activityRepeated: false,
    activityUnstable: false,
    ...overrides,
  };
}

export function computeRula(input: PostureInput): AssessmentResult {
  const ua = upperArmScore(input.upperArmAngle, input.shoulderRaised, input.upperArmAbducted, input.armSupported);
  const la = lowerArmScore(input.lowerArmAngle, input.lowerArmCrossMidline);
  const wr = wristScore(input.wristAngle, input.wristDeviated);
  const tw = input.wristTwistEnd ? 2 : 1;
  const postureA = lookupA(ua, la, wr, tw);
  const muscleA = input.muscleUseA ? 1 : 0;
  const forceA = clamp(Math.round(input.forceA), 0, 3);
  const scoreC = postureA + muscleA + forceA;

  const nk = neckScore(input.neckAngle, input.neckTwisted, input.neckSideBend);
  const tk = trunkScore(input.trunkAngle, input.trunkTwisted, input.trunkSideBend);
  const lg = legsScore(input.legsSupported);
  const postureB = lookupB(nk, tk, lg);
  const muscleB = input.muscleUseB ? 1 : 0;
  const forceB = clamp(Math.round(input.forceB), 0, 3);
  const scoreD = postureB + muscleB + forceB;

  const grandScore = lookupC(scoreC, scoreD);
  const b = band(grandScore);

  return {
    method: "RULA",
    grandScore,
    maxScore: 7,
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
        name: "Group A · arm & wrist",
        items: [
          { label: "Upper arm", value: ua, note: `${Math.round(input.upperArmAngle)}°` },
          { label: "Lower arm", value: la, note: `${Math.round(input.lowerArmAngle)}° flex` },
          { label: "Wrist", value: wr },
          { label: "Wrist twist", value: tw },
        ],
        posture: postureA,
        muscle: muscleA,
        force: forceA,
        score: scoreC,
        scoreLabel: "Wrist & arm score",
      },
      {
        name: "Group B · neck, trunk & legs",
        items: [
          { label: "Neck", value: nk, note: `${Math.round(input.neckAngle)}°` },
          { label: "Trunk", value: tk, note: `${Math.round(input.trunkAngle)}°` },
          { label: "Legs", value: lg },
        ],
        posture: postureB,
        muscle: muscleB,
        force: forceB,
        score: scoreD,
        scoreLabel: "Neck, trunk & leg score",
      },
    ],
    notes: [],
  };
}

export const rula: AssessmentMethod = {
  id: "rula",
  name: "RULA",
  compute: computeRula,
};
