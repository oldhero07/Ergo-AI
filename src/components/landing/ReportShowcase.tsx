import { CheckCircle2, Download, FileCheck2, ShieldCheck } from "lucide-react";
import { gsap } from "@/hooks/useScrollMotion";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { RISK_PILL, RISK_TEXT } from "@/lib/risk";
import { REVEAL_ANALYSIS } from "@/components/landing/revealAnalysis";
import type { RiskBand } from "@/assessment/types";

const { angles: A, assessment: SCORE } = REVEAL_ANALYSIS;

/** Same figure, same pipeline, same numbers as the hero and the score reveal.
 * Tones mirror each joint's RULA sub-score for this pose. */
const METRICS: { label: string; angle: number; tone: RiskBand }[] = [
  { label: "Trunk flexion", angle: Math.round(A.trunk), tone: "veryhigh" },
  { label: "Upper arm", angle: Math.round(A.upperArm), tone: "high" },
  { label: "Elbow flexion", angle: Math.round(A.lowerArm), tone: "medium" },
  { label: "Neck flexion", angle: Math.round(A.neck), tone: "low" },
];

const RISK_BAR: Record<RiskBand, string> = {
  low: "bg-risk-low",
  medium: "bg-risk-medium",
  high: "bg-risk-high",
  veryhigh: "bg-risk-veryhigh",
};

/** An executive summary, not a document screenshot: verdict first, evidence
 * second, export last - the same order the real PDF argues in. */
export function ReportShowcase() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(section.querySelector("[data-report-preview]"), {
        opacity: 0,
        y: 28,
        duration: 0.55,
        ease: "power2.out",
        scrollTrigger: { trigger: section, start: "top 72%", toggleActions: "play none none reverse" },
      });
    });
    return () => mm.revert();
  }, []);

  return (
    <section id="report-preview" ref={sectionRef} className="border-b bg-background">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:py-28">
        <div data-reveal>
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">The deliverable</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            A report that answers first, then shows its work.
          </h2>
          <p className="mt-5 max-w-md text-pretty text-base leading-relaxed text-muted-foreground">
            Every assessment leads with the risk verdict, then records the measurements, recommendations, and provenance needed for review.
          </p>
          <div className="mt-8 space-y-4 text-sm text-muted-foreground">
            <Feature text="Risk band and action level at a glance" />
            <Feature text="Measured joint angles with clear thresholds" />
            <Feature text="Model version and assessment assumptions" />
          </div>
        </div>

        <article data-report-preview className="overflow-hidden rounded-2xl border bg-card shadow-card-hover">
          <header className="flex items-center justify-between border-b px-6 py-4 sm:px-8">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
              <FileCheck2 className="h-4 w-4" aria-hidden /> Ergo AI assessment
            </div>
            <p className="text-xs text-muted-foreground">RULA · single-frame review</p>
          </header>

          {/* The verdict: everything else on the card supports this line. */}
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4 border-b bg-muted/45 px-6 py-6 sm:px-8">
            <div className="flex items-end gap-2">
              <span className={cn("tabular-readout text-7xl font-semibold leading-none", RISK_TEXT[SCORE.riskBand])}>
                {SCORE.grandScore}
              </span>
              <span className="mb-1.5 tabular-readout text-base text-muted-foreground">/ {SCORE.maxScore}</span>
            </div>
            <div className="min-w-0 flex-1">
              <span className={cn("inline-flex rounded-md px-2.5 py-1 text-xs font-semibold", RISK_PILL[SCORE.riskBand])}>
                {SCORE.riskLabel}
              </span>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-foreground">{SCORE.actionLevel}</p>
            </div>
            <ShieldCheck className="hidden h-6 w-6 shrink-0 text-primary sm:block" aria-label="Verified assessment" />
          </div>

          <div className="grid gap-8 px-6 py-6 sm:grid-cols-[1.1fr_0.9fr] sm:px-8 sm:py-7">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Measured angles</p>
              <dl className="mt-4 space-y-4">
                {METRICS.map(({ label, angle, tone }) => (
                  <div key={label}>
                    <div className="flex items-baseline justify-between text-sm">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="tabular-readout font-semibold text-foreground">{angle}°</dd>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", RISK_BAR[tone])}
                        style={{ width: `${Math.min(Math.max((angle / 90) * 100, 4), 100)}%` }}
                        aria-hidden
                      />
                    </div>
                  </div>
                ))}
              </dl>
            </div>
            <div className="flex flex-col">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Recommendation</p>
              <div className="mt-3 rounded-lg border border-primary/20 bg-accent/45 p-4 text-sm leading-relaxed text-foreground">
                Adjust lift height and reduce sustained trunk flexion before the next review.
              </div>
              <p className="mt-auto pt-5 font-mono text-[10px] leading-relaxed text-muted-foreground">
                RTMPose wholebody · RULA 1993 · v1.0
              </p>
            </div>
          </div>

          <footer className="flex items-center justify-between border-t bg-muted/30 px-6 py-4 sm:px-8">
            <p className="text-xs text-muted-foreground">Exported with every analysis - no extra steps.</p>
            <span className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-xs font-semibold text-foreground">
              <Download className="h-3.5 w-3.5 text-primary" aria-hidden /> PDF report
            </span>
          </footer>
        </article>
      </div>
    </section>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-3">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      {text}
    </p>
  );
}
