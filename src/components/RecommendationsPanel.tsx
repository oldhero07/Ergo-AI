import { Lightbulb } from "lucide-react";
import type { AssessmentResult, PostureInput } from "@/assessment/types";
import { buildRecommendations, type Severity } from "@/assessment/recommendations";
import { cn } from "@/lib/utils";
import { RISK_PILL } from "@/lib/risk";

const SEVERITY_CLASSES: Record<Severity, string> = {
  critical: RISK_PILL.veryhigh,
  important: RISK_PILL.medium,
  advisory: "bg-muted text-muted-foreground",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "critical",
  important: "important",
  advisory: "advisory",
};

/** Per-risk-factor intervention guidance below a scorecard. Renders nothing
 * when the posture triggers no rules (nothing to fix - say nothing). */
export function RecommendationsPanel({ result, input }: { result: AssessmentResult; input: PostureInput }) {
  const recs = buildRecommendations(result, input);
  if (!recs.length) return null;

  return (
    <div className="border-t border-border px-5 py-5">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Lightbulb className="h-3.5 w-3.5" />
        </span>
        Recommendations
      </h4>
      <ul className="space-y-3">
        {recs.map((rec) => (
          <li key={rec.id} className="rounded-lg border bg-muted/40 p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "tabular-readout rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  SEVERITY_CLASSES[rec.severity],
                )}
              >
                {SEVERITY_LABEL[rec.severity]}
              </span>
              <span className="text-sm font-medium">{rec.title}</span>
              <span className="tabular-readout ml-auto text-[10px] text-muted-foreground">{rec.component}</span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{rec.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
