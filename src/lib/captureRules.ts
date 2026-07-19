import { Camera, Maximize2, RotateCw, Sun } from "lucide-react";

/**
 * The one set of photo-capture rules, used by the landing's guidelines section
 * (long copy) and the uploader's guide panel (short copy). Shared so the
 * vocabulary a visitor learns on the landing is exactly what the upload page
 * repeats back.
 */
export const CAPTURE_RULES = [
  {
    icon: RotateCw,
    name: "Shoot from the side",
    copy: "Stand 90° to the person — a true profile. RULA and REBA read the sagittal plane, so the side view is the one the AI measures best.",
    short: "A true 90° profile — not frontal, not diagonal.",
  },
  {
    icon: Maximize2,
    name: "Whole body in frame",
    copy: "Head to feet, nothing cropped. Every joint the score needs has to be visible.",
    short: "Head to feet visible — no cropped limbs.",
  },
  {
    icon: Camera,
    name: "Camera level, waist height",
    copy: "Hold the camera steady around waist height, not tilted up or down — tilt distorts the measured angles.",
    short: "Hold level at waist height — tilt distorts angles.",
  },
  {
    icon: Sun,
    name: "Catch the real task",
    copy: "Photograph the working posture mid-task, in even light. A posed stance scores the pose, not the job.",
    short: "Natural working posture mid-task, in even light.",
  },
] as const;
