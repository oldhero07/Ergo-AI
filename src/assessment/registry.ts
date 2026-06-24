import type { AssessmentMethod } from "@/assessment/types";
import { rula } from "@/assessment/rula/rula";
import { reba } from "@/assessment/reba/reba";

/** Registered assessment methods. */
export const methods: AssessmentMethod[] = [rula, reba];

export const defaultMethod = rula;

export function getMethod(id: string): AssessmentMethod {
  return methods.find((m) => m.id === id) ?? defaultMethod;
}
