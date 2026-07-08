// Local-only corpus calibration report (reads corpus-keypoints.local.json).
import { readFileSync } from "node:fs";
import { computeAngles2D } from "../src/lib/angles2d.ts";
import { buildAutoInput, computeRula } from "../src/assessment/rula/rula.ts";
import { computeReba } from "../src/assessment/reba/reba.ts";

const rows = JSON.parse(readFileSync("corpus-keypoints.local.json", "utf-8")).filter((r) => r.detected);
let off = 0;
let conf = 0;
const rulaDist = {};
const rebaDist = {};
const unflagged = {};
for (const r of rows) {
  const { angles, flags, wristAngle, offProfile } = computeAngles2D(r.keypoints, r.image.w, r.image.h);
  if (offProfile) off++;
  conf += angles.confidence;
  for (const [k, v] of Object.entries(flags)) if (!v) unflagged[k] = (unflagged[k] ?? 0) + 1;
  const input = buildAutoInput(angles, { wristAngle });
  rulaDist[computeRula(input).grandScore] = (rulaDist[computeRula(input).grandScore] ?? 0) + 1;
  rebaDist[computeReba(input).grandScore] = (rebaDist[computeReba(input).grandScore] ?? 0) + 1;
}
console.log(`n=${rows.length} | offProfile=${off} | mean confidence=${(conf / rows.length).toFixed(2)}`);
console.log("RULA distribution:", JSON.stringify(rulaDist));
console.log("REBA distribution:", JSON.stringify(rebaDist));
console.log("flagged-unmeasured counts:", JSON.stringify(unflagged));
