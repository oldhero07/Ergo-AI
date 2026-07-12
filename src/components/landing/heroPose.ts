/**
 * Real analysis output for the bundled warehouse-lifting sample, baked in for
 * the landing page's live-analysis demo. Keypoints came from the production
 * inference service (RTMW via /analyze) and the measured values/score from the
 * app's own scoring path for the same photo - the demo shows genuine product
 * output, not an artist's impression. Coordinates are in the original 1024x1024
 * pixel space of `public/samples/warehouse-lifting.jpg`.
 */

export const POSE_IMG = { w: 1024, h: 1024 } as const;

export interface DemoPoint {
  x: number;
  y: number;
}

/** COCO body keypoints for the sample (scores were all >= 0.69). */
export const DEMO_KP = {
  nose: { x: 418, y: 250 },
  leftEar: { x: 489, y: 218 },
  leftShoulder: { x: 587, y: 303 },
  rightShoulder: { x: 510, y: 333 },
  leftElbow: { x: 617, y: 470 },
  rightElbow: { x: 538, y: 466 },
  leftWrist: { x: 534, y: 598 },
  rightWrist: { x: 480, y: 573 },
  leftHip: { x: 743, y: 487 },
  rightHip: { x: 675, y: 487 },
  leftKnee: { x: 626, y: 635 },
  rightKnee: { x: 592, y: 630 },
  leftAnkle: { x: 668, y: 859 },
  rightAnkle: { x: 617, y: 825 },
} as const satisfies Record<string, DemoPoint>;

type KpName = keyof typeof DEMO_KP;

/** The scored (camera-facing) side's kinematic chain, drawn prominently. */
export const SCORED_BONES: [KpName, KpName][] = [
  ["leftEar", "leftShoulder"],
  ["leftShoulder", "leftElbow"],
  ["leftElbow", "leftWrist"],
  ["leftShoulder", "leftHip"],
  ["leftHip", "leftKnee"],
  ["leftKnee", "leftAnkle"],
];

/** The far side, drawn dimmer for depth. */
export const OFF_BONES: [KpName, KpName][] = [
  ["rightShoulder", "rightElbow"],
  ["rightElbow", "rightWrist"],
  ["rightHip", "rightKnee"],
  ["rightKnee", "rightAnkle"],
  ["leftShoulder", "rightShoulder"],
  ["leftHip", "rightHip"],
];

export const SCORED_POINTS: KpName[] = [
  "nose",
  "leftEar",
  "leftShoulder",
  "leftElbow",
  "leftWrist",
  "leftHip",
  "leftKnee",
  "leftAnkle",
];

export const OFF_POINTS: KpName[] = [
  "rightShoulder",
  "rightElbow",
  "rightWrist",
  "rightHip",
  "rightKnee",
  "rightAnkle",
];

/** The app's measured angles and score for this exact photo (RULA). */
export const DEMO_MEASURED = {
  upperArm: 35,
  lowerArm: 40,
  neck: -9,
  trunk: 44,
  grandScore: 5,
  maxScore: 7,
  riskLabel: "Change soon",
} as const;
