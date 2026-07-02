import type { Landmark } from "@mediapipe/tasks-vision";
import type { RiskBand } from "@/assessment/types";

/**
 * Revised NIOSH Lifting Equation (Waters, Putz-Anderson & Garg 1994,
 * DHHS/NIOSH publication 94-110). Metric form:
 *
 *   RWL = LC · HM · VM · DM · AM · FM · CM        LC = 23 kg
 *   HM = 25/H            (H in cm; <25 → 1.00; >63 → 0)
 *   VM = 1 − 0.003·|V−75| (V in cm; >175 → 0)
 *   DM = 0.82 + 4.5/D    (D in cm; <25 → 1.00; >175 → 0)
 *   AM = 1 − 0.0032·A    (A in degrees; >135 → 0)
 *   FM from Table 5, CM from Table 7 of the Applications Manual.
 *
 * FM/CM tables verified against two official reproductions that agree
 * cell-for-cell (OSHA lifting-analysis worksheet; NIOSH manual training
 * tables). Lifting Index LI = load / RWL.
 */

export const LOAD_CONSTANT_KG = 23;

export interface NioshInput {
  /** Horizontal hand distance from mid-ankles, cm. */
  horizontalCm: number;
  /** Vertical hand height above the floor at lift origin, cm. */
  verticalCm: number;
  /** Vertical travel distance between origin and destination, cm. */
  travelCm: number;
  /** Trunk asymmetry/twist angle, degrees (0 = sagittal lifting). */
  asymmetryDeg: number;
  /** Lifting frequency, lifts per minute. */
  frequencyPerMin: number;
  /** Work duration bucket, hours. */
  durationHours: 1 | 2 | 8;
  coupling: "good" | "fair" | "poor";
  /** Actual load handled, kg. */
  loadKg: number;
}

export interface NioshResult {
  rwlKg: number;
  /** Lifting Index = load / RWL. 0 RWL yields Infinity → treated as very high. */
  li: number;
  multipliers: { HM: number; VM: number; DM: number; AM: number; FM: number; CM: number };
  riskBand: RiskBand;
  riskLabel: string;
  actionLevel: string;
  notes: string[];
}

export function horizontalMultiplier(hCm: number): number {
  if (hCm > 63) return 0;
  return Math.min(1, 25 / Math.max(hCm, 25));
}

export function verticalMultiplier(vCm: number): number {
  if (vCm < 0 || vCm > 175) return 0;
  return 1 - 0.003 * Math.abs(vCm - 75);
}

export function distanceMultiplier(dCm: number): number {
  if (dCm > 175) return 0;
  return Math.min(1, 0.82 + 4.5 / Math.max(dCm, 25));
}

export function asymmetricMultiplier(aDeg: number): number {
  const a = Math.abs(aDeg);
  if (a > 135) return 0;
  return 1 - 0.0032 * a;
}

/**
 * Table 5 - Frequency Multiplier. Rows: lifts/min breakpoints; per duration
 * (≤1 h, ≤2 h, ≤8 h) split by vertical height (V < 75 cm vs V ≥ 75 cm).
 * Row layout: [oneLo, oneHi, twoLo, twoHi, eightLo, eightHi].
 */
const FM_ROWS: [number, number[]][] = [
  [0.2, [1.0, 1.0, 0.95, 0.95, 0.85, 0.85]],
  [0.5, [0.97, 0.97, 0.92, 0.92, 0.81, 0.81]],
  [1, [0.94, 0.94, 0.88, 0.88, 0.75, 0.75]],
  [2, [0.91, 0.91, 0.84, 0.84, 0.65, 0.65]],
  [3, [0.88, 0.88, 0.79, 0.79, 0.55, 0.55]],
  [4, [0.84, 0.84, 0.72, 0.72, 0.45, 0.45]],
  [5, [0.8, 0.8, 0.6, 0.6, 0.35, 0.35]],
  [6, [0.75, 0.75, 0.5, 0.5, 0.27, 0.27]],
  [7, [0.7, 0.7, 0.42, 0.42, 0.22, 0.22]],
  [8, [0.6, 0.6, 0.35, 0.35, 0.18, 0.18]],
  [9, [0.52, 0.52, 0.3, 0.3, 0, 0.15]],
  [10, [0.45, 0.45, 0.26, 0.26, 0, 0.13]],
  [11, [0.41, 0.41, 0, 0.23, 0, 0]],
  [12, [0.37, 0.37, 0, 0.21, 0, 0]],
  [13, [0, 0.34, 0, 0, 0, 0]],
  [14, [0, 0.31, 0, 0, 0, 0]],
  [15, [0, 0.28, 0, 0, 0, 0]],
];

export function frequencyMultiplier(liftsPerMin: number, durationHours: 1 | 2 | 8, verticalCm: number): number {
  // Manual footnote: lifting less often than once per 5 minutes → F = 0.2.
  const f = Math.max(liftsPerMin, 0.2);
  if (f > 15) return 0;
  // Step function: use the next breakpoint at or above F (conservative).
  const row = FM_ROWS.find(([bp]) => f <= bp) ?? FM_ROWS[FM_ROWS.length - 1];
  const col = (durationHours === 1 ? 0 : durationHours === 2 ? 2 : 4) + (verticalCm >= 75 ? 1 : 0);
  return row[1][col];
}

/** Table 7 - Coupling Multiplier (good/fair/poor × V<75 cm / V≥75 cm). */
export function couplingMultiplier(coupling: "good" | "fair" | "poor", verticalCm: number): number {
  if (coupling === "good") return 1.0;
  if (coupling === "fair") return verticalCm >= 75 ? 1.0 : 0.95;
  return 0.9;
}

function band(li: number): { band: RiskBand; label: string; action: string } {
  if (li <= 1)
    return { band: "low", label: "Nominal risk", action: "The load is within the recommended weight limit for nearly all healthy workers." };
  if (li <= 2)
    return { band: "medium", label: "Increased risk", action: "Some workers are at increased risk - redesign the task to lower the Lifting Index toward 1." };
  if (li <= 3)
    return { band: "high", label: "High risk", action: "Many workers are at risk of low-back injury - the task should be redesigned soon." };
  return { band: "veryhigh", label: "Very high risk", action: "The lift substantially exceeds recommended limits - redesign the task before continuing." };
}

export function computeNiosh(input: NioshInput): NioshResult {
  const HM = horizontalMultiplier(input.horizontalCm);
  const VM = verticalMultiplier(input.verticalCm);
  const DM = distanceMultiplier(input.travelCm);
  const AM = asymmetricMultiplier(input.asymmetryDeg);
  const FM = frequencyMultiplier(input.frequencyPerMin, input.durationHours, input.verticalCm);
  const CM = couplingMultiplier(input.coupling, input.verticalCm);

  const rwlKg = LOAD_CONSTANT_KG * HM * VM * DM * AM * FM * CM;
  const li = rwlKg > 0 ? input.loadKg / rwlKg : Infinity;
  const b = band(li);

  const notes: string[] = [];
  if (HM === 0) notes.push("Horizontal reach exceeds 63 cm - outside the equation's valid range (RWL = 0).");
  if (VM === 0) notes.push("Vertical height exceeds 175 cm - outside the equation's valid range (RWL = 0).");
  if (AM === 0 && Math.abs(input.asymmetryDeg) > 135) notes.push("Asymmetry exceeds 135° - outside the equation's valid range (RWL = 0).");
  if (FM === 0) notes.push("This frequency/duration/height combination is not sustainable per the NIOSH frequency table (RWL = 0).");

  return { rwlKg, li, multipliers: { HM, VM, DM, AM, FM, CM }, riskBand: b.band, riskLabel: b.label, actionLevel: b.action, notes };
}

// --- Pose prefill (best-effort, clearly labeled "estimated" in the UI) --------

/** MediaPipe world-landmark indices used for geometry estimation. */
const LM = { leftWrist: 15, rightWrist: 16, leftAnkle: 27, rightAnkle: 28 } as const;

export interface NioshGeometryEstimate {
  horizontalCm: number;
  verticalCm: number;
}

/**
 * Estimate H and V from MediaPipe 3D world landmarks (hip-centered, meters,
 * y-down): V ≈ vertical distance from the lower wrist to the ankle plane;
 * H ≈ horizontal (x/z-plane) distance from the mid-ankle point to that wrist.
 * A single-view estimate to prefill the form - always user-adjustable.
 */
export function estimateNioshGeometry(world: Landmark[]): NioshGeometryEstimate | null {
  const lw = world[LM.leftWrist];
  const rw = world[LM.rightWrist];
  const la = world[LM.leftAnkle];
  const ra = world[LM.rightAnkle];
  if (!lw || !rw || !la || !ra) return null;

  // y is down in the world frame: the floor is the larger y (deeper) ankle.
  const floorY = Math.max(la.y, ra.y);
  // The working wrist is the lower of the two (nearer the load).
  const wrist = lw.y > rw.y ? lw : rw;

  const verticalM = Math.max(0, floorY - wrist.y);
  const midAnkle = { x: (la.x + ra.x) / 2, z: (la.z + ra.z) / 2 };
  const horizontalM = Math.hypot(wrist.x - midAnkle.x, wrist.z - midAnkle.z);

  return {
    horizontalCm: Math.round(horizontalM * 100),
    verticalCm: Math.round(verticalM * 100),
  };
}
