/** Backtracking solver on bitmasks (minimum remaining values first). Used to prove uniqueness. */
import { ALL_DIGITS, CELLS, type Grid, bit, boxOf, colOf, popcount, rowOf } from './grid.ts';
import type { Rng } from './rng.ts';

/** Search events for teaching views: a digit is tried, taken back, or a full solution is reached. */
export type SearchEvent =
  | { type: 'try'; cell: number; digit: number; depth: number }
  | { type: 'undo'; cell: number; depth: number }
  | { type: 'solution'; count: number };

interface SearchOptions {
  limit: number;
  rng?: Rng;
  onSolution?: (grid: Grid) => void;
  onEvent?: (event: SearchEvent) => void;
}

/** Returns the number of solutions found, stopping at `limit`. Invalid givens yield 0. */
function search(start: Grid, { limit, rng, onSolution, onEvent }: SearchOptions): number {
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
  let depth = 0;
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
      onEvent?.({ type: 'solution', count: found });
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
      onEvent?.({ type: 'try', cell: best, digit: d, depth });
      depth++;
      const stop = recurse();
      depth--;
      if (stop) return true;
      rows[r]! &= ~m;
      cols[c]! &= ~m;
      boxes[b]! &= ~m;
      onEvent?.({ type: 'undo', cell: best, depth });
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

export interface SearchTrace {
  solutions: number;
  tries: number;
  undos: number;
  /** recorded events, at most `maxEvents` (the counters always cover the whole search) */
  events: SearchEvent[];
  truncated: boolean;
}

/** Runs the uniqueness check (search for up to `limit` solutions) and records what the solver does. */
export function traceSearch(grid: Grid, limit = 2, maxEvents = 50_000): SearchTrace {
  const trace: SearchTrace = { solutions: 0, tries: 0, undos: 0, events: [], truncated: false };
  trace.solutions = search(grid, {
    limit,
    onEvent: (e) => {
      if (e.type === 'try') trace.tries++;
      else if (e.type === 'undo') trace.undos++;
      if (trace.events.length < maxEvents) trace.events.push(e);
      else trace.truncated = true;
    },
  });
  return trace;
}
