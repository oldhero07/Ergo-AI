import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Wraps `children` and fades/slides/blurs them in whenever `phaseKey` changes.
 * Purely presentational - no data flow, no side effects beyond the tween.
 * Respects prefers-reduced-motion (renders as-is, no animation).
 */
export function PhaseTransition({ phaseKey, children }: { phaseKey: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);

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

    const tween = gsap.fromTo(
      el,
      { autoAlpha: 0, y: 14, filter: "blur(6px)" },
      { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.45, ease: "power2.out" },
    );

    return () => {
      // If the tween is interrupted before completing (phase change, or the tab
      // was hidden mid-tween and rAF froze it partway), GSAP leaves the element
      // partly transparent/blurred. Clear those inline styles so the next phase
      // can never inherit a stuck-invisible state.
      tween.kill();
      gsap.set(el, { clearProps: "all" });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseKey]);

  return <div ref={ref}>{children}</div>;
}
