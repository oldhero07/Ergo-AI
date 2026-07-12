import { useEffect, useRef } from "react";
import { FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { gsap } from "@/hooks/useScrollMotion";

/**
 * The deliverable, shown as itself: a render of the actual PDF cover page
 * (public/showcase/report-cover.png, regenerated from a real export whenever
 * the report design changes) floating in on scroll.
 */
export function ReportShowcase() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(section.querySelector("[data-report-page]"), {
        opacity: 0,
        y: 44,
        rotate: 5,
        duration: 0.8,
        ease: "power2.out",
        scrollTrigger: { trigger: section, start: "top 70%", toggleActions: "play none none reverse" },
      });
    });
    return () => mm.revert();
  }, []);

  return (
    <section ref={sectionRef} className="overflow-hidden border-t">
      <div className="mx-auto grid max-w-5xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <div>
          <h2 data-reveal className="text-sm font-semibold uppercase tracking-widest text-primary">
            The deliverable
          </h2>
          <p data-reveal className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            A report that answers first, then shows its work
          </p>
          <p data-reveal className="mt-4 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            The verdict sits on the cover - grand score, risk band, action level. Behind it: per-joint angle
            thresholds, the measured-versus-assumed breakdown, flagged estimates for assessor review, and the
            exact model version for provenance. Ready to hand to management or attach to a study.
          </p>
          <ul data-reveal-stagger className="mt-6 space-y-2.5 text-sm text-muted-foreground">
            <Item>Verdict-first cover with the batch's worst posture</Item>
            <Item>Joint-by-joint thresholds - how far each angle is from the next band</Item>
            <Item>Estimates flagged for review, never hidden</Item>
            <Item>Model version stamped on every page</Item>
          </ul>
          <div data-reveal className="mt-6 flex items-center gap-2">
            <Badge variant="muted" className="gap-1 rounded-full">
              <FileDown className="h-3 w-3" /> PDF
            </Badge>
            <Badge variant="muted" className="rounded-full">CSV</Badge>
            <Badge variant="muted" className="rounded-full">JSON</Badge>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-sm lg:max-w-md">
          {/* Soft brand glow behind the page - cinematic, still light */}
          <div className="absolute -inset-8 rounded-full bg-primary/10 blur-3xl" aria-hidden />
          <img
            data-report-page
            src={`${import.meta.env.BASE_URL}showcase/report-cover.png`}
            alt="Cover page of an Ergo AI PDF report: grand score 5 of 7, risk band Change soon, provenance fields and risk-band legend"
            width={864}
            height={1221}
            className="relative w-full rotate-1 rounded-lg border shadow-2xl"
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
    </section>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
      <span>{children}</span>
    </li>
  );
}
