import { useEffect, useRef, useState } from "react";
import { Activity, ArrowDown, CheckCircle2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { gsap, ScrollTrigger } from "@/hooks/useScrollMotion";
import { KP } from "@/lib/angles2d";
import { RISK_PILL, RISK_TEXT } from "@/lib/risk";
import { REVEAL_IMG, REVEAL_KEYPOINTS } from "@/components/landing/revealPose";
import { REVEAL_ANALYSIS } from "@/components/landing/revealAnalysis";

const BENEFITS = [
  "Find high-risk postures before strain accumulates.",
  "Make ergonomic reviews consistent across teams.",
  "Turn evidence into a clear action plan.",
] as const;

/**
 * The finale: the skeleton emerges from the translucent body, then the product
 * takes over - keypoints, bones, measured angles, and the RULA score, drawn by
 * the same pipeline that scores real uploads. Ends by pointing into the report.
 */
export function ScoreReveal() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const [videoOk, setVideoOk] = useState(true);
  const [wantsVideo] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)").matches,
  );
  const base = import.meta.env.BASE_URL;
  const { angles, assessment } = REVEAL_ANALYSIS;

  useEffect(() => {
    const section = sectionRef.current;
    const video = videoRef.current;
    if (!section || !video || !videoOk || !wantsVideo) return;
    const mm = gsap.matchMedia();

    mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(section);
      const scrubVideo = { t: 0 };
      const counter = { value: 0 };
      const scoreEl = scoreRef.current;
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        // Slightly longer than MsdStory (more stages), same responsive scrub.
        scrollTrigger: { trigger: section, start: "top top", end: "+=260%", scrub: 0.35, pin: true },
      });

      tl.to(scrubVideo, {
        t: 1,
        duration: 0.34,
        onUpdate: () => {
          if (video.duration) video.currentTime = scrubVideo.t * Math.max(video.duration - 0.05, 0);
        },
      });
      tl.to(q("[data-figure]"), { xPercent: -7, scale: 0.92, duration: 0.14 }, "<+0.2");
      tl.from(q("[data-kp]"), { attr: { r: 0 }, opacity: 0, stagger: 0.008, duration: 0.08 }, ">-0.03");
      tl.from(q("[data-bone]"), { strokeDashoffset: 1, stagger: 0.014, duration: 0.1 }, "<");
      tl.from(q("[data-angle]"), { opacity: 0, y: 12, stagger: 0.04, duration: 0.1 }, "+=0.02");
      tl.from(q("[data-analysis]"), { opacity: 0, x: 44, duration: 0.16 }, "<");
      tl.fromTo(
        counter,
        { value: 0 },
        {
          value: assessment.grandScore,
          duration: 0.1,
          onUpdate: () => {
            if (scoreEl) scoreEl.textContent = String(Math.round(counter.value));
          },
        },
        "<+0.06",
      );
      tl.from(q("[data-handoff]"), { opacity: 0, y: 10, duration: 0.08 }, ">+0.02");
      tl.to({}, { duration: 0.1 });

      const refresh = () => ScrollTrigger.refresh();
      video.addEventListener("loadedmetadata", refresh);
      return () => video.removeEventListener("loadedmetadata", refresh);
    });
    return () => mm.revert();
  }, [assessment.grandScore, videoOk, wantsVideo]);

  const point = (index: number) => ({ x: REVEAL_KEYPOINTS[index][0], y: REVEAL_KEYPOINTS[index][1] });
  const bones: [number, number][] = [[KP.leftEar, KP.leftShoulder], [KP.leftShoulder, KP.leftElbow], [KP.leftElbow, KP.leftWrist], [KP.leftShoulder, KP.leftHip], [KP.leftHip, KP.leftKnee], [KP.leftKnee, KP.leftAnkle]];
  const points = [KP.nose, KP.leftEar, KP.leftShoulder, KP.leftElbow, KP.leftWrist, KP.leftHip, KP.leftKnee, KP.leftAnkle];
  const staticMode = !wantsVideo || !videoOk;

  return (
    <section ref={sectionRef} className="relative isolate overflow-hidden border-b bg-background">
      <div className="mx-auto grid min-h-svh max-w-7xl items-center gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:py-0">
        <figure data-figure className="relative w-full">
          <div className="relative aspect-video overflow-hidden">
            {wantsVideo && videoOk && (
              <video ref={videoRef} className="absolute inset-0 h-full w-full mix-blend-multiply" src={`${base}hero/v3-scrub.mp4`} poster={`${base}hero/v3-poster.jpg`} muted playsInline preload="auto" aria-hidden onError={() => setVideoOk(false)} />
            )}
            {staticMode && <img src={`${base}hero/v3-end.jpg`} alt="" width={1280} height={720} className="absolute inset-0 h-full w-full mix-blend-multiply" loading="lazy" />}
            <svg viewBox={`0 0 ${REVEAL_IMG.w} ${REVEAL_IMG.h}`} className="absolute inset-0 h-full w-full" role="img" aria-label={`Pose analysis: RULA score ${assessment.grandScore}, ${assessment.riskLabel}`}>
              <g stroke="hsl(var(--primary))" strokeWidth="6" strokeLinecap="round">
                {bones.map(([a, b]) => <line key={`${a}-${b}`} data-bone x1={point(a).x} y1={point(a).y} x2={point(b).x} y2={point(b).y} pathLength={1} strokeDasharray={1} />)}
              </g>
              <g fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth="3">
                {points.map((index) => <circle key={index} data-kp cx={point(index).x} cy={point(index).y} r={10} />)}
              </g>
              <g data-angle><AngleChip x={point(KP.leftHip).x + 40} y={point(KP.leftHip).y - 175} label={`trunk ${Math.round(angles.trunk)}°`} tone="veryhigh" /></g>
              <g data-angle><AngleChip x={point(KP.leftElbow).x - 410} y={point(KP.leftElbow).y + 42} label={`elbow ${Math.round(angles.lowerArm)}°`} tone="medium" /></g>
              <g data-angle><AngleChip x={point(KP.nose).x - 330} y={point(KP.nose).y - 185} label={`neck ${Math.round(angles.neck)}°`} tone="low" /></g>
            </svg>
          </div>
          <figcaption className="mt-3 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Live pose, angle, and score output</figcaption>
        </figure>

        <aside data-analysis className="max-w-md lg:justify-self-end">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">The analysis</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">From skeleton to score.</h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">The same figure becomes a defensible assessment: pose landmarks, measured angles, a RULA score, and the next action.</p>
          <div className="mt-7 flex items-center gap-4 rounded-xl border bg-card p-4 shadow-card">
            <span ref={scoreRef} className={cn("tabular-readout text-5xl font-semibold", RISK_TEXT[assessment.riskBand])}>{assessment.grandScore}</span>
            <div>
              <span className={cn("inline-flex rounded-md px-2 py-0.5 text-sm font-semibold", RISK_PILL[assessment.riskBand])}>{assessment.riskLabel}</span>
              <p className="mt-1 text-xs text-muted-foreground">RULA grand score · {assessment.maxScore} point scale</p>
            </div>
          </div>
          <ul className="mt-7 space-y-3 text-sm text-muted-foreground">
            {BENEFITS.map((benefit) => <li key={benefit} className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />{benefit}</li>)}
          </ul>
          <div className="mt-8 flex items-center gap-2 border-t pt-5 text-xs text-muted-foreground"><Activity className="h-4 w-4 text-primary" />133 keypoints · deterministic scoring <ShieldCheck className="ml-2 h-4 w-4 text-primary" /></div>
          <p data-handoff className="mt-6 flex items-center gap-2 text-sm font-medium text-primary">
            <ArrowDown className="h-4 w-4" aria-hidden /> Every score becomes a report — keep scrolling.
          </p>
        </aside>
      </div>
    </section>
  );
}

function AngleChip({ x, y, label, tone }: { x: number; y: number; label: string; tone: "low" | "medium" | "high" | "veryhigh" }) {
  const width = 56 + label.length * 18;
  return <g><rect x={x} y={y} width={width} height={56} rx={13} fill="hsl(var(--card))" fillOpacity="0.94" stroke={`hsl(var(--risk-${tone}))`} strokeWidth="2.5" /><circle cx={x + 28} cy={y + 28} r={7.5} fill={`hsl(var(--risk-${tone}))`} /><text x={x + 47} y={y + 38} fontFamily="'JetBrains Mono Variable', monospace" fontSize="30" fontWeight="700" fill="hsl(var(--foreground))">{label}</text></g>;
}
