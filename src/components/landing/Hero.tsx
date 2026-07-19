import { ArrowRight, Camera, FileText, Gauge, Play, Ruler, ScanLine, ShieldCheck, Upload, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RISK_PILL, RISK_TEXT } from "@/lib/risk";
import { REVEAL_ANALYSIS } from "@/components/landing/revealAnalysis";
import type { AnalysisMode } from "@/types";

const STEPS = [
  { icon: Upload, name: "Upload", copy: "A single photo or a short video." },
  { icon: ScanLine, name: "Detect", copy: "AI finds the person and 133 keypoints." },
  { icon: Ruler, name: "Measure", copy: "Joint angles are calculated in 2D." },
  { icon: Gauge, name: "Score", copy: "RULA & REBA scores in seconds." },
  { icon: FileText, name: "Report", copy: "A professional PDF, ready to share." },
] as const;

/** Joint markers + angle chips, positioned in % of the hero figure box. */
const CHIPS = [
  { key: "elbow", label: "Elbow flexion", dot: { x: 47, y: 41 }, chip: { x: 27, y: 30 } },
  { key: "upperArm", label: "Upper arm", dot: { x: 50.5, y: 33 }, chip: { x: 58, y: 17 } },
  { key: "trunk", label: "Trunk flexion", dot: { x: 64, y: 40 }, chip: { x: 60, y: 52 } },
  { key: "knee", label: "Knee flexion", dot: { x: 53.5, y: 64 }, chip: { x: 58, y: 73 } },
] as const;

/** The product's opening claim, illustrated by its own output on one figure. */
export function Hero({ onStart }: { onStart: (mode: AnalysisMode) => void }) {
  const base = import.meta.env.BASE_URL;
  const { angles, assessment } = REVEAL_ANALYSIS;
  const chipValue: Record<(typeof CHIPS)[number]["key"], number> = {
    elbow: Math.round(angles.lowerArm),
    upperArm: Math.round(angles.upperArm),
    trunk: Math.round(angles.trunk),
    knee: Math.round(angles.legAngle ?? 0),
  };

  return (
    <section className="relative overflow-hidden border-b bg-white">
      <div className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 lg:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="relative z-10 max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden /> AI powered · research grade
            </p>
            <h1 className="mt-7 text-balance text-5xl font-semibold leading-[1.02] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Posture risk, <span className="text-primary">scored in seconds.</span>
            </h1>
            <p className="mt-6 max-w-lg text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              Upload a photo. Our AI reads 133 body keypoints and delivers RULA and REBA scores with a professional report.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" className="h-12 gap-2 px-5" onClick={() => onStart("photo")}>
                <Camera className="h-4 w-4" /> Analyze a photo
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 gap-2 px-5"
                onClick={() => document.getElementById("capture-guide")?.scrollIntoView({ behavior: "smooth" })}
              >
                <Play className="h-4 w-4" /> Watch how it works
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-muted-foreground sm:text-sm">
              <span className="flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5 text-primary" aria-hidden /> RULA &amp; REBA</span>
              <span className="flex items-center gap-1.5"><Video className="h-3.5 w-3.5 text-primary" aria-hidden /> NIOSH Lifting Eq.</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden /> Photos never stored</span>
            </div>
          </div>

          <figure className="relative mx-auto w-full max-w-3xl">
            <div className="absolute -inset-12 -z-10 rounded-full bg-primary/5 blur-3xl" aria-hidden />
            <div className="relative">
              <img
                src={`${base}hero/hero-figure.jpg`}
                alt="Translucent anatomical figure in a lifting posture, annotated with measured joint angles"
                width={1600}
                height={900}
                className="aspect-video w-full [mask-image:radial-gradient(ellipse_72%_82%_at_50%_48%,black_62%,transparent_97%)]"
                loading="eager"
                decoding="async"
              />
              {/* Joint markers + measured-angle chips: the product's actual output. */}
              <div className="pointer-events-none absolute inset-0 hidden sm:block" aria-hidden>
                {CHIPS.map(({ key, label, dot, chip }) => (
                  <div key={key}>
                    <span
                      className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-4 ring-primary/15"
                      style={{ left: `${dot.x}%`, top: `${dot.y}%` }}
                    />
                    <div
                      className="absolute -translate-x-1/2 rounded-xl border bg-card/95 px-3.5 py-2 shadow-card backdrop-blur-sm"
                      style={{ left: `${chip.x}%`, top: `${chip.y}%` }}
                    >
                      <span className="block text-[11px] font-medium text-muted-foreground">{label}</span>
                      <span className="tabular-readout block text-xl font-semibold text-primary">{chipValue[key]}°</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* The verdict card: same numbers the report will show. */}
            <aside className="mt-4 rounded-xl border bg-card p-5 shadow-card-hover sm:absolute sm:-right-2 sm:top-1/2 sm:mt-0 sm:w-56 sm:-translate-y-1/2 lg:-right-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">RULA score</p>
              <div className="mt-2 flex items-end gap-1.5">
                <span className={cn("tabular-readout text-5xl font-semibold leading-none", RISK_TEXT[assessment.riskBand])}>{assessment.grandScore}</span>
                <span className="mb-1 tabular-readout text-sm text-muted-foreground">/ {assessment.maxScore}</span>
              </div>
              <span className={cn("mt-3 inline-flex rounded-md px-2 py-0.5 text-xs font-semibold", RISK_PILL[assessment.riskBand])}>
                {assessment.riskLabel}
              </span>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{assessment.actionLevel}</p>
            </aside>
          </figure>
        </div>

        {/* The pipeline, in order: this sequence is the product. */}
        <ol className="mt-14 grid gap-3 rounded-2xl border bg-muted/40 p-4 sm:grid-cols-2 sm:p-5 lg:mt-16 lg:grid-cols-5">
          {STEPS.map(({ icon: Icon, name, copy }, index) => (
            <li key={name} className="relative flex items-start gap-3.5 rounded-xl bg-card p-4 shadow-card">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span className="font-mono text-[10px] text-primary">0{index + 1}</span> {name}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{copy}</p>
              </div>
              {index < STEPS.length - 1 && (
                <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-muted-foreground/60 lg:block" aria-hidden />
              )}
            </li>
          ))}
        </ol>

        <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border bg-background" aria-hidden>
            <ArrowRight className="h-3.5 w-3.5 rotate-90" />
          </span>
          Scroll to explore
        </p>
      </div>
    </section>
  );
}
