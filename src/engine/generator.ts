/** Generates unique-solution puzzles of a target difficulty from a seed. Deterministic per seed. */
import { CELLS, type Grid, emptyGrid } from './grid.ts';
import { type Difficulty, levelIndex, rate } from './rater.ts';
import { createRng } from './rng.ts';
import { hasUniqueSolution, randomSolution } from './solver.ts';

export interface Puzzle {
  seed: string;
  difficulty: Difficulty;
  givens: Grid;
  solution: Grid;
}

export interface GenerateOptions {
  /** attempts before falling back to the closest easier puzzle found */
  maxAttempts?: number;
}

/** Fewest givens we allow per level; easy puzzles keep more clues so beginners get a gentle start. */
const MIN_GIVENS: Record<Difficulty, number> = { leicht: 34, mittel: 28, schwer: 24, experte: 22 };

function attempt(seed: string, target: Difficulty): Puzzle | null {
  const rng = createRng(seed);
  const solution = randomSolution(emptyGrid(), rng);
  if (!solution) return null;
  const givens = [...solution];
  let count = CELLS;
  // Remove cells in point-symmetric pairs (classic look), keeping uniqueness and the level cap.
  const order = rng.shuffle(Array.from({ length: 41 }, (_, i) => i));
  const tryRemove = (pair: number[]): void => {
    if (count - pair.length < MIN_GIVENS[target]) return;
    const saved = pair.map((c) => givens[c] ?? 0);
    for (const c of pair) givens[c] = 0;
    if (!hasUniqueSolution(givens) || rate(givens, target).difficulty === null) {
      pair.forEach((c, i) => (givens[c] = saved[i] ?? 0));
    } else {
      count -= pair.length;
    }
  };
  for (const cell of order) {
    const mirror = CELLS - 1 - cell;
    tryRemove(cell === mirror ? [cell] : [cell, mirror]);
  }
  // Still too easy: give up symmetry and try single cells, which often unlocks the harder levels.
  if (rate(givens).difficulty !== target) {
    for (const cell of rng.shuffle(Array.from({ length: CELLS }, (_, i) => i))) {
      if (givens[cell] !== 0) tryRemove([cell]);
    }
  }
  const difficulty = rate(givens).difficulty;
  if (!difficulty) return null;
  return { seed, difficulty, givens, solution };
}

export function generate(seed: string, target: Difficulty, { maxAttempts = 400 }: GenerateOptions = {}): Puzzle {
  let best: Puzzle | null = null;
  for (let i = 0; i < maxAttempts; i++) {
    const p = attempt(`${seed}#${i}`, target);
    if (!p) continue;
    if (p.difficulty === target) return { ...p, seed };
    if (!best || levelIndex(p.difficulty) > levelIndex(best.difficulty)) best = p;
  }
  if (!best) throw new Error('Kein Sudoku erzeugt');
  return { ...best, seed };
}
