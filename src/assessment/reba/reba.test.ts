import { describe, expect, it } from "vitest";
import { lookupA, lookupB, lookupC } from "@/assessment/reba/rebaTables";
import {
  computeReba,
  legsScore,
  lowerArmScore,
  neckScore,
  trunkScore,
  upperArmScore,
  wristScore,
} from "@/assessment/reba/reba";
import { buildAutoInput } from "@/assessment/rula/rula";
import type { AngleSet } from "@/lib/angles";

describe("REBA category scores", () => {
  it("scores neck (2 bands + twist/side-bend)", () => {
    expect(neckScore(10, false, false)).toBe(1); // 0-20° flexion
    expect(neckScore(30, false, false)).toBe(2); // >20°
    expect(neckScore(-5, false, false)).toBe(2); // extension
    expect(neckScore(10, true, false)).toBe(2); // +twist
  });

  it("scores trunk by inclination + twist/side-bend", () => {
    expect(trunkScore(0, false, false)).toBe(1);
    expect(trunkScore(15, false, false)).toBe(2);
    expect(trunkScore(40, false, false)).toBe(3);
    expect(trunkScore(70, false, false)).toBe(4);
    expect(trunkScore(40, true, false)).toBe(4); // +twist
  });

  it("scores legs with the knee-flexion add and seated exception", () => {
    expect(legsScore(true, undefined, true)).toBe(1); // bilateral, no knee data
    expect(legsScore(false, undefined, true)).toBe(2); // unilateral / unstable
    expect(legsScore(true, 45, false)).toBe(2); // +1 for 30-60° knee
    expect(legsScore(true, 70, false)).toBe(3); // +2 for >60° knee
    expect(legsScore(true, 70, true)).toBe(1); // seated → knee add skipped
  });

  it("scores upper arm, lower arm and wrist", () => {
    expect(upperArmScore(0, false, false, false)).toBe(1);
    expect(upperArmScore(70, false, false, false)).toBe(3);
    expect(upperArmScore(120, false, false, false)).toBe(4);
    expect(upperArmScore(70, false, false, true)).toBe(2); // supported −1
    expect(lowerArmScore(80)).toBe(1); // 60-100°
    expect(lowerArmScore(40)).toBe(2); // <60°
    expect(lowerArmScore(120)).toBe(2); // >100°
    expect(wristScore(10, false)).toBe(1);
    expect(wristScore(20, false)).toBe(2);
    expect(wristScore(20, true)).toBe(3); // +deviated/twisted
  });
});

describe("REBA table lookups", () => {
  it("returns canonical Table A / B / C cells", () => {
    expect(lookupA(1, 1, 1)).toBe(1);
    expect(lookupA(3, 5, 4)).toBe(9);
    expect(lookupA(2, 2, 2)).toBe(4);
    expect(lookupB(1, 1, 1)).toBe(1);
    expect(lookupB(2, 6, 3)).toBe(9);
    expect(lookupB(1, 3, 2)).toBe(4);
    expect(lookupC(1, 1)).toBe(1);
    expect(lookupC(12, 12)).toBe(12);
    expect(lookupC(5, 6)).toBe(7);
  });

  it("clamps out-of-range scores into the table", () => {
    expect(lookupC(20, 20)).toBe(12); // saturates at the corner
  });
});

describe("computeReba end to end", () => {
  it("a neutral seated posture yields grand score 1 (negligible)", () => {
    const angles: AngleSet = { upperArm: 0, lowerArm: 80, neck: 5, trunk: 0, side: "right", confidence: 1 };
    const result = computeReba(buildAutoInput(angles));
    expect(result.method).toBe("REBA");
    expect(result.maxScore).toBe(15);
    expect(result.grandScore).toBe(1);
    expect(result.riskBand).toBe("low");
  });

  it("an elevated-arm hunched posture with load is high risk", () => {
    const angles: AngleSet = { upperArm: 100, lowerArm: 30, neck: 25, trunk: 35, side: "right", confidence: 1 };
    const result = computeReba(
      buildAutoInput(angles, { legsBilateral: false, load: 2, coupling: 2, activityStatic: true }),
    );
    expect(result.grandScore).toBeGreaterThanOrEqual(8);
    expect(["high", "veryhigh"]).toContain(result.riskBand);
  });

  it("load, coupling and activity each raise the score", () => {
    const angles: AngleSet = { upperArm: 50, lowerArm: 80, neck: 15, trunk: 15, side: "right", confidence: 1 };
    const base = computeReba(buildAutoInput(angles));
    const loaded = computeReba(
      buildAutoInput(angles, { load: 2, coupling: 3, activityStatic: true, activityRepeated: true }),
    );
    expect(loaded.grandScore).toBeGreaterThan(base.grandScore);
  });
});
