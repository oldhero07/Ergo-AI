// RULA lookup tables, encoded from McAtamney & Corlett (1993).
// Indices are 1-based scores mapped to 0-based array positions.

/** Table A: [upperArm 1-6][lowerArm 1-3][wrist 1-4][wristTwist 1-2] → posture score A. */
export const TABLE_A: number[][][][] = [
  // Upper arm = 1
  [
    [[1, 2], [2, 2], [2, 3], [3, 3]], // lower arm 1
    [[2, 2], [2, 2], [3, 3], [3, 3]], // lower arm 2
    [[2, 3], [3, 3], [3, 3], [4, 4]], // lower arm 3
  ],
  // Upper arm = 2
  [
    [[2, 3], [3, 3], [3, 4], [4, 4]],
    [[3, 3], [3, 3], [3, 4], [4, 4]],
    [[3, 4], [4, 4], [4, 4], [5, 5]],
  ],
  // Upper arm = 3
  [
    [[3, 3], [4, 4], [4, 4], [5, 5]],
    [[3, 4], [4, 4], [4, 4], [5, 5]],
    [[4, 4], [4, 4], [4, 5], [5, 5]],
  ],
  // Upper arm = 4
  [
    [[4, 4], [4, 4], [4, 5], [5, 5]],
    [[4, 4], [4, 4], [4, 5], [5, 5]],
    [[4, 4], [4, 5], [5, 5], [6, 6]],
  ],
  // Upper arm = 5
  [
    [[5, 5], [5, 5], [5, 6], [6, 7]],
    [[5, 5], [5, 5], [5, 6], [6, 7]],
    [[5, 5], [5, 6], [6, 6], [7, 7]],
  ],
  // Upper arm = 6
  [
    [[7, 7], [7, 7], [7, 8], [8, 9]],
    [[7, 7], [7, 7], [7, 8], [8, 9]],
    [[7, 7], [7, 8], [8, 8], [9, 9]],
  ],
];

/** Table B: [neck 1-6][trunk 1-6][legs 1-2] → posture score B. */
export const TABLE_B: number[][][] = [
  [[1, 3], [2, 3], [3, 4], [5, 5], [6, 6], [7, 7]], // neck 1
  [[2, 3], [2, 3], [4, 5], [5, 5], [6, 7], [7, 7]], // neck 2
  [[3, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 7]], // neck 3
  [[5, 5], [5, 6], [6, 7], [7, 7], [7, 7], [8, 8]], // neck 4
  [[7, 7], [7, 7], [7, 8], [8, 8], [8, 8], [8, 8]], // neck 5
  [[8, 8], [8, 8], [8, 8], [8, 9], [9, 9], [9, 9]], // neck 6
];

/** Table C: [scoreC 1-8][scoreD 1-7] → grand score. */
export const TABLE_C: number[][] = [
  [1, 2, 3, 3, 4, 5, 5], // C 1
  [2, 2, 3, 4, 4, 5, 5], // C 2
  [3, 3, 3, 4, 4, 5, 6], // C 3
  [3, 4, 4, 4, 5, 6, 6], // C 4
  [4, 4, 4, 5, 6, 7, 7], // C 5
  [4, 4, 5, 6, 6, 7, 7], // C 6
  [5, 5, 6, 6, 7, 7, 7], // C 7
  [5, 5, 6, 7, 7, 7, 7], // C 8
];

export function lookupA(upperArm: number, lowerArm: number, wrist: number, twist: number): number {
  const ua = clampIdx(upperArm, 6);
  const la = clampIdx(lowerArm, 3);
  const wr = clampIdx(wrist, 4);
  const tw = clampIdx(twist, 2);
  return TABLE_A[ua - 1][la - 1][wr - 1][tw - 1];
}

export function lookupB(neck: number, trunk: number, legs: number): number {
  const n = clampIdx(neck, 6);
  const t = clampIdx(trunk, 6);
  const l = clampIdx(legs, 2);
  return TABLE_B[n - 1][t - 1][l - 1];
}

export function lookupC(scoreC: number, scoreD: number): number {
  const c = clampIdx(scoreC, 8);
  const d = clampIdx(scoreD, 7);
  return TABLE_C[c - 1][d - 1];
}

function clampIdx(v: number, max: number): number {
  return Math.min(max, Math.max(1, Math.round(v)));
}
