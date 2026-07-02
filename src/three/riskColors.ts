import type { AssessmentResult } from "@/assessment/types";
import type { Bone } from "@/three/skeleton";

/**
 * Per-component risk coloring for the 3D pose viewer. Colors come from the
 * live CSS theme (read at mount via getComputedStyle) so the scene matches
 * light/dark mode; component scores come from the AssessmentResult's group
 * items, normalized against each component's own per-method maximum.
 */

export type ComponentKey = Exclude<Bone["component"], "frame">;

/** Read an HSL token like `--risk-low` and return a CSS hsl() color string.
 * Tokens are stored space-separated ("152 70% 30%"); three.js Color.setStyle
 * only parses the legacy comma syntax, so emit "hsl(152, 70%, 30%)" - valid
 * for both CSS and three materials. */
function tokenColor(name: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return "#888";
  const parts = raw.split("/")[0].trim().split(/\s+/);
  if (parts.length === 3) return `hsl(${parts[0]}, ${parts[1]}, ${parts[2]})`;
  return `hsl(${raw})`;
}

export interface RiskPalette {
  low: string;
  medium: string;
  high: string;
  veryhigh: string;
  frame: string;
  primary: string;
}

export function readPalette(): RiskPalette {
  return {
    low: tokenColor("--risk-low"),
    medium: tokenColor("--risk-medium"),
    high: tokenColor("--risk-high"),
    veryhigh: tokenColor("--risk-veryhigh"),
    frame: tokenColor("--muted-foreground"),
    primary: tokenColor("--primary"),
  };
}

/** Per-method maximum attainable per-component scores, for normalization.
 * RULA/REBA values follow the published scorer ranges; OWAS's single action
 * category is applied to the whole body. */
const COMPONENT_MAX: Record<string, Partial<Record<ComponentKey, number>>> = {
  RULA: { upperArm: 6, lowerArm: 3, neck: 6, trunk: 6, legs: 2 },
  REBA: { upperArm: 6, lowerArm: 2, neck: 3, trunk: 5, legs: 4 },
  OWAS: { upperArm: 4, lowerArm: 4, neck: 4, trunk: 4, legs: 4 },
};

/** Group-item labels → viewer components. Labels are the stable strings the
 * method implementations emit ("Upper arm", "Lower arm", "Neck", "Trunk",
 * "Legs"; OWAS: "Back", "Arms", "Legs"). */
const LABEL_TO_COMPONENT: Record<string, ComponentKey> = {
  "Upper arm": "upperArm",
  "Lower arm": "lowerArm",
  Neck: "neck",
  Trunk: "trunk",
  Legs: "legs",
  // OWAS posture-code digits
  Back: "trunk",
  Arms: "upperArm",
};

/** Extract each component's normalized severity (0..1) from a result. */
export function componentSeverities(result: AssessmentResult): Record<ComponentKey, number> {
  const max = COMPONENT_MAX[result.method] ?? COMPONENT_MAX.RULA;
  const out: Record<ComponentKey, number> = { upperArm: 0, lowerArm: 0, neck: 0, trunk: 0, legs: 0 };
  for (const group of result.groups) {
    for (const item of group.items) {
      const key = LABEL_TO_COMPONENT[item.label];
      if (!key) continue;
      const m = max[key] ?? 4;
      // Score 1 is the "neutral" floor in every method → severity 0.
      const sev = m > 1 ? (item.value - 1) / (m - 1) : 0;
      out[key] = Math.max(out[key], Math.min(1, Math.max(0, sev)));
    }
  }
  if (result.method === "OWAS") {
    // OWAS's neck isn't scored separately - tint it with the trunk severity.
    out.neck = out.trunk;
    out.lowerArm = out.upperArm;
  }
  return out;
}

/** Severity (0..1) → one of the four risk token colors. */
export function severityColor(sev: number, palette: RiskPalette): string {
  if (sev >= 0.75) return palette.veryhigh;
  if (sev >= 0.5) return palette.high;
  if (sev >= 0.25) return palette.medium;
  return palette.low;
}
