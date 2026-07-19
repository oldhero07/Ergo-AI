import { useEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger } from "@/hooks/useScrollMotion";
import { cn } from "@/lib/utils";

const BEATS = [
  {
    eyebrow: "The problem",
    title: "Strain doesn't announce itself.",
    copy: "Musculoskeletal damage builds from thousands of small overloads — a bent trunk here, a raised arm there. By the time it hurts, the injury is months old.",
  },
  {
    eyebrow: "The scale",
    title: "The biggest source of lost workdays.",
    copy: "Work-related musculoskeletal disorders account for roughly a third of workplace injuries serious enough to lose days of work — backs, shoulders, and necks first.",
  },
  {
    eyebrow: "The answer",
    title: "See under the skin, early.",
    copy: "Ergo AI reads the load on the spine and joints from a single photo, so you can change the task before it changes someone's body.",
  },
] as const;

/**
 * Scroll turns the figure translucent: skin fades, skeleton appears. The copy
 * advances in three beats synced to the scrub - problem, scale, answer.
 */
export function MsdStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoOk, setVideoOk] = useState(true);
  const [wantsVideo] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)").matches,
  );
  const base = import.meta.env.BASE_URL;
  const scrubMode = wantsVideo && videoOk;

  useEffect(() => {
    const section = sectionRef.current;
    const video = videoRef.current;
    if (!section || !video || !scrubMode) return;
    const mm = gsap.matchMedia();

    mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(section);
      const beats = q("[data-beat]");
      const scrubVideo = { t: 0 };
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        // Keep pins short and the scrub tight: longer distances with a laggier
        // scrub make the page feel stuck mid-pin.
        scrollTrigger: { trigger: section, start: "top top", end: "+=220%", scrub: 0.35, pin: true },
      });

      tl.to(scrubVideo, {
        t: 1,
        duration: 1,
        onUpdate: () => {
          if (video.duration) video.currentTime = scrubVideo.t * Math.max(video.duration - 0.05, 0);
        },
      });
      // Beat 1 is visible from the start; 2 and 3 crossfade in as the body clears.
      tl.to(beats[0], { autoAlpha: 0, y: -18, duration: 0.1 }, 0.3);
      tl.fromTo(beats[1], { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.1 }, 0.36);
      tl.to(beats[1], { autoAlpha: 0, y: -18, duration: 0.1 }, 0.64);
      tl.fromTo(beats[2], { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.1 }, 0.7);

      const refresh = () => ScrollTrigger.refresh();
      video.addEventListener("loadedmetadata", refresh);
      return () => video.removeEventListener("loadedmetadata", refresh);
    });
    return () => mm.revert();
  }, [scrubMode]);

  return (
    <section ref={sectionRef} className="relative isolate overflow-hidden border-b bg-background">
      <div className="mx-auto grid min-h-svh max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:py-0">
        <div className="relative lg:min-h-[22rem]">
          {BEATS.map(({ eyebrow, title, copy }) => (
            <div
              key={title}
              data-beat
              className={cn(
                "max-w-md",
                scrubMode ? "lg:absolute lg:inset-x-0 lg:top-1/2 lg:-translate-y-1/2" : "mt-12 first:mt-0",
              )}
            >
              <p className="text-sm font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>
              <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
              <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">{copy}</p>
            </div>
          ))}
        </div>

        <figure className="relative w-full">
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-border/80 bg-white shadow-card-hover">
            {scrubMode ? (
              <video
                ref={videoRef}
                className="absolute inset-0 h-full w-full"
                src={`${base}hero/v2-scrub.mp4`}
                poster={`${base}hero/v2-poster.jpg`}
                muted
                playsInline
                preload="auto"
                aria-hidden
                onError={() => setVideoOk(false)}
              />
            ) : (
              <img
                src={`${base}hero/v2-end.jpg`}
                alt=""
                width={1280}
                height={720}
                className="absolute inset-0 h-full w-full"
                loading="lazy"
              />
            )}
          </div>
          <figcaption className="mt-3 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {scrubMode ? "Scroll — the body turns transparent" : "The body under the working posture"}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
