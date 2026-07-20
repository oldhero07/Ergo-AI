import { ArrowRight, Camera, FileText, Gauge, Ruler, ScanLine, ShieldCheck, Scale, Upload, Video } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AnalysisMode } from "@/types";

/** The methodology, in pipeline order - this sequence is the product. */
const STEPS = [
  { icon: Upload, name: "Upload", copy: "A single photo or a short video." },
  { icon: ScanLine, name: "Detect", copy: "AI finds the person and 133 keypoints." },
  { icon: Ruler, name: "Measure", copy: "Joint angles are calculated in 2D." },
  { icon: Gauge, name: "Score", copy: "RULA & REBA scores in seconds." },
  { icon: FileText, name: "Report", copy: "A professional PDF, ready to share." },
] as const;

/**
 * Presentational landing page shown before the tool. Stores nothing - no DB, no
 * cache, no persistence - it just explains what Ergo AI does and hands off to
 * the chosen flow (photo or video) via `onStart`.
 */
export function Landing({ onStart }: { onStart: (mode: AnalysisMode) => void }) {
  const base = import.meta.env.BASE_URL;

  return (
    <div className="animate-in fade-in duration-500">
      {/* Hero: the annotated figure is the thesis - measured angles on a body,
          verdict beside it. In light mode the artwork multiplies into the page;
          in dark mode it inverts to an X-ray glow and screens in. */}
      <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 sm:pt-14">
        <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="relative z-10 max-w-xl text-center lg:text-left">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden /> AI powered · research grade
            </p>
            <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Posture risk, <span className="text-primary">scored in seconds.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0">
              Upload a photo. Our AI reads 133 body keypoints and delivers RULA and REBA scores with a professional report. Free, private, no sign-up.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
              <Button size="lg" className="h-12 gap-2 px-5" onClick={() => onStart("photo")}>
                <Camera className="h-4 w-4" /> Analyze a photo
              </Button>
              <Button size="lg" variant="outline" className="h-12 gap-2 px-5" onClick={() => onStart("video")}>
                <Video className="h-4 w-4" /> Analyze a video
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-muted-foreground sm:text-sm lg:justify-start">
              <span className="flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5 text-primary" aria-hidden /> RULA &amp; REBA</span>
              <span className="flex items-center gap-1.5"><Ruler className="h-3.5 w-3.5 text-primary" aria-hidden /> NIOSH Lifting Eq.</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden /> Photos never stored</span>
            </div>
          </div>

          <figure className="relative mx-auto w-full max-w-3xl">
            <div className="absolute -inset-10 -z-10 rounded-full bg-primary/5 blur-3xl dark:bg-primary/10" aria-hidden />
            {/* The artwork is a light-on-white render, so it always shows in its
                light form: melted into the page in light mode, presented on a
                soft light stage in dark mode (no filter tricks - they read odd). */}
            <div className="dark:rounded-3xl dark:bg-white dark:p-2 sm:dark:p-3">
              <img
                src={`${base}hero/hero-annotated.jpg`}
                alt="Translucent anatomical figure lifting a box, annotated with measured joint angles: neck 18°, upper arm 35°, trunk 42°, knee 32°, ankle 6°"
                width={1536}
                height={1024}
                className="mx-auto max-h-[280px] w-auto max-w-full object-contain mix-blend-multiply [mask-image:radial-gradient(ellipse_74%_84%_at_50%_48%,black_60%,transparent_98%)] sm:max-h-none sm:aspect-[3/2] sm:w-full"
                loading="eager"
                decoding="async"
              />
            </div>
            {/* Verdict card: these numbers mirror the artwork's annotated pose
                (RULA 5 for it), so the figure and its verdict always agree.
                Slim horizontal row on phones; floating card from sm up. */}
            <aside className="mx-auto mt-3 flex w-full max-w-sm items-center gap-4 rounded-xl border bg-card p-4 shadow-card-hover sm:absolute sm:right-0 sm:top-1/2 sm:mt-0 sm:block sm:w-56 sm:-translate-y-1/2 sm:p-5 lg:-right-4">
              <div className="shrink-0">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">RULA score</p>
                <div className="mt-1 flex items-end gap-1.5 sm:mt-2">
                  <span className="tabular-readout text-4xl font-semibold leading-none text-risk-high sm:text-5xl">5</span>
                  <span className="mb-1 tabular-readout text-sm text-muted-foreground">/ 7</span>
                </div>
              </div>
              <div className="min-w-0">
                <span className="inline-flex rounded-md bg-risk-high/15 px-2 py-0.5 text-xs font-semibold text-risk-high sm:mt-3">
                  Change soon
                </span>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:mt-3">Investigate further and change the task soon.</p>
              </div>
            </aside>
          </figure>
        </div>

        {/* Methodology strip: how a photo becomes a defensible score. */}
        <ol className="mt-12 grid gap-3 rounded-2xl border bg-muted/40 p-4 sm:grid-cols-2 sm:p-5 lg:mt-14 lg:grid-cols-5">
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
            Also included: OWAS postural classification, NERPA (the ISO 11226-based RULA variant), and the NIOSH
            lifting equation calculator.
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
