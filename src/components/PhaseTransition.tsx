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
    if (prefersReducedMotion() || !ref.current) return;

    const tween = gsap.fromTo(
      ref.current,
      { autoAlpha: 0, y: 14, filter: "blur(6px)" },
      { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.45, ease: "power2.out" },
    );

    return () => {
      tween.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseKey]);

  return <div ref={ref}>{children}</div>;
}
