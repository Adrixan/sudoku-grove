/** Backtracking solver on bitmasks (minimum remaining values first). Used to prove uniqueness. */
import { ALL_DIGITS, CELLS, type Grid, bit, boxOf, colOf, popcount, rowOf } from './grid.ts';
import type { Rng } from './rng.ts';

interface SearchOptions {
  limit: number;
  rng?: Rng;
  onSolution?: (grid: Grid) => void;
}

/** Returns the number of solutions found, stopping at `limit`. Invalid givens yield 0. */
function search(start: Grid, { limit, rng, onSolution }: SearchOptions): number {
  const cells = [...start];
  const rows = new Array<number>(9).fill(0);
  const cols = new Array<number>(9).fill(0);
  const boxes = new Array<number>(9).fill(0);
  for (let i = 0; i < CELLS; i++) {
    const v = cells[i] ?? 0;
    if (v === 0) continue;
    const m = bit(v);
    const r = rowOf(i);
    const c = colOf(i);
    const b = boxOf(i);
    if ((rows[r]! | cols[c]! | boxes[b]!) & m) return 0;
    rows[r]! |= m;
    cols[c]! |= m;
    boxes[b]! |= m;
  }

  let found = 0;
  const recurse = (): boolean => {
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < CELLS; i++) {
      if (cells[i] !== 0) continue;
      const mask = ALL_DIGITS & ~(rows[rowOf(i)]! | cols[colOf(i)]! | boxes[boxOf(i)]!);
      const n = popcount(mask);
      if (n < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = n;
        if (n <= 1) break;
      }
    }
    if (best === -1) {
      found++;
      onSolution?.([...cells]);
      return found >= limit;
    }
    if (bestCount === 0) return false;
    const r = rowOf(best);
    const c = colOf(best);
    const b = boxOf(best);
    let digits: number[] = [];
    for (let d = 1; d <= 9; d++) if (bestMask & bit(d)) digits.push(d);
    if (rng) digits = rng.shuffle(digits);
    for (const d of digits) {
      const m = bit(d);
      cells[best] = d;
      rows[r]! |= m;
      cols[c]! |= m;
      boxes[b]! |= m;
      if (recurse()) return true;
      rows[r]! &= ~m;
      cols[c]! &= ~m;
      boxes[b]! &= ~m;
    }
    cells[best] = 0;
    return false;
  };
  recurse();
  return found;
}

export function countSolutions(grid: Grid, limit = 2): number {
  return search(grid, { limit });
}

export function hasUniqueSolution(grid: Grid): boolean {
  return countSolutions(grid, 2) === 1;
}

export function solve(grid: Grid): Grid | null {
  let solution: Grid | null = null;
  search(grid, { limit: 1, onSolution: (g) => (solution = g) });
  return solution;
}

/** A random complete grid consistent with the givens (empty grid = random full solution). */
export function randomSolution(grid: Grid, rng: Rng): Grid | null {
  let solution: Grid | null = null;
  search(grid, { limit: 1, rng, onSolution: (g) => (solution = g) });
  return solution;
}
