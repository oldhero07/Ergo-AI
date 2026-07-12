import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { gsap, ScrollTrigger } from "@/hooks/useScrollMotion";
import {
  DEMO_KP,
  DEMO_MEASURED,
  OFF_BONES,
  OFF_POINTS,
  POSE_IMG,
  SCORED_BONES,
  SCORED_POINTS,
} from "@/components/landing/heroPose";

const STEPS = [
  {
    title: "Detect",
    body: "A person detector isolates the subject; RTMPose-wholebody locates 133 body and hand keypoints.",
  },
  {
    title: "Measure",
    body: "Joint angles are derived in the side-view plane - upper arm, forearm, wrist, neck, trunk, knee.",
  },
  {
    title: "Score",
    body: "The published RULA tables turn those angles into a grand score with an action level.",
  },
] as const;

/**
 * The landing centerpiece: the product's real output, animated over the real
 * photo. On desktop (with motion allowed) the section pins and scroll scrubs
 * through detect -> measure -> score; on mobile or reduced-motion the fully
 * annotated state simply renders. Keypoints, angles, and the score are genuine
 * analysis output for this photo (see heroPose.ts) - nothing is invented.
 */
export function LiveAnalysisDemo() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeStep, setActiveStep] = useState(2); // static/final state shows all steps done
  const scoreRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const mm = gsap.matchMedia();

    mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(section);
      setActiveStep(0);

      const counter = { v: 0 };
      const scoreEl = scoreRef.current;

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "+=150%",
          scrub: 0.7,
          pin: true,
          onUpdate: (self) => {
            const step = self.progress < 0.34 ? 0 : self.progress < 0.62 ? 1 : 2;
            setActiveStep((prev) => (prev === step ? prev : step));
          },
        },
        defaults: { ease: "none" },
      });

      // Phase 1 - detect: keypoints pop in, bones draw.
      tl.from(q("[data-kp]"), { attr: { r: 0 }, opacity: 0, stagger: 0.012, duration: 0.16 });
      tl.from(q("[data-bone-scored]"), { strokeDashoffset: 1, stagger: 0.03, duration: 0.22 }, "-=0.04");
      tl.from(q("[data-bone-off]"), { opacity: 0, duration: 0.1 }, "<+0.1");
      // Phase 2 - measure: angle annotations rise in.
      tl.from(q("[data-angle]"), { opacity: 0, y: 14, stagger: 0.07, duration: 0.2 }, "+=0.06");
      // Phase 3 - score: the number counts up, band chip appears.
      tl.fromTo(
        counter,
        { v: 0 },
        {
          v: DEMO_MEASURED.grandScore,
          duration: 0.3,
          onUpdate: () => {
            if (scoreEl) scoreEl.textContent = String(Math.round(counter.v));
          },
        },
        "+=0.05",
      );
      tl.from(q("[data-band-chip]"), { opacity: 0, scale: 0.9, transformOrigin: "left center", duration: 0.12 }, "-=0.08");

      return () => setActiveStep(2);
    });

    mm.add("(max-width: 1023px) and (prefers-reduced-motion: no-preference)", () => {
      // No pin on mobile - just a gentle single reveal of the annotated figure.
      gsap.from(section.querySelector("[data-demo-figure]"), {
        opacity: 0,
        y: 20,
        duration: 0.55,
        ease: "power2.out",
        scrollTrigger: { trigger: section, start: "top 75%", toggleActions: "play none none reverse" },
      });
    });

    return () => mm.revert();
  }, []);

  const kp = DEMO_KP;
  const m = DEMO_MEASURED;

  return (
    <section ref={sectionRef} className="border-t bg-muted/40">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:py-0">
        {/* Narrative column */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">Watch it work</h2>
          <p className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            From photograph to defensible score
          </p>

          <ol className="mt-8 space-y-5">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className={cn(
                  "flex gap-4 border-l-2 pl-4 transition-colors duration-300",
                  i <= activeStep ? "border-primary" : "border-border",
                )}
              >
                <div>
                  <div
                    className={cn(
                      "font-mono text-[11px] font-bold uppercase tracking-widest transition-colors duration-300",
                      i <= activeStep ? "text-primary" : "text-muted-foreground/60",
                    )}
                  >
                    Step {i + 1} · {step.title}
                  </div>
                  <p
                    className={cn(
                      "mt-1 text-sm leading-relaxed transition-colors duration-300",
                      i <= activeStep ? "text-muted-foreground" : "text-muted-foreground/50",
                    )}
                  >
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {/* Score readout */}
          <div className="mt-8 flex items-center gap-5 rounded-xl border bg-card p-5 shadow-card">
            <div className="flex items-baseline gap-1">
              <span ref={scoreRef} className="tabular-readout text-5xl font-bold tracking-tight">
                {m.grandScore}
              </span>
              <span className="tabular-readout text-lg text-muted-foreground">/ {m.maxScore}</span>
            </div>
            <div>
              <span
                data-band-chip
                className="inline-block rounded-md bg-risk-high/15 px-2 py-0.5 text-sm font-bold text-risk-high"
              >
                {m.riskLabel}
              </span>
              <p className="mt-1 text-xs text-muted-foreground">RULA grand score - measured from this photo</p>
            </div>
          </div>
        </div>

        {/* Annotated figure */}
        <figure data-demo-figure className="relative overflow-hidden rounded-2xl border shadow-card-hover">
          <img
            src={`${import.meta.env.BASE_URL}samples/warehouse-lifting.jpg`}
            alt="Side view of a worker lifting a box from a pallet"
            width={POSE_IMG.w}
            height={POSE_IMG.h}
            className="block w-full"
            loading="lazy"
            decoding="async"
            onLoad={() => ScrollTrigger.refresh()}
          />
          <svg
            viewBox={`0 0 ${POSE_IMG.w} ${POSE_IMG.h}`}
            className="absolute inset-0 h-full w-full"
            role="img"
            aria-label={`Detected pose skeleton with measured angles: trunk ${m.trunk} degrees, upper arm ${m.upperArm} degrees, neck ${m.neck} degrees`}
          >
            {/* Far-side bones (depth) */}
            <g data-bone-off stroke="hsl(var(--primary))" strokeOpacity="0.35" strokeWidth="5" strokeLinecap="round">
              {OFF_BONES.map(([a, b]) => (
                <line key={`${a}-${b}`} x1={kp[a].x} y1={kp[a].y} x2={kp[b].x} y2={kp[b].y} />
              ))}
            </g>
            {/* Scored-side bones, drawn on */}
            <g stroke="hsl(var(--primary))" strokeWidth="7" strokeLinecap="round">
              {SCORED_BONES.map(([a, b]) => (
                <line
                  key={`${a}-${b}`}
                  data-bone-scored
                  x1={kp[a].x}
                  y1={kp[a].y}
                  x2={kp[b].x}
                  y2={kp[b].y}
                  pathLength={1}
                  strokeDasharray={1}
                />
              ))}
            </g>
            {/* Keypoints */}
            <g fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth="3">
              {SCORED_POINTS.map((n) => (
                <circle key={n} data-kp cx={kp[n].x} cy={kp[n].y} r={11} />
              ))}
              {OFF_POINTS.map((n) => (
                <circle key={n} data-kp cx={kp[n].x} cy={kp[n].y} r={8} fillOpacity={0.5} />
              ))}
            </g>

            {/* Trunk angle: vertical reference + arc + chip */}
            <g data-angle>
              <line
                x1={kp.leftHip.x}
                y1={kp.leftHip.y}
                x2={kp.leftHip.x}
                y2={kp.leftHip.y - 170}
                stroke="hsl(var(--risk-high))"
                strokeWidth="4"
                strokeDasharray="10 10"
                opacity="0.8"
              />
              <path
                d={`M ${kp.leftHip.x} ${kp.leftHip.y - 95} A 95 95 0 0 0 ${kp.leftHip.x - 62} ${kp.leftHip.y - 71}`}
                fill="none"
                stroke="hsl(var(--risk-high))"
                strokeWidth="5"
              />
              <AngleChip x={kp.leftHip.x - 55} y={kp.leftHip.y - 160} label={`trunk ${m.trunk}°`} tone="high" />
            </g>
            <g data-angle>
              <AngleChip x={kp.leftElbow.x + 34} y={kp.leftElbow.y - 44} label={`upper arm ${m.upperArm}°`} tone="medium" />
            </g>
            <g data-angle>
              <AngleChip x={kp.nose.x - 250} y={kp.nose.y - 60} label={`neck ${m.neck}°`} tone="veryhigh" />
            </g>
          </svg>
          <figcaption className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-gradient-to-t from-black/55 to-transparent px-5 pb-3.5 pt-8 font-mono text-[11px] uppercase tracking-wider text-white/95">
            <span>warehouse-lifting.jpg</span>
            <span>133 keypoints · side view</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

/** Small annotation chip drawn in image-pixel space inside the demo SVG.
 * Width budgets ~17.5px per character for JetBrains Mono at 28px. */
function AngleChip({ x, y, label, tone }: { x: number; y: number; label: string; tone: "medium" | "high" | "veryhigh" }) {
  const w = 52 + label.length * 17.5;
  return (
    <g>
      <rect x={x} y={y} width={w} height={52} rx={12} fill="hsl(var(--card))" fillOpacity="0.94" stroke={`hsl(var(--risk-${tone}))`} strokeWidth="2.5" />
      <circle cx={x + 26} cy={y + 26} r={7} fill={`hsl(var(--risk-${tone}))`} />
      <text x={x + 44} y={y + 36} fontFamily="'JetBrains Mono Variable', monospace" fontSize="28" fontWeight="700" fill="hsl(var(--foreground))">
        {label}
      </text>
    </g>
  );
}
