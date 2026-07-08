/**
 * Phase-2 gate: old-vs-new score comparison over the bundled samples.
 * Old = MediaPipe-3D PostureInputs pinned in src/test/baseline.test.ts.
 * New = captured server keypoints -> angles2d -> same scoring engines.
 * Run with:  npx tsx scripts/compare-scores.mjs   (or vite-node)
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { computeAngles2D } from "../src/lib/angles2d.ts";
import { buildAutoInput, computeRula } from "../src/assessment/rula/rula.ts";
import { computeReba } from "../src/assessment/reba/reba.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixDir = join(root, "src", "test", "fixtures", "keypoints");

// Old pinned baselines (commit 0272b4e, from baseline.test.ts).
const OLD = {
  "office-typing": { rula: 3, reba: 3 },
  "warehouse-lifting": { rula: 6, reba: 7 },
  "assembly-standing": { rula: 6, reba: 5 },
};

console.log("sample | old RULA/REBA | new RULA/REBA | UA° LA° W° N° T° | flags");
console.log("-".repeat(100));
for (const name of ["office-typing", "warehouse-lifting", "assembly-standing", "weaver-sample"]) {
  const fx = JSON.parse(readFileSync(join(fixDir, `${name}.json`), "utf-8"));
  const { angles, flags, wristAngle, offProfile } = computeAngles2D(fx.keypoints, fx.image.w, fx.image.h);
  const input = buildAutoInput(angles, { wristAngle });
  const rula = computeRula(input);
  const reba = computeReba(input);
  const old = OLD[name] ? `${OLD[name].rula}/${OLD[name].reba}` : "-/-";
  const a = [angles.upperArm, angles.lowerArm, wristAngle, angles.neck, angles.trunk]
    .map((v) => v.toFixed(0))
    .join(" ");
  const fl = Object.entries(flags).filter(([, v]) => !v).map(([k]) => k).join(",") || "all measured";
  const warn = offProfile ? " OFF-PROFILE" : "";
  console.log(`${name.padEnd(18)} | ${old.padEnd(7)} | ${rula.grandScore}/${reba.grandScore} (${angles.side}) | ${a} | ${fl}${warn}`);
}
