import { Check, Minus } from "lucide-react";
import type { PostureInput } from "@/assessment/types";

/**
 * Makes the model honest on-screen: lists exactly what the camera measured vs
 * what's assumed-neutral and therefore not in the score, so the grand score is
 * clearly a lower bound until the assumed factors are set in the panel below.
 */
export function MeasurementSummary({
  method,
  input,
  confidence,
  wristMeasured,
  sideBendMeasured,
  staticRepetition,
}: {
  method: string;
  input: PostureInput;
  confidence?: number;
  wristMeasured?: boolean;
  sideBendMeasured?: boolean;
  /** "detected" for video that found static/repetition, else "assumed". */
  staticRepetition: "assumed" | "detected";
}) {
  const isReba = method === "REBA";
  const legMeasured = input.legAngle !== undefined;

  const measured: string[] = ["Upper-arm angle", "Lower-arm angle", "Neck angle", "Trunk angle"];
  if (sideBendMeasured) measured.push("Neck / trunk side-bend");
  if (legMeasured) measured.push("Knee angle");
  if (wristMeasured) measured.push("Wrist flexion");
  if (staticRepetition === "detected") measured.push("Static / repetition");

  const assumed: string[] = ["Neck / trunk twist", "Upper-arm abduction", "Arm support"];
  if (!wristMeasured) assumed.push("Wrist (not measured)");
  if (isReba) {
    assumed.push("Load / force", "Coupling");
    if (staticRepetition !== "detected") assumed.push("Activity (static / repeated)");
  } else {
    assumed.push("Force / load");
    if (staticRepetition !== "detected") assumed.push("Muscle use (static / repeated)");
  }

  return (
    <div className="px-5 py-4">
      <p className="text-xs text-muted-foreground">
        The grand score is a <strong className="text-foreground">lower bound</strong> — {assumed.length} factor
        {assumed.length !== 1 ? "s" : ""} the camera can&apos;t see are assumed neutral. Set them below to complete it.
        {confidence !== undefined && ` · pose confidence ${Math.round(confidence * 100)}%`}
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <h5 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Measured</h5>
          <ul className="space-y-1">
            {measured.map((m) => (
              <li key={m} className="flex items-center gap-1.5 text-sm">
                <Check className="h-3.5 w-3.5 text-risk-low" /> {m}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h5 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Assumed / not assessed
          </h5>
          <ul className="space-y-1">
            {assumed.map((m) => (
              <li key={m} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Minus className="h-3.5 w-3.5" /> {m}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
