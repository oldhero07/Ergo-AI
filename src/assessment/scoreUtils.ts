/** Shared clamp/scoring helpers used by more than one assessment method.
 * Consolidated here after a sweep found `clamp`/`clampIdx` reimplemented
 * identically 5 times across rula.ts, reba.ts, rulaTables.ts, rebaTables.ts,
 * and owasTables.ts, and `upperArmScore` byte-for-byte duplicated between
 * rula.ts and reba.ts (both methods genuinely use the same rule). */

/** Clamp a computed score into its valid range. */
export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Clamp a lookup-table index. Guards non-finite scores (NaN/Infinity) so a
 * bad angle can never index a table out of bounds and crash scoring. */
export function clampIdx(v: number, max: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.min(max, Math.max(1, Math.round(v)));
}

/** RULA/REBA upper-arm score: both methods use the identical rule. */
export function upperArmScore(angle: number, raised: boolean, abducted: boolean, supported: boolean): number {
  let s: number;
  if (angle < -20) s = 2; // extension > 20°
  else if (angle <= 20) s = 1;
  else if (angle <= 45) s = 2;
  else if (angle <= 90) s = 3;
  else s = 4;
  if (raised) s += 1;
  if (abducted) s += 1;
  if (supported) s -= 1;
  return clamp(s, 1, 6);
}
