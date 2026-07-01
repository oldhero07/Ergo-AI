import { Camera, Video, ScanLine, Gauge, ShieldCheck, ArrowRight, Cpu, FileText } from "lucide-react";
import { Logo } from "@/components/Logo";
import type { AnalysisMode } from "@/types";

/**
 * Presentational landing page shown before the tool. Stores nothing — no DB, no
 * cache, no persistence — it just explains what Ergo AI does and hands off to
 * the chosen flow (photo or video) via `onStart`.
 */
export function Landing({ onStart }: { onStart: (mode: AnalysisMode) => void }) {
  return (
    <div className="animate-in fade-in duration-500">
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-2 pt-6 pb-14 sm:pt-12">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Runs in your browser · nothing is uploaded
            </span>
            <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Ergonomic risk scoring, made friendly
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg lg:mx-0">
              Get <strong className="font-semibold text-foreground">RULA</strong> and{" "}
              <strong className="font-semibold text-foreground">REBA</strong> posture-risk scores from a photo or a
              short video — with a professional PDF report. Free, private, no sign-up.
            </p>
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
            <p className="mt-3 text-xs text-muted-foreground">JPG, PNG, iPhone HEIC · MP4, MOV, WebM</p>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* How it works */}
      <section className="border-t py-14">
        <div className="mx-auto max-w-4xl px-2">
          <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            How it works
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Step icon={<Camera className="h-5 w-5" />} n="1" title="Upload">
              A clear side view of the working posture — photo or short clip. Everything stays on your device.
            </Step>
            <Step icon={<ScanLine className="h-5 w-5" />} n="2" title="AI reads the pose">
              On-device AI (Google MediaPipe Pose) locates 33 body landmarks and derives the joint angles.
            </Step>
            <Step icon={<Gauge className="h-5 w-5" />} n="3" title="Score + report">
              A RULA or REBA grand score with a per-joint breakdown and an exportable PDF.
            </Step>
          </div>
        </div>
      </section>

      {/* Methods */}
      <section className="border-t py-14">
        <div className="mx-auto grid max-w-4xl gap-4 px-2 sm:grid-cols-2">
          <MethodCard
            name="RULA"
            full="Rapid Upper Limb Assessment"
            scale="Grand score 1–7"
            body="Focuses on the upper body — arms, wrists, neck and trunk. Best for seated, desk and bench tasks."
          />
          <MethodCard
            name="REBA"
            full="Rapid Entire Body Assessment"
            scale="Grand score 1–15"
            body="Whole-body assessment adding legs, load, coupling and an activity score. Best for dynamic, lifting and field work."
          />
        </div>
      </section>

      {/* Why / privacy */}
      <section className="border-t py-14">
        <div className="mx-auto grid max-w-4xl gap-6 px-2 sm:grid-cols-3">
          <Feature icon={<ShieldCheck className="h-5 w-5" />} title="Private by design">
            Photos and videos are decoded and scored in your browser. Nothing is sent to a server.
          </Feature>
          <Feature icon={<Cpu className="h-5 w-5" />} title="Works offline">
            After the first load the pose model is cached, so it keeps working without a connection.
          </Feature>
          <Feature icon={<FileText className="h-5 w-5" />} title="Professional reports">
            Cover page, risk-band legend, measured angles and assumptions — ready to share.
          </Feature>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t py-16">
        <div className="mx-auto max-w-2xl px-2 text-center">
          <Logo className="mx-auto h-11 w-11" />
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">Ready to assess a posture?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Start with a photo or a short video — RULA and REBA scores in seconds.
          </p>
          <div className="mx-auto mt-6 grid max-w-md gap-3 sm:grid-cols-2">
            <EntryCard icon={<Camera className="h-5 w-5" />} title="Analyze a photo" sub="" onClick={() => onStart("photo")} primary />
            <EntryCard icon={<Video className="h-5 w-5" />} title="Analyze a video" sub="" onClick={() => onStart("video")} />
          </div>
          <p className="mt-5 text-xs text-muted-foreground">
            Scores are a lower-bound 2D estimate, not a substitute for a trained assessor.
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
        "group flex items-center gap-3 rounded-2xl border p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
        (primary ? "border-primary/40 bg-primary/5" : "bg-card")
      }
    >
      <span
        className={
          "grid h-11 w-11 shrink-0 place-items-center rounded-xl " +
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

/** A warm, static product motif: an annotated pose skeleton with a coral gauge. */
function HeroVisual() {
  return (
    <div className="mx-auto hidden w-full max-w-sm rounded-3xl border bg-card p-6 shadow-card lg:block">
      <svg viewBox="0 0 260 240" className="w-full" role="img" aria-label="Pose skeleton with angle and risk score">
        <g stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.9">
          <path d="M120 44 L104 86" />
          <path d="M104 86 L138 120" />
          <path d="M138 120 L128 160" />
          <path d="M104 86 L98 176" />
          <path d="M98 176 L110 214" />
        </g>
        <g fill="hsl(var(--primary))">
          <circle cx="122" cy="34" r="11" />
          <circle cx="104" cy="86" r="5.5" />
          <circle cx="138" cy="120" r="5.5" />
          <circle cx="128" cy="160" r="5.5" />
          <circle cx="98" cy="176" r="5.5" />
          <circle cx="110" cy="214" r="5.5" />
        </g>
        <path d="M122 108 A 20 20 0 0 1 132 138" stroke="hsl(var(--risk-high))" strokeWidth="3" fill="none" />
        <text x="150" y="130" className="fill-muted-foreground" style={{ fontSize: 12, fontFamily: "monospace" }}>
          θ
        </text>
        {/* gauge */}
        <g transform="translate(205,70)">
          <circle r="34" fill="none" stroke="hsl(var(--muted))" strokeWidth="9" />
          <circle
            r="34"
            fill="none"
            stroke="hsl(var(--risk-medium))"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray="213.6"
            strokeDashoffset="122"
            transform="rotate(-90)"
          />
          <text x="0" y="6" textAnchor="middle" className="fill-foreground" style={{ fontSize: 22, fontWeight: 600 }}>
            3
          </text>
        </g>
        <text x="205" y="128" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11 }}>
          RULA
        </text>
      </svg>
    </div>
  );
}

function Step({ icon, n, title, children }: { icon: React.ReactNode; n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-secondary-foreground">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step {n}</span>
      </div>
      <h3 className="mt-3 font-medium">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function MethodCard({ name, full, scale, body }: { name: string; full: string; scale: string; body: string }) {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-semibold">{name}</h3>
        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">{scale}</span>
      </div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{full}</p>
      <p className="mt-3 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</span>
      <h3 className="mt-3 font-medium">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
