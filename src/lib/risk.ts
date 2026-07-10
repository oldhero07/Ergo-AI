import type { RiskBand } from "@/assessment/types";

export const RISK_META: Record<RiskBand, { label: string; color: string }> = {
  low: { label: "Low risk", color: "hsl(var(--risk-low))" },
  medium: { label: "Medium risk", color: "hsl(var(--risk-medium))" },
  high: { label: "High risk", color: "hsl(var(--risk-high))" },
  veryhigh: { label: "Very high risk", color: "hsl(var(--risk-veryhigh))" },
};

/* Central risk class maps. Full string literals only - Tailwind's JIT scanner
   must see every class name verbatim for it to be generated. */

export const RISK_TEXT: Record<RiskBand, string> = {
  low: "text-risk-low",
  medium: "text-risk-medium",
  high: "text-risk-high",
  veryhigh: "text-risk-veryhigh",
};

export const RISK_PILL: Record<RiskBand, string> = {
  low: "bg-risk-low/15 text-risk-low",
  medium: "bg-risk-medium/15 text-risk-medium",
  high: "bg-risk-high/15 text-risk-high",
  veryhigh: "bg-risk-veryhigh/15 text-risk-veryhigh",
};

export const RISK_BORDER: Record<RiskBand, string> = {
  low: "border-risk-low",
  medium: "border-risk-medium",
  high: "border-risk-high",
  veryhigh: "border-risk-veryhigh",
};

export const RISK_FILL: Record<RiskBand, string> = {
  low: "fill-risk-low",
  medium: "fill-risk-medium",
  high: "fill-risk-high",
  veryhigh: "fill-risk-veryhigh",
};
