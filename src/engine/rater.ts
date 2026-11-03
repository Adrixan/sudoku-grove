/** Rates a puzzle by the hardest technique a human needs when always taking the easiest step. */
import { type Grid, conflicts } from './grid.ts';
import { type State, type Step, type Technique, applyStep, createState, findStep } from './techniques.ts';

export const DIFFICULTIES = ['leicht', 'mittel', 'schwer', 'experte'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const TECHNIQUE_LEVEL: Record<Technique, Difficulty> = {
  hiddenSingle: 'leicht',
  nakedSingle: 'leicht',
  pointing: 'mittel',
  claiming: 'mittel',
  nakedPair: 'mittel',
  hiddenPair: 'mittel',
  nakedTriple: 'schwer',
  hiddenTriple: 'schwer',
  xWing: 'schwer',
  xyWing: 'experte',
  swordfish: 'experte',
};

export const levelIndex = (d: Difficulty): number => DIFFICULTIES.indexOf(d);

export interface Rating {
  /** null when our techniques cannot finish the puzzle (then it is never served) */
  difficulty: Difficulty | null;
  steps: Step[];
  used: Partial<Record<Technique, number>>;
}

/** Logical solve. Stops early once the level exceeds `maxLevel` (generator speed-up). */
export function rate(grid: Grid, maxLevel?: Difficulty): Rating {
  const state: State = createState(grid);
  const steps: Step[] = [];
  const used: Partial<Record<Technique, number>> = {};
  let level = 0;
  const cap = maxLevel ? levelIndex(maxLevel) : DIFFICULTIES.length - 1;
  // From conflict-free givens every step is sound, so a filled grid is a real solution and a dead end
  // shows up as "no step found"; no per-step contradiction scan is needed.
  if (conflicts(grid).size > 0) return { difficulty: null, steps, used };
  let empty = state.values.filter((v) => v === 0).length;
  for (;;) {
    if (empty === 0) return { difficulty: DIFFICULTIES[level] ?? null, steps, used };
    const step = findStep(state);
    if (!step) return { difficulty: null, steps, used };
    level = Math.max(level, levelIndex(TECHNIQUE_LEVEL[step.technique]));
    if (level > cap) return { difficulty: null, steps, used };
    used[step.technique] = (used[step.technique] ?? 0) + 1;
    steps.push(step);
    applyStep(state, step);
    empty -= step.placements.length;
  }
}
