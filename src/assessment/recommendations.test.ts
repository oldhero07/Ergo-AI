import { describe, expect, it } from "vitest";
import { buildNioshRecommendations, buildRecommendations } from "@/assessment/recommendations";
import { buildAutoInput, computeRula } from "@/assessment/rula/rula";
import { computeReba } from "@/assessment/reba/reba";
import { computeOwas } from "@/assessment/owas/owas";
import { computeNiosh } from "@/assessment/niosh/niosh";
import type { AngleSet } from "@/lib/angles";

const angles = (over: Partial<AngleSet> = {}): AngleSet => ({
  upperArm: 30,
  lowerArm: 70,
  neck: 10,
  trunk: 10,
  side: "right",
  confidence: 0.9,
  ...over,
});

describe("buildRecommendations", () => {
  it("neutral posture yields no critical items", () => {
    const input = buildAutoInput(angles({ upperArm: 10, neck: 5, trunk: 2 }));
    const recs = buildRecommendations(computeRula(input), input);
    expect(recs.every((r) => r.severity !== "critical")).toBe(true);
  });

  it("overhead reach fires the critical upper-arm rule (and only once per component)", () => {
    const input = buildAutoInput(angles({ upperArm: 120 }));
    const recs = buildRecommendations(computeRula(input), input);
    const upperArm = recs.filter((r) => r.component === "Upper arm");
    expect(upperArm).toHaveLength(1);
    expect(upperArm[0].severity).toBe("critical");
    expect(upperArm[0].title).toMatch(/overhead/i);
  });

  it("deep trunk flexion fires the critical trunk rule on REBA", () => {
    const input = buildAutoInput(angles({ trunk: 70 }));
    const recs = buildRecommendations(computeReba(input), input);
    expect(recs.find((r) => r.component === "Trunk")?.severity).toBe("critical");
  });

  it("muscle-use and load flags add their rules", () => {
    const input = buildAutoInput(angles(), { muscleUseA: true, forceA: 3 });
    const recs = buildRecommendations(computeRula(input), input);
    expect(recs.some((r) => r.id === "muscle-use")).toBe(true);
    expect(recs.some((r) => r.id === "force-load")).toBe(true);
  });

  it("OWAS bent back maps to the back rule", () => {
    const input = buildAutoInput(angles({ trunk: 40 }));
    const recs = buildRecommendations(computeOwas(input), input);
    expect(recs.some((r) => r.component === "Back")).toBe(true);
  });

  it("orders critical before advisory", () => {
    const input = buildAutoInput(angles({ upperArm: 120, lowerArm: 20 }));
    const recs = buildRecommendations(computeRula(input), input);
    const sevs = recs.map((r) => r.severity);
    expect(sevs.indexOf("critical")).toBeLessThan(sevs.lastIndexOf("advisory"));
  });
});

describe("buildNioshRecommendations", () => {
  it("targets the lowest multiplier first", () => {
    const r = computeNiosh({
      horizontalCm: 60, // HM ≈ 0.417 - the limiting factor
      verticalCm: 100, // VM = 0.925
      travelCm: 50, // DM = 0.91
      asymmetryDeg: 0,
      frequencyPerMin: 1,
      durationHours: 1,
      coupling: "good",
      loadKg: 10,
    });
    const recs = buildNioshRecommendations(r);
    expect(recs[0].component).toBe("HM");
    expect(recs[0].severity).toBe("critical");
    expect(recs[0].body).toContain("0.42");
  });

  it("near-ideal geometry with an overweight load falls back to the load advice", () => {
    const r = computeNiosh({
      horizontalCm: 25,
      verticalCm: 75,
      travelCm: 25,
      asymmetryDeg: 0,
      frequencyPerMin: 0.2,
      durationHours: 1,
      coupling: "good",
      loadKg: 30, // LI ≈ 1.3 with all multipliers 1.0
    });
    const recs = buildNioshRecommendations(r);
    expect(recs).toHaveLength(1);
    expect(recs[0].id).toBe("niosh-load");
  });
});
