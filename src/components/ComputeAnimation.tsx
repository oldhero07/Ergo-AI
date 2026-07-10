import { useComputeTimeline } from "@/hooks/useComputeTimeline";
import { cn } from "@/lib/utils";

const PHASES = [
  { label: "Detecting pose", caption: "Locating body landmarks" },
  { label: "Computing vectors", caption: "v = p₂ − p₁" },
  { label: "Solving angles", caption: "θ = cos⁻¹( a·b / |a||b| )" },
  { label: "Scoring", caption: "Group A × Group B → grand score" },
] as const;

export function ComputeAnimation({ note, onSkip }: { note?: string; onSkip?: () => void }) {
  const { rootRef, phase, reducedMotion } = useComputeTimeline();

  if (reducedMotion) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <p className="text-lg font-medium">Processing…</p>
        <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
          {PHASES.map((p) => (
            <li key={p.label}>{p.label}</li>
          ))}
        </ul>
        {note && <p className="mt-3 text-xs text-muted-foreground">{note}</p>}
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="mt-4 text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Skip
          </button>
        )}
      </div>
    );
  }

  const current = PHASES[phase];

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-5 text-center">
      <svg
        ref={rootRef}
        viewBox="0 0 280 300"
        className="h-72 w-64 rounded-lg border bg-card text-primary shadow-card"
        role="img"
        aria-label="Computing"
      >
        <defs>
          <marker id="ca-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M0,0.5 L5.5,3 L0,5.5 Z" fill="hsl(var(--risk-medium))" />
          </marker>
        </defs>

        {/* abstract line-art skeleton */}
        <g stroke="hsl(var(--primary))" strokeWidth={2.5} strokeLinecap="round" fill="none" opacity={0.85}>
          <line data-anim="edge" x1={140} y1={49} x2={128} y2={86} />
          <line data-anim="edge" x1={128} y1={86} x2={154} y2={124} />
          <line data-anim="edge" x1={154} y1={124} x2={146} y2={166} />
          <line data-anim="edge" x1={128} y1={86} x2={122} y2={172} />
          <line data-anim="edge" x1={122} y1={172} x2={132} y2={226} />
          <line data-anim="edge" x1={132} y1={226} x2={126} y2={282} />
        </g>
        
        {/* Skeleton Joint Nodes */}
        <g fill="hsl(var(--primary))">
          <circle data-anim="node" cx={140} cy={36} r={12} fill="hsl(var(--primary))" />
          <circle data-anim="node" cx={140} cy={36} r={5} fill="hsl(var(--primary-foreground))" />
          <circle data-anim="node" cx={128} cy={86} r={5} />
          <circle data-anim="node" cx={154} cy={124} r={5} />
          <circle data-anim="node" cx={146} cy={166} r={5} />
          <circle data-anim="node" cx={122} cy={172} r={5} />
          <circle data-anim="node" cx={132} cy={226} r={5} />
          <circle data-anim="node" cx={126} cy={282} r={5} />
        </g>

        {/* vectors */}
        <g stroke="hsl(var(--risk-medium))" strokeWidth={1.5} markerEnd="url(#ca-arrow)">
          <line data-anim="vector" x1={128} y1={86} x2={154} y2={124} transform="translate(8,-4)" />
          <line data-anim="vector" x1={154} y1={124} x2={146} y2={166} transform="translate(11,-1)" />
        </g>
        <text data-anim="tag" x={183} y={104} className="fill-muted-foreground font-mono" style={{ fontSize: 11, fontWeight: 500 }}>
          v₁
        </text>
        <text data-anim="tag" x={176} y={148} className="fill-muted-foreground font-mono" style={{ fontSize: 11, fontWeight: 500 }}>
          v₂
        </text>

        {/* angle arc at the elbow - concentric to elbow joint (154, 124) */}
        <path
          data-anim="arc"
          d="M 142 106 A 22 22 0 0 0 150 146"
          stroke="hsl(var(--risk-high))"
          strokeWidth={2}
          fill="none"
         
        />
        <text
          data-anim="degree"
          x={134}
          y={126}
          className="fill-foreground font-mono"
          style={{ fontSize: 13, fontWeight: 800 }}
         
        >
          0°
        </text>

        {/* RULA gauge */}
        <g transform="translate(218,68)">
          <circle r={30} fill="none" stroke="hsl(var(--muted))" strokeWidth={7} />
          <circle
            data-anim="gauge-ring"
            r={30}
            fill="none"
            stroke="hsl(var(--risk-medium))"
            strokeWidth={7}
            strokeLinecap="round"
            transform="rotate(-90)"
           
          />
          <text
            data-anim="gauge-text"
            textAnchor="middle"
            dy={6}
            className="fill-foreground font-mono"
            style={{ fontSize: 19, fontWeight: 800 }}
          >
            1
          </text>
        </g>
        
        {/* Score Chips */}
        <g fill="currentColor">
          <g data-anim="chip">
            <rect x={194} y={106} width={20} height={16} rx={4} fill="hsl(var(--primary))" fillOpacity={0.15} stroke="hsl(var(--primary) / 0.3)" strokeWidth={0.5} />
            <text x={204} y={118} textAnchor="middle" className="font-mono font-semibold" style={{ fontSize: 9 }}>
              A
            </text>
          </g>
          <g data-anim="chip">
            <rect x={222} y={106} width={20} height={16} rx={4} fill="hsl(var(--primary))" fillOpacity={0.15} stroke="hsl(var(--primary) / 0.3)" strokeWidth={0.5} />
            <text x={232} y={118} textAnchor="middle" className="font-mono font-semibold" style={{ fontSize: 9 }}>
              B
            </text>
          </g>
        </g>
      </svg>

      <div key={phase} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
        <p className="text-base font-medium">{current.label}</p>
        <p className="mt-1 font-mono text-sm text-muted-foreground">{current.caption}</p>
      </div>

      <div className="flex gap-1.5">
        {PHASES.map((p, i) => (
          <span
            key={p.label}
            className={cn("h-1.5 w-5 rounded-full transition-colors", i === phase ? "bg-primary" : "bg-muted")}
          />
        ))}
      </div>

      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="mt-2 rounded-full border bg-card px-5 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-primary/40 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Skip animation →
        </button>
      )}
    </div>
  );
}
