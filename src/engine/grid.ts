/** 9x9 grid model: cells 0..80 row-major, digits 1..9, 0 = empty. Pure, no DOM. */

export const SIZE = 9;
export const CELLS = 81;
export const ALL_DIGITS = 0x1ff;

export type Grid = number[];

const ROW_OF = Uint8Array.from({ length: CELLS }, (_, c) => Math.floor(c / SIZE));
const COL_OF = Uint8Array.from({ length: CELLS }, (_, c) => c % SIZE);
const BOX_OF = Uint8Array.from({ length: CELLS }, (_, c) => Math.floor(c / 27) * 3 + Math.floor((c % SIZE) / 3));
export const rowOf = (cell: number): number => ROW_OF[cell]!;
export const colOf = (cell: number): number => COL_OF[cell]!;
export const boxOf = (cell: number): number => BOX_OF[cell]!;

export type UnitKind = 'row' | 'col' | 'box';
export interface Unit {
  readonly kind: UnitKind;
  /** 0..8 within its kind */
  readonly index: number;
  readonly cells: readonly number[];
}

const range9 = Array.from({ length: SIZE }, (_, i) => i);

/** 27 units: rows 0..8, columns 9..17, boxes 18..26. */
export const UNITS: readonly Unit[] = [
  ...range9.map((r) => ({ kind: 'row' as const, index: r, cells: range9.map((c) => r * SIZE + c) })),
  ...range9.map((c) => ({ kind: 'col' as const, index: c, cells: range9.map((r) => r * SIZE + c) })),
  ...range9.map((b) => ({
    kind: 'box' as const,
    index: b,
    cells: range9.map((i) => (Math.floor(b / 3) * 3 + Math.floor(i / 3)) * SIZE + (b % 3) * 3 + (i % 3)),
  })),
];

export const ROW_UNITS = UNITS.slice(0, 9);
export const COL_UNITS = UNITS.slice(9, 18);
export const BOX_UNITS = UNITS.slice(18, 27);

/** The 20 cells sharing a row, column or box with each cell. */
export const PEERS: readonly (readonly number[])[] = Array.from({ length: CELLS }, (_, cell) => {
  const set = new Set<number>();
  for (const unit of [ROW_UNITS[rowOf(cell)], COL_UNITS[colOf(cell)], BOX_UNITS[boxOf(cell)]]) {
    for (const other of unit?.cells ?? []) if (other !== cell) set.add(other);
  }
  return [...set].sort((a, b) => a - b);
});

const PEER_SETS: readonly ReadonlySet<number>[] = PEERS.map((p) => new Set(p));
export const arePeers = (a: number, b: number): boolean => PEER_SETS[a]?.has(b) ?? false;

export const bit = (digit: number): number => 1 << (digit - 1);

export function popcount(mask: number): number {
  let m = mask;
  let n = 0;
  while (m) {
    m &= m - 1;
    n++;
  }
  return n;
}

export function digitsOf(mask: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= SIZE; d++) if (mask & bit(d)) out.push(d);
  return out;
}

export function emptyGrid(): Grid {
  return new Array<number>(CELLS).fill(0);
}

/** Accepts 81 characters of 1..9 and 0 or "." for empty; whitespace is ignored. */
export function parseGrid(text: string): Grid {
  const chars = text.replace(/\s+/g, '');
  if (chars.length !== CELLS || !/^[0-9.]+$/.test(chars)) {
    throw new Error('Ein Sudoku braucht genau 81 Zeichen aus 0-9 oder "."');
  }
  return [...chars].map((ch) => (ch === '.' ? 0 : Number(ch)));
}

export function formatGrid(grid: Grid): string {
  return grid.map((v) => (v === 0 ? '.' : String(v))).join('');
}

export function isGrid(value: unknown): value is Grid {
  return (
    Array.isArray(value) &&
    value.length === CELLS &&
    value.every((v) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= SIZE)
  );
}

/** Cells whose value repeats in one of their units. */
export function conflicts(grid: Grid): Set<number> {
  const out = new Set<number>();
  for (const unit of UNITS) {
    const seen = new Map<number, number>();
    for (const cell of unit.cells) {
      const v = grid[cell] ?? 0;
      if (v === 0) continue;
      const first = seen.get(v);
      if (first === undefined) seen.set(v, cell);
      else {
        out.add(first);
        out.add(cell);
      }
    }
  }
  return out;
}

export const isComplete = (grid: Grid): boolean => grid.every((v) => v !== 0) && conflicts(grid).size === 0;
