import type { RiskBand } from "@/assessment/types";

export const RISK_META: Record<RiskBand, { label: string; color: string }> = {
  low: { label: "Low risk", color: "hsl(var(--risk-low))" },
  medium: { label: "Medium risk", color: "hsl(var(--risk-medium))" },
  high: { label: "High risk", color: "hsl(var(--risk-high))" },
  veryhigh: { label: "Very high risk", color: "hsl(var(--risk-veryhigh))" },
};
