import { useRef } from "react";
import { Camera, Video, ShieldCheck, ArrowRight, Scale, FileText } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Hero } from "@/components/landing/Hero";
import { LiveAnalysisDemo } from "@/components/landing/LiveAnalysisDemo";
import { ReportShowcase } from "@/components/landing/ReportShowcase";
import { useScrollReveal } from "@/hooks/useScrollMotion";
import type { AnalysisMode } from "@/types";

/**
 * Presentational landing page shown before the tool. Stores nothing - no DB, no
 * cache, no persistence - it just shows what Ergo AI does (literally: the demo
 * section replays real analysis output) and hands off to the chosen flow via
 * `onStart`. Scroll motion is registered by useScrollReveal and degrades to
 * plain visible content under prefers-reduced-motion.
 */
export function Landing({ onStart }: { onStart: (mode: AnalysisMode) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useScrollReveal(rootRef);

  return (
    <div ref={rootRef}>
      <Hero onStart={onStart} />

      <LiveAnalysisDemo />

      <ReportShowcase />

      {/* Methods */}
      <section className="border-t bg-muted/40 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 data-reveal className="text-center text-sm font-semibold uppercase tracking-widest text-primary">
            Four published methods
          </h2>
          <div data-reveal-stagger className="mt-8 grid gap-4 sm:grid-cols-2">
            <MethodCard
              name="RULA"
              full="Rapid Upper Limb Assessment"
              scale="Grand score 1-7"
              body="Focuses on the upper body - arms, wrists, neck and trunk. Best for seated, desk and bench tasks."
            />
            <MethodCard
              name="REBA"
              full="Rapid Entire Body Assessment"
              scale="Grand score 1-15"
              body="Whole-body assessment adding legs, load, coupling and an activity score. Best for dynamic, lifting and field work."
            />
          </div>
          <p data-reveal className="mt-4 text-center text-sm text-muted-foreground">
            Also included: OWAS postural classification, NERPA (the ISO 11226-based RULA variant), and the NIOSH
            lifting equation calculator.
          </p>
        </div>
      </section>

      {/* Why / privacy */}
      <section className="border-t py-16">
        <div data-reveal-stagger className="mx-auto grid max-w-4xl gap-4 px-4 sm:grid-cols-3 sm:px-6">
          <Feature icon={<ShieldCheck className="h-5 w-5" />} title="Never stored">
            Photos are analyzed in memory on our inference server and immediately discarded - never
            saved, logged, or used for training.
          </Feature>
          <Feature icon={<Scale className="h-5 w-5" />} title="Consistent everywhere">
            One pinned model on fixed hardware: the same photo produces the same score on every
            device, every time.
          </Feature>
          <Feature icon={<FileText className="h-5 w-5" />} title="Professional reports">
            Cover page, risk-band legend, measured angles and assumptions - ready to share.
          </Feature>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t bg-muted/40 py-20">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <div data-reveal>
            <Logo className="mx-auto h-11 w-11" />
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">Ready to assess a posture?</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Start with a photo or a short video - RULA and REBA scores in seconds.
            </p>
          </div>
          <div data-reveal-stagger className="mx-auto mt-7 grid max-w-md gap-3 sm:grid-cols-2">
            <EntryCard icon={<Camera className="h-5 w-5" />} title="Analyze a photo" sub="" onClick={() => onStart("photo")} primary />
            <EntryCard icon={<Video className="h-5 w-5" />} title="Analyze a video" sub="" onClick={() => onStart("video")} />
          </div>
          <p data-reveal className="mt-5 text-xs text-muted-foreground">
            Scores are a lower-bound estimate from a single camera view, not a substitute for a trained assessor.
          </p>
        </div>
      </section>
    </div>
  );
}

function EntryCard({
  icon,
  title,
  sub,
  onClick,
  primary,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "group flex items-center gap-3 rounded-lg border bg-card p-4 text-left shadow-card transition-all hover:border-primary/50 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
        (primary ? "border-primary/40 bg-accent/40" : "")
      }
    >
      <span
        className={
          "grid h-11 w-11 shrink-0 place-items-center rounded-lg " +
          (primary ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")
        }
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 font-medium">
          {title}
          <ArrowRight className="h-4 w-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
        </span>
        {sub && <span className="block text-xs text-muted-foreground">{sub}</span>}
      </span>
    </button>
  );
}

function MethodCard({ name, full, scale, body }: { name: string; full: string; scale: string; body: string }) {
  return (
    <Card className="p-6 transition-shadow hover:shadow-card-hover">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xl font-bold tracking-tight">{name}</h3>
        <Badge variant="muted" className="tabular-readout rounded-full text-primary">{scale}</Badge>
      </div>
      <p className="mt-0.5 font-mono text-[11px] uppercase tracking-widest text-primary">{full}</p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </Card>
  );
}

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
        {icon}
      </span>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </Card>
  );
}
