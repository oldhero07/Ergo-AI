import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Wraps `children` and fades them in whenever `phaseKey` changes. Phases in
 * the analysis flow ("analyze:*") also get a brief scan-line sweep - the same
 * "AI reading the body" motif the landing reveal uses - so moving toward the
 * result feels like one continuous analysis.
 * Purely presentational - no data flow, no side effects beyond the tweens.
 * Respects prefers-reduced-motion (renders as-is, no animation).
 */
export function PhaseTransition({ phaseKey, children }: { phaseKey: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const scanRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Hidden tab: rAF is paused, so a fromTo tween would set the content
    // invisible (its "from" state) and never play - a batch that finishes while
    // the user is on another tab would come back to a blank page. Render the
    // final state directly instead of animating.
    if (prefersReducedMotion() || document.hidden) {
      gsap.set(el, { clearProps: "all" });
      return;
    }

    // Keep this wrapper transform-free. ScrollTrigger pins the landing demo
    // with fixed positioning; a transformed ancestor changes that coordinate
    // system and makes the pinned scrub sequence unstable. (position: relative
    // for the scan overlay is safe - only transforms re-anchor fixed children.)
    const tween = gsap.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: "power2.out" });

    const scan = scanRef.current;
    const line = scan?.firstElementChild ?? null;
    let scanTween: gsap.core.Timeline | undefined;
    if (scan && line && phaseKey.startsWith("analyze:")) {
      scanTween = gsap
        .timeline()
        .set(scan, { autoAlpha: 1 })
        .fromTo(line, { y: 0 }, { y: () => scan.clientHeight, duration: 0.55, ease: "power2.inOut" })
        .to(scan, { autoAlpha: 0, duration: 0.18 }, "-=0.18");
    }

    return () => {
      // If a tween is interrupted before completing (phase change, or the tab
      // was hidden mid-tween and rAF froze it partway), GSAP leaves the element
      // partly transparent/blurred. Clear those inline styles so the next phase
      // can never inherit a stuck-invisible state.
      tween.kill();
      scanTween?.kill();
      gsap.set(el, { clearProps: "all" });
      if (scan) gsap.set(scan, { autoAlpha: 0 });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseKey]);

  return (
    <div ref={ref} className="relative">
      {children}
      {/* Scan sweep overlay: sized to the viewport (not the content, which can
          be very tall), so the line crosses what the user actually sees. */}
      <div ref={scanRef} className="pointer-events-none absolute inset-x-0 top-0 z-50 h-svh overflow-hidden opacity-0" aria-hidden>
        <div className="absolute inset-x-0 top-0">
          <div className="h-px bg-primary/60 shadow-[0_0_18px_2px_hsl(var(--primary)/0.35)]" />
          <div className="absolute inset-x-0 bottom-px h-16 bg-gradient-to-b from-transparent to-primary/10" />
        </div>
      </div>
    </div>
  );
}
