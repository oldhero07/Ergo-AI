import { describe, expect, it } from "vitest";
import type { PostureInput } from "@/assessment/types";
import { computeRula } from "@/assessment/rula/rula";
import { computeReba } from "@/assessment/reba/reba";

/**
 * Scoring regression gate: PostureInputs captured from the bundled sample
 * images at commit 0272b4e (see src/test/fixtures/sample-baseline.json) must
 * keep producing the exact same RULA/REBA scores. If one of these assertions
 * ever needs editing, that is a red flag that scoring behavior changed - stop
 * and verify against the published tables before touching it.
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
} as const;

const officeTyping: PostureInput = {
  ...neutralFlags,
  upperArmAngle: 18.250540380033108,
  lowerArmAngle: 58.13113332592857,
  wristAngle: 31.010823517050486,
  neckAngle: 40.93153734883123,
  trunkAngle: 8.55021836143838,
  neckSideBend: false,
  trunkSideBend: false,
};

const warehouseLifting: PostureInput = {
  ...neutralFlags,
  upperArmAngle: 51.724617595535975,
  lowerArmAngle: 44.85598179376291,
  wristAngle: 0,
  neckAngle: 27.75054193644926,
  trunkAngle: 41.89418429571786,
  legAngle: 52.73792042151233,
  neckSideBend: true,
  trunkSideBend: true,
};

const assemblyStanding: PostureInput = {
  ...neutralFlags,
  upperArmAngle: 75.26409668442102,
  lowerArmAngle: 53.43663563977624,
  wristAngle: 0,
  neckAngle: 42.415134416438576,
  trunkAngle: 5.488529453616084,
  neckSideBend: true,
  trunkSideBend: false,
};

function itemValues(result: ReturnType<typeof computeRula>) {
  const out: Record<string, number> = {};
  for (const g of result.groups) for (const i of g.items) out[i.label] = i.value;
  return out;
}

describe("sample-image scoring baseline (commit 0272b4e)", () => {
  it("office-typing: RULA 3 (medium), REBA 3 (low)", () => {
    const rula = computeRula(officeTyping);
    expect(rula.grandScore).toBe(3);
    expect(rula.riskBand).toBe("medium");
    expect(itemValues(rula)).toMatchObject({
      "Upper arm": 1,
      "Lower arm": 2,
      Wrist: 3,
      "Wrist twist": 1,
      Neck: 3,
      Trunk: 2,
      Legs: 1,
    });

    const reba = computeReba(officeTyping);
    expect(reba.grandScore).toBe(3);
    expect(reba.riskBand).toBe("low");
    expect(itemValues(reba)).toMatchObject({
      Neck: 2,
      Trunk: 2,
      Legs: 1,
      "Upper arm": 1,
      "Lower arm": 2,
      Wrist: 2,
    });
  });

  it("warehouse-lifting: RULA 6 (high), REBA 7 (medium)", () => {
    const rula = computeRula(warehouseLifting);
    expect(rula.grandScore).toBe(6);
    expect(rula.riskBand).toBe("high");
    expect(itemValues(rula)).toMatchObject({
      "Upper arm": 3,
      "Lower arm": 2,
      Wrist: 1,
      Neck: 4,
      Trunk: 4,
      Legs: 1,
    });

    const reba = computeReba(warehouseLifting);
    expect(reba.grandScore).toBe(7);
    expect(reba.riskBand).toBe("medium");
    expect(itemValues(reba)).toMatchObject({
      Neck: 3,
      Trunk: 4,
      Legs: 1,
      "Upper arm": 3,
      "Lower arm": 2,
      Wrist: 1,
    });
  });

  it("assembly-standing: RULA 4 (medium), REBA 4 (medium)", () => {
    const rula = computeRula(assemblyStanding);
    expect(rula.grandScore).toBe(4);
    expect(rula.riskBand).toBe("medium");
    expect(itemValues(rula)).toMatchObject({
      "Upper arm": 3,
      "Lower arm": 2,
      Wrist: 1,
      Neck: 4,
      Trunk: 2,
      Legs: 1,
    });

    const reba = computeReba(assemblyStanding);
    expect(reba.grandScore).toBe(4);
    expect(reba.riskBand).toBe("medium");
    expect(itemValues(reba)).toMatchObject({
      Neck: 3,
      Trunk: 2,
      Legs: 1,
      "Upper arm": 3,
      "Lower arm": 2,
      Wrist: 1,
    });
  });
});
