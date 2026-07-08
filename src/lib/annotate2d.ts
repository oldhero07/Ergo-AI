/**
 * Skeleton overlay for COCO-WholeBody keypoints (server inference path).
 * Replaces MediaPipe's DrawingUtils: draws the original photo plus the 17-body
 * keypoint skeleton and the scored hand ray. Low-confidence joints are drawn
 * dimmed rather than hidden - the overlay shows exactly what the score used
 * (flag, never suppress).
 */
import { fitScale } from "@/lib/image";
import { KP, KP_SCORE_FLOOR } from "@/lib/angles2d";
import type { ApiKeypoint } from "@/lib/poseClient";

const CONNECTOR_COLOR = "#10b981"; // emerald, matching the old overlay
const LANDMARK_COLOR = "#f43f5e"; // rose
const DIM_ALPHA = 0.35;

/** COCO-17 skeleton edges (body only - face/foot points are not drawn). */
const BODY_EDGES: ReadonlyArray<readonly [number, number]> = [
  [KP.nose, KP.leftEye],
  [KP.nose, KP.rightEye],
  [KP.leftEye, KP.leftEar],
  [KP.rightEye, KP.rightEar],
  [KP.leftShoulder, KP.rightShoulder],
  [KP.leftShoulder, KP.leftElbow],
  [KP.leftElbow, KP.leftWrist],
  [KP.rightShoulder, KP.rightElbow],
  [KP.rightElbow, KP.rightWrist],
  [KP.leftShoulder, KP.leftHip],
  [KP.rightShoulder, KP.rightHip],
  [KP.leftHip, KP.rightHip],
  [KP.leftHip, KP.leftKnee],
  [KP.leftKnee, KP.leftAnkle],
  [KP.rightHip, KP.rightKnee],
  [KP.rightKnee, KP.rightAnkle],
  // Hand rays (wrist -> hand root -> middle MCP), which the wrist angle uses.
  [KP.leftWrist, KP.leftHandRoot],
  [KP.leftHandRoot, KP.leftMiddleMcp],
  [KP.rightWrist, KP.rightHandRoot],
  [KP.rightHandRoot, KP.rightMiddleMcp],
];

const DRAWN_POINTS: ReadonlyArray<number> = [
  KP.nose, KP.leftEye, KP.rightEye, KP.leftEar, KP.rightEar,
  KP.leftShoulder, KP.rightShoulder, KP.leftElbow, KP.rightElbow,
  KP.leftWrist, KP.rightWrist, KP.leftHip, KP.rightHip,
  KP.leftKnee, KP.rightKnee, KP.leftAnkle, KP.rightAnkle,
  KP.leftHandRoot, KP.leftMiddleMcp, KP.rightHandRoot, KP.rightMiddleMcp,
];

export interface Annotated2D {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Draw the photo with the keypoint skeleton. `kps` are in ORIGINAL pixel
 * space; the canvas is a downscaled render (same fitScale as the old path).
 * Returns the clean original JPEG too so callers encode the bitmap only once.
 */
export function annotateSkeleton2D(source: ImageBitmap, kps: ApiKeypoint[] | null): Annotated2D {
  const scale = fitScale(source.width, source.height);
  const width = Math.round(source.width * scale);
  const height = Math.round(source.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { dataUrl: "", width, height };
  ctx.drawImage(source, 0, 0, width, height);

  if (kps) {
    const px = (i: number) => ({ x: kps[i][0] * scale, y: kps[i][1] * scale, s: kps[i][2] });
    const lineWidth = Math.max(2, Math.round(width / 220));
    const radius = Math.max(2, Math.round(width / 260));

    ctx.lineCap = "round";
    for (const [a, b] of BODY_EDGES) {
      const pa = px(a);
      const pb = px(b);
      ctx.globalAlpha = Math.min(pa.s, pb.s) >= KP_SCORE_FLOOR ? 1 : DIM_ALPHA;
      ctx.strokeStyle = CONNECTOR_COLOR;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }
    for (const i of DRAWN_POINTS) {
      const p = px(i);
      ctx.globalAlpha = p.s >= KP_SCORE_FLOOR ? 1 : DIM_ALPHA;
      ctx.fillStyle = LANDMARK_COLOR;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  return { dataUrl: canvas.toDataURL("image/png"), width, height };
}

/** Clean downscaled JPEG of the original (PDF embeds this). Standalone copy of
 * annotate.ts's renderOriginalJpeg so this module never pulls the MediaPipe
 * bundle in at runtime. */
export function renderOriginalJpeg2D(source: ImageBitmap, quality = 0.85): string {
  const scale = fitScale(source.width, source.height);
  const width = Math.round(source.width * scale);
  const height = Math.round(source.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(source, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}
