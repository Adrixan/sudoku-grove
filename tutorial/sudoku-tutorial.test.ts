import { describe, expect, it, vi } from 'vitest';
import { isComplete } from '../src/engine/grid.ts';
import { countSolutions } from '../src/engine/solver.ts';

// The tutorial logs to the console on import; keep the test output quiet.
vi.spyOn(console, 'log').mockImplementation(() => undefined);
const tut = await import('./sudoku-tutorial.js');

const SOLUTION = '837251946465739182912486537398527461624913758751864293279348615586192374143675829';

describe('programming tutorial code', () => {
  it('checks placements like the engine', () => {
    expect(tut.erlaubt(tut.feld, 0, 8)).toBe(true);
    expect(tut.erlaubt(tut.feld, 0, 7)).toBe(false); // 7 already in row 1
    expect(tut.erlaubt(tut.feld, 0, 4)).toBe(false); // 4 in column 1
    expect(tut.erlaubt(tut.feld, 0, 1)).toBe(false); // 1 in block 1
  });
  it('solves the tutorial puzzle with both solvers', () => {
    const a = [...tut.feld];
    expect(tut.loese(a)).toBe(true);
    expect(a.join('')).toBe(SOLUTION);
    const b = [...tut.feld];
    expect(tut.loeseSchlau(b)).toBe(true);
    expect(b.join('')).toBe(SOLUTION);
  });
  it('counts solutions with a limit', () => {
    expect(tut.zaehleLoesungen([...tut.feld])).toBe(1);
    expect(tut.zaehleLoesungen(new Array(81).fill(0))).toBe(2);
  });
  it('builds unique puzzles', () => {
    const p = tut.baueSudoku();
    expect(countSolutions(p, 2)).toBe(1);
    const full = new Array(81).fill(0);
    expect(tut.fuelleZufaellig(full)).toBe(true);
    expect(isComplete(full)).toBe(true);
  }, 30_000);
  it('the smart solver needs few tries on this puzzle', () => {
    expect(tut.zaehler()).toBeGreaterThan(0);
    expect(tut.kandidaten(tut.feld, 0)).toContain(8);
  });
});
