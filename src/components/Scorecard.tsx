import { useEffect, useRef } from "react";
import type { AssessmentResult, GroupBreakdown, RiskBand } from "@/assessment/types";
import { cn } from "@/lib/utils";
import { RISK_PILL, RISK_BORDER, RISK_TEXT } from "@/lib/risk";
import { gsap } from "@/hooks/useScrollMotion";
import { CheckCircle2, AlertTriangle, ShieldAlert, OctagonAlert } from "lucide-react";

function Gauge({ score, max, riskBand }: { score: number; max: number; riskBand: RiskBand }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, score / max));
  const textRef = useRef<SVGTextElement>(null);

  // Count the number up on mount and whenever the score changes (method switch).
  // The DOM default is the final value, so reduced-motion users see it directly.
  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const counter = { v: 0 };
      gsap.to(counter, {
        v: score,
        duration: 0.6,
        ease: "power2.out",
        onUpdate: () => {
          if (textRef.current) textRef.current.textContent = String(Math.round(counter.v));
        },
      });
    });
    return () => mm.revert();
  }, [score]);

  return (
    <svg viewBox="0 0 120 120" className="h-28 w-28 shrink-0" role="img" aria-label={`Score ${score} of ${max}`}>
      {/* Track */}
      <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
      {/* Progress */}
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        className={cn(RISK_TEXT[riskBand], "stroke-current")}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - frac)}
        transform="rotate(-90 60 60)"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      {/* Score text */}
      <text ref={textRef} x="60" y="57" textAnchor="middle" className="tabular-readout fill-foreground" style={{ fontSize: 30, fontWeight: 700 }}>
        {score}
      </text>
      <text x="60" y="74" textAnchor="middle" className="tabular-readout fill-muted-foreground" style={{ fontSize: 11 }}>
        of {max}
      </text>
    </svg>
  );
}

function ScoreChip({ value }: { value: number }) {
  return (
    <span className="tabular-readout inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded-lg bg-secondary px-2 text-xs font-bold text-secondary-foreground">
      {value}
    </span>
  );
}

function Group({ group }: { group: GroupBreakdown }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-4">
      <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{group.name}</h4>
      <div className="mt-3 space-y-2">
        {group.items.map((it) => (
          <div key={it.label} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">
              {it.label}
              {it.note ? <span className="ml-1 font-mono text-xs text-muted-foreground/60">{it.note}</span> : null}
            </span>
            <ScoreChip value={it.value} />
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm font-semibold">
        <span>{group.scoreLabel}</span>
        <ScoreChip value={group.score} />
      </div>
      <p className="tabular-readout mt-1.5 text-[10px] text-muted-foreground/70">
        posture {group.posture} · +muscle {group.muscle} · +force {group.force}
      </p>
    </div>
  );
}

export function Scorecard({ result, className }: { result: AssessmentResult; className?: string }) {
  const pillClasses = RISK_PILL[result.riskBand];
  const borderClass = RISK_BORDER[result.riskBand];

  return (
    <div className={cn("p-5", className)}>
      {/* Gauge + summary row */}
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-7">
        <Gauge score={result.grandScore} max={result.maxScore} riskBand={result.riskBand} />
        <div className="flex-1 text-center sm:text-left">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {result.method} grand score
          </div>
          <div className={cn("mt-1 inline-block rounded-lg px-2.5 py-0.5 text-3xl font-bold tracking-tight", pillClasses)}>
            {result.riskLabel}
          </div>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{result.actionLevel}</p>
        </div>
      </div>

      {/* Risk band explanation card */}
      <div className={cn("mt-5 flex items-start gap-3 rounded-xl border-l-4 px-4 py-3.5", borderClass, pillClasses.split(" ")[0])}>
        <div className={cn("mt-0.5 shrink-0", pillClasses.split(" ")[1])}>
          {result.riskBand === "low" && <CheckCircle2 className="h-5 w-5" />}
          {result.riskBand === "medium" && <AlertTriangle className="h-5 w-5" />}
          {result.riskBand === "high" && <ShieldAlert className="h-5 w-5" />}
          {result.riskBand === "veryhigh" && <OctagonAlert className="h-5 w-5" />}
        </div>
        <div>
          <p className={cn("text-sm font-semibold", pillClasses.split(" ")[1])}>
            {result.riskBand === "low" && "Low risk — monitor and re-evaluate if posture changes."}
            {result.riskBand === "medium" && "Medium risk — investigate further and consider changes soon."}
            {result.riskBand === "high" && "High risk — investigate and implement changes promptly."}
            {result.riskBand === "veryhigh" && "Very high risk — stop task and redesign immediately."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.riskBand === "low" && "Minor ergonomic concerns. Document and review at the next scheduled assessment."}
            {result.riskBand === "medium" &&
              "This posture may cause musculoskeletal strain over time. Consider adjusting workstation height, tool placement, or adding rotation schedules."}
            {result.riskBand === "high" &&
              "Sustained exposure risks injury. Prioritize redesigning the task, workstation, or adding mechanical aids. Re-assess after changes."}
            {result.riskBand === "veryhigh" &&
              "Immediate ergonomic intervention required. Remove the worker from this task or provide mechanical support until a redesign is in place."}
          </p>
        </div>
      </div>

      {/* Group breakdown */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {result.groups.map((g) => (
          <Group key={g.name} group={g} />
        ))}
      </div>

      {/* Notes */}
      {result.notes.length > 0 && (
        <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
          {result.notes.map((n, i) => (
            <li key={i}>· {n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
