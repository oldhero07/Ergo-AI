/**
 * OWAS action-category lookup (Karhu, Kansi & Kuorinka 1977; the 252-cell
 * classification distributed with the OWAS/WinOWAS training material).
 *
 * Transcription verified against two independent published implementations
 * that agree cell-for-cell: the OWAS 0.3.5 software classification table and
 * the rs9000/ergonomics reference implementation.
 *
 * Index order: [back-1][arms-1][legs-1][load-1] → action category 1–4.
 *   back 1–4 · arms 1–3 · legs 1–7 · load 1–3
 */
const AC: number[][][][] = [
  // Back 1 - straight
  [
    [[1, 1, 1], [1, 1, 1], [1, 1, 1], [2, 2, 2], [2, 2, 2], [1, 1, 1], [1, 1, 1]], // arms 1
    [[1, 1, 1], [1, 1, 1], [1, 1, 1], [2, 2, 2], [2, 2, 2], [1, 1, 1], [1, 1, 1]], // arms 2
    [[1, 1, 1], [1, 1, 1], [1, 1, 1], [2, 2, 3], [2, 2, 3], [1, 1, 1], [1, 1, 2]], // arms 3
  ],
  // Back 2 - bent
  [
    [[2, 2, 3], [2, 2, 3], [2, 2, 3], [3, 3, 3], [3, 3, 3], [2, 2, 2], [2, 3, 3]],
    [[2, 2, 3], [2, 2, 3], [2, 3, 3], [3, 4, 4], [3, 4, 4], [3, 3, 4], [2, 3, 4]],
    [[3, 3, 4], [2, 2, 3], [3, 3, 3], [3, 4, 4], [4, 4, 4], [4, 4, 4], [2, 3, 4]],
  ],
  // Back 3 - twisted / side-bent
  [
    [[1, 1, 1], [1, 1, 1], [1, 1, 2], [3, 3, 3], [4, 4, 4], [1, 1, 1], [1, 1, 1]],
    [[2, 2, 3], [1, 1, 1], [1, 1, 2], [4, 4, 4], [4, 4, 4], [3, 3, 3], [1, 1, 1]],
    [[2, 2, 3], [1, 1, 1], [2, 3, 3], [4, 4, 4], [4, 4, 4], [4, 4, 4], [1, 1, 2]],
  ],
  // Back 4 - bent AND twisted
  [
    [[2, 3, 3], [2, 2, 3], [2, 3, 3], [4, 4, 4], [4, 4, 4], [4, 4, 4], [2, 3, 4]],
    [[3, 3, 4], [2, 3, 4], [3, 3, 4], [4, 4, 4], [4, 4, 4], [4, 4, 4], [2, 3, 4]],
    [[4, 4, 4], [2, 3, 4], [3, 3, 4], [4, 4, 4], [4, 4, 4], [4, 4, 4], [2, 3, 4]],
  ],
];

const clampIdx = (v: number, max: number) => Math.min(max, Math.max(1, Math.round(Number.isFinite(v) ? v : 1)));

/** Action category (1–4) for an OWAS posture code. Inputs are 1-based codes. */
export function lookupActionCategory(back: number, arms: number, legs: number, load: number): number {
  return AC[clampIdx(back, 4) - 1][clampIdx(arms, 3) - 1][clampIdx(legs, 7) - 1][clampIdx(load, 3) - 1];
}
