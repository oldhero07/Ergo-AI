import { describe, expect, it } from "vitest";
import { lookupActionCategory } from "@/assessment/owas/owasTables";
import { armsCode, backCode, computeOwas, legsCode, loadCode } from "@/assessment/owas/owas";
import { buildAutoInput } from "@/assessment/rula/rula";
import type { AngleSet } from "@/lib/angles";

/** Spot-checks against the published OWAS classification (verified against two
 * independent published implementations that agree cell-for-cell). Code order:
 * back, arms, legs, load. */
describe("OWAS action-category table", () => {
  it("matches published values for canonical codes", () => {
    // Neutral standing, light load → AC 1.
    expect(lookupActionCategory(1, 1, 2, 1)).toBe(1);
    // Straight back, squatting (both knees bent) → AC 2.
    expect(lookupActionCategory(1, 1, 4, 1)).toBe(2);
    // Straight back, both arms up, squatting, heavy → AC 3.
    expect(lookupActionCategory(1, 3, 4, 3)).toBe(3);
    // Bent back standing → AC 2 (light) / AC 3 (heavy).
    expect(lookupActionCategory(2, 1, 2, 1)).toBe(2);
    expect(lookupActionCategory(2, 1, 2, 3)).toBe(3);
    // Bent back, both arms up, one knee bent, heavy → AC 4.
    expect(lookupActionCategory(2, 3, 5, 2)).toBe(4);
    // Twisted back sitting, light → AC 1; twisted + one arm up, sitting light → AC 2.
    expect(lookupActionCategory(3, 1, 1, 1)).toBe(1);
    expect(lookupActionCategory(3, 2, 1, 1)).toBe(2);
    // Twisted, one-knee-bent squat → AC 4 at any load.
    expect(lookupActionCategory(3, 1, 5, 1)).toBe(4);
    // Bent + twisted, both knees bent → AC 4; worst-case code 4-3-5-3 → AC 4.
    expect(lookupActionCategory(4, 1, 4, 1)).toBe(4);
    expect(lookupActionCategory(4, 3, 5, 3)).toBe(4);
    // Bent + twisted while walking scales with load: 2 / 3 / 4.
    expect(lookupActionCategory(4, 2, 7, 1)).toBe(2);
    expect(lookupActionCategory(4, 2, 7, 2)).toBe(3);
    expect(lookupActionCategory(4, 2, 7, 3)).toBe(4);
    // Kneeling with bent back and both arms up → AC 4.
    expect(lookupActionCategory(2, 3, 6, 1)).toBe(4);
  });

  it("every cell is a valid category 1-4 and the neutral row is all 1s", () => {
    for (let b = 1; b <= 4; b++)
      for (let a = 1; a <= 3; a++)
        for (let l = 1; l <= 7; l++)
          for (let f = 1; f <= 3; f++) {
            const ac = lookupActionCategory(b, a, l, f);
            expect(ac).toBeGreaterThanOrEqual(1);
            expect(ac).toBeLessThanOrEqual(4);
          }
    // Back straight, arms down, standing straight: all loads AC 1.
    expect(lookupActionCategory(1, 1, 2, 1)).toBe(1);
    expect(lookupActionCategory(1, 1, 2, 2)).toBe(1);
    expect(lookupActionCategory(1, 1, 2, 3)).toBe(1);
  });
});

describe("OWAS code derivation", () => {
  it("back code from trunk angle + twist flags", () => {
    expect(backCode(5, false, false)).toBe(1);
    expect(backCode(35, false, false)).toBe(2);
    expect(backCode(5, true, false)).toBe(3);
    expect(backCode(5, false, true)).toBe(3);
    expect(backCode(35, true, false)).toBe(4);
  });

  it("arms code from above-shoulder classification", () => {
    expect(armsCode("none")).toBe(1);
    expect(armsCode("one")).toBe(2);
    expect(armsCode("both")).toBe(3);
  });

  it("legs code from knee flexion / bilaterality / seated convention", () => {
    expect(legsCode(undefined, true, true)).toEqual({ code: 2, assumed: true });
    expect(legsCode(10, true, true)).toEqual({ code: 2, assumed: false });
    expect(legsCode(10, false, true)).toEqual({ code: 3, assumed: false });
    expect(legsCode(45, true, false)).toEqual({ code: 4, assumed: false });
    expect(legsCode(45, false, false)).toEqual({ code: 5, assumed: false });
    expect(legsCode(80, true, true)).toEqual({ code: 1, assumed: true }); // deep bend + supported → sitting
    expect(legsCode(80, true, false)).toEqual({ code: 4, assumed: false }); // deep bend unsupported → squat
  });

  it("load code maps REBA bands conservatively", () => {
    expect(loadCode(0)).toBe(1);
    expect(loadCode(1)).toBe(1);
    expect(loadCode(2)).toBe(2);
  });
});

describe("computeOwas end-to-end", () => {
  const angles = (over: Partial<AngleSet> = {}): AngleSet => ({
    upperArm: 30,
    lowerArm: 70,
    neck: 10,
    trunk: 10,
    side: "right",
    confidence: 0.9,
    ...over,
  });

  it("neutral standing posture → AC 1 (low)", () => {
    const input = buildAutoInput(angles());
    const r = computeOwas(input);
    expect(r.method).toBe("OWAS");
    expect(r.grandScore).toBe(1);
    expect(r.maxScore).toBe(4);
    expect(r.riskBand).toBe("low");
  });

  it("bent trunk + heavy-ish load → escalates", () => {
    const input = buildAutoInput(angles({ trunk: 40 }), { load: 2 });
    const r = computeOwas(input);
    // back 2, arms 1, legs 2 (not visible → assumed standing), load 2 → AC 2
    expect(r.grandScore).toBe(2);
    expect(r.riskBand).toBe("medium");
  });

  it("bent + twisted trunk with both arms up and bent knees → AC 4", () => {
    const input = buildAutoInput(angles({ trunk: 40, trunkSideBend: true, legAngle: 50 }), {
      armsAboveShoulder: "both",
      legsSupported: false,
    });
    const r = computeOwas(input);
    expect(r.grandScore).toBe(4);
    expect(r.riskBand).toBe("veryhigh");
  });

  it("derives armsAboveShoulder from both-sides data via buildAutoInput", () => {
    const input = buildAutoInput(
      angles({
        sides: {
          left: { upperArm: 120, lowerArm: 60, visibility: 0.9 },
          right: { upperArm: 40, lowerArm: 60, visibility: 0.9 },
        },
      }),
    );
    expect(input.armsAboveShoulder).toBe("one");
    const r = computeOwas(input);
    const armsItem = r.groups[0].items.find((i) => i.label === "Arms");
    expect(armsItem?.value).toBe(2);
  });

  it("posture-code breakdown lists all four digits", () => {
    const r = computeOwas(buildAutoInput(angles()));
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0].items.map((i) => i.label)).toEqual(["Back", "Arms", "Legs", "Load"]);
  });
});
