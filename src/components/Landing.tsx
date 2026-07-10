import { Camera, Video, ScanLine, Gauge, ShieldCheck, ArrowRight, Scale, FileText } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { AnalysisMode } from "@/types";

/**
 * Presentational landing page shown before the tool. Stores nothing - no DB, no
 * cache, no persistence - it just explains what Ergo AI does and hands off to
 * the chosen flow (photo or video) via `onStart`.
 */
export function Landing({ onStart }: { onStart: (mode: AnalysisMode) => void }) {
  return (
    <div className="animate-in fade-in duration-500">
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-2 pt-6 pb-14 sm:pt-12">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1 text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Processed in memory · never stored
            </Badge>
            <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Ergonomic risk assessment from a photo
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg lg:mx-0">
              Get <strong className="font-semibold text-foreground">RULA</strong> and{" "}
              <strong className="font-semibold text-foreground">REBA</strong> posture-risk scores from a photo or a
              short video - with a professional PDF report. Free, private, no sign-up.
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              <Badge variant="muted" className="tabular-readout rounded-full">133 keypoints</Badge>
              <Badge variant="muted" className="tabular-readout rounded-full">RULA · REBA · OWAS</Badge>
              <Badge variant="muted" className="tabular-readout rounded-full">Same photo, same score, every device</Badge>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <EntryCard
                icon={<Camera className="h-5 w-5" />}
                title="Analyze a photo"
                sub="One image or a batch"
                onClick={() => onStart("photo")}
                primary
              />
              <EntryCard
                icon={<Video className="h-5 w-5" />}
                title="Analyze a video"
                sub="A short clip, over time"
                onClick={() => onStart("video")}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">JPG or PNG · MP4, MOV, WebM</p>
          </div>
          <div className="relative hidden min-h-[420px] lg:block">
            <HeroVisual />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t py-14">
        <div className="mx-auto max-w-4xl px-2">
          <h2 className="text-center text-sm font-semibold uppercase tracking-widest text-primary">
            How it works
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Step icon={<Camera className="h-5 w-5" />} n="1" title="Upload">
              A clear side view of the working posture - photo or short clip. Analyzed in memory, never stored.
            </Step>
            <Step icon={<ScanLine className="h-5 w-5" />} n="2" title="AI reads the pose">
              Research-grade AI (RTMPose wholebody) locates 133 body and hand keypoints and derives the joint angles.
            </Step>
            <Step icon={<Gauge className="h-5 w-5" />} n="3" title="Score + report">
              A RULA or REBA grand score with a per-joint breakdown and an exportable PDF.
            </Step>
          </div>
        </div>
      </section>

      {/* Methods */}
      <section className="border-t py-14">
        <div className="mx-auto max-w-4xl px-2">
          <div className="grid gap-4 sm:grid-cols-2">
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
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Also included: OWAS postural classification and the NIOSH lifting equation calculator.
          </p>
        </div>
      </section>

      {/* Why / privacy */}
      <section className="border-t py-14">
        <div className="mx-auto grid max-w-4xl gap-4 px-2 sm:grid-cols-3">
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
      <section className="border-t py-16">
        <div className="mx-auto max-w-2xl px-2 text-center">
          <Logo className="mx-auto h-11 w-11" />
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">Ready to assess a posture?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Start with a photo or a short video - RULA and REBA scores in seconds.
          </p>
          <div className="mx-auto mt-6 grid max-w-md gap-3 sm:grid-cols-2">
            <EntryCard icon={<Camera className="h-5 w-5" />} title="Analyze a photo" sub="" onClick={() => onStart("photo")} primary />
            <EntryCard icon={<Video className="h-5 w-5" />} title="Analyze a video" sub="" onClick={() => onStart("video")} />
          </div>
          <p className="mt-5 text-xs text-muted-foreground">
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

/** A static, token-colored product motif: an annotated pose skeleton with an
 * angle arc and a score gauge. Clean clinical line-art - no glow filters. */
function HeroVisual() {
  return (
    <Card className="mx-auto w-full max-w-sm p-6">
      <svg viewBox="0 0 260 250" className="w-full" role="img" aria-label="Pose skeleton with angle and risk score">
        {/* Keypoint annotation */}
        <text x={10} y={20} className="fill-muted-foreground font-mono" style={{ fontSize: 8, letterSpacing: "0.05em" }}>
          133 KEYPOINTS · SIDE VIEW
        </text>

        {/* Skeleton bones */}
        <g stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M120 44 L104 86" />
          <path d="M104 86 L138 120" />
          <path d="M138 120 L128 160" />
          <path d="M104 86 L98 176" />
          <path d="M98 176 L110 214" />
        </g>

        {/* Joint nodes */}
        <g fill="hsl(var(--primary))">
          <circle cx="120" cy="44" r="8" />
          <circle cx="120" cy="44" r="3.5" fill="hsl(var(--primary-foreground))" />
          <circle cx="104" cy="86" r="5" />
          <circle cx="138" cy="120" r="5" />
          <circle cx="128" cy="160" r="5" />
          <circle cx="98" cy="176" r="5" />
          <circle cx="110" cy="214" r="5" />
        </g>

        {/* Measured angle arc at the elbow */}
        <path d="M 124 106 A 20 20 0 0 0 133 139" stroke="hsl(var(--risk-high))" strokeWidth="2" fill="none" />
        <rect x={128} y={94} width={42} height={16} rx={4} fill="hsl(var(--risk-high))" fillOpacity={0.12} />
        <text x={132} y={106} className="fill-foreground font-mono" style={{ fontSize: 9, fontWeight: 700 }}>
          θ = 42.6°
        </text>

        {/* Score gauge */}
        <g transform="translate(208,80)">
          <circle r="32" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
          <circle
            r="32"
            fill="none"
            stroke="hsl(var(--risk-medium))"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="201"
            strokeDashoffset="130"
            transform="rotate(-90)"
          />
          <text x="0" y="7" textAnchor="middle" className="fill-foreground font-mono" style={{ fontSize: 22, fontWeight: 800 }}>
            3
          </text>
        </g>
        <text x="208" y="138" textAnchor="middle" className="fill-muted-foreground font-mono font-medium" style={{ fontSize: 10, letterSpacing: "0.05em" }}>
          RULA SCORE
        </text>
      </svg>
    </Card>
  );
}

function Step({ icon, n, title, children }: { icon: React.ReactNode; n: string; title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5 transition-shadow hover:shadow-card-hover">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
          {icon}
        </span>
        <Badge variant="muted" className="rounded-full font-mono text-[10px] font-bold uppercase tracking-widest text-primary">
          Step {n}
        </Badge>
      </div>
      <h3 className="mt-3 font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </Card>
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
