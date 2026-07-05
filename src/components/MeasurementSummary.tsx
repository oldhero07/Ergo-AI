import { Check, Info, Minus, Activity } from "lucide-react";
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
  const isOwas = method === "OWAS";
  const legMeasured = input.legAngle !== undefined;

  const measured: string[] = ["Upper-arm angle", "Lower-arm angle", "Neck angle", "Trunk angle"];
  if (sideBendMeasured) measured.push("Neck / trunk side-bend");
  if (legMeasured) measured.push("Knee angle");
  if (!isOwas && wristMeasured) measured.push("Wrist flexion");
  if (isOwas && input.armsAboveShoulder !== undefined) measured.push("Arm elevation (both sides)");
  if (staticRepetition === "detected") measured.push("Static / repetition");

  const assumed: string[] = [];
  if (isOwas) {
    // OWAS classifies posture categories; its unobservables differ from RULA/REBA.
    assumed.push("Trunk twist");
    if (input.armsAboveShoulder === undefined) assumed.push("Arm elevation (one side only)");
    assumed.push("Walking / kneeling", "Load weight");
  } else {
    assumed.push("Neck / trunk twist", "Upper-arm abduction", "Arm support");
    if (!wristMeasured) assumed.push("Wrist (not measured)");
    if (isReba) {
      assumed.push("Load / force", "Coupling");
      if (staticRepetition !== "detected") assumed.push("Activity (static / repeated)");
    } else {
      assumed.push("Force / load");
      if (staticRepetition !== "detected") assumed.push("Muscle use (static / repeated)");
    }
  }

  const pct = confidence !== undefined ? Math.round(confidence * 100) : null;

  return (
    <div className="px-5 py-5">
      {/* Confidence banner */}
      <div className="mb-6 flex flex-col gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            The initial score is a <strong className="font-medium text-foreground">baseline</strong> because{" "}
            {assumed.length} factor{assumed.length !== 1 ? "s" : ""} cannot be seen by the camera.{" "}
            Review and adjust the assumed factors below for a complete assessment.
          </p>
        </div>
        {pct !== null && (
          <div className="flex shrink-0 items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 text-primary">
            <Activity className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Detection confidence {pct}%</span>
          </div>
        )}
      </div>

      {/* Measured vs Assumed columns */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h5 className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15">
              <Check className="h-3 w-3 text-primary" />
            </span>
            Measured Automatically ({measured.length})
          </h5>
          <ul className="space-y-2">
            {measured.map((m) => (
              <li key={m} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                {m}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h5 className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted">
              <Minus className="h-3 w-3 text-muted-foreground" />
            </span>
            Assumed Neutral ({assumed.length})
          </h5>
          <ul className="space-y-2">
            {assumed.map((m) => (
              <li key={m} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-border" />
                {m}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
