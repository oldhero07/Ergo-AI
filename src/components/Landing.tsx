import { Camera, Video, ScanLine, Gauge, ShieldCheck, ArrowRight, Cpu, FileText } from "lucide-react";
import { Logo } from "@/components/Logo";
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
            <span className="glass glow-ring inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Runs in your browser · nothing is uploaded
            </span>
            <h1 className="mt-6 text-balance bg-gradient-to-r from-primary via-foreground to-foreground bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl">
              Lab-grade posture risk analysis, in your browser
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg lg:mx-0">
              Get <strong className="font-semibold text-foreground">RULA</strong> and{" "}
              <strong className="font-semibold text-foreground">REBA</strong> posture-risk scores from a photo or a
              short video - with a professional PDF report. Free, private, no sign-up.
            </p>

            {/* HUD stat chips */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              <HudChip>33 landmarks · 3D</HudChip>
              <HudChip>RULA · REBA</HudChip>
              <HudChip>100% on-device</HudChip>
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
            <p className="mt-3 text-xs text-muted-foreground">JPG, PNG, iPhone HEIC · MP4, MOV, WebM</p>
          </div>
          <div id="hero-visual-slot" className="hidden lg:block">
            <HeroVisual />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative overflow-hidden border-t py-14 grid-bg">
        <div
          className="motion-safe:animate-scanline pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary/0 via-primary/60 to-primary/0"
          aria-hidden="true"
        />
        <div className="mx-auto max-w-4xl px-2">
          <h2 className="text-center font-mono text-sm font-semibold uppercase tracking-widest text-primary">
            How it works
          </h2>
          <div className="mt-8 relative">
            {/* Connector line between steps */}
            <div className="absolute top-[28px] left-[calc(16.66%+0px)] right-[calc(16.66%+0px)] hidden h-px bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20 sm:block" />
            <div className="grid gap-4 sm:grid-cols-3">
              <Step icon={<Camera className="h-5 w-5" />} n="1" title="Upload">
                A clear side view of the working posture - photo or short clip. Everything stays on your device.
              </Step>
              <Step icon={<ScanLine className="h-5 w-5" />} n="2" title="AI reads the pose">
                On-device AI (Google MediaPipe Pose) locates 33 body landmarks and derives the joint angles.
              </Step>
              <Step icon={<Gauge className="h-5 w-5" />} n="3" title="Score + report">
                A RULA or REBA grand score with a per-joint breakdown and an exportable PDF.
              </Step>
            </div>
          </div>
        </div>
      </section>

      {/* Methods */}
      <section className="border-t py-14">
        <div className="mx-auto grid max-w-4xl gap-4 px-2 sm:grid-cols-2">
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
      </section>

      {/* Why / privacy */}
      <section className="border-t py-14 grid-bg">
        <div className="mx-auto grid max-w-4xl gap-6 px-2 sm:grid-cols-3">
          <Feature icon={<ShieldCheck className="h-5 w-5" />} title="Private by design">
            Photos and videos are decoded and scored in your browser. Nothing is sent to a server.
          </Feature>
          <Feature icon={<Cpu className="h-5 w-5" />} title="Works offline">
            After the first load the pose model is cached, so it keeps working without a connection.
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

function HudChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="hud-readout glass inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
      {children}
    </span>
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
        "group glass flex items-center gap-3 rounded-2xl p-4 text-left transition-all hover:-translate-y-1 hover:shadow-glow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
        (primary ? "border-primary/40 bg-primary/5" : "")
      }
    >
      <span
        className={
          "grid h-11 w-11 shrink-0 place-items-center rounded-xl " +
          (primary ? "bg-primary text-primary-foreground shadow-glow-sm" : "bg-secondary text-secondary-foreground")
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

/** A static, token-colored product motif: an annotated pose skeleton with an angle arc and a RULA gauge. */
function HeroVisual() {
  return (
    <div className="glass mx-auto w-full max-w-sm rounded-3xl p-6 shadow-glow relative overflow-hidden">
      {/* Decorative ambient background blur lights - token colors only */}
      <div className="absolute -left-20 -top-20 h-40 w-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute -right-20 -bottom-20 h-40 w-40 rounded-full bg-accent/20 blur-3xl pointer-events-none" />

      <svg viewBox="0 0 260 250" className="w-full relative z-10" role="img" aria-label="Pose skeleton with angle and risk score">
        <defs>
          {/* Diagnostic UI grid */}
          <pattern id="hero-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="0.75" fill="currentColor" opacity="0.1" />
          </pattern>
          {/* Soft neon glow */}
          <filter id="hero-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ambient Grid */}
        <rect width="260" height="250" fill="url(#hero-grid)" className="text-muted-foreground" />

        {/* HUD corner brackets */}
        <path d="M 10 24 L 10 10 L 24 10" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.5" />
        <path d="M 236 10 L 250 10 L 250 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.5" />
        <path d="M 250 226 L 250 240 L 236 240" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.5" />
        <path d="M 24 240 L 10 240 L 10 226" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.5" />

        {/* Diagnostic HUD Overlay */}
        <g fill="currentColor" opacity="0.7">
          <rect x={10} y={32} width={6} height={6} rx={1} fill="hsl(var(--primary))" />
          <text x={22} y={38} className="font-mono fill-foreground" style={{ fontSize: 8, letterSpacing: "0.05em", fontWeight: 600 }}>
            POSE ENGINE: ACTIVE
          </text>
          <text x={10} y={52} className="font-mono fill-muted-foreground" style={{ fontSize: 7 }}>
            33 LANDMARKS / CONF: 98.4%
          </text>
        </g>

        {/* Main Biomechanical Model */}
        <g>
          {/* Skeleton Bones */}
          <g stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.85" filter="url(#hero-glow)">
            <path d="M120 44 L104 86" />
            <path d="M104 86 L138 120" />
            <path d="M138 120 L128 160" />
            <path d="M104 86 L98 176" />
            <path d="M98 176 L110 214" />
          </g>

          {/* Joint Nodes */}
          <g fill="hsl(var(--primary))" filter="url(#hero-glow)">
            <circle cx="120" cy="44" r="3.5" fill="hsl(var(--background))" />
            <circle cx="120" cy="44" r="8" fill="hsl(var(--primary))" fillOpacity={0.15} stroke="hsl(var(--primary))" strokeWidth={1} />
            <circle cx="104" cy="86" r="5" />
            <circle cx="138" cy="120" r="5" />
            <circle cx="128" cy="160" r="5" />
            <circle cx="98" cy="176" r="5" />
            <circle cx="110" cy="214" r="5" />
          </g>

          {/* Measured Angle Highlight - Concentric Angle Arc around Elbow Joint (138, 120) */}
          <path d="M 124 106 A 20 20 0 0 0 133 139" stroke="hsl(var(--risk-high))" strokeWidth="2" fill="none" filter="url(#hero-glow)" />

          <rect x={128} y={94} width={42} height={16} rx={4} fill="hsl(var(--risk-high))" fillOpacity={0.15} />
          <text x={132} y={106} className="fill-foreground font-mono" style={{ fontSize: 9, fontWeight: 700 }}>
            θ = 42.6°
          </text>
        </g>

        {/* HUD Gauge Panel */}
        <g transform="translate(208,80)">
          {/* Gauge Background ring */}
          <circle r="32" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
          {/* Gauge Active Ring */}
          <circle
            r="32"
            fill="none"
            stroke="hsl(var(--risk-medium))"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="201"
            strokeDashoffset="130"
            transform="rotate(-90)"
            filter="url(#hero-glow)"
          />
          {/* Inner glass overlay */}
          <circle r="26" fill="currentColor" fillOpacity={0.03} className="text-foreground" />
          {/* Score Text */}
          <text x="0" y="7" textAnchor="middle" className="fill-foreground font-mono" style={{ fontSize: 22, fontWeight: 800 }}>
            3
          </text>
        </g>
        <text x="208" y="138" textAnchor="middle" className="fill-muted-foreground font-mono font-medium" style={{ fontSize: 10, letterSpacing: "0.05em" }}>
          RULA SCORE
        </text>

        {/* Biomechanical key lines */}
        <path d="M 198 20 L 238 20 L 238 40" fill="none" stroke="currentColor" className="text-muted-foreground" strokeWidth="0.5" opacity="0.3" />
        <path d="M 20 230 L 20 200 L 40 200" fill="none" stroke="currentColor" className="text-muted-foreground" strokeWidth="0.5" opacity="0.3" />
      </svg>
    </div>
  );
}

function Step({ icon, n, title, children }: { icon: React.ReactNode; n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="group glass relative rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-glow-sm">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary/30 to-primary/5 text-primary ring-1 ring-primary/25 transition-all group-hover:from-primary/40 group-hover:to-primary/10">
          {icon}
        </span>
        <span className="hud-readout inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-primary">
          Step {n}
        </span>
      </div>
      <h3 className="mt-3 font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{children}</p>
      {/* Subtle bottom accent line on hover */}
      <span className="absolute bottom-0 left-6 right-6 h-0.5 scale-x-0 rounded-full bg-gradient-to-r from-primary/0 via-primary to-primary/0 transition-transform duration-300 group-hover:scale-x-100" />
    </div>
  );
}

function MethodCard({ name, full, scale, body }: { name: string; full: string; scale: string; body: string }) {
  return (
    <div className="group glass rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-glow-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xl font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">{name}</h3>
        <span className="hud-readout rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-primary ring-1 ring-primary/20">
          {scale}
        </span>
      </div>
      <p className="mt-0.5 font-mono text-[11px] uppercase tracking-widest text-primary">{full}</p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="group glass rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-glow-sm">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary/25 to-accent/20 text-primary ring-1 ring-primary/15 transition-all group-hover:from-primary/35 group-hover:to-accent/30">
        {icon}
      </span>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
