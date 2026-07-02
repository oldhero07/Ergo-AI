import type { AssessmentMethod } from "@/assessment/types";
import { rula } from "@/assessment/rula/rula";
import { reba } from "@/assessment/reba/reba";
import { owas } from "@/assessment/owas/owas";

/** Registered assessment methods (pose-driven: compute from a PostureInput). */
export const methods: AssessmentMethod[] = [rula, reba, owas];

/** Form-driven calculators (not pose-driven; they have their own input UIs). */
export interface CalculatorMethod {
  id: string;
  name: string;
  kind: "calculator";
}
export const calculators: CalculatorMethod[] = [
  { id: "niosh", name: "NIOSH Lifting", kind: "calculator" },
];

export const defaultMethod = rula;

export function getMethod(id: string): AssessmentMethod {
  return methods.find((m) => m.id === id) ?? defaultMethod;
}
