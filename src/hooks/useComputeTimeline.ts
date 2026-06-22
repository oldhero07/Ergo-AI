import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

export const PHASE_COUNT = 4;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface LengthTarget {
  getTotalLength: () => number;
}
interface TextTarget {
  textContent: string;
}
interface PhaseTargets {
  nodes: object;
  edges: ArrayLike<LengthTarget>;
  vectors: object;
  tags: object;
  arc: LengthTarget | null;
  degreeText: TextTarget | null;
  gaugeRing: LengthTarget | null;
  gaugeText: TextTarget | null;
  chips: object;
}

/**
 * Appends the full 4-phase + reset choreography to `tl`. Shared by the real
 * (DOM-backed) timeline and a one-time dry-run probe built from plain-object
 * stand-ins, so the measured loop duration (COMPUTE_LOOP_MS below) can never
 * drift out of sync with what's actually playing on screen.
 */
function appendPhases(tl: gsap.core.Timeline, t: PhaseTargets, setPhase?: (n: number) => void) {
  const edgeLengths = new Map<LengthTarget, number>();
  Array.from(t.edges).forEach((edge) => {
    const len = edge.getTotalLength();
    edgeLengths.set(edge, len);
    gsap.set(edge, { strokeDasharray: len, strokeDashoffset: len });
  });
  const arcLen = t.arc?.getTotalLength() ?? 0;
  if (t.arc) gsap.set(t.arc, { strokeDasharray: arcLen, strokeDashoffset: arcLen, opacity: 0 });
  const gaugeLen = t.gaugeRing?.getTotalLength() ?? 0;
  if (t.gaugeRing) gsap.set(t.gaugeRing, { strokeDasharray: gaugeLen, strokeDashoffset: gaugeLen });

  gsap.set(t.nodes, { scale: 0, opacity: 0, transformOrigin: "center" });
  gsap.set(t.vectors, { opacity: 0 });
  gsap.set(t.tags, { opacity: 0 });
  if (t.degreeText) gsap.set(t.degreeText, { opacity: 0 });
  gsap.set(t.chips, { opacity: 0.25, scale: 0.92, transformOrigin: "center" });
  if (t.gaugeText) gsap.set(t.gaugeText, { opacity: 0 });

  const degreeProxy = { v: 0 };
  const scoreProxy = { v: 1 };

  // Phase 0 — Detecting pose: wireframe assembles.
  tl.call(() => setPhase?.(0))
    .to(t.nodes, { scale: 1, opacity: 1, duration: 0.35, stagger: 0.07, ease: "back.out(2)" })
    .to(t.edges as object, { strokeDashoffset: 0, duration: 0.5, stagger: 0.06 }, "<0.1")
    .to({}, { duration: 0.35 });

  // Phase 1 — Computing vectors: arrows extend off the wireframe.
  tl.call(() => setPhase?.(1))
    .to(t.vectors, { opacity: 1, duration: 0.3, stagger: 0.18 })
    .to(t.tags, { opacity: 1, duration: 0.3, stagger: 0.18 }, "<")
    .to({}, { duration: 0.55 });

  // Phase 2 — Solving angles: arc sweeps, degree readout flickers then settles.
  tl.call(() => setPhase?.(2))
    .to(t.arc as object, { opacity: 1, strokeDashoffset: 0, duration: 0.45 })
    .to(t.degreeText as object, { opacity: 1, duration: 0.2 }, "<")
    .to(
      degreeProxy,
      {
        v: 37,
        duration: 0.6,
        ease: "steps(11)",
        onUpdate: () => {
          if (t.degreeText) t.degreeText.textContent = `${Math.round(degreeProxy.v)}°`;
        },
      },
      "<",
    )
    .to({}, { duration: 0.4 });

  // Phase 3 — Running RULA: group chips light up, gauge sweeps, score cycles.
  tl.call(() => setPhase?.(3))
    .to(t.chips, { opacity: 1, scale: 1, duration: 0.25, stagger: 0.15 })
    .to(t.gaugeRing as object, { strokeDashoffset: gaugeLen * 0.22, duration: 0.6 }, "<")
    .to(t.gaugeText as object, { opacity: 1, duration: 0.2 }, "<")
    .to(
      scoreProxy,
      {
        v: 7,
        duration: 0.6,
        ease: "steps(6)",
        onUpdate: () => {
          if (t.gaugeText) t.gaugeText.textContent = String(Math.round(scoreProxy.v));
        },
      },
      "<",
    )
    .to({}, { duration: 0.45 });

  // Reset to a hidden state so the next repeat draws on again (seamless loop).
  tl.to(t.nodes, { opacity: 0, duration: 0.3 })
    .to([t.vectors, t.tags, t.arc, t.degreeText, t.gaugeText].filter(Boolean) as object[], { opacity: 0, duration: 0.3 }, "<")
    .to(t.chips, { opacity: 0.25, scale: 0.92, duration: 0.3 }, "<")
    .call(() => {
      Array.from(t.edges).forEach((edge) => gsap.set(edge, { strokeDashoffset: edgeLengths.get(edge) ?? 0 }));
      if (t.arc) gsap.set(t.arc, { strokeDashoffset: arcLen });
      if (t.gaugeRing) gsap.set(t.gaugeRing, { strokeDashoffset: gaugeLen });
      gsap.set(t.nodes, { scale: 0 });
      degreeProxy.v = 0;
      scoreProxy.v = 1;
    });
}

function dummyLengthTargets(count: number): LengthTarget[] {
  return Array.from({ length: count }, () => ({ getTotalLength: () => 100 }));
}

/** One-time dry-run probe (no real DOM) so we know the true single-loop duration. */
const probeTl = gsap.timeline({ paused: true });
appendPhases(probeTl, {
  nodes: dummyLengthTargets(7),
  edges: dummyLengthTargets(6),
  vectors: dummyLengthTargets(2),
  tags: dummyLengthTargets(2),
  arc: dummyLengthTargets(1)[0],
  degreeText: { textContent: "" },
  gaugeRing: dummyLengthTargets(1)[0],
  gaugeText: { textContent: "" },
  chips: dummyLengthTargets(4),
});
/** Duration (ms) of exactly one cycle of the compute animation, measured from the real timeline. */
export const COMPUTE_LOOP_MS = Math.round(probeTl.duration() * 1000);
probeTl.kill();

/**
 * Builds the looping, abstract "computing" animation on a single GSAP timeline.
 * Attach the returned `rootRef` to the root <svg>; child elements are selected
 * by `data-anim` attribute so the markup and the choreography stay decoupled.
 * Returns the active phase (0-3) for React-driven caption text, and whether
 * prefers-reduced-motion is on (in which case no GSAP timeline is built at all).
 */
export function useComputeTimeline() {
  const rootRef = useRef<SVGSVGElement | null>(null);
  const [phase, setPhase] = useState(0);
  const reducedMotion = useRef(prefersReducedMotion()).current;

  useEffect(() => {
    if (reducedMotion || !rootRef.current) return;
    const root = rootRef.current;

    const targets: PhaseTargets = {
      nodes: root.querySelectorAll('[data-anim="node"]'),
      edges: root.querySelectorAll<SVGGeometryElement>('[data-anim="edge"]'),
      vectors: root.querySelectorAll('[data-anim="vector"]'),
      tags: root.querySelectorAll('[data-anim="tag"]'),
      arc: root.querySelector<SVGGeometryElement>('[data-anim="arc"]'),
      degreeText: root.querySelector<SVGTextElement>('[data-anim="degree"]'),
      gaugeRing: root.querySelector<SVGGeometryElement>('[data-anim="gauge-ring"]'),
      gaugeText: root.querySelector<SVGTextElement>('[data-anim="gauge-text"]'),
      chips: root.querySelectorAll('[data-anim="chip"]'),
    };

    const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
    appendPhases(tl, targets, setPhase);
    tl.repeat(-1);

    return () => {
      tl.kill();
    };
  }, [reducedMotion]);

  return { rootRef, phase, reducedMotion };
}
