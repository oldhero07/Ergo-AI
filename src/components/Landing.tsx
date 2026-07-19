import { useRef } from "react";
import { Camera, FileText, ShieldCheck, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hero } from "@/components/landing/Hero";
import { CaptureGuidelines } from "@/components/landing/CaptureGuidelines";
import { MsdStory } from "@/components/landing/MsdStory";
import { ScoreReveal } from "@/components/landing/ScoreReveal";
import { ReportShowcase } from "@/components/landing/ReportShowcase";
import { useScrollReveal } from "@/hooks/useScrollMotion";
import type { AnalysisMode } from "@/types";

const TRUST = ["RULA", "REBA", "NIOSH lifting", "Photos never stored", "Research-grade analysis"];

/**
 * The narrative: meet the product, learn the one photo it needs, see why the
 * risk matters, watch the figure become a score, then hold the report.
 */
export function Landing({ onStart }: { onStart: (mode: AnalysisMode) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useScrollReveal(rootRef);

  return (
    <div ref={rootRef}>
      <Hero onStart={onStart} />

      <CaptureGuidelines />

      <MsdStory />

      <ScoreReveal />

      <section className="border-b bg-muted/45">
        <div data-reveal-stagger className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-7 gap-y-3 px-4 py-6 sm:px-6">
          {TRUST.map((item) => (
            <span key={item} className="flex items-center gap-2 text-xs font-medium text-muted-foreground sm:text-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
              {item}
            </span>
          ))}
        </div>
      </section>

      <ReportShowcase />

      <section className="border-t bg-muted/45 py-20 sm:py-28">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <div data-reveal>
            <ShieldCheck className="mx-auto h-8 w-8 text-primary" aria-hidden />
            <h2 className="mt-5 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Ready to assess a posture?</h2>
            <p className="mx-auto mt-3 max-w-lg text-pretty text-base text-muted-foreground">
              Upload a photo or short video. Get a defensible ergonomic score and a report built to share.
            </p>
          </div>
          <div data-reveal-stagger className="mx-auto mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
            <Button size="lg" className="h-12 gap-2" onClick={() => onStart("photo")}>
              <Camera className="h-4 w-4" /> Analyze a photo
            </Button>
            <Button size="lg" variant="outline" className="h-12 gap-2" onClick={() => onStart("video")}>
              <Video className="h-4 w-4" /> Analyze a video
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="h-12 gap-2"
              onClick={() => document.getElementById("report-preview")?.scrollIntoView({ behavior: "smooth" })}
            >
              <FileText className="h-4 w-4" /> Open report
            </Button>
          </div>
          <p data-reveal className="mt-6 text-xs text-muted-foreground">
            Scores are a lower-bound estimate from a single camera view, not a substitute for a trained assessor.
          </p>
        </div>
      </section>
    </div>
  );
}
