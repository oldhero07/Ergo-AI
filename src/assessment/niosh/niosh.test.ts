import { describe, expect, it } from "vitest";
import {
  LOAD_CONSTANT_KG,
  asymmetricMultiplier,
  computeNiosh,
  couplingMultiplier,
  distanceMultiplier,
  estimateNioshGeometry,
  frequencyMultiplier,
  horizontalMultiplier,
  verticalMultiplier,
  type NioshInput,
} from "@/assessment/niosh/niosh";

/** Component multipliers vs the Applications Manual tables (94-110).
 * Table values are printed to 2 decimals; formulas are exact. */
describe("NIOSH component multipliers", () => {
  it("horizontal: HM = 25/H, clamped", () => {
    expect(horizontalMultiplier(20)).toBe(1); // <=25 → 1.00
    expect(horizontalMultiplier(25)).toBe(1);
    expect(horizontalMultiplier(30)).toBeCloseTo(25 / 30, 10); // table: .83
    expect(horizontalMultiplier(50)).toBeCloseTo(0.5, 10);
    expect(horizontalMultiplier(63)).toBeCloseTo(25 / 63, 10); // table: .40
    expect(horizontalMultiplier(64)).toBe(0);
  });

  it("vertical: VM = 1 - 0.003|V-75|", () => {
    expect(verticalMultiplier(75)).toBe(1);
    expect(verticalMultiplier(0)).toBeCloseTo(0.775, 10); // table: .78
    expect(verticalMultiplier(30)).toBeCloseTo(0.865, 10); // table: .87
    expect(verticalMultiplier(100)).toBeCloseTo(0.925, 10); // table: .93
    expect(verticalMultiplier(175)).toBeCloseTo(0.7, 10); // table: .70
    expect(verticalMultiplier(176)).toBe(0);
  });

  it("distance: DM = 0.82 + 4.5/D, clamped", () => {
    expect(distanceMultiplier(20)).toBe(1); // <=25 → 1.00
    expect(distanceMultiplier(25)).toBe(1);
    expect(distanceMultiplier(40)).toBeCloseTo(0.9325, 10); // table: .93
    expect(distanceMultiplier(175)).toBeCloseTo(0.82 + 4.5 / 175, 10); // table: .85
    expect(distanceMultiplier(176)).toBe(0);
  });

  it("asymmetry: AM = 1 - 0.0032A", () => {
    expect(asymmetricMultiplier(0)).toBe(1);
    expect(asymmetricMultiplier(45)).toBeCloseTo(0.856, 10); // table: .86
    expect(asymmetricMultiplier(90)).toBeCloseTo(0.712, 10); // table: .71
    expect(asymmetricMultiplier(135)).toBeCloseTo(0.568, 10); // table: .57
    expect(asymmetricMultiplier(136)).toBe(0);
  });

  it("frequency: Table 5 values incl. V-band splits and zero cells", () => {
    // <=0.2 lifts/min
    expect(frequencyMultiplier(0.1, 1, 50)).toBe(1.0); // footnote: F<1/5min → 0.2
    expect(frequencyMultiplier(0.2, 8, 50)).toBe(0.85);
    // mid rows
    expect(frequencyMultiplier(4, 1, 50)).toBe(0.84);
    expect(frequencyMultiplier(4, 2, 50)).toBe(0.72);
    expect(frequencyMultiplier(4, 8, 50)).toBe(0.45);
    // conservative bucketing: 3.5 lifts/min uses the 4/min row
    expect(frequencyMultiplier(3.5, 8, 50)).toBe(0.45);
    // V-band splits (V < 75 vs >= 75)
    expect(frequencyMultiplier(9, 8, 50)).toBe(0);
    expect(frequencyMultiplier(9, 8, 80)).toBe(0.15);
    expect(frequencyMultiplier(10, 8, 80)).toBe(0.13);
    expect(frequencyMultiplier(11, 2, 50)).toBe(0);
    expect(frequencyMultiplier(11, 2, 80)).toBe(0.23);
    expect(frequencyMultiplier(13, 1, 50)).toBe(0);
    expect(frequencyMultiplier(13, 1, 80)).toBe(0.34);
    expect(frequencyMultiplier(15, 1, 80)).toBe(0.28);
    expect(frequencyMultiplier(16, 1, 80)).toBe(0);
  });

  it("coupling: Table 7", () => {
    expect(couplingMultiplier("good", 50)).toBe(1.0);
    expect(couplingMultiplier("good", 80)).toBe(1.0);
    expect(couplingMultiplier("fair", 50)).toBe(0.95);
    expect(couplingMultiplier("fair", 80)).toBe(1.0);
    expect(couplingMultiplier("poor", 50)).toBe(0.9);
    expect(couplingMultiplier("poor", 80)).toBe(0.9);
  });
});

describe("computeNiosh end-to-end", () => {
  it("ideal lift → RWL = 23 kg exactly, LI = load/23", () => {
    const input: NioshInput = {
      horizontalCm: 25,
      verticalCm: 75,
      travelCm: 25,
      asymmetryDeg: 0,
      frequencyPerMin: 0.2,
      durationHours: 1,
      coupling: "good",
      loadKg: 11.5,
    };
    const r = computeNiosh(input);
    expect(r.rwlKg).toBeCloseTo(LOAD_CONSTANT_KG, 10);
    expect(r.li).toBeCloseTo(0.5, 10);
    expect(r.riskBand).toBe("low");
  });

  it("hand-computed demanding lift", () => {
    // HM=25/50=0.5 · VM=1-0.003*25=0.925 · DM=0.82+4.5/50=0.91
    // AM=1-0.0032*45=0.856 · FM(4/min, 8h, V>=75)=0.45 · CM(fair, V>=75)=1.0
    // RWL = 23*0.5*0.925*0.91*0.856*0.45 = 3.7287840825 kg
    const input: NioshInput = {
      horizontalCm: 50,
      verticalCm: 100,
      travelCm: 50,
      asymmetryDeg: 45,
      frequencyPerMin: 4,
      durationHours: 8,
      coupling: "fair",
      loadKg: 10,
    };
    const r = computeNiosh(input);
    expect(r.rwlKg).toBeCloseTo(3.7287840825, 6);
    expect(r.li).toBeCloseTo(10 / 3.7287840825, 6);
    expect(r.riskBand).toBe("high"); // LI ≈ 2.68
  });

  it("out-of-range reach → RWL 0, very high risk, explanatory note", () => {
    const r = computeNiosh({
      horizontalCm: 70,
      verticalCm: 75,
      travelCm: 25,
      asymmetryDeg: 0,
      frequencyPerMin: 1,
      durationHours: 1,
      coupling: "good",
      loadKg: 5,
    });
    expect(r.rwlKg).toBe(0);
    expect(r.li).toBe(Infinity);
    expect(r.riskBand).toBe("veryhigh");
    expect(r.notes.some((n) => n.includes("63 cm"))).toBe(true);
  });

  it("LI band edges", () => {
    const base: NioshInput = {
      horizontalCm: 25,
      verticalCm: 75,
      travelCm: 25,
      asymmetryDeg: 0,
      frequencyPerMin: 0.2,
      durationHours: 1,
      coupling: "good",
      loadKg: 23, // LI = 1 exactly
    };
    expect(computeNiosh(base).riskBand).toBe("low");
    expect(computeNiosh({ ...base, loadKg: 34.5 }).riskBand).toBe("medium"); // LI 1.5
    expect(computeNiosh({ ...base, loadKg: 57.5 }).riskBand).toBe("high"); // LI 2.5
    expect(computeNiosh({ ...base, loadKg: 80.5 }).riskBand).toBe("veryhigh"); // LI 3.5
  });
});

describe("estimateNioshGeometry", () => {
  it("estimates H and V from synthetic world landmarks", () => {
    // World frame: meters, y down. Wrists at y=0.2 (0.6 m above the ankles at
    // y=0.8), 0.35 m forward of the mid-ankle in z, ankles at z=0.
    const world = new Array(33).fill(null).map(() => ({ x: 0, y: 0, z: 0, visibility: 1 }));
    world[15] = { x: 0.05, y: 0.2, z: -0.35, visibility: 1 }; // left wrist
    world[16] = { x: -0.05, y: 0.2, z: -0.35, visibility: 1 }; // right wrist
    world[27] = { x: 0.1, y: 0.8, z: 0, visibility: 1 }; // left ankle
    world[28] = { x: -0.1, y: 0.8, z: 0, visibility: 1 }; // right ankle
    const est = estimateNioshGeometry(world as never);
    expect(est).not.toBeNull();
    expect(est!.verticalCm).toBe(60);
    // wrist x=±0.05 vs mid-ankle x=0 → hypot(0.05, 0.35) ≈ 0.3536 m
    expect(est!.horizontalCm).toBe(35);
  });

  it("returns null when landmarks are missing", () => {
    expect(estimateNioshGeometry([] as never)).toBeNull();
  });
});
