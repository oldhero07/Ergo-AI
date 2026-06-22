import { useComputeTimeline } from "@/hooks/useComputeTimeline";
import { cn } from "@/lib/utils";

const PHASES = [
  { label: "Detecting pose", caption: "Locating body landmarks" },
  { label: "Computing vectors", caption: "v = p₂ − p₁" },
  { label: "Solving angles", caption: "θ = cos⁻¹( a·b / |a||b| )" },
  { label: "Running RULA", caption: "Group A × Group B → grand score" },
] as const;

const TICKER_ITEMS = [
  "θ = cos⁻¹(a·b / |a||b|)",
  "v = p₂ − p₁",
  "RULA = f(A, B, C, D)",
  "ScoreA = TableA[UA][LA][W][WT]",
  "ScoreB = TableB[N][T][L]",
  "Grand = TableC[C][D]",
];

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
      <svg ref={rootRef} viewBox="0 0 280 300" className="h-72 w-64 text-primary" role="img" aria-label="Computing">
        <defs>
          <marker id="ca-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="currentColor" />
          </marker>
        </defs>

        {/* abstract wireframe skeleton */}
        <g stroke="currentColor" strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.85}>
          <line data-anim="edge" x1={140} y1={49} x2={128} y2={86} />
          <line data-anim="edge" x1={128} y1={86} x2={154} y2={124} />
          <line data-anim="edge" x1={154} y1={124} x2={146} y2={166} />
          <line data-anim="edge" x1={128} y1={86} x2={122} y2={172} />
          <line data-anim="edge" x1={122} y1={172} x2={132} y2={226} />
          <line data-anim="edge" x1={132} y1={226} x2={126} y2={282} />
        </g>
        <g fill="currentColor">
          <circle data-anim="node" cx={140} cy={36} r={13} />
          <circle data-anim="node" cx={128} cy={86} r={6} />
          <circle data-anim="node" cx={154} cy={124} r={6} />
          <circle data-anim="node" cx={146} cy={166} r={6} />
          <circle data-anim="node" cx={122} cy={172} r={6} />
          <circle data-anim="node" cx={132} cy={226} r={6} />
          <circle data-anim="node" cx={126} cy={282} r={6} />
        </g>

        {/* vectors */}
        <g stroke="hsl(var(--risk-medium))" strokeWidth={3} markerEnd="url(#ca-arrow)">
          <line data-anim="vector" x1={128} y1={86} x2={154} y2={124} transform="translate(10,-6)" />
          <line data-anim="vector" x1={154} y1={124} x2={146} y2={166} transform="translate(14,-2)" />
        </g>
        <text data-anim="tag" x={183} y={104} className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
          v₁
        </text>
        <text data-anim="tag" x={176} y={148} className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
          v₂
        </text>

        {/* angle arc at the elbow */}
        <path
          data-anim="arc"
          d="M 144 110 A 22 22 0 0 1 152 142"
          stroke="hsl(var(--risk-high))"
          strokeWidth={3}
          fill="none"
        />
        <text
          data-anim="degree"
          x={166}
          y={134}
          className="fill-foreground font-mono"
          style={{ fontSize: 14, fontWeight: 600 }}
        >
          0°
        </text>

        {/* RULA gauge */}
        <g transform="translate(218,68)">
          <circle r={30} fill="none" stroke="hsl(var(--muted))" strokeWidth={8} />
          <circle
            data-anim="gauge-ring"
            r={30}
            fill="none"
            stroke="hsl(var(--risk-low))"
            strokeWidth={8}
            strokeLinecap="round"
            transform="rotate(-90)"
          />
          <text
            data-anim="gauge-text"
            textAnchor="middle"
            dy={5}
            className="fill-foreground font-mono"
            style={{ fontSize: 18, fontWeight: 700 }}
          >
            1
          </text>
        </g>
        <g fill="currentColor">
          <rect data-anim="chip" x={194} y={106} width={20} height={16} rx={4} fillOpacity={0.15} stroke="none" />
          <text data-anim="chip" x={204} y={117} textAnchor="middle" className="font-mono" style={{ fontSize: 9 }}>
            A
          </text>
          <rect data-anim="chip" x={222} y={106} width={20} height={16} rx={4} fillOpacity={0.15} stroke="none" />
          <text data-anim="chip" x={232} y={117} textAnchor="middle" className="font-mono" style={{ fontSize: 9 }}>
            B
          </text>
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

      <div className="ticker-mask w-full max-w-md overflow-hidden">
        <div className="ticker-track flex w-max gap-8 whitespace-nowrap font-mono text-xs text-muted-foreground/70">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
      </div>

      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Skip
        </button>
      )}
    </div>
  );
}
