import { Check, Info, Minus } from "lucide-react";
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

  const pct = confidence !== undefined ? Math.round(confidence * 100) : null;

  return (
    <div className="px-5 py-5">
      {/* Confidence banner */}
      <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          The grand score is a{" "}
          <strong className="font-semibold text-foreground">lower bound</strong> —{" "}
          {assumed.length} factor{assumed.length !== 1 ? "s" : ""} the camera can&apos;t see are
          assumed neutral. Adjust them below to complete the assessment.
          {pct !== null && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] font-medium">
              pose confidence {pct}%
            </span>
          )}
        </p>
      </div>

      {/* Measured vs Assumed columns */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <h5 className="mb-2.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Measured ({measured.length})
          </h5>
          <ul className="space-y-1.5">
            {measured.map((m) => (
              <li key={m} className="flex items-center gap-2 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                  <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                </span>
                <span className="font-medium">{m}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
          <h5 className="mb-2.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
            Assumed neutral ({assumed.length})
          </h5>
          <ul className="space-y-1.5">
            {assumed.map((m) => (
              <li key={m} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Minus className="h-3 w-3" />
                </span>
                {m}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
