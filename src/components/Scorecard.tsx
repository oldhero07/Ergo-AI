import type { AssessmentResult, GroupBreakdown } from "@/assessment/types";
import { RISK_META } from "@/lib/risk";
import { cn } from "@/lib/utils";

function Gauge({ score, max, color }: { score: number; max: number; color: string }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, score / max));
  return (
    <svg viewBox="0 0 120 120" className="h-28 w-28 shrink-0" role="img" aria-label={`Score ${score} of ${max}`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - frac)}
        transform="rotate(-90 60 60)"
      />
      <text x="60" y="59" textAnchor="middle" className="fill-foreground" style={{ fontSize: 30, fontWeight: 600 }}>
        {score}
      </text>
      <text x="60" y="79" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 12 }}>
        of {max}
      </text>
    </svg>
  );
}

function Chip({ value }: { value: number }) {
  return (
    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-secondary px-1.5 text-xs font-medium tabular-nums">
      {value}
    </span>
  );
}

function Group({ group }: { group: GroupBreakdown }) {
  return (
    <div className="rounded-lg border p-4">
      <h4 className="text-sm font-medium">{group.name}</h4>
      <div className="mt-3 space-y-1.5">
        {group.items.map((it) => (
          <div key={it.label} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">
              {it.label}
              {it.note ? <span className="ml-1 font-mono text-xs text-muted-foreground/70">{it.note}</span> : null}
            </span>
            <Chip value={it.value} />
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t pt-2.5 text-sm font-medium">
        <span>{group.scoreLabel}</span>
        <Chip value={group.score} />
      </div>
      <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
        posture {group.posture} · +muscle {group.muscle} · +force {group.force}
      </p>
    </div>
  );
}

export function Scorecard({ result, className }: { result: AssessmentResult; className?: string }) {
  const meta = RISK_META[result.riskBand];
  return (
    <div className={cn("p-5", className)}>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
        <Gauge score={result.grandScore} max={result.maxScore} color={meta.color} />
        <div className="text-center sm:text-left">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {result.method} grand score
          </div>
          <div className="mt-0.5 text-2xl font-semibold" style={{ color: meta.color }}>
            {result.riskLabel}
          </div>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{result.actionLevel}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {result.groups.map((g) => (
          <Group key={g.name} group={g} />
        ))}
      </div>
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
