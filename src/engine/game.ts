/** Game state as a pure reducer: entries, pencil marks, undo/redo, completion. No DOM, no storage. */
import type { Puzzle } from './generator.ts';
import { ALL_DIGITS, CELLS, type Grid, PEERS, bit, conflicts } from './grid.ts';
import type { CellDigit } from './techniques.ts';

export const GAME_VERSION = 1;

interface CellSnapshot {
  value: number;
  notes: number;
}
interface Change {
  cell: number;
  before: CellSnapshot;
  after: CellSnapshot;
}
export type Move = Change[];

export interface Game {
  version: typeof GAME_VERSION;
  puzzle: Puzzle;
  /** ISO date (Europe/Vienna) for the daily puzzle, otherwise null */
  daily: string | null;
  values: Grid;
  /** pencil marks per cell as digit bitmask */
  notes: number[];
  history: Move[];
  future: Move[];
  elapsedMs: number;
  hintsUsed: number;
  completed: boolean;
}

export function newGame(puzzle: Puzzle, daily: string | null = null): Game {
  return {
    version: GAME_VERSION,
    puzzle,
    daily,
    values: [...puzzle.givens],
    notes: new Array<number>(CELLS).fill(0),
    history: [],
    future: [],
    elapsedMs: 0,
    hintsUsed: 0,
    completed: false,
  };
}

export const isGiven = (game: Game, cell: number): boolean => (game.puzzle.givens[cell] ?? 0) !== 0;

const snap = (game: Game, cell: number): CellSnapshot => ({ value: game.values[cell] ?? 0, notes: game.notes[cell] ?? 0 });

function commit(game: Game, move: Move): Game {
  const changes = move.filter((c) => c.before.value !== c.after.value || c.before.notes !== c.after.notes);
  if (changes.length === 0 || game.completed) return game;
  const values = [...game.values];
  const notes = [...game.notes];
  for (const c of changes) {
    values[c.cell] = c.after.value;
    notes[c.cell] = c.after.notes;
  }
  const completed = values.every((v, i) => v === game.puzzle.solution[i]);
  return { ...game, values, notes, history: [...game.history, changes], future: [], completed };
}

/** Enter a digit (0 clears). Placing a digit also removes it from the pencil marks of all peers. */
export function setDigit(game: Game, cell: number, digit: number): Game {
  if (isGiven(game, cell) || digit < 0 || digit > 9) return game;
  const before = snap(game, cell);
  const value = before.value === digit ? 0 : digit;
  const move: Move = [{ cell, before, after: { value, notes: 0 } }];
  if (value) {
    for (const p of PEERS[cell] ?? []) {
      const b = snap(game, p);
      if (b.notes & bit(value)) move.push({ cell: p, before: b, after: { ...b, notes: b.notes & ~bit(value) } });
    }
  }
  return commit(game, move);
}

export function toggleNote(game: Game, cell: number, digit: number): Game {
  if (isGiven(game, cell) || digit < 1 || digit > 9) return game;
  const before = snap(game, cell);
  if (before.value !== 0) return game;
  return commit(game, [{ cell, before, after: { value: 0, notes: before.notes ^ bit(digit) } }]);
}

export function erase(game: Game, cell: number): Game {
  if (isGiven(game, cell)) return game;
  return commit(game, [{ cell, before: snap(game, cell), after: { value: 0, notes: 0 } }]);
}

/** Candidates from the current entries only (what a careful player would pencil in). */
export function basicCandidates(values: Grid, cell: number): number {
  if (values[cell]) return 0;
  let mask = ALL_DIGITS;
  for (const p of PEERS[cell] ?? []) {
    const v = values[p] ?? 0;
    if (v) mask &= ~bit(v);
  }
  return mask;
}

/** Fill every empty cell's pencil marks with its candidates (one undo step). */
export function fillAllNotes(game: Game): Game {
  const move: Move = [];
  for (let cell = 0; cell < CELLS; cell++) {
    const b = snap(game, cell);
    if (b.value) continue;
    move.push({ cell, before: b, after: { value: 0, notes: basicCandidates(game.values, cell) } });
  }
  return commit(game, move);
}

/** Apply a hint: placements are entered, eliminations update the pencil marks of the affected cells. */
export function applyHint(game: Game, placements: CellDigit[], eliminations: CellDigit[], candidates: number[]): Game {
  let next = game;
  for (const p of placements) next = setDigit(next, p.cell, p.digit);
  if (eliminations.length) {
    const byCell = new Map<number, number>();
    for (const e of eliminations) byCell.set(e.cell, (byCell.get(e.cell) ?? candidates[e.cell] ?? 0) & ~bit(e.digit));
    const move: Move = [...byCell].map(([cell, notes]) => ({ cell, before: snap(next, cell), after: { value: 0, notes } }));
    next = commit(next, move);
  }
  return next === game ? game : { ...next, hintsUsed: game.hintsUsed + 1 };
}

export function undo(game: Game): Game {
  const move = game.history.at(-1);
  if (!move || game.completed) return game;
  const values = [...game.values];
  const notes = [...game.notes];
  for (const c of move) {
    values[c.cell] = c.before.value;
    notes[c.cell] = c.before.notes;
  }
  return { ...game, values, notes, history: game.history.slice(0, -1), future: [...game.future, move] };
}

export function redo(game: Game): Game {
  const move = game.future.at(-1);
  if (!move || game.completed) return game;
  const values = [...game.values];
  const notes = [...game.notes];
  for (const c of move) {
    values[c.cell] = c.after.value;
    notes[c.cell] = c.after.notes;
  }
  const completed = values.every((v, i) => v === game.puzzle.solution[i]);
  return { ...game, values, notes, history: [...game.history, move], future: game.future.slice(0, -1), completed };
}

/** Rule conflicts (same digit twice in a unit): always visible, they need no knowledge of the solution. */
export const conflictCells = (game: Game): Set<number> => conflicts(game.values);

/** Entries that differ from the solution (shown only on request or by a hint). */
export function wrongCells(game: Game): number[] {
  const out: number[] = [];
  for (let c = 0; c < CELLS; c++) {
    const v = game.values[c] ?? 0;
    if (v && !isGiven(game, c) && v !== game.puzzle.solution[c]) out.push(c);
  }
  return out;
}

/** Cells whose pencil marks exclude the correct digit. */
export function wrongNoteCells(game: Game): number[] {
  const out: number[] = [];
  for (let c = 0; c < CELLS; c++) {
    const n = game.notes[c] ?? 0;
    if (n && !game.values[c] && !(n & bit(game.puzzle.solution[c] ?? 0))) out.push(c);
  }
  return out;
}

export const remainingOf = (game: Game, digit: number): number => 9 - game.values.filter((v) => v === digit).length;
