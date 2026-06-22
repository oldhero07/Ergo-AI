import type { AssessmentMethod } from "@/assessment/types";
import { rula } from "@/assessment/rula/rula";

/** Registered assessment methods. REBA and others slot in here later. */
export const methods: AssessmentMethod[] = [rula];

export const defaultMethod = rula;

export function getMethod(id: string): AssessmentMethod {
  return methods.find((m) => m.id === id) ?? defaultMethod;
}
