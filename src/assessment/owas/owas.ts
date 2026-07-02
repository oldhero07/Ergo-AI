import type { AssessmentMethod, AssessmentResult, PostureInput, RiskBand } from "@/assessment/types";
import { lookupActionCategory } from "@/assessment/owas/owasTables";

/**
 * OWAS (Ovako Working Posture Analysing System, Karhu et al. 1977).
 * Classifies the whole-body posture with a four-digit code - back (1-4),
 * arms (1-3), legs (1-7), load (1-3) - and maps it to an action category 1-4.
 *
 * Derivation from a single camera view is honest-but-approximate: every
 * inference that OWAS defines observationally (arms above shoulder, walking
 * vs standing, sitting vs squatting) is derived conservatively from the
 * measured angles and flagged in `notes`.
 */

/** Back code: 1 straight · 2 bent (>20°) · 3 twisted/side-bent · 4 bent AND twisted. */
export function backCode(trunkAngle: number, twisted: boolean, sideBend: boolean): number {
  const bent = trunkAngle > 20;
  const twist = twisted || sideBend;
  if (bent && twist) return 4;
  if (twist) return 3;
  if (bent) return 2;
  return 1;
}

/** Arms code: 1 both below shoulder · 2 one at/above · 3 both at/above. */
export function armsCode(above: "none" | "one" | "both"): number {
  return above === "both" ? 3 : above === "one" ? 2 : 1;
}

/**
 * Legs code from what a photo can measure. Knee flexion (0° = straight)
 * separates straight standing from bent-knee postures; `bilateral` separates
 * even from one-sided weight-bearing; `seated` mirrors REBA's convention that
 * `legsSupported` marks a seated/supported posture. Walking and kneeling
 * cannot be told apart from a single frame - they stay manual adjustments.
 */
export function legsCode(legAngle: number | undefined, bilateral: boolean, seated: boolean): { code: number; assumed: boolean } {
  if (legAngle === undefined) return { code: 2, assumed: true }; // lower body not visible → standing, both straight
  if (legAngle > 60 && seated) return { code: 1, assumed: true }; // deep knee bend while supported → sitting
  if (legAngle >= 30) return { code: bilateral ? 4 : 5, assumed: false }; // knees bent
  return { code: bilateral ? 2 : 3, assumed: false }; // near-straight
}

/** Load code from the REBA load band (0 <5 kg · 1 5-10 kg · 2 >10 kg).
 * OWAS band 3 (>20 kg) is not distinguishable from band 2 without user input. */
export function loadCode(rebaLoadBand: number): number {
  return rebaLoadBand >= 2 ? 2 : 1;
}

const BACK_LABELS = ["straight", "bent", "twisted", "bent + twisted"];
const ARMS_LABELS = ["both below shoulder", "one at/above shoulder", "both at/above shoulder"];
const LEGS_LABELS = [
  "sitting",
  "standing, both legs straight",
  "standing on one straight leg",
  "both knees bent",
  "one knee bent",
  "kneeling",
  "walking",
];
const LOAD_LABELS = ["< 10 kg", "10-20 kg", "> 20 kg"];

function band(ac: number): { band: RiskBand; label: string; action: string } {
  if (ac <= 1)
    return { band: "low", label: "No action needed", action: "Normal posture - no corrective measures required." };
  if (ac === 2)
    return { band: "medium", label: "Action in the near future", action: "Posture is somewhat harmful - corrective measures in the near future." };
  if (ac === 3)
    return { band: "high", label: "Action as soon as possible", action: "Posture is distinctly harmful - corrective measures as soon as possible." };
  return { band: "veryhigh", label: "Action immediately", action: "Posture is extremely harmful - corrective measures immediately." };
}

export function computeOwas(input: PostureInput): AssessmentResult {
  const back = backCode(input.trunkAngle, input.trunkTwisted, input.trunkSideBend);
  const arms = armsCode(input.armsAboveShoulder ?? "none");
  const legs = legsCode(input.legAngle, input.legsBilateral, input.legsSupported);
  const load = loadCode(input.load);
  const ac = lookupActionCategory(back, arms, legs.code, load);
  const b = band(ac);

  const notes: string[] = [];
  if (input.armsAboveShoulder === undefined) {
    notes.push("Arm elevation classified from the scored side only (both-sides data unavailable).");
  }
  if (legs.assumed) {
    notes.push(
      input.legAngle === undefined
        ? "Legs not visible - coded as standing with both legs straight (assumed)."
        : "Deep knee bend while supported - coded as sitting (assumed).",
    );
  }
  notes.push("Walking/kneeling cannot be detected from a single view; adjust the posture factors if applicable.");

  return {
    method: "OWAS",
    grandScore: ac,
    maxScore: 4,
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
        name: "Posture code · back, arms, legs, load",
        items: [
          { label: "Back", value: back, note: `${BACK_LABELS[back - 1]} · ${Math.round(input.trunkAngle)}°` },
          { label: "Arms", value: arms, note: ARMS_LABELS[arms - 1] },
          { label: "Legs", value: legs.code, note: LEGS_LABELS[legs.code - 1] },
          { label: "Load", value: load, note: LOAD_LABELS[load - 1] },
        ],
        posture: ac,
        muscle: 0,
        force: 0,
        score: ac,
        scoreLabel: "Action category",
      },
    ],
    notes,
  };
}

export const owas: AssessmentMethod = {
  id: "owas",
  name: "OWAS",
  compute: computeOwas,
};
