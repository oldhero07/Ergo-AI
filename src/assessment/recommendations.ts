import type { AssessmentResult, PostureInput } from "@/assessment/types";
import type { NioshResult } from "@/assessment/niosh/niosh";

/**
 * Structured, per-risk-factor intervention guidance. Rules key off the stable
 * group-item labels each method emits and fire when that component's score
 * reaches the rule's threshold; input-flag rules cover the factors that scores
 * alone don't expose (muscle use, load, coupling). Consumed by the UI panel
 * and the PDF's recommendations section.
 */

export type Severity = "advisory" | "important" | "critical";

export interface Recommendation {
  id: string;
  component: string;
  severity: Severity;
  title: string;
  body: string;
}

interface ScoreRule {
  methods: string[]; // method names as emitted in AssessmentResult.method
  label: string; // group-item label
  minScore: number;
  severity: Severity;
  title: string;
  body: string;
}

const SCORE_RULES: ScoreRule[] = [
  // --- Upper arm -------------------------------------------------------------
  {
    methods: ["RULA", "REBA"],
    label: "Upper arm",
    minScore: 3,
    severity: "important",
    title: "Lower the working height or bring the task closer",
    body: "The upper arm is elevated beyond 45°. Reduce shelf/bench height, tilt the work toward the worker, or move frequently used items into the forearm 'power zone' (waist to mid-chest) so the elbow can stay near the body.",
  },
  {
    methods: ["RULA", "REBA"],
    label: "Upper arm",
    minScore: 4,
    severity: "critical",
    title: "Eliminate sustained overhead reaching",
    body: "The upper arm exceeds 90° elevation. Reposition the task below shoulder height, add a platform or lift table, or provide arm support - sustained work above shoulder level is a primary driver of shoulder disorders.",
  },
  // --- Lower arm ---------------------------------------------------------------
  {
    methods: ["RULA", "REBA"],
    label: "Lower arm",
    minScore: 2,
    severity: "advisory",
    title: "Keep the forearm in its 60-100° comfort arc",
    body: "The elbow is either overextended or tightly flexed. Adjust reach distance or work height so the forearm stays near a right angle to the upper arm.",
  },
  // --- Wrist -------------------------------------------------------------------
  {
    methods: ["RULA", "REBA"],
    label: "Wrist",
    minScore: 3,
    severity: "important",
    title: "Bring the wrist toward neutral",
    body: "Wrist flexion/extension exceeds 15°. Re-angle the tool or handle (bend the tool, not the wrist), reposition the work surface, or add a wrist support for keyboard-style tasks.",
  },
  // --- Neck --------------------------------------------------------------------
  {
    methods: ["RULA", "REBA"],
    label: "Neck",
    minScore: 3,
    severity: "important",
    title: "Raise the visual target",
    body: "The neck is flexed beyond 20°. Raise the display, work piece, or task lighting so the eyes' natural line of sight (~15° below horizontal) reaches it without bending the neck.",
  },
  {
    methods: ["RULA"],
    label: "Neck",
    minScore: 4,
    severity: "critical",
    title: "Remove neck extension or extreme flexion",
    body: "The neck posture is at the extreme of its range. Reposition the task vertically; where the score comes from side-bend or twist, center the work in front of the worker.",
  },
  // --- Trunk -------------------------------------------------------------------
  {
    methods: ["RULA", "REBA"],
    label: "Trunk",
    minScore: 3,
    severity: "important",
    title: "Reduce forward bending of the trunk",
    body: "Trunk flexion exceeds 20°. Raise the work surface, use a sit-stand stool or jig to support the posture, and slide the task closer so the spine can stay upright under load.",
  },
  {
    methods: ["RULA", "REBA"],
    label: "Trunk",
    minScore: 4,
    severity: "critical",
    title: "Redesign to remove deep trunk flexion",
    body: "Trunk flexion exceeds 60°. This posture multiplies spinal compression - raise the task origin (lift tables, tilted bins), or reorganize the workflow so the load is picked between knee and shoulder height.",
  },
  // --- Legs --------------------------------------------------------------------
  {
    methods: ["RULA", "REBA"],
    label: "Legs",
    minScore: 2,
    severity: "advisory",
    title: "Stabilize the base of support",
    body: "Weight is on one leg or the base is unstable. Provide room for both feet, a footrest for seated work, or anti-fatigue matting for prolonged standing.",
  },
  // --- OWAS posture-code digits --------------------------------------------------
  {
    methods: ["OWAS"],
    label: "Back",
    minScore: 2,
    severity: "important",
    title: "Straighten the back posture",
    body: "The back is bent or twisted during the task. Raise or reorient the work to remove the bend, and place materials so the trunk doesn't rotate under load.",
  },
  {
    methods: ["OWAS"],
    label: "Arms",
    minScore: 2,
    severity: "important",
    title: "Bring hands below shoulder level",
    body: "One or both arms work at/above the shoulder. Lower the task or raise the worker (platform) so hands operate below shoulder height.",
  },
  {
    methods: ["OWAS"],
    label: "Legs",
    minScore: 4,
    severity: "important",
    title: "Remove squatting / kneeling from the cycle",
    body: "The legs are bent or kneeling. Raise the task origin off the floor; where floor-level work is unavoidable, rotate the duty and provide knee support.",
  },
];

interface FlagRule {
  methods: string[];
  applies: (input: PostureInput) => boolean;
  id: string;
  component: string;
  severity: Severity;
  title: string;
  body: string;
}

const FLAG_RULES: FlagRule[] = [
  {
    methods: ["RULA", "REBA"],
    applies: (i) => i.muscleUseA || i.muscleUseB || i.activityStatic || i.activityRepeated,
    id: "muscle-use",
    component: "Muscle use",
    severity: "important",
    title: "Break up static holds and repetition",
    body: "The posture is held or repeated. Introduce micro-breaks (20-30 s every few minutes), rotate tasks across muscle groups, or mechanize the repetitive element.",
  },
  {
    methods: ["RULA", "REBA"],
    applies: (i) => Math.max(i.forceA, i.forceB) >= 2 || i.load >= 2 || i.loadShock,
    id: "force-load",
    component: "Force / load",
    severity: "critical",
    title: "Reduce the handled load",
    body: "Significant force or load is applied in this posture. Split the load, use mechanical assistance (hoist, cart, conveyor), or slide instead of lift.",
  },
  {
    methods: ["REBA"],
    applies: (i) => i.coupling >= 2,
    id: "coupling",
    component: "Coupling",
    severity: "important",
    title: "Improve the grip interface",
    body: "The hand-to-object coupling is poor. Add handles or cutouts, containerize loose/irregular items, and keep grip surfaces dry and intact.",
  },
];

/** Build the ordered recommendation list for a scored result. */
export function buildRecommendations(result: AssessmentResult, input: PostureInput): Recommendation[] {
  const out: Recommendation[] = [];
  const seen = new Set<string>();

  // Highest-threshold rule wins per (label): iterate rules sorted by minScore desc.
  const byLabel = new Map<string, number>();
  for (const g of result.groups) for (const item of g.items) byLabel.set(item.label, item.value);

  const sorted = [...SCORE_RULES].sort((a, b) => b.minScore - a.minScore);
  for (const rule of sorted) {
    if (!rule.methods.includes(result.method)) continue;
    const score = byLabel.get(rule.label);
    if (score === undefined || score < rule.minScore) continue;
    const key = `${rule.label}`;
    if (seen.has(key)) continue; // a stricter rule already fired for this component
    seen.add(key);
    out.push({
      id: `${result.method}-${rule.label}-${rule.minScore}`.toLowerCase().replace(/\s+/g, "-"),
      component: rule.label,
      severity: rule.severity,
      title: rule.title,
      body: rule.body,
    });
  }

  for (const rule of FLAG_RULES) {
    if (!rule.methods.includes(result.method)) continue;
    if (!rule.applies(input)) continue;
    out.push({
      id: rule.id,
      component: rule.component,
      severity: rule.severity,
      title: rule.title,
      body: rule.body,
    });
  }

  const rank: Record<Severity, number> = { critical: 0, important: 1, advisory: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** NIOSH: the lowest sub-0.85 multiplier is the biggest redesign lever. */
export function buildNioshRecommendations(result: NioshResult): Recommendation[] {
  const guidance: Record<string, { title: string; body: string }> = {
    HM: {
      title: "Reduce the horizontal reach",
      body: "Bring the load closer to the body before lifting: remove barriers in front of the feet, orient containers so the grip point faces the worker, and slide the load to the body's edge first.",
    },
    VM: {
      title: "Start the lift nearer to knuckle height",
      body: "The lift origin/height is far from the ~75 cm optimum. Raise floor-level loads onto stands or adjust shelving so lifts begin and end between knee and shoulder height.",
    },
    DM: {
      title: "Shorten the vertical travel",
      body: "The load travels a long vertical distance. Stage material at the destination height or split the move into two supported steps.",
    },
    AM: {
      title: "Remove trunk twisting",
      body: "The lift involves torso rotation. Reposition origin and destination so the worker steps and turns with the feet instead of twisting the spine.",
    },
    FM: {
      title: "Lower the lifting frequency or add recovery",
      body: "The pace/duration combination is heavily penalized. Slow the required rate, alternate workers, batch the task differently, or mechanize part of the cycle.",
    },
    CM: {
      title: "Improve the grip",
      body: "Poor coupling reduces the safe limit. Add handles or cutouts, or containerize the load so it can be gripped with a comfortable, wrapped hand.",
    },
  };

  const entries = Object.entries(result.multipliers) as [keyof typeof guidance, number][];
  const limiting = entries.filter(([, v]) => v < 0.85).sort((a, b) => a[1] - b[1]);

  const out: Recommendation[] = limiting.slice(0, 3).map(([key, value], i) => ({
    id: `niosh-${key.toLowerCase()}`,
    component: key,
    severity: i === 0 ? "critical" : "important",
    title: guidance[key].title,
    body: `${guidance[key].body} (multiplier ${value.toFixed(2)})`,
  }));

  if (result.li > 1 && out.length === 0) {
    out.push({
      id: "niosh-load",
      component: "Load",
      severity: "critical",
      title: "Reduce the load weight",
      body: "All geometry multipliers are near optimal, so the load itself exceeds the recommended limit - lighten it or split it.",
    });
  }
  return out;
}
