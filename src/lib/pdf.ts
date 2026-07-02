import { jsPDF } from "jspdf";
import type { PoseAnalysis } from "@/lib/analyze";
import type { AssessmentResult, GroupBreakdown, PostureInput, RiskBand } from "@/assessment/types";
import {
  buildNioshRecommendations,
  buildRecommendations,
  type Recommendation,
  type Severity,
} from "@/assessment/recommendations";
import { thresholdRows } from "@/assessment/thresholds";
import type { NioshInput, NioshResult } from "@/assessment/niosh/niosh";

/** One photo + its analysis, ready to be rendered onto a PDF page. */
export interface PdfReportItem {
  fileName: string;
  /** `blob:` object URL or `data:` URL pointing at the original (unannotated) photo. */
  originalUrl: string;
  analysis: PoseAnalysis;
}

/** Optional human-entered provenance shown on the cover page. All fields optional. */
export interface ReportMeta {
  assessor?: string;
  organization?: string;
  subject?: string; // subject / task being assessed
  /** Optional org/report logo, `data:` URL. Drawn top-right of the cover page when present. */
  logoDataUrl?: string;
}

/** RGB fill/text colors per risk band - jsPDF wants plain RGB triples, not CSS `hsl(var(--x))`. */
const RISK_RGB: Record<RiskBand, [number, number, number]> = {
  low: [22, 163, 74],
  medium: [217, 119, 6],
  high: [234, 88, 12],
  veryhigh: [220, 38, 38],
};

const PAGE_MARGIN = 36; // pt
const FOOTER_RESERVE = 28; // pt kept clear at the bottom of every page for the footer
const CONTENT_MUTED: [number, number, number] = [100, 100, 100];
const CONTENT_DARK: [number, number, number] = [30, 30, 30];
const RULE_GRAY: [number, number, number] = [210, 210, 210];

/** Longest edge (px) we embed images at in the PDF. The display box is ~255pt
 * wide (~530px @150dpi print), so ~1000px is plenty sharp while keeping the file
 * small. Both the original photo AND the skeleton are re-encoded to JPEG here -
 * embedding the skeleton as PNG (lossless, photographic content) is what made
 * reports balloon to many MB per page. */
const PDF_IMAGE_MAX_PX = 1000;
const PDF_IMAGE_QUALITY = 0.82;

export interface PreparedImage {
  /** Downscaled, JPEG-encoded `data:` URL ready for `doc.addImage(..., "JPEG")`. */
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Load any image URL (`data:`, `blob:`, or http), downscale its longest edge to
 * `maxPx`, and re-encode as JPEG. This keeps PDF reports small enough to handle
 * large batches: a full-res original + a PNG skeleton can be ~7 MB *per photo*;
 * downscaled JPEGs are typically ~150-300 KB each.
 */
export async function prepareImage(
  url: string,
  maxPx = PDF_IMAGE_MAX_PX,
  quality = PDF_IMAGE_QUALITY,
): Promise<PreparedImage> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });

  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  const scale = Math.min(1, maxPx / Math.max(nw, nh));
  const width = Math.max(1, Math.round(nw * scale));
  const height = Math.max(1, Math.round(nh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to acquire 2D canvas context");
  ctx.drawImage(img, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL("image/jpeg", quality), width, height };
}

/** Scale (w, h) to fit fully inside (maxW, maxH) while preserving aspect ratio. */
function fitWithin(w: number, h: number, maxW: number, maxH: number): { w: number; h: number } {
  const scale = Math.min(maxW / w, maxH / h, 1);
  return { w: w * scale, h: h * scale };
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

const COUPLING_LABELS = ["good", "fair", "poor", "unacceptable"];

/** pdf.ts works with method NAMES ("RULA"/"REBA"/"OWAS"); map to registry ids. */
function methodNameToId(method: string): string {
  if (method === "REBA") return "reba";
  if (method === "OWAS") return "owas";
  return "rula";
}

const SEVERITY_RGB: Record<Severity, [number, number, number]> = {
  critical: [220, 38, 38],
  important: [217, 119, 6],
  advisory: CONTENT_MUTED,
};

const SEVERITY_TAG: Record<Severity, string> = {
  critical: "[CRITICAL]",
  important: "[IMPORTANT]",
  advisory: "[ADVISORY]",
};

/** The 1-N scale a method's grand score sits on (RULA 1-7, REBA 1-15). */
function methodScale(maxScore: number): string {
  return `1-${fmt(maxScore)}`;
}

/**
 * Plain-language summary of the visually-unobservable factors baked into the
 * input, branched by method so a REBA report describes load/coupling/activity
 * (not RULA's wrist-twist/muscle), and vice-versa.
 */
function describeAssumptions(input: PostureInput, method: string): string {
  const parts: string[] = [];
  if (method === "OWAS") {
    parts.push(
      input.armsAboveShoulder !== undefined
        ? `Arms: ${input.armsAboveShoulder} above shoulder (estimated from both sides' pose)`
        : "Arms: classified from the scored side only (assumed)",
    );
    parts.push(
      input.legAngle !== undefined
        ? `Knee flexion: ${fmt(input.legAngle)}° (estimated from pose)`
        : "Legs: not visible - coded as standing, both straight (assumed)",
    );
    parts.push(input.load >= 2 ? "Load: 10-20 kg band (assumed from load setting)" : "Load: < 10 kg (assumed)");
    parts.push("Walking / kneeling: not detectable from a single view (assumed absent)");
    return parts.join(" · ");
  }
  if (method === "REBA") {
    parts.push(
      input.legAngle !== undefined
        ? `Knee flexion: ${fmt(input.legAngle)}° (estimated from pose)`
        : "Legs: not visible - assumed bilateral / supported",
    );
    parts.push(
      input.load > 0 || input.loadShock
        ? `Load: band ${fmt(input.load)} (0-2)${input.loadShock ? " + shock" : ""} (assumed)`
        : "Load: < 5 kg, no shock (assumed)",
    );
    parts.push(`Coupling: ${COUPLING_LABELS[Math.max(0, Math.min(3, Math.round(input.coupling)))]} (assumed)`);
    const act = [
      input.activityStatic && "static hold > 1 min",
      input.activityRepeated && "repeated > 4×/min",
      input.activityUnstable && "rapid/unstable changes",
    ].filter(Boolean) as string[];
    parts.push(act.length ? `Activity score: ${act.join(", ")} (assumed)` : "Activity score: none (assumed)");
    parts.push(
      input.wristDeviated || input.wristTwistEnd
        ? "Wrist: deviated/twisted (assumed)"
        : "Wrist: neutral (assumed)",
    );
    return parts.join(" · ");
  }

  // RULA
  parts.push(
    input.wristDeviated || Math.abs(input.wristAngle) > 0
      ? `Wrist: ${fmt(input.wristAngle)}° flexion${input.wristDeviated ? ", deviated" : ""} (estimated)`
      : "Wrist: neutral (assumed)",
  );
  parts.push(input.wristTwistEnd ? "Twist: at/near end of range (assumed)" : "Twist: mid-range (assumed)");
  parts.push(
    input.muscleUseA || input.muscleUseB
      ? "Muscle use: static/repeated posture held (assumed)"
      : "Muscle use: none significant (assumed)",
  );
  const maxForce = Math.max(input.forceA, input.forceB);
  parts.push(maxForce > 0 ? `Force/load: ${maxForce} (assumed, 0-3 scale)` : "Force/load: none (assumed)");
  parts.push(input.legsSupported ? "Legs: supported (assumed)" : "Legs: not supported (assumed)");
  return parts.join(" · ");
}

/** Measured joint angles + pose confidence - the objective values the score is derived from. */
function describeAngles(analysis: PoseAnalysis, a: AssessmentResult): string {
  let txt = `Measured angles - upper arm ${fmt(a.angles.upperArm)}°, lower arm ${fmt(a.angles.lowerArm)}°, neck ${fmt(
    a.angles.neck,
  )}°, trunk ${fmt(a.angles.trunk)}°`;
  if (a.method === "REBA" && analysis.input?.legAngle !== undefined) {
    txt += `, knee ${fmt(analysis.input.legAngle)}°`;
  }
  if (analysis.angles) txt += `  ·  pose confidence ${Math.round(analysis.angles.confidence * 100)}%`;
  return txt;
}

function addCaveat(doc: jsPDF, x: number, y: number, maxWidth: number, method: string): number {
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...CONTENT_MUTED);
  const lines = doc.splitTextToSize(
    `Caveat: this is a lower-bound estimate from a single camera view. It is not a substitute for a full multi-factor ${method} observation by a trained assessor.`,
    maxWidth,
  ) as string[];
  doc.text(lines, x, y);
  return y + lines.length * 10;
}

/** Page header: bold title, optional muted subtitle, and a rule beneath. Returns the y cursor below it. */
function drawHeader(doc: jsPDF, pageWidth: number, title: string, subtitle?: string): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...CONTENT_DARK);
  doc.text(title, PAGE_MARGIN, PAGE_MARGIN);
  let ruleY = PAGE_MARGIN + 6;
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...CONTENT_MUTED);
    doc.text(subtitle, PAGE_MARGIN, PAGE_MARGIN + 15);
    ruleY = PAGE_MARGIN + 21;
  }
  doc.setDrawColor(...RULE_GRAY);
  doc.setLineWidth(0.75);
  doc.line(PAGE_MARGIN, ruleY, pageWidth - PAGE_MARGIN, ruleY);
  return ruleY + 16;
}

/** Add a page if `needed` pt won't fit above the footer; returns the (possibly reset) y cursor. */
function ensureSpace(doc: jsPDF, y: number, needed: number, pageWidth: number, contTitle: string): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - PAGE_MARGIN - FOOTER_RESERVE) {
    doc.addPage();
    return drawHeader(doc, pageWidth, contTitle);
  }
  return y;
}

/** Render one GroupBreakdown (Group A or Group B) as a compact text block. Returns the new y cursor. */
function drawGroupBreakdown(doc: jsPDF, group: GroupBreakdown, x: number, y: number, maxWidth: number): number {
  let cursor = y;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...CONTENT_DARK);
  const titleLines = doc.splitTextToSize(`${group.name} - score ${fmt(group.score)}`, maxWidth) as string[];
  doc.text(titleLines, x, cursor);
  cursor += titleLines.length * 12 + 1;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...CONTENT_DARK);
  for (const item of group.items) {
    const note = item.note ? `  (${item.note})` : "";
    const lines = doc.splitTextToSize(`• ${item.label}: ${fmt(item.value)}${note}`, maxWidth) as string[];
    doc.text(lines, x, cursor);
    cursor += lines.length * 10;
  }

  cursor += 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...CONTENT_MUTED);
  doc.text(`Posture: ${fmt(group.posture)}   Muscle: ${fmt(group.muscle)}   Force: ${fmt(group.force)}`, x, cursor);
  cursor += 14;
  return cursor;
}

/**
 * Compact per-joint table: Joint | Measured | Band | Score | Next threshold.
 * Rows come from `thresholdRows`, skipping "not measured" joints. Skipped
 * entirely for OWAS (category-coded, not angle-banded) by the caller.
 * Returns the new y cursor.
 */
function addThresholdTable(doc: jsPDF, y: number, input: PostureInput, methodId: string, pageWidth: number, title: string): number {
  const rows = thresholdRows(methodId, input).filter((r) => r.measuredDeg !== undefined);
  if (!rows.length) return y;

  const colX = {
    joint: PAGE_MARGIN,
    measured: PAGE_MARGIN + 90,
    band: PAGE_MARGIN + 170,
    score: PAGE_MARGIN + 300,
    next: PAGE_MARGIN + 350,
  };

  let cursor = ensureSpace(doc, y, 16 + rows.length * 12 + 8, pageWidth, title);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...CONTENT_DARK);
  doc.text("Joint-by-joint thresholds", PAGE_MARGIN, cursor);
  cursor += 12;

  doc.setFontSize(8.5);
  doc.text("Joint", colX.joint, cursor);
  doc.text("Measured", colX.measured, cursor);
  doc.text("Band", colX.band, cursor);
  doc.text("Score", colX.score, cursor);
  doc.text("Next threshold", colX.next, cursor);
  cursor += 4;
  doc.setDrawColor(...RULE_GRAY);
  doc.setLineWidth(0.5);
  doc.line(PAGE_MARGIN, cursor, pageWidth - PAGE_MARGIN, cursor);
  cursor += 11;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  for (const row of rows) {
    cursor = ensureSpace(doc, cursor, 12, pageWidth, title);
    doc.setTextColor(...CONTENT_DARK);
    doc.text(row.joint, colX.joint, cursor);
    doc.text(`${fmt(row.measuredDeg!)}°`, colX.measured, cursor);
    doc.text(row.band, colX.band, cursor);
    doc.text(fmt(row.score), colX.score, cursor);
    doc.setTextColor(...CONTENT_MUTED);
    const nextLines = doc.splitTextToSize(row.nextThreshold ?? "-", pageWidth - PAGE_MARGIN - colX.next) as string[];
    doc.text(nextLines, colX.next, cursor);
    cursor += Math.max(1, nextLines.length) * 12;
  }

  return cursor + 6;
}

/**
 * "Recommendations" section: severity-tagged, titled, wrapped-body items,
 * capped at 5 per call. Returns the new y cursor.
 */
function addRecommendationsSection(doc: jsPDF, y: number, recs: Recommendation[], pageWidth: number, title: string): number {
  if (!recs.length) return y;
  const contentWidth = pageWidth - PAGE_MARGIN * 2;
  const capped = recs.slice(0, 5);

  let cursor = ensureSpace(doc, y, 18, pageWidth, title);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...CONTENT_DARK);
  doc.text("Recommendations", PAGE_MARGIN, cursor);
  cursor += 15;

  for (const rec of capped) {
    const tag = SEVERITY_TAG[rec.severity];
    const tagRgb = SEVERITY_RGB[rec.severity];

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    const tagWidth = doc.getTextWidth(`${tag} `);
    const titleLines = doc.splitTextToSize(rec.title, contentWidth - tagWidth) as string[];
    const bodyLines = doc.splitTextToSize(rec.body, contentWidth) as string[];
    const blockH = Math.max(1, titleLines.length) * 11 + bodyLines.length * 10 + 6;
    cursor = ensureSpace(doc, cursor, blockH, pageWidth, title);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...tagRgb);
    doc.text(tag, PAGE_MARGIN, cursor);
    doc.setTextColor(...CONTENT_DARK);
    doc.text(titleLines, PAGE_MARGIN + tagWidth, cursor);
    cursor += Math.max(1, titleLines.length) * 11;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...CONTENT_MUTED);
    doc.text(bodyLines, PAGE_MARGIN, cursor);
    cursor += bodyLines.length * 10 + 6;
  }

  return cursor;
}

/** Risk-band legend rows for a method (RULA 1-7, REBA 1-15, OWAS AC 1-4). */
function riskBandRows(method: string): { range: string; label: string; band: RiskBand }[] {
  if (method === "OWAS") {
    return [
      { range: "1", label: "No action needed", band: "low" },
      { range: "2", label: "Action in the near future", band: "medium" },
      { range: "3", label: "Action as soon as possible", band: "high" },
      { range: "4", label: "Action immediately", band: "veryhigh" },
    ];
  }
  if (method === "REBA") {
    return [
      { range: "1", label: "Negligible", band: "low" },
      { range: "2-3", label: "Low risk", band: "low" },
      { range: "4-7", label: "Medium risk", band: "medium" },
      { range: "8-10", label: "High risk", band: "high" },
      { range: "11-15", label: "Very high risk", band: "veryhigh" },
    ];
  }
  return [
    { range: "1-2", label: "Acceptable", band: "low" },
    { range: "3-4", label: "Investigate further", band: "medium" },
    { range: "5-6", label: "Change soon", band: "high" },
    { range: "7", label: "Change now", band: "veryhigh" },
  ];
}

/** Draw an optional logo top-right of the cover page. A bad/undecodable logo must
 * never break the export, so failures are swallowed silently. */
function drawCoverLogo(doc: jsPDF, pageWidth: number, logoDataUrl: string | undefined): void {
  if (!logoDataUrl) return;
  try {
    const boxSize = 64;
    const match = /^data:image\/(\w+);base64,/.exec(logoDataUrl);
    const format = match ? match[1].toUpperCase() : "PNG";
    doc.addImage(logoDataUrl, format, pageWidth - PAGE_MARGIN - boxSize, PAGE_MARGIN - 8, boxSize, boxSize);
  } catch {
    /* a malformed logo must never break the export */
  }
}

/** Cover page: title, provenance (assessor/org/subject/date), batch totals, and a risk-band legend. */
function addCoverPage(doc: jsPDF, items: PdfReportItem[], meta: ReportMeta, method: string, maxScore: number): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PAGE_MARGIN * 2;
  let y = drawHeader(
    doc,
    pageWidth,
    "Ergonomic Risk Assessment",
    `${method} method · grand-score scale ${methodScale(maxScore)}`,
  );
  drawCoverLogo(doc, pageWidth, meta.logoDataUrl);

  const scored = items.filter((it) => it.analysis.detected && it.analysis.assessment);
  const scores = scored.map((it) => it.analysis.assessment!.grandScore);
  const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const max = scores.length ? Math.max(...scores) : 0;

  // Provenance block - key/value rows, blanks shown as an em dash.
  y += 6;
  const rows: [string, string][] = [
    ["Assessor", meta.assessor?.trim() || "-"],
    ["Organization", meta.organization?.trim() || "-"],
    ["Subject / task", meta.subject?.trim() || "-"],
    ["Date generated", new Date().toLocaleString()],
    [
      "Method",
      `${method} (${
        method === "REBA"
          ? "Rapid Entire Body Assessment"
          : method === "OWAS"
            ? "Ovako Working Posture Analysing System"
            : "Rapid Upper Limb Assessment"
      })`,
    ],
    ["Photos analyzed", `${items.length} (${scored.length} with a detected pose)`],
  ];
  if (scored.length) rows.push(["Grand score", `mean ${fmt(mean)} · max ${fmt(max)} (of ${fmt(maxScore)})`]);

  const labelW = 110;
  for (const [k, v] of rows) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...CONTENT_DARK);
    doc.text(`${k}:`, PAGE_MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...CONTENT_MUTED);
    const lines = doc.splitTextToSize(v, contentWidth - labelW) as string[];
    doc.text(lines, PAGE_MARGIN + labelW, y);
    y += Math.max(1, lines.length) * 13 + 2;
  }

  // Risk-band legend with color swatches.
  y += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...CONTENT_DARK);
  doc.text(`Risk bands - ${method}`, PAGE_MARGIN, y);
  y += 16;
  for (const row of riskBandRows(method)) {
    const rgb = RISK_RGB[row.band];
    doc.setFillColor(...rgb);
    doc.setDrawColor(...rgb);
    doc.rect(PAGE_MARGIN, y - 8, 14, 11, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...CONTENT_DARK);
    doc.text(`${row.range}`, PAGE_MARGIN + 24, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...CONTENT_MUTED);
    doc.text(row.label, PAGE_MARGIN + 80, y);
    y += 17;
  }

  // Methodology note.
  y += 10;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(...CONTENT_MUTED);
  const intro = doc.splitTextToSize(
    `Scores are computed from MediaPipe Pose landmarks located in each photo, in your browser. ${method} captures ${
      method === "REBA" ? "whole-body" : method === "OWAS" ? "whole-body posture-category" : "upper-limb"
    } posture risk. All values are a lower-bound estimate from a single camera view and are not a substitute for a full observation by a trained assessor.`,
    contentWidth,
  ) as string[];
  doc.text(intro, PAGE_MARGIN, y);
}

/** One summary-table page listing every photo's grand score and risk band, plus batch mean/max. */
function addSummaryPage(doc: jsPDF, items: PdfReportItem[], method: string, maxScore: number): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = drawHeader(
    doc,
    pageWidth,
    "Ergo AI - Batch Summary",
    `${method} assessment · grand-score scale ${methodScale(maxScore)}`,
  );

  const scored = items.filter((it) => it.analysis.detected && it.analysis.assessment);
  const scores = scored.map((it) => it.analysis.assessment!.grandScore);
  const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const max = scores.length ? Math.max(...scores) : 0;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...CONTENT_MUTED);
  doc.text(`${items.length} photo(s) analyzed · ${scored.length} with a detected pose`, PAGE_MARGIN, y);
  y += 22;

  // Table header.
  const colX = { file: PAGE_MARGIN, score: PAGE_MARGIN + 250, band: PAGE_MARGIN + 330, action: PAGE_MARGIN + 420 };
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...CONTENT_DARK);
  doc.text("File", colX.file, y);
  doc.text(`Score (/${fmt(maxScore)})`, colX.score, y);
  doc.text("Risk band", colX.band, y);
  doc.text("Action level", colX.action, y);
  y += 6;
  doc.setDrawColor(...RULE_GRAY);
  doc.line(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN, y);
  y += 14;

  doc.setFont("helvetica", "normal");
  for (const item of items) {
    const { analysis } = item;
    doc.setFontSize(9);
    doc.setTextColor(...CONTENT_DARK);
    const nameLines = doc.splitTextToSize(item.fileName, colX.score - colX.file - 8) as string[];
    doc.text(nameLines, colX.file, y);

    if (analysis.detected && analysis.assessment) {
      const a = analysis.assessment;
      doc.setTextColor(...CONTENT_DARK);
      doc.text(`${fmt(a.grandScore)} / ${fmt(a.maxScore)}`, colX.score, y);
      const rgb = RISK_RGB[a.riskBand];
      doc.setTextColor(...rgb);
      doc.setFont("helvetica", "bold");
      const bandLines = doc.splitTextToSize(a.riskLabel, colX.action - colX.band - 8) as string[];
      doc.text(bandLines, colX.band, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...CONTENT_DARK);
      const actionLines = doc.splitTextToSize(a.actionLevel, pageWidth - PAGE_MARGIN - colX.action) as string[];
      doc.text(actionLines, colX.action, y);
      y += Math.max(nameLines.length, bandLines.length, actionLines.length) * 12 + 6;
    } else {
      doc.setTextColor(...CONTENT_MUTED);
      doc.text(analysis.error ?? "No pose detected", colX.score, y);
      y += nameLines.length * 12 + 6;
    }

    if (y > doc.internal.pageSize.getHeight() - PAGE_MARGIN - FOOTER_RESERVE - 40) {
      doc.addPage();
      y = drawHeader(doc, pageWidth, "Ergo AI - Batch Summary (cont.)");
    }
  }

  // Highlighted mean/max strip.
  y += 8;
  y = ensureSpace(doc, y, 44, pageWidth, "Ergo AI - Batch Summary (cont.)");
  doc.setDrawColor(...RULE_GRAY);
  doc.setFillColor(245, 245, 245);
  const boxW = pageWidth - PAGE_MARGIN * 2;
  doc.rect(PAGE_MARGIN, y, boxW, 36, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...CONTENT_DARK);
  doc.text(`Batch mean grand score: ${fmt(mean)}`, PAGE_MARGIN + 12, y + 22);
  doc.text(`Batch max grand score: ${fmt(max)}`, PAGE_MARGIN + boxW / 2, y + 22);
}

/** One page per photo: original image, skeleton image, assessment breakdown (if any), assumptions, caveat. */
async function addPhotoPage(doc: jsPDF, item: PdfReportItem, isFirstPage: boolean): Promise<void> {
  if (!isFirstPage) doc.addPage();
  const pageWidth = doc.internal.pageSize.getWidth();
  const { analysis } = item;
  const methodName = analysis.assessment?.method;
  const title = item.fileName;
  let y = drawHeader(doc, pageWidth, title, methodName ? `${methodName} ergonomic assessment` : undefined);

  const contentWidth = pageWidth - PAGE_MARGIN * 2;

  // Two images side by side: original + skeleton.
  const imageBoxW = (contentWidth - 12) / 2;
  const imageBoxH = 170;

  // Prefer the decoded-and-re-encoded original (HEIC-safe) over the raw upload
  // URL, which the browser can't always load (e.g. iPhone .heic). A failed image
  // load must never abort the whole export, so each prepare is caught.
  const safeOriginalUrl = analysis.originalImageUrl ?? item.originalUrl;
  const tryPrepare = async (url: string | undefined) => {
    if (!url) return null;
    try {
      return await prepareImage(url);
    } catch {
      return null;
    }
  };
  const [original, skeleton] = await Promise.all([tryPrepare(safeOriginalUrl), tryPrepare(analysis.skeletonUrl)]);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...CONTENT_MUTED);
  if (original) {
    const originalFit = fitWithin(original.width, original.height, imageBoxW, imageBoxH);
    doc.addImage(original.dataUrl, "JPEG", PAGE_MARGIN + (imageBoxW - originalFit.w) / 2, y, originalFit.w, originalFit.h);
  } else {
    doc.setDrawColor(...RULE_GRAY);
    doc.rect(PAGE_MARGIN, y, imageBoxW, imageBoxH);
    doc.text("Original preview unavailable", PAGE_MARGIN + 8, y + imageBoxH / 2);
  }
  doc.text("Original photo", PAGE_MARGIN, y + imageBoxH + 10);

  if (skeleton) {
    const skeletonFit = fitWithin(skeleton.width, skeleton.height, imageBoxW, imageBoxH);
    const skeletonX = PAGE_MARGIN + imageBoxW + 12;
    doc.addImage(skeleton.dataUrl, "JPEG", skeletonX + (imageBoxW - skeletonFit.w) / 2, y, skeletonFit.w, skeletonFit.h);
    doc.text("MediaPipe skeleton", skeletonX, y + imageBoxH + 10);
  }

  y += imageBoxH + 26;

  if (!analysis.detected || analysis.error || !analysis.assessment) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...RISK_RGB.high);
    doc.text(analysis.error ? `Error: ${analysis.error}` : "No pose detected", PAGE_MARGIN, y);
    return;
  }

  const a: AssessmentResult = analysis.assessment;
  const rgb = RISK_RGB[a.riskBand];

  // Grand-score strip - auto-sized to the wrapped action text so nothing overflows the box.
  const scoreText = `${a.method} grand score: ${fmt(a.grandScore)} / ${fmt(a.maxScore)}`;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const actionLines = doc.splitTextToSize(`Action: ${a.actionLevel}`, contentWidth - 20) as string[];
  const stripH = 18 + 14 + actionLines.length * 11 + 8;

  doc.setDrawColor(...RULE_GRAY);
  doc.setFillColor(245, 245, 245);
  doc.rect(PAGE_MARGIN, y, contentWidth, stripH, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(...CONTENT_DARK);
  doc.text(scoreText, PAGE_MARGIN + 10, y + 20);
  const scoreW = doc.getTextWidth(scoreText);
  doc.setTextColor(...rgb);
  doc.text(`- ${a.riskLabel}`, PAGE_MARGIN + 10 + scoreW + 8, y + 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...CONTENT_DARK);
  doc.text(actionLines, PAGE_MARGIN + 10, y + 36);
  y += stripH + 12;

  // Measured angles + pose confidence.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...CONTENT_MUTED);
  const angleLines = doc.splitTextToSize(describeAngles(analysis, a), contentWidth) as string[];
  doc.text(angleLines, PAGE_MARGIN, y);
  y += angleLines.length * 10 + 8;

  // Compact per-joint threshold table (skipped for OWAS - category-coded, not angle-banded).
  if (analysis.input && a.method !== "OWAS") {
    y = addThresholdTable(doc, y, analysis.input, methodNameToId(a.method), pageWidth, title);
  }

  // Group A / Group B breakdown, side by side.
  const groupColW = (contentWidth - 12) / 2;
  const maxItems = Math.max(...a.groups.map((g) => g.items.length));
  y = ensureSpace(doc, y, maxItems * 10 + 48, pageWidth, title);
  let groupBottom = y;
  a.groups.forEach((group, idx) => {
    const gx = PAGE_MARGIN + idx * (groupColW + 12);
    const bottom = drawGroupBreakdown(doc, group, gx, y, groupColW);
    groupBottom = Math.max(groupBottom, bottom);
  });
  y = groupBottom + 4;

  if (a.notes.length) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...CONTENT_MUTED);
    for (const note of a.notes) {
      const lines = doc.splitTextToSize(`Note: ${note}`, contentWidth) as string[];
      y = ensureSpace(doc, y, lines.length * 10, pageWidth, title);
      doc.text(lines, PAGE_MARGIN, y);
      y += lines.length * 10;
    }
    y += 4;
  }

  if (analysis.input) {
    const assumptionLines = doc.splitTextToSize(
      describeAssumptions(analysis.input, a.method),
      contentWidth,
    ) as string[];
    y = ensureSpace(doc, y, assumptionLines.length * 10 + 14, pageWidth, title);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...CONTENT_DARK);
    doc.text(`Assumptions (factors a single photo cannot fully observe):`, PAGE_MARGIN, y);
    y += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...CONTENT_MUTED);
    doc.text(assumptionLines, PAGE_MARGIN, y);
    y += assumptionLines.length * 10 + 6;
  }

  if (analysis.input) {
    const recs = buildRecommendations(a, analysis.input);
    y = addRecommendationsSection(doc, y, recs, pageWidth, title);
  }

  y = ensureSpace(doc, y, 36, pageWidth, title);
  addCaveat(doc, PAGE_MARGIN, y, contentWidth, a.method);
}

/** Stamp every page with a footer: tool + method + generation time (left) and "Page X of Y" (right). */
function addFooters(doc: jsPDF, method: string): void {
  const pages = doc.getNumberOfPages();
  const stamp = new Date().toLocaleString();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...CONTENT_MUTED);
    doc.text(`Ergo AI · ${method} report · Generated ${stamp}`, PAGE_MARGIN, ph - 18);
    doc.text(`Page ${p} of ${pages}`, pw - PAGE_MARGIN, ph - 18, { align: "right" });
  }
}

function timestampedFilename(method: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  const tag = method.toLowerCase();
  return `ergo-ai-${tag}-report-${stamp}.pdf`;
}

function drawTimelineBlock(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  stepNum: string,
  title: string,
  description: string,
  isLast: boolean
): number {
  const coral = [255, 111, 97] as [number, number, number];
  
  if (!isLast) {
    doc.setDrawColor(254, 215, 210); // Very light coral
    doc.setLineWidth(3);
    doc.line(x + 20, y + 36, x + 20, y + 144);
  }

  doc.setFillColor(...coral);
  doc.circle(x + 20, y + 20, 16, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(stepNum, x + 20, y + 24, { align: "center" });

  const boxX = x + 50;
  const boxW = w - 50;
  
  doc.setFillColor(255, 250, 249); // Ultra-light coral tint
  doc.roundedRect(boxX, y, boxW, 95, 6, 6, "F");
  
  doc.setDrawColor(...coral);
  doc.setLineWidth(4);
  doc.line(boxX, y + 6, boxX, y + 89);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...CONTENT_DARK);
  doc.text(title, boxX + 15, y + 25);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...CONTENT_MUTED);
  const lines = doc.splitTextToSize(description, boxW - 30);
  doc.text(lines, boxX + 15, y + 42);

  return 140;
}

function addMethodologyPage(doc: jsPDF, isVideo: boolean): void {
  doc.addPage();
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PAGE_MARGIN * 2;

  let y = drawHeader(
    doc,
    pageWidth,
    "Ergo AI - Technical Methodology & Process Flow",
    "On-device biomechanical pipeline & AI algorithms",
  );

  y += 30;

  y += drawTimelineBlock(
    doc,
    PAGE_MARGIN,
    y,
    contentWidth,
    "01",
    "3D Kinematic Processing (Camera-Invariant)",
    "The engine extracts MediaPipe's 3D Metric World Landmarks, mapped in real-world meters relative to the body's center. Unlike basic 2D pixel tracking, calculating joint angles as 3D spatial vectors eliminates perspective distortion caused by camera tilt or skew, ensuring consistent, reproducible measurements from any viewing angle.",
    false
  );

  y += drawTimelineBlock(
    doc,
    PAGE_MARGIN,
    y,
    contentWidth,
    "02",
    "Region-of-Interest (ROI) Cropping Optimization",
    "To process high-resolution imagery and video frames at near real-time speeds, the system identifies the wrist coordinate and crops a 35% bounding window around it. Hand landmark detection is executed solely on this sub-image, accelerating performance by up to 10x while maintaining precision. A full-frame scan serves as a quality-assurance fallback.",
    false
  );

  y += drawTimelineBlock(
    doc,
    PAGE_MARGIN,
    y,
    contentWidth,
    "03",
    "Dual-Model Forearm & Hand Coordination",
    "Ergo-AI runs dual neural networks in parallel: the primary Pose model tracks the body structure, while the Hand model isolates finger joints. The system intelligently synchronizes these data streams in 3D space to automatically calculate exact wrist flexion and extension angles relative to the forearm axis, removing the need for manual wrist angle estimation.",
    false
  );

  if (isVideo) {
    drawTimelineBlock(
      doc,
      PAGE_MARGIN,
      y,
      contentWidth,
      "04",
      "Temporal Smoothing & Risk Hysteresis",
      "For video analysis, raw joint angles are stabilized using a rolling median filter to eliminate frame-to-frame jitter. Posture cycles are computed using a Schmitt trigger with a +/- 7 degrees hysteresis to objectively detect repetitive motions (4 or more actions per minute) or sustained static postures held over long durations, outputting a precise temporal risk timeline.",
      true
    );
  } else {
    drawTimelineBlock(
      doc,
      PAGE_MARGIN,
      y,
      contentWidth,
      "04",
      "Privacy-First On-Device Architecture",
      "Ergo-AI is engineered for strict enterprise security. All neural network weights and WebAssembly ML models are cached locally. Image processing and biomechanical calculations run entirely on-device within the browser's sandbox. Zero visual data is uploaded to external cloud servers, ensuring 100% compliance with workplace privacy and air-gapped safety protocols.",
      true
    );
  }
}

/**
 * Build and download a PDF report: an optional batch summary page (when more
 * than one item is supplied) followed by one page per photo containing the
 * original image, the MediaPipe skeleton overlay, the assessment breakdown (if a
 * pose was detected), measured angles, the visual-assumption notes, and a
 * methodology caveat. Every page is labelled with the assessment method (RULA
 * or REBA) and stamped with a footer (generation time + page numbers).
 */
export async function exportPdfReport(items: PdfReportItem[], meta: ReportMeta = {}): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  // Report-level method/scale, taken from the first scored item. The whole batch
  // shares one method (the UI scores every photo with the active method).
  const firstScored = items.find((it) => it.analysis.assessment)?.analysis.assessment;
  const method = firstScored?.method ?? "RULA";
  const maxScore = firstScored?.maxScore ?? 7;

  // Page 1 is always the cover sheet (provenance + risk-band legend).
  addCoverPage(doc, items, meta, method, maxScore);

  if (items.length > 1) {
    doc.addPage();
    addSummaryPage(doc, items, method, maxScore);
  }

  // Cover sheet occupies page 1, so every photo gets its own fresh page.
  for (const item of items) {
    await addPhotoPage(doc, item, false);
  }

  // Add visual methodology page
  addMethodologyPage(doc, false);

  addFooters(doc, method);
  doc.save(timestampedFilename(method));
}

// --- Video report -----------------------------------------------------------

export interface VideoPdfReport {
  fileName: string;
  method: string;
  maxScore: number;
  durationSec: number;
  framesAnalyzed: number;
  skipped: number;
  timeline: { timeSec: number; grandScore: number; riskBand: RiskBand }[];
  stats: { peakScore: number; peakTimeSec: number; peakLabel: string; peakBand: RiskBand; mean: number; highPct: number };
  worst: { timeSec: number; thumbUrl: string; assessment: AssessmentResult; input: PostureInput };
}

const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Draw the risk-over-time bars (coloured by band) into a boxed region. */
function drawTimeline(doc: jsPDF, report: VideoPdfReport, x: number, y: number, w: number, h: number): void {
  doc.setDrawColor(...RULE_GRAY);
  doc.setFillColor(250, 250, 250);
  doc.rect(x, y, w, h, "FD");
  const dur = report.durationSec || 1;
  const barW = Math.max(1, (w / Math.max(1, report.timeline.length)) * 0.8);
  for (const p of report.timeline) {
    const bx = x + (p.timeSec / dur) * w;
    const bh = (p.grandScore / report.maxScore) * (h - 8);
    doc.setFillColor(...RISK_RGB[p.riskBand]);
    doc.rect(Math.min(bx, x + w - barW), y + h - bh, barW, bh, "F");
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...CONTENT_MUTED);
  doc.text("0:00", x, y + h + 9);
  doc.text(fmtClock(dur), x + w, y + h + 9, { align: "right" });
}

/**
 * Build and download a one-clip video report: a summary page (provenance, the
 * peak/mean/time-at-high-risk stats, the risk-over-time timeline, and a risk-band
 * legend) followed by the worst frame with its full breakdown.
 */
export async function exportVideoPdfReport(report: VideoPdfReport, meta: ReportMeta = {}): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PAGE_MARGIN * 2;
  const { method, maxScore } = report;

  // --- Page 1: summary --------------------------------------------------------
  let y = drawHeader(
    doc,
    pageWidth,
    "Ergonomic Risk Assessment - Video",
    `${method} method · grand-score scale ${methodScale(maxScore)}`,
  );

  const rows: [string, string][] = [
    ["Assessor", meta.assessor?.trim() || "-"],
    ["Organization", meta.organization?.trim() || "-"],
    ["Subject / task", meta.subject?.trim() || "-"],
    ["Date generated", new Date().toLocaleString()],
    ["Video", report.fileName],
    ["Analyzed", `${report.framesAnalyzed} frames over ${report.durationSec.toFixed(1)} s${report.skipped ? ` · ${report.skipped} skipped` : ""}`],
  ];
  y += 4;
  const labelW = 110;
  for (const [k, v] of rows) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...CONTENT_DARK);
    doc.text(`${k}:`, PAGE_MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...CONTENT_MUTED);
    const lines = doc.splitTextToSize(v, contentWidth - labelW) as string[];
    doc.text(lines, PAGE_MARGIN + labelW, y);
    y += Math.max(1, lines.length) * 13 + 2;
  }

  // Stats strip.
  y += 10;
  doc.setDrawColor(...RULE_GRAY);
  doc.setFillColor(245, 245, 245);
  doc.rect(PAGE_MARGIN, y, contentWidth, 40, "FD");
  const third = contentWidth / 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...RISK_RGB[report.stats.peakBand]);
  doc.text(`${fmt(report.stats.peakScore)} / ${fmt(maxScore)}`, PAGE_MARGIN + 12, y + 20);
  doc.setTextColor(...CONTENT_DARK);
  doc.text(fmt(report.stats.mean), PAGE_MARGIN + third + 12, y + 20);
  doc.text(`${report.stats.highPct}%`, PAGE_MARGIN + third * 2 + 12, y + 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...CONTENT_MUTED);
  doc.text(`peak · ${report.stats.peakLabel} at ${fmtClock(report.stats.peakTimeSec)}`, PAGE_MARGIN + 12, y + 33);
  doc.text("mean grand score", PAGE_MARGIN + third + 12, y + 33);
  doc.text("time at high / very-high risk", PAGE_MARGIN + third * 2 + 12, y + 33);
  y += 40 + 18;

  // Timeline.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...CONTENT_DARK);
  doc.text("Risk over time", PAGE_MARGIN, y);
  y += 10;
  drawTimeline(doc, report, PAGE_MARGIN, y, contentWidth, 90);
  y += 90 + 22;

  // Risk-band legend.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...CONTENT_DARK);
  doc.text(`Risk bands - ${method}`, PAGE_MARGIN, y);
  y += 15;
  for (const row of riskBandRows(method)) {
    doc.setFillColor(...RISK_RGB[row.band]);
    doc.rect(PAGE_MARGIN, y - 7, 13, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...CONTENT_DARK);
    doc.text(row.range, PAGE_MARGIN + 22, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...CONTENT_MUTED);
    doc.text(row.label, PAGE_MARGIN + 78, y);
    y += 15;
  }

  // --- Page 2: worst frame ----------------------------------------------------
  doc.addPage();
  const a = report.worst.assessment;
  let y2 = drawHeader(doc, pageWidth, `Worst frame · ${fmtClock(report.worst.timeSec)}`, `${method} grand score ${fmt(a.grandScore)} / ${fmt(maxScore)} - ${a.riskLabel}`);

  const img = await (async () => {
    try {
      return await prepareImage(report.worst.thumbUrl);
    } catch {
      return null;
    }
  })();
  if (img) {
    const fit = fitWithin(img.width, img.height, contentWidth, 220);
    doc.addImage(img.dataUrl, "JPEG", PAGE_MARGIN + (contentWidth - fit.w) / 2, y2, fit.w, fit.h);
    y2 += fit.h + 18;
  }

  // Measured angles.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...CONTENT_MUTED);
  let angleTxt = `Measured angles - upper arm ${fmt(a.angles.upperArm)}°, lower arm ${fmt(a.angles.lowerArm)}°, neck ${fmt(a.angles.neck)}°, trunk ${fmt(a.angles.trunk)}°`;
  if (method === "REBA" && report.worst.input.legAngle !== undefined) angleTxt += `, knee ${fmt(report.worst.input.legAngle)}°`;
  const al = doc.splitTextToSize(angleTxt, contentWidth) as string[];
  doc.text(al, PAGE_MARGIN, y2);
  y2 += al.length * 10 + 8;

  // Group breakdown.
  const groupColW = (contentWidth - 12) / 2;
  let bottom = y2;
  a.groups.forEach((group, idx) => {
    bottom = Math.max(bottom, drawGroupBreakdown(doc, group, PAGE_MARGIN + idx * (groupColW + 12), y2, groupColW));
  });
  y2 = bottom + 6;

  const assumptionLines = doc.splitTextToSize(describeAssumptions(report.worst.input, method), contentWidth) as string[];
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...CONTENT_DARK);
  doc.text("Assumptions (factors video cannot fully observe):", PAGE_MARGIN, y2);
  y2 += 12;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...CONTENT_MUTED);
  doc.text(assumptionLines, PAGE_MARGIN, y2);
  y2 += assumptionLines.length * 10 + 8;

  const worstRecs = buildRecommendations(a, report.worst.input);
  y2 = addRecommendationsSection(doc, y2, worstRecs, pageWidth, `Worst frame · ${fmtClock(report.worst.timeSec)}`);

  addCaveat(doc, PAGE_MARGIN, y2, contentWidth, method);

  // Add visual methodology page
  addMethodologyPage(doc, true);

  addFooters(doc, method);
  doc.save(timestampedFilename(`${method}-video`));
}

/**
 * One-page NIOSH Lifting Equation report: provenance, task variables, the six
 * multipliers with formulas, RWL + Lifting Index verdict, and redesign
 * recommendations targeting the limiting multipliers.
 */
export async function exportNioshPdf(input: NioshInput, result: NioshResult, meta: ReportMeta = {}): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PAGE_MARGIN * 2;
  const title = "NIOSH Lifting Equation";

  let y = drawHeader(doc, pageWidth, "NIOSH Lifting Equation - RWL & Lifting Index", "Revised lifting equation (Waters, Putz-Anderson & Garg 1994)");
  drawCoverLogo(doc, pageWidth, meta.logoDataUrl);

  // Provenance
  y += 4;
  const provenance: [string, string][] = [
    ["Assessor", meta.assessor?.trim() || "-"],
    ["Organization", meta.organization?.trim() || "-"],
    ["Subject / task", meta.subject?.trim() || "-"],
    ["Date generated", new Date().toLocaleString()],
  ];
  const labelW = 110;
  for (const [k, v] of provenance) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...CONTENT_DARK);
    doc.text(`${k}:`, PAGE_MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...CONTENT_MUTED);
    doc.text(v, PAGE_MARGIN + labelW, y);
    y += 15;
  }
  y += 6;

  // Task variables
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...CONTENT_DARK);
  doc.text("Task variables", PAGE_MARGIN, y);
  y += 14;
  const durationLabel = input.durationHours === 1 ? "<= 1 hour" : input.durationHours === 2 ? "<= 2 hours" : "<= 8 hours";
  const vars: [string, string][] = [
    ["Horizontal distance (H)", `${fmt(input.horizontalCm)} cm`],
    ["Vertical height (V)", `${fmt(input.verticalCm)} cm`],
    ["Vertical travel (D)", `${fmt(input.travelCm)} cm`],
    ["Asymmetry angle (A)", `${fmt(input.asymmetryDeg)} deg`],
    ["Frequency (F)", `${input.frequencyPerMin} lifts/min`],
    ["Work duration", durationLabel],
    ["Coupling", input.coupling],
    ["Load handled", `${fmt(input.loadKg)} kg`],
  ];
  doc.setFontSize(8.5);
  for (const [k, v] of vars) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...CONTENT_DARK);
    doc.text(k, PAGE_MARGIN, y);
    doc.setTextColor(...CONTENT_MUTED);
    doc.text(v, PAGE_MARGIN + 170, y);
    y += 12;
  }
  y += 8;

  // Multipliers
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...CONTENT_DARK);
  doc.text("Multipliers", PAGE_MARGIN, y);
  y += 14;
  const formulas: Record<string, string> = {
    HM: "25 / H",
    VM: "1 - 0.003 x |V - 75|",
    DM: "0.82 + 4.5 / D",
    AM: "1 - 0.0032 x A",
    FM: "frequency table (Table 5)",
    CM: "coupling table (Table 7)",
  };
  doc.setFontSize(8.5);
  for (const [key, value] of Object.entries(result.multipliers)) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...CONTENT_DARK);
    doc.text(key, PAGE_MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...CONTENT_MUTED);
    doc.text(formulas[key] ?? "", PAGE_MARGIN + 40, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...(value === 0 ? RISK_RGB.veryhigh : CONTENT_DARK));
    doc.text(value.toFixed(3), PAGE_MARGIN + 220, y);
    y += 12;
  }
  y += 10;

  // Verdict strip
  const liText = Number.isFinite(result.li) ? result.li.toFixed(2) : "out of range";
  const rgb = RISK_RGB[result.riskBand];
  doc.setFillColor(245, 245, 245);
  doc.rect(PAGE_MARGIN, y - 10, contentWidth, 44, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...CONTENT_DARK);
  doc.text(`Recommended Weight Limit: ${result.rwlKg.toFixed(1)} kg`, PAGE_MARGIN + 10, y + 6);
  doc.setTextColor(...rgb);
  doc.text(`Lifting Index: ${liText} - ${result.riskLabel}`, PAGE_MARGIN + 10, y + 24);
  y += 48;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...CONTENT_MUTED);
  const actionLines = doc.splitTextToSize(result.actionLevel, contentWidth) as string[];
  doc.text(actionLines, PAGE_MARGIN, y);
  y += actionLines.length * 10 + 6;

  for (const note of result.notes) {
    const lines = doc.splitTextToSize(`Note: ${note}`, contentWidth) as string[];
    doc.text(lines, PAGE_MARGIN, y);
    y += lines.length * 10 + 2;
  }
  y += 6;

  y = addRecommendationsSection(doc, y, buildNioshRecommendations(result), pageWidth, title);

  addFooters(doc, "NIOSH");
  doc.save(timestampedFilename("niosh"));
}
