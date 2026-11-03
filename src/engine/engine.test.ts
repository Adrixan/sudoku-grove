import { describe, expect, it } from 'vitest';
import { generate } from './generator.ts';
import { ALL_DIGITS, CELLS, PEERS, UNITS, bit, conflicts, emptyGrid, formatGrid, isComplete, parseGrid } from './grid.ts';
import { DIFFICULTIES, rate } from './rater.ts';
import { createRng } from './rng.ts';
import { countSolutions, hasUniqueSolution, solve } from './solver.ts';
import { type State, type Technique, TECHNIQUES, applyStep, createState, findStep } from './techniques.ts';

// Classic textbook example (Wikipedia "Sudoku"), used only as a test fixture.
const EXAMPLE = '53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79';
const EXAMPLE_SOLUTION = '534678912672195348198342567859761423426853791713924856961537284287419635345286179';

const cell = (r: number, c: number): number => r * 9 + c;
const finder = (id: Technique) => TECHNIQUES.find((t) => t.id === id)!.find;

/** Empty board where every cell allows every digit; tests carve out candidate patterns. */
function openState(): State {
  return { values: emptyGrid(), cands: new Array<number>(CELLS).fill(ALL_DIGITS) };
}
const remove = (s: State, cells: number[], digit: number) => cells.forEach((c) => (s.cands[c]! &= ~bit(digit)));
const rowCells = (r: number) => Array.from({ length: 9 }, (_, c) => cell(r, c));
const colCells = (c: number) => Array.from({ length: 9 }, (_, r) => cell(r, c));

describe('grid', () => {
  it('has 27 units of 9 cells and 20 peers per cell', () => {
    expect(UNITS).toHaveLength(27);
    expect(UNITS.every((u) => u.cells.length === 9 && new Set(u.cells).size === 9)).toBe(true);
    expect(PEERS.every((p) => p.length === 20)).toBe(true);
  });
  it('parses and formats round trip and rejects bad input', () => {
    expect(formatGrid(parseGrid(EXAMPLE))).toBe(EXAMPLE);
    expect(() => parseGrid('123')).toThrow();
    expect(() => parseGrid('x'.repeat(81))).toThrow();
  });
  it('finds conflicts', () => {
    const g = emptyGrid();
    g[0] = 5;
    g[8] = 5;
    g[40] = 3;
    expect([...conflicts(g)].sort((a, b) => a - b)).toEqual([0, 8]);
    expect(isComplete(parseGrid(EXAMPLE_SOLUTION))).toBe(true);
  });
});

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = createRng('2026-11-03');
    const b = createRng('2026-11-03');
    const c = createRng('2026-11-04');
    const seqA = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(seqA);
    expect(Array.from({ length: 5 }, () => c.next())).not.toEqual(seqA);
    expect(seqA.every((x) => x >= 0 && x < 1)).toBe(true);
  });
  it('shuffles into a permutation', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    expect(createRng('x').shuffle(items).sort((a, b) => a - b)).toEqual(items);
  });
});

describe('solver', () => {
  it('solves the example uniquely', () => {
    const g = parseGrid(EXAMPLE);
    expect(formatGrid(solve(g)!)).toBe(EXAMPLE_SOLUTION);
    expect(hasUniqueSolution(g)).toBe(true);
  });
  it('counts multiple solutions up to the limit and rejects invalid givens', () => {
    expect(countSolutions(emptyGrid(), 2)).toBe(2);
    const bad = emptyGrid();
    bad[0] = 1;
    bad[1] = 1;
    expect(countSolutions(bad)).toBe(0);
    expect(solve(bad)).toBeNull();
  });
});

describe('techniques', () => {
  it('hidden single: the only place for a digit in a box', () => {
    const s = openState();
    remove(s, [0, 1, 2, 9, 10, 11, 18, 19].map((x) => x), 4); // box 0 keeps 4 only in cell 20
    const step = finder('hiddenSingle')(s)!;
    expect(step.placements).toEqual([{ cell: 20, digit: 4 }]);
  });
  it('naked single: one candidate left', () => {
    const s = openState();
    s.cands[40] = bit(7);
    expect(finder('nakedSingle')(s)!.placements).toEqual([{ cell: 40, digit: 7 }]);
  });
  it('pointing: digit confined to one row of a box leaves the rest of the row', () => {
    const s = openState();
    remove(s, [cell(1, 0), cell(1, 1), cell(1, 2), cell(2, 0), cell(2, 1), cell(2, 2)], 5);
    const step = finder('pointing')(s)!;
    expect(step.digits).toEqual([5]);
    expect(step.eliminations.map((e) => e.cell).sort((a, b) => a - b)).toEqual(rowCells(0).slice(3));
  });
  it('claiming: digit confined to one box within a row leaves the rest of the box', () => {
    const s = openState();
    remove(s, rowCells(0).slice(3), 6);
    // make pointing impossible for 6 in box 0 by keeping it spread over rows 0..2
    const step = finder('claiming')(s)!;
    expect(step.digits).toEqual([6]);
    expect(step.eliminations.map((e) => e.cell).sort((a, b) => a - b)).toEqual([9, 10, 11, 18, 19, 20]);
  });
  it('naked pair: two cells with the same two candidates', () => {
    const s = openState();
    s.cands[cell(4, 0)] = bit(1) | bit(2);
    s.cands[cell(4, 5)] = bit(1) | bit(2);
    const step = finder('nakedPair')(s)!;
    expect(step.cells).toEqual([cell(4, 0), cell(4, 5)]);
    const elimCells = new Set(step.eliminations.map((e) => e.cell));
    expect(elimCells.has(cell(4, 3))).toBe(true);
    expect(step.eliminations.every((e) => e.digit === 1 || e.digit === 2)).toBe(true);
  });
  it('hidden pair: two digits share only two cells of a unit', () => {
    const s = openState();
    const others = rowCells(3).filter((c) => c !== cell(3, 1) && c !== cell(3, 7));
    remove(s, others, 8);
    remove(s, others, 9);
    const step = finder('hiddenPair')(s)!;
    expect(step.cells).toEqual([cell(3, 1), cell(3, 7)]);
    expect(step.eliminations).toHaveLength(14);
  });
  it('x-wing on rows eliminates the digit from the two columns', () => {
    const s = openState();
    remove(s, rowCells(0).filter((c) => c !== cell(0, 2) && c !== cell(0, 6)), 1);
    remove(s, rowCells(4).filter((c) => c !== cell(4, 2) && c !== cell(4, 6)), 1);
    const step = finder('xWing')(s)!;
    expect(step.cells).toEqual([cell(0, 2), cell(0, 6), cell(4, 2), cell(4, 6)]);
    expect(step.eliminations).toHaveLength(14);
    expect(step.eliminations.every((e) => e.digit === 1 && [2, 6].includes(e.cell % 9))).toBe(true);
  });
  it('swordfish on rows', () => {
    const s = openState();
    const keep: Record<number, number[]> = { 1: [0, 4], 4: [4, 8], 7: [0, 8] };
    for (const [r, cols] of Object.entries(keep)) {
      remove(s, rowCells(Number(r)).filter((c) => !cols.includes(c % 9)), 3);
    }
    const step = finder('swordfish')(s)!;
    expect(step.digits).toEqual([3]);
    expect(step.eliminations.every((e) => [0, 4, 8].includes(e.cell % 9) && ![1, 4, 7].includes(Math.floor(e.cell / 9)))).toBe(true);
    expect(step.eliminations).toHaveLength(18);
  });
  it('xy-wing eliminates z from cells seeing both pincers', () => {
    const s = openState();
    s.cands[cell(0, 0)] = bit(1) | bit(2); // pivot {x,y}
    s.cands[cell(0, 5)] = bit(1) | bit(3); // pincer {x,z}
    s.cands[cell(5, 0)] = bit(2) | bit(3); // pincer {y,z}
    const step = finder('xyWing')(s)!;
    expect(step.cells).toEqual([cell(0, 0), cell(0, 5), cell(5, 0)]);
    expect(step.eliminations).toEqual([{ cell: cell(5, 5), digit: 3 }]);
  });
  it('steps on a real puzzle never contradict the solution', () => {
    const solution = parseGrid(EXAMPLE_SOLUTION);
    const state = createState(parseGrid(EXAMPLE));
    for (let step = findStep(state); step; step = findStep(state)) {
      for (const p of step.placements) expect(p.digit).toBe(solution[p.cell]);
      for (const e of step.eliminations) expect(e.digit).not.toBe(solution[e.cell]);
      applyStep(state, step);
    }
    expect(formatGrid(state.values)).toBe(EXAMPLE_SOLUTION);
  });
});

describe('rater', () => {
  it('rates the singles-only example as leicht', () => {
    expect(rate(parseGrid(EXAMPLE)).difficulty).toBe('leicht');
  });
});

describe('generator', () => {
  it('is deterministic per seed', () => {
    expect(generate('daily-2026-11-03', 'mittel')).toEqual(generate('daily-2026-11-03', 'mittel'));
  });
  for (const difficulty of DIFFICULTIES) {
    it(`builds sound, unique ${difficulty} puzzles`, () => {
      for (let i = 0; i < 3; i++) {
        const p = generate(`test-${difficulty}-${i}`, difficulty);
        expect(p.difficulty).toBe(difficulty);
        expect(hasUniqueSolution(p.givens)).toBe(true);
        expect(isComplete(p.solution)).toBe(true);
        expect(p.givens.every((v, c) => v === 0 || v === p.solution[c])).toBe(true);
        const state = createState(p.givens);
        for (const step of rate(p.givens).steps) {
          for (const pl of step.placements) expect(pl.digit).toBe(p.solution[pl.cell]);
          for (const e of step.eliminations) expect(e.digit).not.toBe(p.solution[e.cell]);
          applyStep(state, step);
        }
        expect(state.values).toEqual(p.solution);
      }
    }, 60_000);
  }
});
