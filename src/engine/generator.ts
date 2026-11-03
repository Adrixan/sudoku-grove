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

/** What the generator does, step by step (used by the teaching page). */
export type GeneratorEvent =
  | { type: 'filled'; grid: Grid }
  | { type: 'remove'; cells: number[]; kept: boolean; reason: 'ok' | 'notUnique' | 'tooHard' | 'minGivens'; givens: number }
  | { type: 'asymmetric' }
  | { type: 'done'; difficulty: Difficulty | null; givens: number };

function attempt(seed: string, target: Difficulty, onEvent?: (e: GeneratorEvent) => void): Puzzle | null {
  const rng = createRng(seed);
  const solution = randomSolution(emptyGrid(), rng);
  if (!solution) return null;
  onEvent?.({ type: 'filled', grid: [...solution] });
  const givens = [...solution];
  let count = CELLS;
  // Remove cells in point-symmetric pairs (classic look), keeping uniqueness and the level cap.
  const order = rng.shuffle(Array.from({ length: 41 }, (_, i) => i));
  const tryRemove = (pair: number[]): void => {
    if (count - pair.length < MIN_GIVENS[target]) {
      onEvent?.({ type: 'remove', cells: pair, kept: true, reason: 'minGivens', givens: count });
      return;
    }
    const saved = pair.map((c) => givens[c] ?? 0);
    for (const c of pair) givens[c] = 0;
    const unique = hasUniqueSolution(givens);
    if (!unique || rate(givens, target).difficulty === null) {
      pair.forEach((c, i) => (givens[c] = saved[i] ?? 0));
      onEvent?.({ type: 'remove', cells: pair, kept: true, reason: unique ? 'tooHard' : 'notUnique', givens: count });
    } else {
      count -= pair.length;
      onEvent?.({ type: 'remove', cells: pair, kept: false, reason: 'ok', givens: count });
    }
  };
  for (const cell of order) {
    const mirror = CELLS - 1 - cell;
    tryRemove(cell === mirror ? [cell] : [cell, mirror]);
  }
  // Still too easy: give up symmetry and try single cells, which often unlocks the harder levels.
  if (rate(givens).difficulty !== target) {
    onEvent?.({ type: 'asymmetric' });
    for (const cell of rng.shuffle(Array.from({ length: CELLS }, (_, i) => i))) {
      if (givens[cell] !== 0) tryRemove([cell]);
    }
  }
  const difficulty = rate(givens).difficulty;
  onEvent?.({ type: 'done', difficulty, givens: count });
  if (!difficulty) return null;
  return { seed, difficulty, givens, solution };
}

export interface GenerateResult {
  puzzle: Puzzle;
  /** number of attempts used, the last one produced the puzzle */
  attempts: number;
  /** seed of the producing attempt, replayable with `traceAttempt` */
  attemptSeed: string;
}

export function generateWithInfo(seed: string, target: Difficulty, { maxAttempts = 400 }: GenerateOptions = {}): GenerateResult {
  let best: GenerateResult | null = null;
  for (let i = 0; i < maxAttempts; i++) {
    const attemptSeed = `${seed}#${i}`;
    const p = attempt(attemptSeed, target);
    if (!p) continue;
    if (p.difficulty === target) return { puzzle: { ...p, seed }, attempts: i + 1, attemptSeed };
    if (!best || levelIndex(p.difficulty) > levelIndex(best.puzzle.difficulty)) best = { puzzle: { ...p, seed }, attempts: i + 1, attemptSeed };
  }
  if (!best) throw new Error('Kein Sudoku erzeugt');
  return { ...best, attempts: maxAttempts };
}

export function generate(seed: string, target: Difficulty, options: GenerateOptions = {}): Puzzle {
  return generateWithInfo(seed, target, options).puzzle;
}

/** Replays one generator attempt and records every step. */
export function traceAttempt(attemptSeed: string, target: Difficulty): GeneratorEvent[] {
  const events: GeneratorEvent[] = [];
  attempt(attemptSeed, target, (e) => events.push(e));
  return events;
}
