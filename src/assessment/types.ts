export type RiskBand = "low" | "medium" | "high" | "veryhigh";

/** All inputs an angle-based upper-body assessment (RULA, later REBA) may need. */
export interface PostureInput {
  // Angles in degrees.
  upperArmAngle: number; // elevation from trunk line (flexion +, extension -)
  lowerArmAngle: number; // forearm flexion (0 = straight, ~90 = right angle)
  wristAngle: number; // flexion/extension magnitude
  neckAngle: number; // flexion + / extension -
  trunkAngle: number; // inclination from vertical

  // Group A flags.
  shoulderRaised: boolean;
  upperArmAbducted: boolean;
  armSupported: boolean;
  lowerArmCrossMidline: boolean;
  wristDeviated: boolean;
  wristTwistEnd: boolean;

  // Group B flags.
  neckTwisted: boolean;
  neckSideBend: boolean;
  trunkTwisted: boolean;
  trunkSideBend: boolean;
  legsSupported: boolean;

  // Muscle use (static/repeated) and force/load (0–3) per group.
  muscleUseA: boolean;
  forceA: number;
  muscleUseB: boolean;
  forceB: number;

  // --- REBA-specific inputs (ignored by RULA) ---------------------------------
  // REBA scores legs by knee flexion + base stability, and adds load, coupling
  // and a whole-task activity score that RULA does not have. Defaulted by
  // `buildAutoInput`, so RULA-only callers are unaffected.
  legAngle?: number; // knee flexion in degrees (0 = straight, ~90 = right angle); undefined when lower body not visible
  legsBilateral: boolean; // true = bilateral weight-bearing / sitting / walking; false = unilateral / unstable
  load: number; // REBA load band: 0 (<5 kg), 1 (5–10 kg), 2 (>10 kg)
  loadShock: boolean; // +1 for shock or rapid build-up of force
  coupling: number; // 0 good, 1 fair, 2 poor, 3 unacceptable
  activityStatic: boolean; // one or more body parts held static >1 min
  activityRepeated: boolean; // small-range actions repeated >4×/min
  activityUnstable: boolean; // rapid large-range changes / unstable base
}

export interface GroupBreakdown {
  name: string;
  items: { label: string; value: number; note?: string }[];
  posture: number;
  muscle: number;
  force: number;
  score: number;
  scoreLabel: string;
}

export interface AssessmentResult {
  method: string;
  grandScore: number;
  maxScore: number;
  riskBand: RiskBand;
  riskLabel: string;
  actionLevel: string;
  groups: GroupBreakdown[];
  angles: { upperArm: number; lowerArm: number; neck: number; trunk: number };
  notes: string[];
}

export interface AssessmentMethod {
  id: string;
  name: string;
  compute: (input: PostureInput) => AssessmentResult;
}
