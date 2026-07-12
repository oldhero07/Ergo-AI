import { describe, expect, it } from "vitest";
import { buildAutoInput, computeRula } from "@/assessment/rula/rula";
import {
  computeNerpa,
  nerpaNeckScore,
  nerpaTrunkScore,
  nerpaUpperArmScore,
  nerpaWristScore,
} from "@/assessment/nerpa/nerpa";
import type { AngleSet } from "@/lib/angles2d";

describe("NERPA category scores (Sanchez-Lite et al. 2013 bands)", () => {
  it("scores upper arm on three levels, band 2 widened to 60°", () => {
    expect(nerpaUpperArmScore(0, false, false, false)).toBe(1); // neutral
    expect(nerpaUpperArmScore(30, false, false, false)).toBe(2); // 20-60 (RULA: 3 at 50°)
    expect(nerpaUpperArmScore(55, false, false, false)).toBe(2); // still band 2
    expect(nerpaUpperArmScore(70, false, false, false)).toBe(3); // >60
    expect(nerpaUpperArmScore(120, false, false, false)).toBe(3); // level 4 eliminated
    expect(nerpaUpperArmScore(-40, false, false, false)).toBe(2); // extension
    expect(nerpaUpperArmScore(70, true, false, false)).toBe(4); // +shoulder raised >25°
    expect(nerpaUpperArmScore(70, true, true, false)).toBe(5); // caps at Table A's row 5
    expect(nerpaUpperArmScore(70, false, false, true)).toBe(2); // arm supported −1
  });

  it("gives the wrist a ±15° margin RULA does not", () => {
    expect(nerpaWristScore(0, false)).toBe(1);
    expect(nerpaWristScore(12, false)).toBe(1); // RULA scores 2 here
    expect(nerpaWristScore(30, false)).toBe(2);
    expect(nerpaWristScore(50, false)).toBe(3);
    expect(nerpaWristScore(12, true)).toBe(2); // deviation >10° penalty
  });

  it("keeps RULA's neck flexion bands but adds a 5° extension margin", () => {
    expect(nerpaNeckScore(5, false, false)).toBe(1);
    expect(nerpaNeckScore(15, false, false)).toBe(2);
    expect(nerpaNeckScore(25, false, false)).toBe(3);
    expect(nerpaNeckScore(-3, false, false)).toBe(1); // within the extension margin
    expect(nerpaNeckScore(-10, false, false)).toBe(4); // genuine extension
    expect(nerpaNeckScore(5, true, true)).toBe(3); // +twist +side-bend (>10°)
  });

  it("scores trunk on the ISO-derived 20/40/60 bands", () => {
    expect(nerpaTrunkScore(10, false, false)).toBe(1); // RULA scores 2 here
    expect(nerpaTrunkScore(30, false, false)).toBe(2); // RULA scores 3 here
    expect(nerpaTrunkScore(50, false, false)).toBe(3);
    expect(nerpaTrunkScore(70, false, false)).toBe(4);
    expect(nerpaTrunkScore(30, true, false)).toBe(3); // +twist >10°
  });
});

describe("computeNerpa end to end", () => {
  it("a fully neutral posture yields grand score 1", () => {
    const angles: AngleSet = { upperArm: 0, lowerArm: 80, neck: 5, trunk: 0, side: "right", confidence: 1 };
    const result = computeNerpa(buildAutoInput(angles));
    expect(result.grandScore).toBe(1);
    expect(result.riskBand).toBe("low");
    expect(result.method).toBe("NERPA");
  });

  it("never exceeds RULA for the same posture (less strict by design)", () => {
    const postures: AngleSet[] = [
      { upperArm: 30, lowerArm: 80, neck: 5, trunk: 10, side: "right", confidence: 1 },
      { upperArm: 50, lowerArm: 80, neck: 15, trunk: 30, side: "right", confidence: 1 },
      { upperArm: 100, lowerArm: 30, neck: 25, trunk: 35, side: "right", confidence: 1 },
      { upperArm: 70, lowerArm: 120, neck: -10, trunk: 70, side: "right", confidence: 1 },
    ];
    for (const angles of postures) {
      const input = buildAutoInput(angles);
      expect(computeNerpa(input).grandScore).toBeLessThanOrEqual(computeRula(input).grandScore);
    }
  });

  it("scores a mild desk posture lower than RULA", () => {
    // 30° arm, slight trunk lean: RULA UA band 2 + trunk band 2; NERPA relaxes both.
    const angles: AngleSet = { upperArm: 48, lowerArm: 80, neck: 8, trunk: 15, side: "right", confidence: 1 };
    const input = buildAutoInput(angles);
    expect(computeNerpa(input).grandScore).toBeLessThan(computeRula(input).grandScore);
  });

  it("an extreme posture still lands in the action bands", () => {
    const angles: AngleSet = { upperArm: 100, lowerArm: 30, neck: 25, trunk: 70, side: "right", confidence: 1 };
    const result = computeNerpa(buildAutoInput(angles, { muscleUseA: true, muscleUseB: true, forceA: 2, forceB: 2 }));
    expect(result.grandScore).toBeGreaterThanOrEqual(5);
    expect(["high", "veryhigh"]).toContain(result.riskBand);
  });

  it("force and muscle use raise the score", () => {
    const angles: AngleSet = { upperArm: 50, lowerArm: 80, neck: 15, trunk: 25, side: "right", confidence: 1 };
    const base = computeNerpa(buildAutoInput(angles));
    const loaded = computeNerpa(buildAutoInput(angles, { forceA: 3, muscleUseA: true, forceB: 3, muscleUseB: true }));
    expect(loaded.grandScore).toBeGreaterThan(base.grandScore);
  });
});
