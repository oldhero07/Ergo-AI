import { computeAngles2D } from "@/lib/angles2d";
import { buildAutoInput, computeRula } from "@/assessment/rula/rula";
import { REVEAL_IMG, REVEAL_KEYPOINTS } from "@/components/landing/revealPose";

/**
 * The one assessment every landing visual derives from: the master-video pose
 * run through the app's real pipeline (computeAngles2D -> computeRula). Hero
 * chips, the score reveal, and the report preview all read these numbers, so
 * the marketing figures can never drift from what the product would output.
 * Module-level because the input is a build-time constant.
 */
const { angles, wristAngle } = computeAngles2D(REVEAL_KEYPOINTS, REVEAL_IMG.w, REVEAL_IMG.h);

export const REVEAL_ANALYSIS = {
  angles,
  assessment: computeRula(buildAutoInput(angles, { wristAngle })),
} as const;
