import { useMemo, useState } from "react";
import { ArrowLeft, FileDown, Loader2 } from "lucide-react";
import { computeNiosh } from "@/assessment/niosh/niosh";
import type { NioshInput, NioshResult } from "@/assessment/niosh/niosh";
import type { RiskBand } from "@/assessment/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { exportNioshPdf, type ReportMeta } from "@/lib/pdf";

export interface NioshPrefill {
  horizontalCm: number;
  verticalCm: number;
}

const RISK_PILL_CLASSES: Record<RiskBand, string> = {
  low: "bg-risk-low/15 text-risk-low",
  medium: "bg-risk-medium/15 text-risk-medium",
  high: "bg-risk-high/15 text-risk-high",
  veryhigh: "bg-risk-veryhigh/15 text-risk-veryhigh",
};

const RISK_STROKE_CLASSES: Record<RiskBand, string> = {
  low: "text-risk-low",
  medium: "text-risk-medium",
  high: "text-risk-high",
  veryhigh: "text-risk-veryhigh",
};

const DEFAULT_INPUT: NioshInput = {
  horizontalCm: 40,
  verticalCm: 75,
  travelCm: 30,
  asymmetryDeg: 0,
  frequencyPerMin: 1,
  durationHours: 1,
  coupling: "good",
  loadKg: 10,
};

/** Segmented toggle button shared by the duration and coupling controls. */
function SegButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
        active
          ? "bg-primary text-primary-foreground shadow-glow-sm"
          : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      )}
    >
      {label}
    </button>
  );
}

function SliderRow({
  id,
  label,
  value,
  unit,
  min,
  max,
  step = 1,
  decimals = 0,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step?: number;
  decimals?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/50 px-3.5 py-2.5">
      <label htmlFor={id} className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="hud-readout rounded-md bg-secondary px-1.5 py-0.5 font-medium text-secondary-foreground">
          {value.toFixed(decimals)}
          {unit}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
      />
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground/60">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
    </div>
  );
}

function LiGauge({ result }: { result: NioshResult }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const isInfinite = result.li === Infinity;
  const frac = isInfinite ? 1 : Math.max(0, Math.min(1, result.li / 4));
  const strokeClass = RISK_STROKE_CLASSES[result.riskBand];

  return (
    <svg viewBox="0 0 120 120" className="h-32 w-32 shrink-0" role="img" aria-label={`Lifting Index ${isInfinite ? "infinite" : result.li.toFixed(2)}`}>
      <defs>
        <filter id="niosh-li-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        className={cn(strokeClass, "stroke-current")}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - frac)}
        transform="rotate(-90 60 60)"
        filter="url(#niosh-li-glow)"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      <text x="60" y="57" textAnchor="middle" className="hud-readout fill-foreground" style={{ fontSize: isInfinite ? 34 : 26, fontWeight: 700 }}>
        {isInfinite ? "∞" : result.li.toFixed(2)}
      </text>
      <text x="60" y="76" textAnchor="middle" className="hud-readout fill-muted-foreground" style={{ fontSize: 10 }}>
        LIFTING INDEX
      </text>
    </svg>
  );
}

interface MultiplierRow {
  key: keyof NioshResult["multipliers"];
  name: string;
  formula: string;
}

const MULTIPLIER_ROWS: MultiplierRow[] = [
  { key: "HM", name: "HM · Horizontal", formula: "25 / H" },
  { key: "VM", name: "VM · Vertical", formula: "1 − 0.003|V−75|" },
  { key: "DM", name: "DM · Distance", formula: "0.82 + 4.5 / D" },
  { key: "AM", name: "AM · Asymmetry", formula: "1 − 0.0032A" },
  { key: "FM", name: "FM · Frequency", formula: "Table 5" },
  { key: "CM", name: "CM · Coupling", formula: "Table 7" },
];

function MultiplierTable({ result }: { result: NioshResult }) {
  const multipliers = result.multipliers;

  const limitingKey = useMemo(() => {
    let best: { key: string; value: number } | null = null;
    for (const row of MULTIPLIER_ROWS) {
      const v = multipliers[row.key];
      if (v <= 0) continue;
      if (v < 0.85 && (best === null || v < best.value)) best = { key: row.key, value: v };
    }
    return best?.key ?? null;
  }, [multipliers]);

  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Multiplier breakdown</h3>
      <div className="mt-3 divide-y divide-border">
        {MULTIPLIER_ROWS.map((row) => {
          const value = multipliers[row.key];
          const isZero = value === 0;
          const isLimiting = row.key === limitingKey;
          return (
            <div key={row.key} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div>
                <div className="font-medium">{row.name}</div>
                <div className="hud-readout text-xs text-muted-foreground">{row.formula}</div>
              </div>
              <span
                className={cn(
                  "hud-readout rounded-md bg-secondary px-2 py-1 text-sm font-semibold text-secondary-foreground",
                  isZero && "text-risk-veryhigh",
                  isLimiting && !isZero && "text-risk-medium",
                )}
              >
                {value.toFixed(3)}
              </span>
            </div>
          );
        })}
      </div>
      {limitingKey && (
        <p className="mt-2 text-[10px] text-muted-foreground/70">
          <span className="text-risk-medium">lowest multiplier</span> = biggest lever for redesign
        </p>
      )}
      {result.notes.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-border pt-3">
          {result.notes.map((n, i) => (
            <li key={i} className="text-xs text-risk-medium">
              {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function NioshCalculator({
  prefill,
  onBack,
  reportMeta,
}: {
  prefill?: NioshPrefill | null;
  onBack: () => void;
  reportMeta?: ReportMeta;
}) {
  const [input, setInput] = useState<NioshInput>(() =>
    prefill ? { ...DEFAULT_INPUT, horizontalCm: prefill.horizontalCm, verticalCm: prefill.verticalCm } : DEFAULT_INPUT,
  );
  const [showPrefillChip, setShowPrefillChip] = useState(!!prefill);
  const [exporting, setExporting] = useState(false);

  const exportPdf = async () => {
    setExporting(true);
    try {
      await exportNioshPdf(input, result, reportMeta);
    } finally {
      setExporting(false);
    }
  };

  const result = useMemo(() => computeNiosh(input), [input]);
  const set = <K extends keyof NioshInput>(key: K, value: NioshInput[K]) => setInput((prev) => ({ ...prev, [key]: value }));

  const pillClasses = RISK_PILL_CLASSES[result.riskBand];

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div>
          <h2 className="text-lg font-semibold leading-none tracking-tight">NIOSH Lifting Equation</h2>
          <p className="hud-readout mt-1 text-xs text-muted-foreground">
            Revised lifting equation (Waters et al., 1994) · RWL &amp; Lifting Index
          </p>
        </div>
        <Button variant="outline" onClick={() => void exportPdf()} disabled={exporting} className="ml-auto">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          Export PDF
        </Button>
      </div>

      {showPrefillChip && (
        <div className="glass mb-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs">
          <span className="hud-readout font-mono text-muted-foreground">H &amp; V estimated from photo - adjust to measured values</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setShowPrefillChip(false)}
            className="ml-1 rounded-full px-1.5 text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ×
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* LEFT: form */}
        <div className="glass rounded-2xl p-5">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Task variables</h3>
          <div className="space-y-3">
            <SliderRow
              id="niosh-h"
              label="Horizontal distance (H)"
              value={input.horizontalCm}
              unit=" cm"
              min={25}
              max={70}
              onChange={(v) => set("horizontalCm", v)}
            />
            <SliderRow
              id="niosh-v"
              label="Vertical height (V)"
              value={input.verticalCm}
              unit=" cm"
              min={0}
              max={175}
              onChange={(v) => set("verticalCm", v)}
            />
            <SliderRow
              id="niosh-d"
              label="Vertical travel (D)"
              value={input.travelCm}
              unit=" cm"
              min={25}
              max={175}
              onChange={(v) => set("travelCm", v)}
            />
            <SliderRow
              id="niosh-a"
              label="Asymmetry angle (A)"
              value={input.asymmetryDeg}
              unit="°"
              min={0}
              max={135}
              onChange={(v) => set("asymmetryDeg", v)}
            />
            <SliderRow
              id="niosh-f"
              label="Frequency"
              value={input.frequencyPerMin}
              unit=" /min"
              min={0.2}
              max={16}
              step={0.1}
              decimals={1}
              onChange={(v) => set("frequencyPerMin", v)}
            />
            <SliderRow
              id="niosh-load"
              label="Load"
              value={input.loadKg}
              unit=" kg"
              min={0}
              max={50}
              step={0.5}
              decimals={1}
              onChange={(v) => set("loadKg", v)}
            />

            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/50 px-3.5 py-2.5 text-sm">
              <span className="text-muted-foreground">Duration</span>
              <div className="flex gap-1">
                <SegButton label="≤1h" active={input.durationHours === 1} onClick={() => set("durationHours", 1)} />
                <SegButton label="≤2h" active={input.durationHours === 2} onClick={() => set("durationHours", 2)} />
                <SegButton label="≤8h" active={input.durationHours === 8} onClick={() => set("durationHours", 8)} />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/50 px-3.5 py-2.5 text-sm">
              <span className="text-muted-foreground">Coupling</span>
              <div className="flex gap-1">
                <SegButton label="Good" active={input.coupling === "good"} onClick={() => set("coupling", "good")} />
                <SegButton label="Fair" active={input.coupling === "fair"} onClick={() => set("coupling", "fair")} />
                <SegButton label="Poor" active={input.coupling === "poor"} onClick={() => set("coupling", "poor")} />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: results */}
        <div className="glass flex flex-col items-center rounded-2xl p-5 text-center">
          <h3 className="mb-4 self-start text-xs font-bold uppercase tracking-widest text-muted-foreground">Result</h3>
          <LiGauge result={result} />
          <p className="hud-readout mt-4 text-sm text-muted-foreground">
            Recommended Weight Limit: <span className="font-semibold text-foreground">{result.rwlKg.toFixed(1)} kg</span>
          </p>
          <div className={cn("mt-3 inline-block rounded-lg px-2.5 py-0.5 text-lg font-bold tracking-tight", pillClasses)}>
            {result.riskLabel}
          </div>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">{result.actionLevel}</p>
        </div>
      </div>

      {/* Multiplier breakdown */}
      <div className="mt-6">
        <MultiplierTable result={result} />
      </div>
    </div>
  );
}
