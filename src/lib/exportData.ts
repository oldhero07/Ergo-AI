import { getMethod } from "@/assessment/registry";
import type { PostureInput } from "@/assessment/types";
import type { PoseAnalysis, VideoAnalysis } from "@/lib/analyze";

/**
 * CSV / JSON export helpers for photo and video analysis batches. Pure
 * string-building (no DOM) except `downloadText`, so the bulk of this module
 * is unit-testable without a browser environment.
 */

export interface PhotoCsvItem {
  fileName: string;
  analysis: PoseAnalysis;
}

/** Escape one CSV field: quote-wrap when it contains a quote, comma, or newline. */
function csvField(value: string): string {
  if (/["\n,]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvRow(fields: (string | number | boolean | undefined)[]): string {
  return fields
    .map((f) => {
      if (f === undefined || f === null) return "";
      if (typeof f === "boolean") return f ? "true" : "false";
      if (typeof f === "number") return csvField(f.toFixed(2));
      return csvField(f);
    })
    .join(",");
}

const BASE_COLUMNS = [
  "file",
  "method",
  "detected",
  "error",
  "side",
  "upper_arm_deg",
  "lower_arm_deg",
  "wrist_deg",
  "neck_deg",
  "trunk_deg",
  "knee_deg",
  "confidence",
  "wrist_measured",
  "grand_score",
  "max_score",
  "risk_band",
  "risk_label",
];

const FLAG_COLUMNS = [
  "shoulder_raised",
  "upper_arm_abducted",
  "arm_supported",
  "lower_arm_cross_midline",
  "wrist_deviated",
  "wrist_twist_end",
  "neck_twisted",
  "neck_side_bend",
  "trunk_twisted",
  "trunk_side_bend",
  "legs_supported",
  "legs_bilateral",
  "muscle_use_a",
  "force_a",
  "muscle_use_b",
  "force_b",
  "load",
  "load_shock",
  "coupling",
  "activity_static",
  "activity_repeated",
  "activity_unstable",
  "arms_above_shoulder",
];

function slugify(label: string): string {
  return label.toLowerCase().replace(/\s+/g, "_");
}

/** Derive `<slug>_score` column names from a set of group-item labels, in the order encountered. */
function scoreSlugsFromGroups(groups: { items: { label: string }[] }[]): string[] {
  const slugs: string[] = [];
  for (const g of groups) {
    for (const item of g.items) {
      const slug = `${slugify(item.label)}_score`;
      if (!slugs.includes(slug)) slugs.push(slug);
    }
  }
  return slugs;
}

function flagValues(input: PostureInput): (string | number | boolean | undefined)[] {
  return [
    input.shoulderRaised,
    input.upperArmAbducted,
    input.armSupported,
    input.lowerArmCrossMidline,
    input.wristDeviated,
    input.wristTwistEnd,
    input.neckTwisted,
    input.neckSideBend,
    input.trunkTwisted,
    input.trunkSideBend,
    input.legsSupported,
    input.legsBilateral,
    input.muscleUseA,
    input.forceA,
    input.muscleUseB,
    input.forceB,
    input.load,
    input.loadShock,
    input.coupling,
    input.activityStatic,
    input.activityRepeated,
    input.activityUnstable,
    input.armsAboveShoulder,
  ];
}

/** Map of `<slug>_score` -> value, from an assessment's groups. */
function scoreMap(groups: { items: { label: string; value: number }[] }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const g of groups) for (const item of g.items) m.set(`${slugify(item.label)}_score`, item.value);
  return m;
}

/** One row per photo. Columns are fixed base/flag columns plus per-component
 * `<slug>_score` columns derived from the first scored item's groups. */
export function photoCsv(items: PhotoCsvItem[], methodId: string): string {
  const firstScored = items.find((it) => it.analysis.detected && it.analysis.assessment);
  const scoreSlugs = firstScored?.analysis.assessment ? scoreSlugsFromGroups(firstScored.analysis.assessment.groups) : [];

  const header = [...BASE_COLUMNS, ...scoreSlugs, ...FLAG_COLUMNS];
  const lines = [csvRow(header)];

  for (const item of items) {
    const { analysis } = item;
    if (!analysis.detected || !analysis.assessment || !analysis.input) {
      const row = [
        item.fileName,
        methodId,
        analysis.detected,
        analysis.error ?? "",
        ...new Array(BASE_COLUMNS.length - 4).fill(""),
        ...new Array(scoreSlugs.length).fill(""),
        ...new Array(FLAG_COLUMNS.length).fill(""),
      ];
      lines.push(csvRow(row));
      continue;
    }

    const a = analysis.assessment;
    const input = analysis.input;
    const scores = scoreMap(a.groups);

    const base: (string | number | boolean | undefined)[] = [
      item.fileName,
      methodId,
      analysis.detected,
      analysis.error ?? "",
      analysis.angles?.side ?? "",
      a.angles.upperArm,
      a.angles.lowerArm,
      input.wristAngle,
      a.angles.neck,
      a.angles.trunk,
      input.legAngle,
      analysis.angles?.confidence,
      analysis.wristMeasured,
      a.grandScore,
      a.maxScore,
      a.riskBand,
      a.riskLabel,
    ];

    const scoreValues = scoreSlugs.map((slug) => scores.get(slug));
    lines.push(csvRow([...base, ...scoreValues, ...flagValues(input)]));
  }

  return lines.join("\n");
}

/** Video CSV: `# key: value` comment header lines, then one row per frame. */
export function videoCsv(analysis: VideoAnalysis, methodId: string, fileName: string): string {
  const method = getMethod(methodId);

  const comments = [
    `# file: ${fileName}`,
    `# method: ${methodId}`,
    `# fps: ${analysis.fps}`,
    `# sampled_duration_sec: ${analysis.sampledDurationSec}`,
    `# skipped_no_pose: ${analysis.skippedNoPose}`,
    `# skipped_low_confidence: ${analysis.skippedLowConfidence}`,
    `# unreadable_frames: ${analysis.unreadableFrames}`,
    `# temporal_repeated: ${analysis.temporal.repeated}`,
    `# temporal_sustained: ${analysis.temporal.sustained}`,
  ];

  // Compute the first frame's assessment (if any) to derive the score-column set.
  const firstAssessment = analysis.frames.length ? method.compute(analysis.frames[0].input) : undefined;
  const scoreSlugs = firstAssessment ? scoreSlugsFromGroups(firstAssessment.groups) : [];

  const header = [
    "time_sec",
    "side",
    "upper_arm_deg",
    "lower_arm_deg",
    "wrist_deg",
    "neck_deg",
    "trunk_deg",
    "knee_deg",
    "confidence",
    "grand_score",
    "risk_band",
    ...scoreSlugs,
  ];

  const lines = [...comments, csvRow(header)];

  for (const frame of analysis.frames) {
    const a = method.compute(frame.input);
    const scores = scoreMap(a.groups);
    const scoreValues = scoreSlugs.map((slug) => scores.get(slug));
    lines.push(
      csvRow([
        frame.timeSec,
        frame.angles.side,
        frame.angles.upperArm,
        frame.angles.lowerArm,
        frame.input.wristAngle,
        frame.angles.neck,
        frame.angles.trunk,
        frame.angles.legAngle,
        frame.confidence,
        a.grandScore,
        a.riskBand,
        ...scoreValues,
      ]),
    );
  }

  return lines.join("\n");
}

/** Pretty-printed JSON (2-space indent) for any serializable payload. */
export function exportJson(payload: unknown): string {
  return JSON.stringify(payload, null, 2);
}

/** Trigger a browser download of `text` as a file named `filename`. No-op outside the DOM. */
export function downloadText(filename: string, mime: string, text: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
