/** Small 9x9 board for the teaching demos. Interactive boards use the ARIA grid pattern with arrow keys. */
import { CELLS, type Grid, colOf, rowOf } from '../engine/grid.ts';
import { cellName } from '../engine/hints.ts';

export interface MiniBoardOptions {
  label: string;
  /** called when a cell is chosen by click or keyboard; makes the board interactive */
  onSelect?: (cell: number) => void;
}

export class MiniBoard {
  readonly root: HTMLDivElement;
  private readonly cells: HTMLDivElement[] = [];
  private readonly labels: HTMLSpanElement[] = [];
  private readonly values: HTMLSpanElement[] = [];
  private selected = 0;

  constructor(host: HTMLElement, private readonly options: MiniBoardOptions) {
    this.root = document.createElement('div');
    this.root.className = 'board board--mini';
    const interactive = Boolean(options.onSelect);
    if (interactive) {
      this.root.setAttribute('role', 'grid');
      this.root.setAttribute('aria-label', options.label);
    } else {
      // Static replays are described in text next to the board.
      this.root.setAttribute('aria-hidden', 'true');
    }
    for (let r = 0; r < 9; r++) {
      const row = document.createElement('div');
      row.className = 'board__row';
      if (interactive) row.setAttribute('role', 'row');
      for (let c = 0; c < 9; c++) {
        const i = r * 9 + c;
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        const value = document.createElement('span');
        value.className = 'cell__value';
        if (interactive) {
          cell.setAttribute('role', 'gridcell');
          cell.tabIndex = i === 0 ? 0 : -1;
          value.setAttribute('aria-hidden', 'true');
          const label = document.createElement('span');
          label.className = 'visually-hidden';
          cell.append(label);
          this.labels.push(label);
          cell.addEventListener('click', () => this.select(i, true));
        }
        cell.append(value);
        row.append(cell);
        this.cells.push(cell);
        this.values.push(value);
      }
      this.root.append(row);
    }
    if (interactive) this.root.addEventListener('keydown', (e) => this.onKey(e));
    host.append(this.root);
  }

  setValues(grid: Grid, given?: Grid): void {
    for (let i = 0; i < CELLS; i++) {
      const v = grid[i] ?? 0;
      this.values[i]!.textContent = v ? String(v) : '';
      this.cells[i]!.classList.toggle('is-given', given ? (given[i] ?? 0) !== 0 : v !== 0);
      const label = this.labels[i];
      if (label) label.textContent = `${cellName(i)}, ${v ? v : 'leer'}`;
    }
  }

  setValue(cell: number, value: number): void {
    this.values[cell]!.textContent = value ? String(value) : '';
  }

  /** Replace the given state class on every cell (one class per state). */
  mark(className: string, cells: Iterable<number>): void {
    const set = new Set(cells);
    this.cells.forEach((el, i) => el.classList.toggle(className, set.has(i)));
  }

  select(cell: number, focus: boolean): void {
    this.selected = cell;
    this.cells.forEach((el, i) => {
      el.tabIndex = i === cell ? 0 : -1;
      el.classList.toggle('is-selected', i === cell);
      if (this.options.onSelect) el.setAttribute('aria-selected', String(i === cell));
    });
    if (focus) this.cells[cell]?.focus();
    this.options.onSelect?.(cell);
  }

  private onKey(e: KeyboardEvent): void {
    const r = rowOf(this.selected);
    const c = colOf(this.selected);
    const next: Record<string, number> = {
      ArrowUp: ((r + 8) % 9) * 9 + c,
      ArrowDown: ((r + 1) % 9) * 9 + c,
      ArrowLeft: r * 9 + ((c + 8) % 9),
      ArrowRight: r * 9 + ((c + 1) % 9),
      Home: r * 9,
      End: r * 9 + 8,
    };
    const target = next[e.key];
    if (target === undefined) return;
    e.preventDefault();
    this.select(target, true);
  }
}
