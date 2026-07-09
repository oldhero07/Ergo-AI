/**
 * Analysis result types - the contract between the inference pipeline and
 * every consumer (results UI, exports, PDF, session restore). Dependency-free:
 * defining `LandmarkPoint` here (rather than importing MediaPipe's identical
 * type) keeps the type graph clean of the removed on-device ML stack.
 */
import type { AngleSet } from "@/lib/angles2d";
import type { AngleMeasuredFlags } from "@/lib/angles2d";

/** A pose landmark point ({x,y,z} + optional confidence), MediaPipe-shaped for
 * compatibility with persisted sessions and the NIOSH geometry estimator. */
export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface PoseAnalysis {
  /** Annotated "skeleton" image (original + keypoint overlay), data/blob URL. */
  skeletonUrl: string;
  /** Clean original re-encoded to JPEG so the PDF can always embed it. */
  originalImageUrl?: string;
  /** 2D normalized landmarks (legacy shape; empty on the server path). */
  landmarks: LandmarkPoint[];
  /** Metric 3D world landmarks (legacy shape; empty on the server path). */
  worldLandmarks: LandmarkPoint[];
  width: number;
  height: number;
  detected: boolean;
  error?: string;
  angles?: AngleSet;
  /** Wrist flexion was confidently measured (vs flagged for review). */
  wristMeasured?: boolean;
  /** The auto-derived assessment input (editable in the adjustments panel). */
  input?: import("@/assessment/types").PostureInput;
  assessment?: import("@/assessment/types").AssessmentResult;
  /** Per-angle "confidently measured" flags for the UI/PDF to highlight
   * review-worthy inputs. Never consumed by scoring. */
  measuredFlags?: AngleMeasuredFlags;
  /** Photo looks angled/frontal - sagittal angles may be under-read. */
  offProfile?: boolean;
  /** Exact model build that produced the keypoints (embedded in exports). */
  modelVersion?: string;
}

export type VideoProgress = (stage: "sampling", done: number, total: number) => void;

export interface AnalyzeVideoOptions {
  fps?: number;
  maxFrames?: number;
  maxEdge?: number;
  maxDurationSec?: number;
}

export type { VideoAnalysis, VideoFrameResult } from "@/lib/video/assemble";
