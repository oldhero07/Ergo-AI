import { useEffect, useRef, useState } from "react";
import { Camera, Video, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { gsap } from "@/hooks/useScrollMotion";
import type { AnalysisMode } from "@/types";

/**
 * Cinematic light hero: a full-bleed photograph (or, when present, a muted
 * looping clip at `public/hero/hero-loop.mp4`) washed toward the background
 * color so the display type stays readable, one message, one primary CTA.
 * The media layer is decorative - all information lives in the text.
 */
export function Hero({ onStart }: { onStart: (mode: AnalysisMode) => void }) {
  const rootRef = useRef<HTMLElement>(null);
  const base = import.meta.env.BASE_URL;

  // Entrance choreography (load-time, not scroll): eyebrow -> headline -> sub -> CTA.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(root.querySelectorAll("[data-hero-seq]"), {
        opacity: 0,
        y: 18,
        duration: 0.65,
        ease: "power2.out",
        stagger: 0.09,
        delay: 0.1,
      });
    });
    return () => mm.revert();
  }, []);

  return (
    <section ref={rootRef} className="relative overflow-hidden border-b">
      {/* Media layer (decorative) */}
      <div className="absolute inset-0" aria-hidden>
        <HeroMedia base={base} />
        {/* Readability washes - light theme: wash toward the page background */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/25" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background to-transparent" />
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-background/80 to-transparent" />
      </div>

      <div className="relative mx-auto flex min-h-[82svh] max-w-6xl flex-col justify-center px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <div data-hero-seq>
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Processed in memory · never stored
            </span>
          </div>

          <h1
            data-hero-seq
            className="mt-6 text-balance text-5xl font-semibold leading-[1.04] tracking-tighter sm:text-6xl lg:text-7xl"
          >
            Posture risk,
            <br />
            scored in seconds.
          </h1>

          <p data-hero-seq className="mt-6 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
            Upload a photo of a working posture. Research-grade AI reads 133 body keypoints and returns a
            defensible <strong className="font-semibold text-foreground">RULA</strong> or{" "}
            <strong className="font-semibold text-foreground">REBA</strong> score - with a report you can hand
            to management. Free, private, no sign-up.
          </p>

          <div data-hero-seq className="mt-8 flex flex-wrap items-center gap-4">
            <Button size="lg" className="h-12 gap-2 px-6 text-base shadow-card" onClick={() => onStart("photo")}>
              <Camera className="h-5 w-5" /> Analyze a photo
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="h-12 gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => onStart("video")}
            >
              <Video className="h-4 w-4" /> or analyze a short video
            </Button>
          </div>
          <p data-hero-seq className="mt-3 text-xs text-muted-foreground">
            JPG or PNG · MP4, MOV, WebM · batch up to 30 photos
          </p>
        </div>

        {/* Trust strip - the standards this tool stands on */}
        <div
          data-hero-seq
          className="mt-16 flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground"
        >
          <span>RULA · McAtamney &amp; Corlett 1993</span>
          <span className="hidden text-border sm:inline">|</span>
          <span>REBA · Hignett &amp; McAtamney 2000</span>
          <span className="hidden text-border sm:inline">|</span>
          <span>NERPA · ISO 11226</span>
          <span className="hidden text-border sm:inline">|</span>
          <span>Photos never stored</span>
        </div>
      </div>
    </section>
  );
}

/** Poster photograph with an optional video loop that fades in over it when
 * (and only when) a `hero/hero-loop.mp4` asset exists and motion is allowed. */
function HeroMedia({ base }: { base: string }) {
  const [videoOk, setVideoOk] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [reducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  return (
    <>
      <img
        src={`${base}samples/warehouse-lifting.jpg`}
        alt=""
        width={1024}
        height={1024}
        className="h-full w-full object-cover object-[72%_center]"
        loading="eager"
        decoding="async"
      />
      {videoOk && !reducedMotion && (
        <video
          className={
            "absolute inset-0 h-full w-full object-cover object-[72%_center] transition-opacity duration-700 " +
            (playing ? "opacity-100" : "opacity-0")
          }
          src={`${base}hero/hero-loop.mp4`}
          autoPlay
          muted
          loop
          playsInline
          onCanPlay={() => setPlaying(true)}
          onError={() => setVideoOk(false)}
        />
      )}
    </>
  );
}
