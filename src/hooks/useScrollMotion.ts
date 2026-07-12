import { useEffect, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);
export { gsap, ScrollTrigger };

/**
 * Scroll-entrance reveals for descendants of `root`:
 *  - `data-reveal` on an element fades/rises it in when it enters the viewport
 *  - `data-reveal-stagger` on a container staggers its direct children instead
 *
 * Subtle tier by design: 14-16px rise, power2.out, ~0.5s, 60ms stagger. Under
 * `prefers-reduced-motion` no tween is ever registered, so content is simply
 * visible - the default DOM state is always the final state.
 */
export function useScrollReveal(rootRef: RefObject<HTMLElement>): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const staggered = new Set<Element>();
      for (const group of Array.from(root.querySelectorAll<HTMLElement>("[data-reveal-stagger]"))) {
        const items = Array.from(group.children).filter((c): c is HTMLElement => c instanceof HTMLElement);
        if (!items.length) continue;
        for (const item of items) staggered.add(item);
        gsap.from(items, {
          opacity: 0,
          y: 16,
          duration: 0.5,
          ease: "power2.out",
          stagger: 0.06,
          scrollTrigger: { trigger: group, start: "top 85%", toggleActions: "play none none reverse" },
        });
      }
      for (const el of Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"))) {
        if (staggered.has(el)) continue;
        gsap.from(el, {
          opacity: 0,
          y: 14,
          duration: 0.45,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%", toggleActions: "play none none reverse" },
        });
      }
    });

    // Image/font loads change layout; recalc trigger positions once settled.
    const onLoad = () => ScrollTrigger.refresh();
    window.addEventListener("load", onLoad);
    return () => {
      window.removeEventListener("load", onLoad);
      mm.revert();
    };
  }, [rootRef]);
}
