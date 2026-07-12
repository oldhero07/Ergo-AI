import type { AssessmentMethod, AssessmentResult, PostureInput, RiskBand } from "@/assessment/types";
import { lookupA, lookupB, lookupC } from "@/assessment/rula/rulaTables";
import { lowerArmScore, legsScore } from "@/assessment/rula/rula";
import { clamp } from "@/assessment/scoreUtils";

/**
 * NERPA - Novel Ergonomic Postural Assessment (Sanchez-Lite, Garcia, Domingo &
 * Sebastian, PLoS ONE 2013, 10.1371/journal.pone.0072703). A RULA variant that
 * re-derives the segment angle bands from ISO 11226:2000, making the method
 * less strict near neutral while keeping RULA's structure:
 *
 *  - Upper arm: 3 posture levels instead of 4. Band 2 widens to 20-60 deg
 *    ("increases by 15 deg"), everything above 60 deg scores 3, and RULA's
 *    level 4 is eliminated. Shoulder-raised counts only above 25 deg.
 *  - Wrist: a +/-15 deg flexion/extension margin scores 1 (RULA allows no
 *    margin); 15-45 deg scores 2; beyond 45 deg scores 3. Deviation penalty
 *    applies beyond 10 deg.
 *  - Neck: flexion bands unchanged; extension scores 4 only beyond a 5 deg
 *    margin; twist/side-bend penalties apply only above 10 deg.
 *  - Trunk: 0-20 deg scores 1, 20-40 deg 2, 40-60 deg 3, >60 deg 4 (RULA
 *    scores 1 only for a fully upright trunk); twist/side-bend above 10 deg.
 *  - Lower arm, legs, wrist twist, muscle use, force/load: unchanged from RULA.
 *
 * Lookup tables: the paper states the method "begins with the premise of
 * maintaining the original A, B, and C tables of the RULA method", so this
 * implementation reuses the cell-checked RULA tables. (The paper's Figure 5
 * worksheet contains a handful of cells that deviate from the published RULA
 * tables - upper-arm-2 rows in Table A, rows 7-8 in Table C - but those breaks
 * are non-monotonic and contradict the text, so they are treated as figure
 * typos, not method changes.)
 *
 * The twist/side-bend >10 deg thresholds are judgment calls the camera cannot
 * measure from one view; as elsewhere, they surface as the assessor-editable
 * boolean flags in `PostureInput`.
 */

export function nerpaUpperArmScore(angle: number, raised: boolean, abducted: boolean, supported: boolean): number {
  let s: number;
  if (angle < -20) s = 2; // extension beyond 20 deg
  else if (angle <= 20) s = 1;
  else if (angle <= 60) s = 2; // RULA's 20-45 band widened per ISO 11226
  else s = 3; // level 4 eliminated: everything above 60 deg
  if (raised) s += 1; // shoulder raised >25 deg or shoulder in extension
  if (abducted) s += 1;
  if (supported) s -= 1;
  return clamp(s, 1, 5); // NERPA's Table A rows span 1-5 (posture max 3 + adjustments)
}

export function nerpaWristScore(angle: number, deviated: boolean): number {
  const a = Math.abs(angle);
  let s: number;
  if (a <= 15) s = 1; // the 15 deg no-penalty margin RULA lacks
  else if (a <= 45) s = 2;
  else s = 3;
  if (deviated) s += 1; // radial/ulnar deviation beyond 10 deg
  return clamp(s, 1, 4);
}

export function nerpaNeckScore(angle: number, twisted: boolean, sideBend: boolean): number {
  let s: number;
  if (angle < -5) s = 4; // extension beyond the 5 deg margin
  else if (angle <= 10) s = 1;
  else if (angle <= 20) s = 2;
  else s = 3;
  if (twisted) s += 1; // torsion beyond 10 deg
  if (sideBend) s += 1; // inclination beyond 10 deg
  return clamp(s, 1, 6);
}

export function nerpaTrunkScore(angle: number, twisted: boolean, sideBend: boolean): number {
  let s: number;
  if (angle <= 20) s = 1; // RULA band 2 becomes NERPA's band 1
  else if (angle <= 40) s = 2;
  else if (angle <= 60) s = 3;
  else s = 4;
  if (twisted) s += 1;
  if (sideBend) s += 1;
  return clamp(s, 1, 6);
}

function band(grand: number): { band: RiskBand; label: string; action: string } {
  if (grand <= 2) return { band: "low", label: "Acceptable", action: "Posture is acceptable if not held or repeated for long periods." };
  if (grand <= 4) return { band: "medium", label: "Investigate", action: "Further investigation is needed; changes may be required." };
  if (grand <= 6) return { band: "high", label: "Change soon", action: "Investigate further and change the task soon." };
  return { band: "veryhigh", label: "Change now", action: "Investigate and implement change immediately." };
}

export function computeNerpa(input: PostureInput): AssessmentResult {
  const ua = nerpaUpperArmScore(input.upperArmAngle, input.shoulderRaised, input.upperArmAbducted, input.armSupported);
  const la = lowerArmScore(input.lowerArmAngle, input.lowerArmCrossMidline);
  const wr = nerpaWristScore(input.wristAngle, input.wristDeviated);
  const tw = input.wristTwistEnd ? 2 : 1;
  const postureA = lookupA(ua, la, wr, tw);
  const muscleA = input.muscleUseA ? 1 : 0;
  const forceA = clamp(Math.round(input.forceA), 0, 3);
  const scoreC = postureA + muscleA + forceA;

  const nk = nerpaNeckScore(input.neckAngle, input.neckTwisted, input.neckSideBend);
  const tk = nerpaTrunkScore(input.trunkAngle, input.trunkTwisted, input.trunkSideBend);
  const lg = legsScore(input.legsSupported);
  const postureB = lookupB(nk, tk, lg);
  const muscleB = input.muscleUseB ? 1 : 0;
  const forceB = clamp(Math.round(input.forceB), 0, 3);
  const scoreD = postureB + muscleB + forceB;

  const grandScore = lookupC(scoreC, scoreD);
  const b = band(grandScore);

  return {
    method: "NERPA",
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
    notes: [
      "NERPA re-derives RULA's angle bands from ISO 11226:2000, so near-neutral postures score lower than RULA; scores are not interchangeable between the two methods.",
    ],
  };
}

export const nerpa: AssessmentMethod = {
  id: "nerpa",
  name: "NERPA",
  compute: computeNerpa,
};
