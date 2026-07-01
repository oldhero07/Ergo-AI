import { describe, expect, it } from "vitest";
import { lookupA, lookupB, lookupC } from "@/assessment/rula/rulaTables";
import {
  buildAutoInput,
  computeRula,
  lowerArmScore,
  neckScore,
  trunkScore,
  upperArmScore,
  wristScore,
} from "@/assessment/rula/rula";
import type { AngleSet } from "@/lib/angles";

describe("RULA category scores", () => {
  it("scores upper arm by elevation with adjustments", () => {
    expect(upperArmScore(0, false, false, false)).toBe(1); // neutral
    expect(upperArmScore(30, false, false, false)).toBe(2); // 20-45
    expect(upperArmScore(70, false, false, false)).toBe(3); // 45-90
    expect(upperArmScore(120, false, false, false)).toBe(4); // >90
    expect(upperArmScore(-40, false, false, false)).toBe(2); // extension
    expect(upperArmScore(70, true, false, false)).toBe(4); // +shoulder raised
    expect(upperArmScore(70, false, false, true)).toBe(2); // arm supported −1
  });

  it("scores lower arm by forearm flexion", () => {
    expect(lowerArmScore(80, false)).toBe(1); // 60-100
    expect(lowerArmScore(120, false)).toBe(2); // >100
    expect(lowerArmScore(80, true)).toBe(2); // +cross midline
  });

  it("scores wrist, neck and trunk", () => {
    expect(wristScore(0, false)).toBe(1);
    expect(wristScore(20, false)).toBe(3);
    expect(neckScore(5, false, false)).toBe(1);
    expect(neckScore(25, false, false)).toBe(3);
    expect(neckScore(-10, false, false)).toBe(4); // extension
    expect(trunkScore(0, false, false)).toBe(1);
    expect(trunkScore(40, false, false)).toBe(3);
  });
});

describe("RULA table lookups", () => {
  it("returns canonical Table A / B / C cells", () => {
    expect(lookupA(1, 1, 1, 1)).toBe(1);
    expect(lookupA(6, 3, 4, 2)).toBe(9);
    expect(lookupB(1, 1, 1)).toBe(1);
    expect(lookupB(6, 6, 2)).toBe(9);
    expect(lookupC(1, 1)).toBe(1);
    expect(lookupC(8, 7)).toBe(7);
  });

  it("clamps out-of-range scores into the table", () => {
    expect(lookupC(12, 9)).toBe(7); // saturates at the corner
  });
});

describe("computeRula end to end", () => {
  it("a fully neutral posture yields grand score 1", () => {
    const angles: AngleSet = { upperArm: 0, lowerArm: 80, neck: 5, trunk: 0, side: "right", confidence: 1 };
    const result = computeRula(buildAutoInput(angles));
    expect(result.grandScore).toBe(1);
    expect(result.riskBand).toBe("low");
  });

  it("an elevated-arm hunched posture is high risk", () => {
    const angles: AngleSet = { upperArm: 100, lowerArm: 30, neck: 25, trunk: 35, side: "right", confidence: 1 };
    const result = computeRula(buildAutoInput(angles, { muscleUseA: true, muscleUseB: true }));
    expect(result.grandScore).toBeGreaterThanOrEqual(5);
    expect(["high", "veryhigh"]).toContain(result.riskBand);
  });

  it("force and muscle use raise the score", () => {
    const angles: AngleSet = { upperArm: 50, lowerArm: 80, neck: 15, trunk: 15, side: "right", confidence: 1 };
    const base = computeRula(buildAutoInput(angles));
    const loaded = computeRula(buildAutoInput(angles, { forceA: 3, muscleUseA: true, forceB: 3, muscleUseB: true }));
    expect(loaded.grandScore).toBeGreaterThan(base.grandScore);
  });
});
