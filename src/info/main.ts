/** Teaching page: interactive demos for the data structure, bitmasks, PRNG, generator, solver and rater. */
import '../ui/styles.css';
import './info.css';
import { dailySeed, viennaDate } from '../engine/daily.ts';
import { type GeneratorEvent, type Puzzle, generateWithInfo, traceAttempt } from '../engine/generator.ts';
import { ALL_DIGITS, CELLS, type Grid, PEERS, bit, boxOf, colOf, digitsOf, popcount, rowOf } from '../engine/grid.ts';
import { TECHNIQUE_NAMES, cellName, explain } from '../engine/hints.ts';
import { DIFFICULTIES, type Difficulty, TECHNIQUE_LEVEL, rate } from '../engine/rater.ts';
import { createRng } from '../engine/rng.ts';
import { type SearchTrace, traceSearch } from '../engine/solver.ts';
import type { Technique } from '../engine/techniques.ts';
import { initThemeToggle } from '../ui/theme.ts';
import { MiniBoard } from '../ui/miniboard.ts';

const LABEL: Record<Difficulty, string> = { leicht: 'Leicht', mittel: 'Mittel', schwer: 'Schwer', experte: 'Experte' };

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} fehlt`);
  return el as T;
}

const binary = (mask: number): string => `0b${mask.toString(2).padStart(9, '0')}`;
const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function stats(dl: HTMLElement, rows: [string, string | number][]): void {
  dl.replaceChildren(
    ...rows.flatMap(([k, v]) => {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = String(v);
      return [dt, dd];
    }),
  );
}

function candidatesOf(grid: Grid, cell: number): number {
  if (grid[cell]) return 0;
  let mask = ALL_DIGITS;
  for (const p of PEERS[cell] ?? []) if (grid[p]) mask &= ~bit(grid[p] ?? 0);
  return mask;
}

/** Steps through a list of events with play, pause, single step and jump to the end. */
class Player {
  private index = 0;
  private timer = 0;
  private playing = false;
  constructor(
    private readonly length: () => number,
    private readonly apply: (i: number) => void,
    private readonly perTick: () => number,
    private readonly onState: (playing: boolean, done: boolean) => void,
  ) {}
  reset(): void {
    this.pause();
    this.index = 0;
    this.onState(false, this.length() === 0);
  }
  get position(): number {
    return this.index;
  }
  step(n = 1): void {
    const end = Math.min(this.length(), this.index + n);
    while (this.index < end) this.apply(this.index++);
    const done = this.index >= this.length();
    if (done) this.pause();
    this.onState(this.playing, done);
  }
  toEnd(): void {
    this.step(this.length() - this.index);
  }
  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }
  private play(): void {
    if (this.index >= this.length()) return;
    this.playing = true;
    const tick = (): void => {
      if (!this.playing) return;
      this.step(this.perTick());
      if (this.playing) this.timer = window.setTimeout(tick, 60);
    };
    tick();
  }
  pause(): void {
    this.playing = false;
    window.clearTimeout(this.timer);
    this.onState(false, this.index >= this.length());
  }
}

interface LabResult {
  puzzle: Puzzle;
  attempts: number;
  attemptSeed: string;
  generatorEvents: GeneratorEvent[];
  search: SearchTrace;
}

// ---------- worker for the lab (fallback: main thread) ----------
let worker: Worker | null = null;
let requestId = 0;
const pending = new Map<number, (r: LabResult | null) => void>();
try {
  worker = new Worker(new URL('../worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<LabResult & { id: number; error?: string }>) => {
    const resolve = pending.get(e.data.id);
    pending.delete(e.data.id);
    resolve?.(e.data.error ? null : e.data);
  };
  worker.onerror = () => {
    worker = null;
    for (const r of pending.values()) r(null);
    pending.clear();
  };
} catch {
  worker = null;
}

async function runLab(seed: string, difficulty: Difficulty): Promise<LabResult> {
  if (worker) {
    const id = ++requestId;
    const result = await new Promise<LabResult | null>((resolve) => {
      pending.set(id, resolve);
      worker?.postMessage({ id, kind: 'lab', seed, difficulty });
    });
    if (result) return result;
  }
  const info = generateWithInfo(seed, difficulty);
  return { ...info, generatorEvents: traceAttempt(info.attemptSeed, difficulty), search: traceSearch(info.puzzle.givens, 2, 40_000) };
}

function start(): void {
  initThemeToggle();
  const today = viennaDate();

  // ---------- 1: data structure ----------
  const example = generateWithInfo('info-beispiel', 'leicht').puzzle.givens;
  let chosenCell = 40;
  const feldOut = $('demo-feld-out');
  const feldBoard = new MiniBoard($('demo-feld-board'), {
    label: 'Beispiel-Spielfeld',
    onSelect: (cell) => {
      chosenCell = cell;
      feldBoard.mark('is-peer', PEERS[cell] ?? []);
      const r = rowOf(cell);
      const c = colOf(cell);
      const v = example[cell] ?? 0;
      const cands = candidatesOf(example, cell);
      feldOut.innerHTML = '';
      const lines = [
        `${cellName(cell)} (ab 1 gezählt)`,
        `Index ${cell} = 9 · ${r} + ${c}`,
        `Zeile ${r} = ${cell} div 9, Spalte ${c} = ${cell} mod 9 (ab 0 gezählt)`,
        `Block ${boxOf(cell)} = 3 · (${r} div 3) + (${c} div 3)`,
        v ? `Inhalt: ${v} (Vorgabe)` : `Leer, Kandidaten: ${digitsOf(cands).join(', ')} (${binary(cands)})`,
        '20 Nachbarn sind markiert.',
      ];
      for (const line of lines) {
        const p = document.createElement('p');
        p.textContent = line;
        feldOut.append(p);
      }
    },
  });
  feldBoard.setValues(example);
  feldBoard.select(40, false);

  // ---------- 2: bitmask ----------
  let mask = 0b000010101;
  const bitsHost = $('demo-bits');
  const bitsOut = $('demo-bits-out');
  const bitButtons: HTMLButtonElement[] = [];
  for (let d = 9; d >= 1; d--) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bit';
    // Name "Ziffer 9" from text; aria-pressed tells whether the bit is set.
    b.innerHTML = `<span class="visually-hidden">Ziffer </span><span class="bit__digit">${d}</span><span class="bit__value" aria-hidden="true"></span>`;
    b.addEventListener('click', () => {
      mask ^= bit(d);
      renderBits();
    });
    bitsHost.append(b);
    bitButtons[d] = b;
  }
  function renderBits(): void {
    for (let d = 1; d <= 9; d++) {
      const on = (mask & bit(d)) !== 0;
      const b = bitButtons[d]!;
      b.setAttribute('aria-pressed', String(on));
      b.querySelector('.bit__value')!.textContent = on ? '1' : '0';
    }
    const digits = digitsOf(mask);
    bitsOut.innerHTML = '';
    for (const line of [
      `Binär: ${binary(mask)}`,
      `Dezimal: ${mask}`,
      `Kandidaten: ${digits.length ? digits.join(', ') : 'keine'} (Popcount ${popcount(mask)})`,
      digits.length === 1 ? `Nur eine Möglichkeit: Hier muss die ${digits[0]} stehen.` : digits.length === 0 ? 'Keine Möglichkeit: Sackgasse, der Löser müsste zurückgehen.' : '',
    ]) {
      if (!line) continue;
      const p = document.createElement('p');
      p.textContent = line;
      bitsOut.append(p);
    }
  }
  $('demo-bits-from-cell').addEventListener('click', () => {
    mask = candidatesOf(example, chosenCell);
    renderBits();
  });
  renderBits();

  // ---------- 3: PRNG ----------
  const seedInput = $<HTMLInputElement>('demo-seed');
  const seedOut = $('demo-seed-out');
  seedInput.value = dailySeed(today);
  const draw = (): void => {
    const rng = createRng(seedInput.value);
    const digits = Array.from({ length: 10 }, () => rng.int(9) + 1);
    seedOut.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'mono';
    p.textContent = digits.join('  ');
    const q = document.createElement('p');
    q.textContent = `Startwert „${seedInput.value}“: ${digits.join(', ')}`;
    q.className = 'visually-hidden';
    seedOut.append(p, q);
  };
  $('demo-seed-run').addEventListener('click', draw);
  draw();

  // ---------- 4 to 6: generator, solver, rater on one puzzle ----------
  const genLevel = $<HTMLSelectElement>('demo-gen-level');
  const genSeed = $<HTMLInputElement>('demo-gen-seed');
  genSeed.value = `info-${today}`;
  const genBoard = new MiniBoard($('demo-gen-board'), { label: 'Generator' });
  const solveBoard = new MiniBoard($('demo-solve-board'), { label: 'Löser' });
  const genStatus = $('demo-gen-status');
  const genStats = $('demo-gen-stats');
  const solveStatus = $('demo-solve-status');
  const solveStats = $('demo-solve-stats');
  const genPlay = $<HTMLButtonElement>('demo-gen-play');
  const solvePlay = $<HTMLButtonElement>('demo-solve-play');
  const speed = $<HTMLSelectElement>('demo-solve-speed');
  let lab: LabResult | null = null;

  // generator replay state
  let genGrid: Grid = new Array<number>(CELLS).fill(0);
  let genCount = { removed: 0, notUnique: 0, tooHard: 0, givens: 81 };
  const genPlayer = new Player(
    () => lab?.generatorEvents.length ?? 0,
    (i) => {
      const e = lab?.generatorEvents[i];
      if (!e) return;
      genBoard.mark('is-back', []);
      genBoard.mark('is-removed-now', []);
      if (e.type === 'filled') {
        genGrid = [...e.grid];
        genBoard.setValues(genGrid);
        genStatus.textContent = 'Volles Gitter gebaut. Jetzt werden Ziffern entfernt.';
      } else if (e.type === 'remove') {
        const where = e.cells.map(cellName).join(' und ');
        if (!e.kept) {
          for (const c of e.cells) genGrid[c] = 0;
          genBoard.setValues(genGrid);
          genBoard.mark('is-removed-now', e.cells);
          genCount.removed += e.cells.length;
          genStatus.textContent = `Entfernt: ${where}. Noch genau eine Lösung.`;
        } else if (e.reason !== 'minGivens') {
          genBoard.mark('is-back', e.cells);
          if (e.reason === 'notUnique') genCount.notUnique++;
          else genCount.tooHard++;
          genStatus.textContent = `${where}: zurückgelegt, ${e.reason === 'notUnique' ? 'sonst gäbe es mehrere Lösungen' : 'sonst wäre es zu schwer'}.`;
        }
        genCount.givens = e.givens;
      } else if (e.type === 'asymmetric') {
        genStatus.textContent = 'Noch zu leicht: Jetzt werden auch einzelne Felder ohne Symmetrie probiert.';
      } else {
        genStatus.textContent = e.difficulty
          ? `Fertig: ${e.givens} Vorgaben, Stufe ${LABEL[e.difficulty]}.`
          : 'Dieser Versuch hat nicht geklappt.';
      }
      renderGenStats();
    },
    () => 1,
    (playing, done) => {
      // No live announcements while playing (too many); the final state is announced.
      genStatus.setAttribute('aria-live', playing ? 'off' : 'polite');
      genPlay.textContent = playing ? 'Pause' : 'Abspielen';
      genPlay.disabled = done;
      $<HTMLButtonElement>('demo-gen-step').disabled = done;
      $<HTMLButtonElement>('demo-gen-end').disabled = done;
    },
  );
  function renderGenStats(): void {
    stats(genStats, [
      ['Versuche gebraucht', lab?.attempts ?? '…'],
      ['Startwert des Versuchs', lab?.attemptSeed ?? '…'],
      ['Vorgaben', genCount.givens],
      ['Entfernt', genCount.removed],
      ['Zurückgelegt: mehrere Lösungen', genCount.notUnique],
      ['Zurückgelegt: zu schwer', genCount.tooHard],
    ]);
  }

  // solver replay state
  let solveGrid: Grid = [];
  let solveCount = { tries: 0, undos: 0, solutions: 0, depth: 0 };
  const solvePlayer = new Player(
    () => lab?.search.events.length ?? 0,
    (i) => {
      const e = lab?.search.events[i];
      if (!e) return;
      if (e.type === 'try') {
        solveGrid[e.cell] = e.digit;
        solveBoard.setValue(e.cell, e.digit);
        solveBoard.mark('is-try', [e.cell]);
        solveCount.tries++;
        solveCount.depth = e.depth + 1;
        solveStatus.textContent = `Versuche ${e.digit} in ${cellName(e.cell)} (Tiefe ${e.depth + 1}).`;
      } else if (e.type === 'undo') {
        solveGrid[e.cell] = 0;
        solveBoard.setValue(e.cell, 0);
        solveBoard.mark('is-try', []);
        solveBoard.mark('is-undo', [e.cell]);
        solveCount.undos++;
        solveCount.depth = e.depth;
        solveStatus.textContent = `Sackgasse: ${cellName(e.cell)} wird zurückgenommen.`;
      } else {
        solveCount.solutions = e.count;
        solveStatus.textContent = e.count === 1 ? 'Erste Lösung gefunden. Gibt es eine zweite? Weitersuchen …' : 'Zweite Lösung gefunden: nicht eindeutig.';
      }
      renderSolveStats();
    },
    () => Number(speed.value) || 1,
    (playing, done) => {
      solveStatus.setAttribute('aria-live', playing ? 'off' : 'polite');
      solvePlay.textContent = playing ? 'Pause' : 'Abspielen';
      solvePlay.disabled = done;
      $<HTMLButtonElement>('demo-solve-step').disabled = done;
      $<HTMLButtonElement>('demo-solve-end').disabled = done;
      if (done && lab) {
        solveBoard.mark('is-try', []);
        solveBoard.mark('is-undo', []);
        const s = lab.search;
        solveStatus.textContent =
          s.solutions === 1
            ? `Suche beendet: Es gibt genau eine Lösung. ${s.tries} Versuche, ${s.undos} Rücknahmen.${s.truncated ? ' (Die Zeitlupe zeigt nur den Anfang.)' : ''}`
            : `Suche beendet: ${s.solutions} Lösungen.`;
      }
    },
  );
  function renderSolveStats(): void {
    stats(solveStats, [
      ['Versuche', solveCount.tries],
      ['Rücknahmen', solveCount.undos],
      ['Suchtiefe', solveCount.depth],
      ['Gefundene Lösungen', solveCount.solutions],
      ['Versuche insgesamt', lab?.search.tries ?? '…'],
    ]);
  }

  function renderRating(puzzle: Puzzle): void {
    const out = $('demo-rate-out');
    const rating = rate(puzzle.givens);
    out.innerHTML = '';
    const p = document.createElement('p');
    p.textContent = `Das Sudoku hat ${puzzle.givens.filter(Boolean).length} Vorgaben. Der menschliche Löser braucht ${rating.steps.length} Schritte. Stufe: ${rating.difficulty ? LABEL[rating.difficulty] : 'unbekannt'}.`;
    const table = document.createElement('table');
    table.innerHTML = '<caption>Verwendete Techniken</caption><thead><tr><th scope="col">Technik</th><th scope="col">Stufe</th><th scope="col">Anzahl</th></tr></thead>';
    const body = document.createElement('tbody');
    for (const [t, n] of Object.entries(rating.used) as [Technique, number][]) {
      const tr = document.createElement('tr');
      for (const [i, text] of [TECHNIQUE_NAMES[t], LABEL[TECHNIQUE_LEVEL[t]], String(n)].entries()) {
        const cell = document.createElement(i === 0 ? 'th' : 'td');
        if (i === 0) cell.setAttribute('scope', 'row');
        cell.textContent = text;
        tr.append(cell);
      }
      body.append(tr);
    }
    table.append(body);
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', 'Tabelle der verwendeten Techniken');
    wrap.append(table);
    const details = document.createElement('details');
    details.className = 'steps';
    const summary = document.createElement('summary');
    summary.textContent = 'Alle Schritte des menschlichen Lösers zeigen';
    const list = document.createElement('ol');
    for (const step of rating.steps) {
      const li = document.createElement('li');
      const { title, text } = explain(step);
      const strong = document.createElement('strong');
      strong.textContent = `${title}: `;
      li.append(strong, text);
      list.append(li);
    }
    details.append(summary, list);
    out.append(p, wrap, details);
  }

  async function runGenerator(): Promise<void> {
    const level = genLevel.value as Difficulty;
    if (!DIFFICULTIES.includes(level)) return;
    const seed = genSeed.value.trim().slice(0, 40) || 'info';
    const run = $<HTMLButtonElement>('demo-gen-run');
    run.disabled = true;
    genStatus.textContent = 'Wird erzeugt …';
    solveStatus.textContent = '';
    try {
      lab = await runLab(seed, level);
    } finally {
      run.disabled = false;
    }
    genGrid = new Array<number>(CELLS).fill(0);
    genCount = { removed: 0, notUnique: 0, tooHard: 0, givens: 81 };
    genBoard.setValues(genGrid);
    genBoard.mark('is-back', []);
    genBoard.mark('is-removed-now', []);
    genPlayer.reset();
    genPlayer.step(1);
    renderGenStats();
    genStatus.textContent = `Versuch ${lab.attempts} hat geklappt. Drücke „Abspielen“, um das Entfernen anzusehen.`;

    solveGrid = [...lab.puzzle.givens];
    solveCount = { tries: 0, undos: 0, solutions: 0, depth: 0 };
    solveBoard.setValues(solveGrid, lab.puzzle.givens);
    solveBoard.mark('is-try', []);
    solveBoard.mark('is-undo', []);
    solvePlayer.reset();
    renderSolveStats();
    solveStatus.textContent = `Bereit: ${lab.search.tries} Versuche bis zum Beweis der Eindeutigkeit.`;
    renderRating(lab.puzzle);
  }

  genPlay.addEventListener('click', () => genPlayer.toggle());
  $('demo-gen-step').addEventListener('click', () => genPlayer.step(1));
  $('demo-gen-end').addEventListener('click', () => genPlayer.toEnd());
  solvePlay.addEventListener('click', () => solvePlayer.toggle());
  $('demo-solve-step').addEventListener('click', () => solvePlayer.step(1));
  $('demo-solve-end').addEventListener('click', () => solvePlayer.toEnd());
  $('demo-gen-run').addEventListener('click', () => void runGenerator());
  if (reducedMotion()) speed.value = '1';
  void runGenerator();
}

start();
