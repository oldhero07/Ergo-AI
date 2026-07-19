import { useEffect, useRef, useState } from "react";
import { Camera, Maximize2, RotateCw, Sun } from "lucide-react";

const RULES = [
  {
    icon: RotateCw,
    name: "Shoot from the side",
    copy: "Stand 90° to the person — a true profile. RULA and REBA read the sagittal plane, so the side view is the one the AI measures best.",
  },
  {
    icon: Maximize2,
    name: "Whole body in frame",
    copy: "Head to feet, nothing cropped. Every joint the score needs has to be visible.",
  },
  {
    icon: Camera,
    name: "Camera level, waist height",
    copy: "Hold the camera steady around waist height, not tilted up or down — tilt distorts the measured angles.",
  },
  {
    icon: Sun,
    name: "Catch the real task",
    copy: "Photograph the working posture mid-task, in even light. A posed stance scores the pose, not the job.",
  },
] as const;

/**
 * The rotating figure demonstrates the one instruction that matters most:
 * circle the subject until you see a clean profile. The clip ping-pongs
 * (forward then reverse) because the raw rotation doesn't loop seamlessly.
 */
export function CaptureGuidelines() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoOk, setVideoOk] = useState(true);
  const [wantsVideo] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: no-preference)").matches,
  );
  const base = import.meta.env.BASE_URL;

  // Autoplay can be blocked even when muted; fall back to the still poster.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !wantsVideo) return;
    video.play().catch(() => setVideoOk(false));
  }, [wantsVideo]);

  return (
    <section id="capture-guide" className="scroll-mt-16 border-b bg-muted/45">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
        <figure data-reveal className="relative">
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-border/80 bg-white shadow-card-hover">
            {wantsVideo && videoOk ? (
              <video
                ref={videoRef}
                className="absolute inset-0 h-full w-full"
                src={`${base}hero/v1-loop.mp4`}
                poster={`${base}hero/v1-poster.jpg`}
                muted
                loop
                playsInline
                autoPlay
                preload="metadata"
                aria-hidden
                onError={() => setVideoOk(false)}
              />
            ) : (
              <img
                src={`${base}hero/v1-poster.jpg`}
                alt=""
                width={1280}
                height={720}
                className="absolute inset-0 h-full w-full"
                loading="lazy"
              />
            )}
            <span className="absolute bottom-3 right-3 rounded-md border bg-card/90 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground backdrop-blur-sm">
              90° side profile
            </span>
          </div>
          <figcaption className="mt-3 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Circle the subject until you see a clean profile
          </figcaption>
        </figure>

        <div>
          <p data-reveal className="text-sm font-semibold uppercase tracking-widest text-primary">Before you shoot</p>
          <h2 data-reveal className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            One good photo is the whole setup.
          </h2>
          <p data-reveal className="mt-4 max-w-md text-pretty text-base leading-relaxed text-muted-foreground">
            No sensors, no suits, no calibration. The score is only as good as the view — here is what a good view looks like.
          </p>
          <ul data-reveal-stagger className="mt-8 space-y-5">
            {RULES.map(({ icon: Icon, name, copy }) => (
              <li key={name} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{name}</h3>
                  <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">{copy}</p>
                </div>
              </li>
            ))}
          </ul>
          <p data-reveal className="mt-7 border-t pt-5 text-xs leading-relaxed text-muted-foreground">
            Analyzing a video instead? The same rules apply — keep the clip short and the camera steady.
          </p>
        </div>
      </div>
    </section>
  );
}
