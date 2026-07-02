import { useComputeTimeline } from "@/hooks/useComputeTimeline";
import { cn } from "@/lib/utils";

const PHASES = [
  { label: "Detecting pose", caption: "Locating body landmarks" },
  { label: "Computing vectors", caption: "v = p₂ − p₁" },
  { label: "Solving angles", caption: "θ = cos⁻¹( a·b / |a||b| )" },
  { label: "Scoring", caption: "Group A × Group B → grand score" },
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
      <svg ref={rootRef} viewBox="0 0 280 300" className="h-72 w-64 rounded-2xl text-primary grid-bg" role="img" aria-label="Computing">
        <defs>
          <marker id="ca-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M0,0.5 L5.5,3 L0,5.5 Z" fill="hsl(var(--risk-medium))" />
          </marker>
          
          {/* Neon Glow Filter */}
          <filter id="ca-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* High-tech digital dot-grid pattern */}
          <pattern id="ca-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <line x1="20" y1="0" x2="20" y2="20" stroke="currentColor" strokeWidth="0.5" opacity="0.08" />
            <line x1="0" y1="20" x2="20" y2="20" stroke="currentColor" strokeWidth="0.5" opacity="0.08" />
            <circle cx="20" cy="20" r="0.75" fill="currentColor" opacity="0.15" />
          </pattern>

          {/* Biomechanical pulse gradient */}
          <radialGradient id="ca-bg-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.12" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </radialGradient>
        </defs>

        <style>
          {`
            @keyframes ca-scan-sweep {
              0% { transform: translateY(5px); opacity: 0; }
              10% { opacity: 0.8; }
              90% { opacity: 0.8; }
              100% { transform: translateY(295px); opacity: 0; }
            }
            .animate-ca-scan {
              animation: ca-scan-sweep 4s infinite linear;
            }
          `}
        </style>

        {/* Ambient Grid & Background Glow */}
        <rect width="280" height="300" fill="url(#ca-grid)" className="text-muted-foreground" />
        <rect width="280" height="300" fill="url(#ca-bg-glow)" />

        {/* Dynamic laser scanning beam */}
        <g className="animate-ca-scan">
          <line x1="10" y1="0" x2="270" y2="0" stroke="hsl(var(--primary))" strokeWidth="2" filter="url(#ca-glow)" />
          <line x1="10" y1="0" x2="270" y2="0" stroke="hsl(var(--primary-foreground))" strokeWidth="0.75" opacity="0.9" />
        </g>

        {/* abstract wireframe skeleton */}
        <g stroke="hsl(var(--primary))" strokeWidth={2.5} strokeLinecap="round" fill="none" opacity={0.7} filter="url(#ca-glow)">
          <line data-anim="edge" x1={140} y1={49} x2={128} y2={86} />
          <line data-anim="edge" x1={128} y1={86} x2={154} y2={124} />
          <line data-anim="edge" x1={154} y1={124} x2={146} y2={166} />
          <line data-anim="edge" x1={128} y1={86} x2={122} y2={172} />
          <line data-anim="edge" x1={122} y1={172} x2={132} y2={226} />
          <line data-anim="edge" x1={132} y1={226} x2={126} y2={282} />
        </g>
        
        {/* Skeleton Joint Nodes */}
        <g fill="hsl(var(--primary))" filter="url(#ca-glow)">
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
        <g stroke="hsl(var(--risk-medium))" strokeWidth={1.5} markerEnd="url(#ca-arrow)" filter="url(#ca-glow)">
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
          filter="url(#ca-glow)"
        />
        <text
          data-anim="degree"
          x={134}
          y={126}
          className="fill-foreground font-mono"
          style={{ fontSize: 13, fontWeight: 800 }}
          filter="url(#ca-glow)"
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
            filter="url(#ca-glow)"
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
          className="mt-2 rounded-full border border-border bg-background/60 px-5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
        >
          Skip animation →
        </button>
      )}
    </div>
  );
}
