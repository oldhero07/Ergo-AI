import { describe, expect, it } from "vitest";
import type { PostureInput } from "@/assessment/types";
import { computeRula } from "@/assessment/rula/rula";
import { computeReba } from "@/assessment/reba/reba";

/**
 * Scoring regression gate: PostureInputs derived from the bundled sample
 * images through the SERVER-INFERENCE path (captured keypoint fixtures in
 * src/test/fixtures/keypoints/, model
 * rtmw-dw-x-l-cocktail14-256x192@20231122+yolox-m-humanart@c2c7a14a, angles
 * via src/lib/angles2d.ts) must keep producing the exact same RULA/REBA
 * scores. Each item score below was cross-checked against the published
 * tables (McAtamney & Corlett 1993; Hignett & McAtamney 2000) at re-pin time.
 * If one of these assertions ever needs editing, that is a red flag that
 * scoring behavior changed - stop and verify against the published tables
 * before touching it.
 *
 * (Values re-pinned from the MediaPipe-3D baselines of commit 0272b4e when
 * inference moved server-side: differences trace to pseudo-3D neck inflation
 * and phantom side-bend detections in the old path - verified against the
 * actual photos, the new numbers are the more faithful ones.)
 */

const neutralFlags = {
  shoulderRaised: false,
  upperArmAbducted: false,
  armSupported: false,
  lowerArmCrossMidline: false,
  wristDeviated: false,
  wristTwistEnd: false,
  neckTwisted: false,
  trunkTwisted: false,
  legsSupported: true,
  muscleUseA: false,
  forceA: 0,
  muscleUseB: false,
  forceB: 0,
  legsBilateral: true,
  load: 0,
  loadShock: false,
  coupling: 0,
  activityStatic: false,
  activityRepeated: false,
  activityUnstable: false,
  armsAboveShoulder: "none",
  neckSideBend: false,
  trunkSideBend: false,
} as const;

const officeTyping: PostureInput = {
  ...neutralFlags,
  upperArmAngle: 16.924530369244493,
  lowerArmAngle: 52.64227360007445,
  wristAngle: 36.543631568867795,
  neckAngle: 19.941441099621052,
  trunkAngle: 13.70696100407981,
  legAngle: 72.50745811794549,
};

const warehouseLifting: PostureInput = {
  ...neutralFlags,
  upperArmAngle: 34.89135986239358,
  lowerArmAngle: 39.927867127485484,
  wristAngle: 32.35784767211016,
  neckAngle: -8.52011227261351,
  trunkAngle: 43.51213247117222,
  legAngle: 37.71538185799537,
};

const assemblyStanding: PostureInput = {
  ...neutralFlags,
  upperArmAngle: 65.71549473517426,
  lowerArmAngle: 21.522074522443717,
  wristAngle: 6.317138806173379,
  neckAngle: 10.065525955968056,
  trunkAngle: 4.451174002886455,
  legAngle: 21.801409486351815,
};

function itemValues(result: ReturnType<typeof computeRula>) {
  const out: Record<string, number> = {};
  for (const g of result.groups) for (const i of g.items) out[i.label] = i.value;
  return out;
}

describe("sample-image scoring baseline (server-inference fixtures)", () => {
  it("office-typing: RULA 3 (medium), REBA 2 (low)", () => {
    const rula = computeRula(officeTyping);
    expect(rula.grandScore).toBe(3);
    expect(rula.riskBand).toBe("medium");
    expect(itemValues(rula)).toMatchObject({
      "Upper arm": 1,
      "Lower arm": 2,
      Wrist: 3,
      "Wrist twist": 1,
      Neck: 2,
      Trunk: 2,
      Legs: 1,
    });

    const reba = computeReba(officeTyping);
    expect(reba.grandScore).toBe(2);
    expect(reba.riskBand).toBe("low");
    expect(itemValues(reba)).toMatchObject({
      Neck: 1,
      Trunk: 2,
      Legs: 1,
      "Upper arm": 1,
      "Lower arm": 2,
      Wrist: 2,
    });
  });

  it("warehouse-lifting: RULA 5 (high), REBA 4 (medium)", () => {
    const rula = computeRula(warehouseLifting);
    expect(rula.grandScore).toBe(5);
    expect(rula.riskBand).toBe("high");
    expect(itemValues(rula)).toMatchObject({
      "Upper arm": 2,
      "Lower arm": 2,
      Wrist: 3,
      "Wrist twist": 1,
      Neck: 4, // -8.5° = true neck extension (head up while trunk flexed 44°)
      Trunk: 3,
      Legs: 1,
    });

    const reba = computeReba(warehouseLifting);
    expect(reba.grandScore).toBe(4);
    expect(reba.riskBand).toBe("medium");
    expect(itemValues(reba)).toMatchObject({
      Neck: 2,
      Trunk: 3,
      Legs: 1,
      "Upper arm": 2,
      "Lower arm": 2,
      Wrist: 2,
    });
  });

  it("assembly-standing: RULA 4 (medium), REBA 2 (low)", () => {
    const rula = computeRula(assemblyStanding);
    expect(rula.grandScore).toBe(4);
    expect(rula.riskBand).toBe("medium");
    expect(itemValues(rula)).toMatchObject({
      "Upper arm": 3,
      "Lower arm": 2,
      Wrist: 2,
      "Wrist twist": 1,
      Neck: 2,
      Trunk: 1,
      Legs: 1,
    });

    const reba = computeReba(assemblyStanding);
    expect(reba.grandScore).toBe(2);
    expect(reba.riskBand).toBe("low");
    expect(itemValues(reba)).toMatchObject({
      Neck: 1,
      Trunk: 1,
      Legs: 1,
      "Upper arm": 3,
      "Lower arm": 2,
      Wrist: 1,
    });
  });
});
