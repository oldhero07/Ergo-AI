// REBA lookup tables, encoded from Hignett & McAtamney (2000).
// Indices are 1-based scores mapped to 0-based array positions.

/** Table A: [neck 1-3][trunk 1-5][legs 1-4] → posture score A (1-9). */
export const TABLE_A: number[][][] = [
  // Neck = 1
  [
    [1, 2, 3, 4], // trunk 1
    [2, 3, 4, 5], // trunk 2
    [2, 4, 5, 6], // trunk 3
    [3, 5, 6, 7], // trunk 4
    [4, 6, 7, 8], // trunk 5
  ],
  // Neck = 2
  [
    [1, 2, 3, 4],
    [3, 4, 5, 6],
    [4, 5, 6, 7],
    [5, 6, 7, 8],
    [6, 7, 8, 9],
  ],
  // Neck = 3
  [
    [3, 3, 5, 6],
    [4, 5, 6, 7],
    [5, 6, 7, 8],
    [6, 7, 8, 9],
    [7, 7, 8, 9],
  ],
];

/** Table B: [lowerArm 1-2][upperArm 1-6][wrist 1-3] → posture score B (1-9). */
export const TABLE_B: number[][][] = [
  // Lower arm = 1
  [
    [1, 2, 2], // upper arm 1
    [1, 2, 3], // upper arm 2
    [3, 4, 5], // upper arm 3
    [4, 5, 5], // upper arm 4
    [6, 7, 8], // upper arm 5
    [7, 8, 8], // upper arm 6
  ],
  // Lower arm = 2
  [
    [1, 2, 3],
    [2, 3, 4],
    [4, 5, 5],
    [5, 6, 7],
    [7, 8, 8],
    [8, 9, 9],
  ],
];

/** Table C: [scoreA 1-12][scoreB 1-12] → combined score (1-12). */
export const TABLE_C: number[][] = [
  [1, 1, 1, 2, 3, 3, 4, 5, 6, 7, 7, 7], // A 1
  [1, 2, 2, 3, 4, 4, 5, 6, 6, 7, 7, 8], // A 2
  [2, 3, 3, 3, 4, 5, 6, 7, 7, 8, 8, 8], // A 3
  [3, 4, 4, 4, 5, 6, 7, 8, 8, 9, 9, 9], // A 4
  [4, 4, 4, 5, 6, 7, 8, 8, 9, 9, 9, 9], // A 5
  [6, 6, 6, 7, 8, 8, 9, 9, 10, 10, 10, 10], // A 6
  [7, 7, 7, 8, 9, 9, 9, 10, 10, 11, 11, 11], // A 7
  [8, 8, 8, 9, 10, 10, 10, 10, 10, 11, 11, 11], // A 8
  [9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12, 12], // A 9
  [10, 10, 10, 11, 11, 11, 11, 12, 12, 12, 12, 12], // A 10
  [11, 11, 11, 11, 12, 12, 12, 12, 12, 12, 12, 12], // A 11
  [12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12], // A 12
];

function clampIdx(v: number, max: number): number {
  // Guard non-finite scores (NaN/Infinity) so a bad angle can never index the
  // lookup tables out of bounds and crash scoring.
  if (!Number.isFinite(v)) return 1;
  return Math.min(max, Math.max(1, Math.round(v)));
}

export function lookupA(neck: number, trunk: number, legs: number): number {
  return TABLE_A[clampIdx(neck, 3) - 1][clampIdx(trunk, 5) - 1][clampIdx(legs, 4) - 1];
}

export function lookupB(lowerArm: number, upperArm: number, wrist: number): number {
  return TABLE_B[clampIdx(lowerArm, 2) - 1][clampIdx(upperArm, 6) - 1][clampIdx(wrist, 3) - 1];
}

export function lookupC(scoreA: number, scoreB: number): number {
  return TABLE_C[clampIdx(scoreA, 12) - 1][clampIdx(scoreB, 12) - 1];
}
