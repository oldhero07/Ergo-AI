import { jsPDF } from "jspdf";
import type { PoseAnalysis } from "@/lib/analyze";
import type { AssessmentResult, GroupBreakdown, PostureInput, RiskBand } from "@/assessment/types";

/** One photo + its analysis, ready to be rendered onto a PDF page. */
export interface PdfReportItem {
  fileName: string;
  /** `blob:` object URL or `data:` URL pointing at the original (unannotated) photo. */
  originalUrl: string;
  analysis: PoseAnalysis;
}

/** RGB fill/text colors per risk band — jsPDF wants plain RGB triples, not CSS `hsl(var(--x))`. */
const RISK_RGB: Record<RiskBand, [number, number, number]> = {
  low: [22, 163, 74],
  medium: [217, 119, 6],
  high: [234, 88, 12],
  veryhigh: [220, 38, 38],
};

const PAGE_MARGIN = 36; // pt
const CONTENT_MUTED: [number, number, number] = [100, 100, 100];
const CONTENT_DARK: [number, number, number] = [30, 30, 30];
const RULE_GRAY: [number, number, number] = [210, 210, 210];

/**
 * Resolve any image URL to a `data:` URL jsPDF's `addImage` can consume.
 * `data:` URLs (e.g. the MediaPipe skeleton output) pass through untouched.
 * `blob:` (and any other non-data) URLs are loaded into an `<img>`, drawn to
 * an offscreen canvas at natural size, and re-encoded as JPEG.
 */
export async function toDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;

  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to acquire 2D canvas context");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.92);
}

/** Natural pixel size of a data URL image, needed to fit it into a PDF content box without distortion. */
function getImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Failed to read image dimensions"));
    img.src = dataUrl;
  });
}

/** Scale (w, h) to fit fully inside (maxW, maxH) while preserving aspect ratio. */
function fitWithin(w: number, h: number, maxW: number, maxH: number): { w: number; h: number } {
  const scale = Math.min(maxW / w, maxH / h, 1);
  return { w: w * scale, h: h * scale };
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Plain-language summary of the visually-unobservable assumptions baked into a RULA input. */
function describeAssumptions(input: PostureInput): string {
  const parts: string[] = [];
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
  parts.push(
    maxForce > 0 ? `Force/load: ${maxForce} (assumed, 0–3 scale)` : "Force/load: none (assumed)",
  );
  parts.push(input.legsSupported ? "Legs: supported (assumed)" : "Legs: not supported (assumed)");
  return parts.join(" · ");
}

function addCaveat(doc: jsPDF, x: number, y: number, maxWidth: number): number {
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...CONTENT_MUTED);
  const lines = doc.splitTextToSize(
    "Caveat: this is a lower-bound 2D single-camera pose estimate. It is not a substitute for a full multi-factor RULA observation by a trained assessor.",
    maxWidth,
  ) as string[];
  doc.text(lines, x, y);
  return y + lines.length * 10;
}

function drawHeader(doc: jsPDF, pageWidth: number, title: string): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...CONTENT_DARK);
  doc.text(title, PAGE_MARGIN, PAGE_MARGIN);
  doc.setDrawColor(...RULE_GRAY);
  doc.setLineWidth(0.75);
  doc.line(PAGE_MARGIN, PAGE_MARGIN + 6, pageWidth - PAGE_MARGIN, PAGE_MARGIN + 6);
  return PAGE_MARGIN + 22;
}

/** Render one GroupBreakdown (Group A or Group B) as a compact text block. Returns the new y cursor. */
function drawGroupBreakdown(doc: jsPDF, group: GroupBreakdown, x: number, y: number, maxWidth: number): number {
  let cursor = y;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...CONTENT_DARK);
  doc.text(`${group.name} — score ${fmt(group.score)} (${group.scoreLabel})`, x, cursor);
  cursor += 13;

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
  doc.text(
    `Posture: ${fmt(group.posture)}   Muscle: ${fmt(group.muscle)}   Force: ${fmt(group.force)}`,
    x,
    cursor,
  );
  cursor += 14;
  return cursor;
}

/** One summary-table page listing every photo's grand score and risk band, plus batch mean/max. */
function addSummaryPage(doc: jsPDF, items: PdfReportItem[]): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = drawHeader(doc, pageWidth, "Ergo AI — Batch Summary");

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
  const colX = { file: PAGE_MARGIN, score: PAGE_MARGIN + 280, band: PAGE_MARGIN + 350, action: PAGE_MARGIN + 460 };
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...CONTENT_DARK);
  doc.text("File", colX.file, y);
  doc.text("Grand score", colX.score, y);
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
      doc.text(fmt(a.grandScore), colX.score, y);
      const rgb = RISK_RGB[a.riskBand];
      doc.setTextColor(...rgb);
      doc.setFont("helvetica", "bold");
      doc.text(a.riskLabel, colX.band, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...CONTENT_DARK);
      const actionLines = doc.splitTextToSize(a.actionLevel, pageWidth - PAGE_MARGIN - colX.action) as string[];
      doc.text(actionLines, colX.action, y);
      y += Math.max(nameLines.length, actionLines.length) * 12 + 6;
    } else {
      doc.setTextColor(...CONTENT_MUTED);
      doc.text(analysis.error ?? "No pose detected", colX.score, y);
      y += nameLines.length * 12 + 6;
    }

    if (y > doc.internal.pageSize.getHeight() - PAGE_MARGIN - 40) {
      doc.addPage();
      y = drawHeader(doc, pageWidth, "Ergo AI — Batch Summary (cont.)");
    }
  }

  // Highlighted mean/max strip.
  y += 8;
  if (y > doc.internal.pageSize.getHeight() - PAGE_MARGIN - 60) {
    doc.addPage();
    y = drawHeader(doc, pageWidth, "Ergo AI — Batch Summary (cont.)");
  }
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

/** One page per photo: original image, skeleton image, RULA breakdown (if any), assumptions, caveat. */
async function addPhotoPage(doc: jsPDF, item: PdfReportItem, isFirstPage: boolean): Promise<void> {
  if (!isFirstPage) doc.addPage();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = drawHeader(doc, pageWidth, item.fileName);

  const contentWidth = pageWidth - PAGE_MARGIN * 2;
  const { analysis } = item;

  // Two images side by side: original + skeleton.
  const imageBoxW = (contentWidth - 12) / 2;
  const imageBoxH = 170;

  const originalDataUrl = await toDataUrl(item.originalUrl);
  const [originalSize, skeletonSize] = await Promise.all([
    getImageSize(originalDataUrl),
    analysis.skeletonUrl ? getImageSize(analysis.skeletonUrl) : Promise.resolve(null),
  ]);

  const originalFit = fitWithin(originalSize.width, originalSize.height, imageBoxW, imageBoxH);
  doc.addImage(
    originalDataUrl,
    "JPEG",
    PAGE_MARGIN + (imageBoxW - originalFit.w) / 2,
    y,
    originalFit.w,
    originalFit.h,
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...CONTENT_MUTED);
  doc.text("Original photo", PAGE_MARGIN, y + imageBoxH + 10);

  if (skeletonSize) {
    const skeletonFit = fitWithin(skeletonSize.width, skeletonSize.height, imageBoxW, imageBoxH);
    const skeletonX = PAGE_MARGIN + imageBoxW + 12;
    doc.addImage(
      analysis.skeletonUrl,
      "PNG",
      skeletonX + (imageBoxW - skeletonFit.w) / 2,
      y,
      skeletonFit.w,
      skeletonFit.h,
    );
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

  // Grand score / risk band / action level strip.
  doc.setDrawColor(...RULE_GRAY);
  doc.setFillColor(245, 245, 245);
  doc.rect(PAGE_MARGIN, y, contentWidth, 34, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...CONTENT_DARK);
  doc.text(`Grand score: ${fmt(a.grandScore)} / ${fmt(a.maxScore)}`, PAGE_MARGIN + 10, y + 21);
  const rgb = RISK_RGB[a.riskBand];
  doc.setTextColor(...rgb);
  doc.text(a.riskLabel, PAGE_MARGIN + 220, y + 21);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...CONTENT_DARK);
  const actionLines = doc.splitTextToSize(`Action: ${a.actionLevel}`, contentWidth - 360) as string[];
  doc.text(actionLines, PAGE_MARGIN + 340, y + 14);
  y += 34 + 16;

  // Group A / Group B breakdown, side by side.
  const groupColW = (contentWidth - 12) / 2;
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
      doc.text(lines, PAGE_MARGIN, y);
      y += lines.length * 10;
    }
    y += 4;
  }

  if (analysis.input) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...CONTENT_DARK);
    doc.text("Assumptions (factors a single 2D photo cannot fully observe):", PAGE_MARGIN, y);
    y += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...CONTENT_MUTED);
    const lines = doc.splitTextToSize(describeAssumptions(analysis.input), contentWidth) as string[];
    doc.text(lines, PAGE_MARGIN, y);
    y += lines.length * 10 + 6;
  }

  // Pin the caveat near the bottom of the page rather than immediately after content.
  addCaveat(doc, PAGE_MARGIN, Math.max(y, pageHeight - PAGE_MARGIN - 26), contentWidth);
}

function timestampedFilename(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `ergo-ai-report-${stamp}.pdf`;
}

/**
 * Build and download a PDF report: an optional batch summary page (when more
 * than one item is supplied) followed by one page per photo containing the
 * original image, the MediaPipe skeleton overlay, the RULA breakdown (if a
 * pose was detected), the visual-assumption notes, and a methodology caveat.
 */
export async function exportPdfReport(items: PdfReportItem[]): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  if (items.length > 1) {
    addSummaryPage(doc, items);
  }

  for (let i = 0; i < items.length; i++) {
    const isFirstPage = items.length === 1 && i === 0;
    await addPhotoPage(doc, items[i], isFirstPage);
  }

  doc.save(timestampedFilename());
}
