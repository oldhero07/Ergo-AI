import { Camera, ScanLine, Gauge, ShieldCheck, ArrowRight, Cpu, FileText } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

/**
 * Presentational landing page shown before the tool. Stores nothing — no DB, no
 * cache, no persistence — it just explains what Ergo AI does and hands off to the
 * photo-analysis flow via `onStart`. Keeps the privacy-first promise intact.
 */
export function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div className="animate-in fade-in duration-500">
      {/* Hero */}
      <section className="mx-auto max-w-3xl px-2 pt-8 pb-14 text-center sm:pt-14">
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> Runs in your browser · nothing is uploaded
        </span>
        <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Ergonomic risk scoring from a single photo
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
          Ergo AI estimates <strong className="font-medium text-foreground">RULA</strong> and{" "}
          <strong className="font-medium text-foreground">REBA</strong> posture-risk scores from a photo using
          on-device pose detection — then builds a professional PDF report. Free, private, no sign-up.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" onClick={onStart} className="gap-2">
            <Camera className="h-4 w-4" /> Analyze a photo <ArrowRight className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">JPG, PNG, or iPhone HEIC · video analysis coming soon</span>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t py-12">
        <div className="mx-auto max-w-4xl px-2">
          <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            How it works
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <Step icon={<Camera className="h-5 w-5" />} n="1" title="Upload a photo">
              A clear side view of the working posture. Everything stays on your device.
            </Step>
            <Step icon={<ScanLine className="h-5 w-5" />} n="2" title="AI finds the pose">
              Google’s MediaPipe Pose locates 33 body landmarks and derives the joint angles.
            </Step>
            <Step icon={<Gauge className="h-5 w-5" />} n="3" title="Get a score + report">
              A RULA or REBA grand score with a per-joint breakdown and an exportable PDF.
            </Step>
          </div>
        </div>
      </section>

      {/* Methods */}
      <section className="border-t py-12">
        <div className="mx-auto grid max-w-4xl gap-5 px-2 sm:grid-cols-2">
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
      <section className="border-t py-12">
        <div className="mx-auto grid max-w-4xl gap-6 px-2 sm:grid-cols-3">
          <Feature icon={<ShieldCheck className="h-5 w-5" />} title="Private by design">
            Photos are decoded and scored in your browser. Nothing is sent to a server.
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
      <section className="border-t py-14">
        <div className="mx-auto max-w-2xl px-2 text-center">
          <Logo className="mx-auto h-10 w-10" />
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">Ready to assess a posture?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Upload one photo or a batch — get RULA and REBA scores in seconds.
          </p>
          <Button size="lg" onClick={onStart} className="mt-6 gap-2">
            <Camera className="h-4 w-4" /> Analyze a photo <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="mt-4 text-xs text-muted-foreground">
            Scores are a lower-bound 2D estimate, not a substitute for a trained assessor.
          </p>
        </div>
      </section>
    </div>
  );
}

function Step({ icon, n, title, children }: { icon: React.ReactNode; n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-secondary-foreground">{icon}</span>
        <span className="text-xs font-semibold text-muted-foreground">Step {n}</span>
      </div>
      <h3 className="mt-3 font-medium">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function MethodCard({ name, full, scale, body }: { name: string; full: string; scale: string; body: string }) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-semibold">{name}</h3>
        <span className="text-xs font-medium text-muted-foreground">{scale}</span>
      </div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{full}</p>
      <p className="mt-3 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-secondary-foreground">{icon}</span>
      <h3 className="mt-3 font-medium">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
