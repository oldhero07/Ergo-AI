import { Check, Info, Minus, Activity, AlertTriangle, Eye } from "lucide-react";
import type { PostureInput } from "@/assessment/types";
import type { AngleMeasuredFlags } from "@/lib/angles2d";

/**
 * Makes the model honest on-screen, three-ways:
 *  - measured: derived from confidently-seen keypoints;
 *  - estimated (review): the value IS in the score (flag-never-suppress) but a
 *    joint it depends on was hard to see - highlighted so the assessor
 *    reviews/overrides it rather than silently trusting it;
 *  - assumed neutral: not observable from the camera at all.
 * Plus an off-profile warning when the photo angle itself under-reads angles.
 */
export function MeasurementSummary({
  method,
  input,
  confidence,
  wristMeasured,
  sideBendMeasured,
  staticRepetition,
  measuredFlags,
  offProfile,
}: {
  method: string;
  input: PostureInput;
  confidence?: number;
  wristMeasured?: boolean;
  sideBendMeasured?: boolean;
  /** "detected" for video that found static/repetition, else "assumed". */
  staticRepetition: "assumed" | "detected";
  /** Per-angle confidence flags (server-inference path). Absent on restored
   * legacy sessions - the summary then falls back to measured/assumed only. */
  measuredFlags?: AngleMeasuredFlags;
  /** Photo looks angled/frontal - sagittal angles may be under-read. */
  offProfile?: boolean;
}) {
  const isReba = method === "REBA";
  const isOwas = method === "OWAS";
  const legMeasured = input.legAngle !== undefined;

  const measured: string[] = [];
  const review: string[] = [];
  /** Route an angle to "measured" or "estimated - review" by its flag. */
  const route = (label: string, flag: boolean | undefined) => {
    if (flag === false) review.push(label);
    else measured.push(label);
  };

  route("Upper-arm angle", measuredFlags?.upperArm);
  route("Lower-arm angle", measuredFlags?.lowerArm);
  route("Neck angle", measuredFlags?.neck);
  route("Trunk angle", measuredFlags?.trunk);
  if (sideBendMeasured) measured.push("Neck / trunk side-bend");
  if (legMeasured) route("Knee angle", measuredFlags?.legs);
  if (!isOwas) {
    if (measuredFlags) route("Wrist flexion", measuredFlags.wrist);
    else if (wristMeasured) measured.push("Wrist flexion");
  }
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
    if (!measuredFlags && !wristMeasured) assumed.push("Wrist (not measured)");
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
      {/* Review-needed warnings come FIRST - they are the honest headline. */}
      {review.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-risk-medium/40 bg-risk-medium/10 p-4">
          <Eye className="mt-0.5 h-5 w-5 shrink-0 text-risk-medium" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            <strong className="font-semibold text-foreground">
              {review.join(", ")} {review.length === 1 ? "is" : "are"} an estimate
            </strong>{" "}
            - a joint {review.length === 1 ? "it depends on" : "they depend on"} was hard to see in this
            photo. The estimated value is included in the score (the AI&apos;s best read of the actual
            image), but review it against the photo and override it below if it looks wrong.
          </p>
        </div>
      )}
      {offProfile && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-risk-medium/40 bg-risk-medium/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-risk-medium" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            <strong className="font-semibold text-foreground">This photo looks angled or frontal.</strong>{" "}
            Side-view angles read shallower from an angled camera, so the score may be an underestimate.
            For the most accurate result, retake the photo from directly side-on to the working posture.
          </p>
        </div>
      )}

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

      {/* Measured / Review / Assumed columns */}
      <div className={`grid gap-4 ${review.length ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
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

        {review.length > 0 && (
          <div className="rounded-xl border border-risk-medium/40 bg-risk-medium/5 p-4">
            <h5 className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-risk-medium/15">
                <Eye className="h-3 w-3 text-risk-medium" />
              </span>
              Estimated - Review ({review.length})
            </h5>
            <ul className="space-y-2">
              {review.map((m) => (
                <li key={m} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-risk-medium/50" />
                  {m}
                </li>
              ))}
            </ul>
          </div>
        )}

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
