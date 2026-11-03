/** Human solving techniques on a candidate state. Each finder returns one step or null. */
import {
  ALL_DIGITS,
  BOX_UNITS,
  CELLS,
  COL_UNITS,
  type Grid,
  PEERS,
  ROW_UNITS,
  UNITS,
  type Unit,
  arePeers,
  bit,
  boxOf,
  colOf,
  digitsOf,
  popcount,
  rowOf,
} from './grid.ts';

export type Technique =
  | 'hiddenSingle'
  | 'nakedSingle'
  | 'pointing'
  | 'claiming'
  | 'nakedPair'
  | 'hiddenPair'
  | 'nakedTriple'
  | 'hiddenTriple'
  | 'xWing'
  | 'xyWing'
  | 'swordfish';

export interface CellDigit {
  cell: number;
  digit: number;
}

export interface Step {
  technique: Technique;
  placements: CellDigit[];
  eliminations: CellDigit[];
  /** Cells that prove the step (shown highlighted in a hint). */
  cells: number[];
  digits: number[];
  /** Units the step is about, as indices into UNITS. */
  units: number[];
}

export interface State {
  values: Grid;
  /** candidate bitmask per cell; 0 for filled cells */
  cands: number[];
}

export function createState(grid: Grid): State {
  const values = [...grid];
  const cands = values.map((v, cell) => {
    if (v !== 0) return 0;
    let mask = ALL_DIGITS;
    for (const p of PEERS[cell] ?? []) {
      const pv = values[p] ?? 0;
      if (pv) mask &= ~bit(pv);
    }
    return mask;
  });
  return { values, cands };
}

export function applyStep(state: State, step: Step): void {
  for (const { cell, digit } of step.placements) place(state, cell, digit);
  for (const { cell, digit } of step.eliminations) state.cands[cell]! &= ~bit(digit);
}

export function place(state: State, cell: number, digit: number): void {
  state.values[cell] = digit;
  state.cands[cell] = 0;
  for (const p of PEERS[cell] ?? []) state.cands[p]! &= ~bit(digit);
}

/** True when an empty cell has no candidate or a unit lost every place for a missing digit. */
export function isContradiction(state: State): boolean {
  for (let i = 0; i < CELLS; i++) if (state.values[i] === 0 && state.cands[i] === 0) return true;
  for (const unit of UNITS) {
    let placed = 0;
    let possible = 0;
    for (const c of unit.cells) {
      const v = state.values[c] ?? 0;
      if (v) placed |= bit(v);
      possible |= state.cands[c] ?? 0;
    }
    if ((placed | possible) !== ALL_DIGITS) return true;
  }
  return false;
}

const unitIndex = (unit: Unit): number => UNITS.indexOf(unit);
const emptyCells = (state: State, unit: Unit): number[] => unit.cells.filter((c) => state.values[c] === 0);
const cellsWith = (state: State, cells: readonly number[], digit: number): number[] =>
  cells.filter((c) => (state.cands[c]! & bit(digit)) !== 0);

function* combinations<T>(items: readonly T[], k: number, start = 0, acc: T[] = []): Generator<T[]> {
  if (acc.length === k) {
    yield [...acc];
    return;
  }
  for (let i = start; i <= items.length - (k - acc.length); i++) {
    acc.push(items[i] as T);
    yield* combinations(items, k, i + 1, acc);
    acc.pop();
  }
}

/** Boxes first: that is how most people scan. */
const SCAN_ORDER: readonly Unit[] = [...BOX_UNITS, ...ROW_UNITS, ...COL_UNITS];

function hiddenSingle(state: State): Step | null {
  // Hot path of the generator: one pass per unit with bitmasks instead of per-digit scans.
  for (const unit of SCAN_ORDER) {
    let once = 0;
    let twice = 0;
    for (const c of unit.cells) {
      const m = state.cands[c]!;
      twice |= once & m;
      once |= m;
    }
    const single = once & ~twice;
    if (!single) continue;
    const digit = digitsOf(single)[0]!;
    const cell = unit.cells.find((c) => (state.cands[c]! & bit(digit)) !== 0)!;
    return { technique: 'hiddenSingle', placements: [{ cell, digit }], eliminations: [], cells: [cell], digits: [digit], units: [unitIndex(unit)] };
  }
  return null;
}

function nakedSingle(state: State): Step | null {
  for (let cell = 0; cell < CELLS; cell++) {
    const m = state.cands[cell]!;
    if (state.values[cell] === 0 && popcount(m) === 1) {
      const digit = digitsOf(m)[0]!;
      return { technique: 'nakedSingle', placements: [{ cell, digit }], eliminations: [], cells: [cell], digits: [digit], units: [] };
    }
  }
  return null;
}

/** Pointing: a digit inside a box sits in one row or column, so it leaves that line outside the box. */
function pointing(state: State): Step | null {
  for (const box of BOX_UNITS) {
    for (let d = 1; d <= 9; d++) {
      const spots = cellsWith(state, box.cells, d);
      if (spots.length < 2) continue;
      for (const line of [ROW_UNITS[rowOf(spots[0]!)]!, COL_UNITS[colOf(spots[0]!)]!]) {
        if (!spots.every((c) => line.cells.includes(c))) continue;
        const elim = cellsWith(state, line.cells, d).filter((c) => !box.cells.includes(c));
        if (elim.length) {
          return { technique: 'pointing', placements: [], eliminations: elim.map((cell) => ({ cell, digit: d })), cells: spots, digits: [d], units: [unitIndex(box), unitIndex(line)] };
        }
      }
    }
  }
  return null;
}

/** Claiming (box-line reduction): a digit inside a line sits in one box, so it leaves the rest of that box. */
function claiming(state: State): Step | null {
  for (const line of [...ROW_UNITS, ...COL_UNITS]) {
    for (let d = 1; d <= 9; d++) {
      const spots = cellsWith(state, line.cells, d);
      if (spots.length < 2) continue;
      const box = BOX_UNITS[boxOf(spots[0]!)]!;
      if (!spots.every((c) => box.cells.includes(c))) continue;
      const elim = cellsWith(state, box.cells, d).filter((c) => !line.cells.includes(c));
      if (elim.length) {
        return { technique: 'claiming', placements: [], eliminations: elim.map((cell) => ({ cell, digit: d })), cells: spots, digits: [d], units: [unitIndex(line), unitIndex(box)] };
      }
    }
  }
  return null;
}

function nakedSubset(state: State, size: 2 | 3): Step | null {
  const technique: Technique = size === 2 ? 'nakedPair' : 'nakedTriple';
  for (const unit of UNITS) {
    const empties = emptyCells(state, unit).filter((c) => {
      const n = popcount(state.cands[c]!);
      return n >= 2 && n <= size;
    });
    for (const combo of combinations(empties, size)) {
      const union = combo.reduce((m, c) => m | state.cands[c]!, 0);
      if (popcount(union) !== size) continue;
      const elim: CellDigit[] = [];
      for (const c of emptyCells(state, unit)) {
        if (combo.includes(c)) continue;
        for (const d of digitsOf(state.cands[c]! & union)) elim.push({ cell: c, digit: d });
      }
      if (elim.length) return { technique, placements: [], eliminations: elim, cells: combo, digits: digitsOf(union), units: [unitIndex(unit)] };
    }
  }
  return null;
}

function hiddenSubset(state: State, size: 2 | 3): Step | null {
  const technique: Technique = size === 2 ? 'hiddenPair' : 'hiddenTriple';
  for (const unit of UNITS) {
    const open = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => {
      const n = cellsWith(state, unit.cells, d).length;
      return n >= 2 && n <= size;
    });
    for (const digits of combinations(open, size)) {
      const cells = [...new Set(digits.flatMap((d) => cellsWith(state, unit.cells, d)))];
      if (cells.length !== size) continue;
      const keep = digits.reduce((m, d) => m | bit(d), 0);
      const elim: CellDigit[] = [];
      for (const c of cells) for (const d of digitsOf(state.cands[c]! & ~keep)) elim.push({ cell: c, digit: d });
      if (elim.length) return { technique, placements: [], eliminations: elim, cells: cells.sort((a, b) => a - b), digits, units: [unitIndex(unit)] };
    }
  }
  return null;
}

/** X-Wing (size 2) and Swordfish (size 3), on rows and on columns. */
function fish(state: State, size: 2 | 3): Step | null {
  const technique: Technique = size === 2 ? 'xWing' : 'swordfish';
  for (const [bases, covers, crossOf] of [
    [ROW_UNITS, COL_UNITS, colOf],
    [COL_UNITS, ROW_UNITS, rowOf],
  ] as const) {
    for (let d = 1; d <= 9; d++) {
      const candidates = bases.filter((u) => {
        const n = cellsWith(state, u.cells, d).length;
        return n >= 2 && n <= size;
      });
      for (const baseSet of combinations(candidates, size)) {
        const spots = baseSet.flatMap((u) => cellsWith(state, u.cells, d));
        const crossIdx = [...new Set(spots.map(crossOf))];
        if (crossIdx.length !== size) continue;
        const elim: CellDigit[] = [];
        for (const ci of crossIdx) {
          for (const c of cellsWith(state, covers[ci]!.cells, d)) if (!spots.includes(c)) elim.push({ cell: c, digit: d });
        }
        if (elim.length) {
          return { technique, placements: [], eliminations: elim, cells: spots.sort((a, b) => a - b), digits: [d], units: baseSet.map(unitIndex) };
        }
      }
    }
  }
  return null;
}

function xyWing(state: State): Step | null {
  const bivalue = [];
  for (let c = 0; c < CELLS; c++) if (state.values[c] === 0 && popcount(state.cands[c]!) === 2) bivalue.push(c);
  for (const pivot of bivalue) {
    const pm = state.cands[pivot]!;
    const wings = bivalue.filter((c) => c !== pivot && arePeers(pivot, c) && popcount(state.cands[c]! & pm) === 1);
    for (const [a, b] of combinations(wings, 2) as Generator<[number, number]>) {
      const am = state.cands[a]!;
      const bm = state.cands[b]!;
      const z = am & bm & ~pm;
      // a = {x,z}, b = {y,z}, pivot = {x,y} with x != y
      if (popcount(z) !== 1 || (am & pm) === (bm & pm)) continue;
      const elim: CellDigit[] = [];
      for (let c = 0; c < CELLS; c++) {
        if (c === a || c === b || c === pivot || !(state.cands[c]! & z)) continue;
        if (arePeers(c, a) && arePeers(c, b)) elim.push({ cell: c, digit: digitsOf(z)[0]! });
      }
      if (elim.length) return { technique: 'xyWing', placements: [], eliminations: elim, cells: [pivot, a, b], digits: digitsOf(pm | z), units: [] };
    }
  }
  return null;
}

/** Ordered from easiest to hardest; findStep always returns the easiest available step. */
export const TECHNIQUES: readonly { id: Technique; find: (s: State) => Step | null }[] = [
  { id: 'hiddenSingle', find: hiddenSingle },
  { id: 'nakedSingle', find: nakedSingle },
  { id: 'pointing', find: pointing },
  { id: 'claiming', find: claiming },
  { id: 'nakedPair', find: (s) => nakedSubset(s, 2) },
  { id: 'hiddenPair', find: (s) => hiddenSubset(s, 2) },
  { id: 'nakedTriple', find: (s) => nakedSubset(s, 3) },
  { id: 'hiddenTriple', find: (s) => hiddenSubset(s, 3) },
  { id: 'xWing', find: (s) => fish(s, 2) },
  { id: 'xyWing', find: xyWing },
  { id: 'swordfish', find: (s) => fish(s, 3) },
];

export function findStep(state: State): Step | null {
  for (const t of TECHNIQUES) {
    const step = t.find(state);
    if (step) return step;
  }
  return null;
}
