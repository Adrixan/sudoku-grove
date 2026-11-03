import { describe, expect, it } from 'vitest';
import { generate, generateWithInfo, traceAttempt } from './generator.ts';
import { CELLS, parseGrid } from './grid.ts';
import { traceSearch } from './solver.ts';

const EXAMPLE = '53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79';
const SOLUTION = '534678912672195348198342567859761423426853791713924856961537284287419635345286179';

describe('traceSearch', () => {
  it('replaying the events reaches the solution and proves uniqueness', () => {
    const start = parseGrid(EXAMPLE);
    const trace = traceSearch(start);
    expect(trace.solutions).toBe(1);
    expect(trace.truncated).toBe(false);
    const board = [...start];
    let snapshot: number[] | null = null;
    for (const e of trace.events) {
      if (e.type === 'try') {
        expect(board[e.cell]).toBe(0);
        board[e.cell] = e.digit;
      } else if (e.type === 'undo') board[e.cell] = 0;
      else snapshot = [...board];
    }
    expect(snapshot?.join('')).toBe(SOLUTION);
    expect(trace.tries).toBe(trace.events.filter((e) => e.type === 'try').length);
  });
  it('stops at two solutions on an empty grid', () => {
    const t = traceSearch(new Array<number>(CELLS).fill(0));
    expect(t.solutions).toBe(2);
  });
  it('caps recorded events but keeps counting', () => {
    const t = traceSearch(new Array<number>(CELLS).fill(0), 2, 10);
    expect(t.events).toHaveLength(10);
    expect(t.truncated).toBe(true);
    expect(t.tries).toBeGreaterThan(10);
  });
});

describe('traceAttempt', () => {
  it('replays the attempt that produced the puzzle', () => {
    const { puzzle, attempts, attemptSeed } = generateWithInfo('trace-test', 'mittel');
    expect(generate('trace-test', 'mittel')).toEqual(puzzle);
    expect(attempts).toBeGreaterThanOrEqual(1);
    const events = traceAttempt(attemptSeed, 'mittel');
    const first = events[0];
    if (first?.type !== 'filled') throw new Error('first event must be the filled grid');
    expect(first.grid).toEqual(puzzle.solution);
    const board = [...first.grid];
    for (const e of events) if (e.type === 'remove' && !e.kept) for (const c of e.cells) board[c] = 0;
    expect(board).toEqual(puzzle.givens);
    const last = events.at(-1);
    expect(last?.type === 'done' && last.difficulty).toBe('mittel');
  });
});
