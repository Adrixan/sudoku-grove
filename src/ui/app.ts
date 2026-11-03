/** Browser UI: renders the board, handles keyboard, pointer and touch input, timer, saves and hints. */
import { dailyDifficulty, dailySeed, viennaDate } from '../engine/daily.ts';
import {
  type Game,
  applyHint,
  basicCandidates,
  conflictCells,
  erase,
  fillAllNotes,
  isGiven,
  newGame,
  redo,
  remainingOf,
  setDigit,
  toggleNote,
  undo,
  wrongCells,
} from '../engine/game.ts';
import { type Puzzle, generate } from '../engine/generator.ts';
import { traceSearch } from '../engine/solver.ts';
import { TECHNIQUE_NAMES } from '../engine/hints.ts';
import { CELLS, bit, boxOf, colOf, digitsOf, rowOf } from '../engine/grid.ts';
import { type Hint, cellName, getHint, hintArea } from '../engine/hints.ts';
import { DIFFICULTIES, type Difficulty, rate } from '../engine/rater.ts';
import type { Technique } from '../engine/techniques.ts';
import { randomSeed } from '../engine/rng.ts';
import { type Saved, load, save } from '../storage/store.ts';
import { initThemeToggle } from './theme.ts';

const LABEL: Record<Difficulty, string> = { leicht: 'Leicht', mittel: 'Mittel', schwer: 'Schwer', experte: 'Experte' };

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} fehlt`);
  return el as T;
}

export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mmss = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return h ? `${h}:${mmss}` : mmss;
}

function spokenTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m} ${m === 1 ? 'Minute' : 'Minuten'} und ${s} ${s === 1 ? 'Sekunde' : 'Sekunden'}`;
}

export function startApp(): void {
  const saved: Saved = load();
  let game: Game | null = saved.game;
  let selected = 40;
  let notesMode = false;
  let hint: Hint | null = null;
  let showWrong = new Set<number>();
  let generating = false;

  const board = $<HTMLDivElement>('board');
  const pad = $<HTMLDivElement>('pad');
  const live = $<HTMLParagraphElement>('live');
  const timerEl = $<HTMLSpanElement>('timer');
  const statusLabel = $<HTMLSpanElement>('status-label');
  const boardNote = $<HTMLParagraphElement>('board-note');
  const difficultySel = $<HTMLSelectElement>('difficulty');
  const notesBtn = $<HTMLButtonElement>('notes-mode');
  const undoBtn = $<HTMLButtonElement>('undo');
  const redoBtn = $<HTMLButtonElement>('redo');
  const hintPanel = $<HTMLElement>('hint-panel');
  const hintTitle = $<HTMLHeadingElement>('hint-title');
  const hintText = $<HTMLParagraphElement>('hint-text');
  const hintApply = $<HTMLButtonElement>('hint-apply');
  const winDialog = $<HTMLDialogElement>('win-dialog');
  const confirmDialog = $<HTMLDialogElement>('confirm-dialog');
  const showTimerBox = $<HTMLInputElement>('show-timer');
  const highlightBox = $<HTMLInputElement>('highlight-same');
  const insightBox = $<HTMLInputElement>('show-insight');
  const hintMore = $<HTMLParagraphElement>('hint-more');
  const hintMoreLink = $<HTMLAnchorElement>('hint-more-link');

  const announce = (text: string): void => {
    // Clear first so repeated messages are read again.
    live.textContent = '';
    window.setTimeout(() => (live.textContent = text), 30);
  };

  const persist = (): void => {
    saved.game = game;
    save(saved);
  };

  // ---------- board ----------
  const cells: HTMLDivElement[] = [];
  const noteSpans: HTMLSpanElement[][] = [];
  const valueSpans: HTMLSpanElement[] = [];
  // Accessible names come from hidden text, not aria-label, so the visible digit is part of the name.
  const labelSpans: HTMLSpanElement[] = [];
  for (let r = 0; r < 9; r++) {
    const row = document.createElement('div');
    row.setAttribute('role', 'row');
    row.className = 'board__row';
    for (let c = 0; c < 9; c++) {
      const i = r * 9 + c;
      const cell = document.createElement('div');
      cell.setAttribute('role', 'gridcell');
      cell.className = 'cell';
      cell.dataset.r = String(r);
      cell.dataset.c = String(c);
      cell.tabIndex = -1;
      const value = document.createElement('span');
      value.className = 'cell__value';
      value.setAttribute('aria-hidden', 'true');
      const notes = document.createElement('span');
      notes.className = 'cell__notes';
      notes.setAttribute('aria-hidden', 'true');
      const spans: HTMLSpanElement[] = [];
      for (let d = 1; d <= 9; d++) {
        const s = document.createElement('span');
        s.textContent = String(d);
        notes.append(s);
        spans.push(s);
      }
      const label = document.createElement('span');
      label.className = 'visually-hidden';
      cell.append(label, value, notes);
      labelSpans.push(label);
      cell.addEventListener('click', () => select(i, true));
      row.append(cell);
      cells.push(cell);
      valueSpans.push(value);
      noteSpans.push(spans);
    }
    board.append(row);
  }

  const padButtons: HTMLButtonElement[] = [];
  for (let d = 1; d <= 9; d++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pad__digit';
    b.innerHTML = `<span class="pad__num">${d}</span><span class="visually-hidden pad__sr"></span><span class="pad__left" aria-hidden="true"></span>`;
    b.addEventListener('click', () => input(d, notesMode));
    pad.append(b);
    padButtons.push(b);
  }

  function select(cell: number, focus: boolean): void {
    selected = Math.max(0, Math.min(CELLS - 1, cell));
    render();
    if (focus) cells[selected]?.focus();
  }

  // ---------- rendering ----------
  function render(): void {
    const g = game;
    board.setAttribute('aria-busy', String(generating || !g));
    boardNote.hidden = !generating;
    if (!g) return;
    const conflicts = conflictCells(g);
    const selValue = g.values[selected] ?? 0;
    const sameOn = saved.settings.highlightSame && selValue !== 0;
    const step = hint?.kind === 'step' ? hint.step : null;
    const area = step ? hintArea(step) : new Set<number>();
    const keyCells = new Set(step ? step.cells : hint && hint.kind !== 'step' ? hint.cells : []);
    const targets = new Set<number>(step ? [...step.placements, ...step.eliminations].map((x) => x.cell) : []);
    const struck = new Map<number, number>();
    for (const e of step?.eliminations ?? []) struck.set(e.cell, (struck.get(e.cell) ?? 0) | bit(e.digit));

    for (let i = 0; i < CELLS; i++) {
      const el = cells[i]!;
      const v = g.values[i] ?? 0;
      const given = isGiven(g, i);
      const peer = i !== selected && (rowOf(i) === rowOf(selected) || colOf(i) === colOf(selected) || boxOf(i) === boxOf(selected));
      const shownNotes = v ? 0 : (g.notes[i] ?? 0) || (struck.has(i) && hint?.kind === 'step' ? (hint.candidates[i] ?? 0) : 0);
      el.classList.toggle('is-given', given);
      el.classList.toggle('is-selected', i === selected);
      el.classList.toggle('is-peer', peer);
      el.classList.toggle('is-same', sameOn && v === selValue);
      el.classList.toggle('is-conflict', conflicts.has(i));
      el.classList.toggle('is-wrong', showWrong.has(i));
      el.classList.toggle('is-hint-area', area.has(i));
      el.classList.toggle('is-hint-key', keyCells.has(i));
      el.classList.toggle('is-hint-target', targets.has(i));
      el.tabIndex = i === selected ? 0 : -1;
      el.setAttribute('aria-selected', String(i === selected));
      valueSpans[i]!.textContent = v ? String(v) : '';
      const strikeMask = struck.get(i) ?? 0;
      noteSpans[i]!.forEach((s, k) => {
        const m = bit(k + 1);
        s.classList.toggle('on', (shownNotes & m) !== 0);
        s.classList.toggle('same', sameOn && k + 1 === selValue && (shownNotes & m) !== 0);
        s.classList.toggle('strike', (strikeMask & m) !== 0);
      });
      const parts = [cellName(i)];
      if (v) parts.push(given ? `${v}, vorgegeben` : String(v));
      else parts.push('leer');
      const notes = digitsOf(g.notes[i] ?? 0);
      if (!v && notes.length) parts.push(`Notizen ${notes.join(' ')}`);
      if (conflicts.has(i)) parts.push('Konflikt');
      if (showWrong.has(i)) parts.push('falsch');
      if (keyCells.has(i) || targets.has(i)) parts.push('Tipp');
      labelSpans[i]!.textContent = parts.join(', ');
    }

    padButtons.forEach((b, k) => {
      const left = remainingOf(g, k + 1);
      b.querySelector('.pad__left')!.textContent = String(left);
      b.classList.toggle('is-done', left <= 0);
      b.querySelector('.pad__sr')!.textContent = `, noch ${Math.max(0, left)} übrig`;
    });

    notesBtn.setAttribute('aria-pressed', String(notesMode));
    undoBtn.disabled = g.history.length === 0 || g.completed;
    redoBtn.disabled = g.future.length === 0 || g.completed;
    const dailyText = g.daily ? `Tagesrätsel ${new Date(`${g.daily}T12:00:00`).toLocaleDateString('de-AT')} · ` : '';
    statusLabel.textContent = `${dailyText}${LABEL[g.puzzle.difficulty]}${g.hintsUsed ? ` · ${g.hintsUsed} ${g.hintsUsed === 1 ? 'Tipp' : 'Tipps'}` : ''}`;
    timerEl.hidden = !saved.settings.showTimer;
    timerEl.textContent = formatTime(g.elapsedMs);

    renderInsight(g);

    if (hint) {
      hintPanel.hidden = false;
      hintTitle.textContent = hint.title;
      hintText.textContent = hint.text;
      hintApply.hidden = hint.kind !== 'step';
      hintMore.hidden = hint.kind !== 'step';
      if (hint.kind === 'step') hintMoreLink.href = `./techniken.html#${hint.step.technique}`;
    } else {
      hintPanel.hidden = true;
    }
  }

  // ---------- Informatik-Blick ----------
  const insight = $<HTMLDetailsElement>('insight');
  const insightBody = $<HTMLDivElement>('insight-body');
  let analysisKey = '';
  let analysis: { used: string; steps: number; tries: number; undos: number } | null = null;

  function renderInsight(g: Game): void {
    insight.hidden = !saved.settings.showInsight;
    if (insight.hidden || !insight.open) return;
    const key = g.puzzle.givens.join('');
    if (key !== analysisKey) {
      const rating = rate(g.puzzle.givens);
      const search = traceSearch(g.puzzle.givens, 2, 0);
      const used = (Object.entries(rating.used) as [Technique, number][]).map(([t, n]) => `${TECHNIQUE_NAMES[t]} ×${n}`).join(', ');
      analysis = { used, steps: rating.steps.length, tries: search.tries, undos: search.undos };
      analysisKey = key;
    }
    const a = analysis;
    const r = rowOf(selected);
    const c = colOf(selected);
    const cands = basicCandidates(g.values, selected);
    const lines: [string, string][] = [
      ['Startwert', g.puzzle.seed],
      ['Vorgaben', `${g.puzzle.givens.filter(Boolean).length} von 81`],
      ['Menschlicher Löser', a ? `${a.steps} Schritte: ${a.used}` : ''],
      ['Eindeutigkeitsbeweis', a ? `${a.tries} Versuche, ${a.undos} Rücknahmen (Backtracking)` : ''],
      ['Gewähltes Feld', `Index ${selected} = 9 · ${r} + ${c}, Block ${boxOf(selected)}`],
      ['Kandidaten', g.values[selected] ? 'Feld ist ausgefüllt' : `${digitsOf(cands).join(', ') || 'keine'} = 0b${cands.toString(2).padStart(9, '0')}`],
    ];
    const dl = document.createElement('dl');
    dl.className = 'insight__list';
    for (const [k, v] of lines) {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      dl.append(dt, dd);
    }
    insightBody.replaceChildren(dl);
  }
  insight.addEventListener('toggle', () => game && renderInsight(game));

  // ---------- game flow ----------
  function update(next: Game, message?: string): void {
    if (next === game) return;
    const wasDone = game?.completed ?? false;
    game = next;
    hint = null;
    showWrong = new Set();
    render();
    persist();
    if (message) announce(message);
    if (!wasDone && next.completed) win(next);
  }

  function input(digit: number, asNote: boolean): void {
    if (!game || generating) return;
    const name = cellName(selected);
    if (isGiven(game, selected)) {
      announce(`${name} ist vorgegeben.`);
      return;
    }
    if (asNote) {
      const next = toggleNote(game, selected, digit);
      if (next === game) return announce('Notizen gehen nur in leeren Feldern.');
      const on = ((next.notes[selected] ?? 0) & bit(digit)) !== 0;
      return update(next, `Notiz ${digit} ${on ? 'gesetzt' : 'entfernt'}`);
    }
    const next = setDigit(game, selected, digit);
    const v = next.values[selected] ?? 0;
    const conflict = v !== 0 && conflictCells(next).has(selected);
    update(next, v ? `${v} in ${name}${conflict ? '. Achtung: Konflikt' : ''}` : `${name} geleert`);
  }

  function win(g: Game): void {
    if (g.daily) saved.daily[g.daily] = { ms: g.elapsedMs, hints: g.hintsUsed };
    persist();
    const hints = g.hintsUsed === 0 ? 'ganz ohne Tipp' : `mit ${g.hintsUsed} ${g.hintsUsed === 1 ? 'Tipp' : 'Tipps'}`;
    $('win-text').textContent = `${g.daily ? 'Tagesrätsel' : `Sudoku (${LABEL[g.puzzle.difficulty]})`} gelöst in ${formatTime(g.elapsedMs)}, ${hints}.`;
    announce(`Geschafft! Gelöst in ${spokenTime(g.elapsedMs)}.`);
    winDialog.showModal();
  }

  // Worker with main-thread fallback (e.g. when workers are blocked).
  let worker: Worker | null = null;
  let requestId = 0;
  const pending = new Map<number, { resolve: (p: Puzzle) => void; reject: (e: Error) => void }>();
  try {
    worker = new Worker(new URL('../worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; puzzle?: Puzzle; error?: string }>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.puzzle) p.resolve(e.data.puzzle);
      else p.reject(new Error(e.data.error ?? 'Fehler'));
    };
    worker.onerror = () => {
      worker = null;
      for (const p of pending.values()) p.reject(new Error('Worker nicht verfügbar'));
      pending.clear();
    };
  } catch {
    worker = null;
  }

  async function makePuzzle(seed: string, difficulty: Difficulty): Promise<Puzzle> {
    if (worker) {
      const id = ++requestId;
      try {
        return await new Promise<Puzzle>((resolve, reject) => {
          pending.set(id, { resolve, reject });
          worker?.postMessage({ id, seed, difficulty });
        });
      } catch {
        /* fall through to the main thread */
      }
    }
    return generate(seed, difficulty);
  }

  async function confirmDiscard(): Promise<boolean> {
    if (!game || game.completed || game.history.length === 0) return true;
    confirmDialog.returnValue = '';
    confirmDialog.showModal();
    return new Promise((resolve) => {
      confirmDialog.addEventListener('close', () => resolve(confirmDialog.returnValue === 'ok'), { once: true });
    });
  }

  async function start(seed: string, difficulty: Difficulty, daily: string | null): Promise<void> {
    if (generating) return;
    generating = true;
    hint = null;
    render();
    announce('Sudoku wird erzeugt.');
    try {
      const puzzle = await makePuzzle(seed, difficulty);
      game = newGame(puzzle, daily);
      selected = game.values.indexOf(0);
      generating = false;
      persist();
      render();
      announce(`${daily ? 'Tagesrätsel' : 'Neues Sudoku'}, ${LABEL[puzzle.difficulty]}, ${puzzle.givens.filter(Boolean).length} Ziffern vorgegeben.`);
      cells[selected]?.focus();
    } catch {
      generating = false;
      render();
      announce('Das Sudoku konnte nicht erzeugt werden. Bitte versuche es noch einmal.');
    }
  }

  async function newRandomGame(): Promise<void> {
    if (await confirmDiscard()) await start(randomSeed(), saved.settings.difficulty, null);
  }

  async function dailyGame(): Promise<void> {
    const date = viennaDate();
    if (game?.daily === date && !game.completed) {
      announce('Das Tagesrätsel läuft schon.');
      cells[selected]?.focus();
      return;
    }
    const done = saved.daily[date];
    if (!(await confirmDiscard())) return;
    await start(dailySeed(date), dailyDifficulty(), date);
    if (done) announce(`Heute schon gelöst in ${spokenTime(done.ms)}. Viel Spaß beim zweiten Versuch.`);
  }

  function showHint(): void {
    if (!game || game.completed || generating) return;
    hint = getHint(game);
    if (hint.kind === 'mistake' || hint.kind === 'noteMistake') showWrong = new Set(hint.cells);
    const focusCell = hint.kind === 'step' ? hint.step.placements[0]?.cell ?? hint.step.cells[0] : hint.cells[0];
    if (focusCell !== undefined && hint.kind === 'step' && hint.step.placements.length) selected = focusCell;
    render();
    announce(`${hint.title}. ${hint.text}`);
  }

  // ---------- events ----------
  board.addEventListener('keydown', (e) => {
    if (!game) return;
    const r = rowOf(selected);
    const c = colOf(selected);
    const moves: Record<string, number> = {
      ArrowUp: ((r + 8) % 9) * 9 + c,
      ArrowDown: ((r + 1) % 9) * 9 + c,
      ArrowLeft: r * 9 + ((c + 8) % 9),
      ArrowRight: r * 9 + ((c + 1) % 9),
      Home: r * 9,
      End: r * 9 + 8,
    };
    const target = moves[e.key];
    if (target !== undefined) {
      e.preventDefault();
      select(e.ctrlKey && (e.key === 'Home' || e.key === 'End') ? (e.key === 'Home' ? 0 : 80) : target, true);
      return;
    }
    const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code)?.[1];
    if (digit && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      input(Number(digit), notesMode !== e.shiftKey);
      return;
    }
    if (e.key === 'Backspace' || e.key === 'Delete' || e.code === 'Digit0' || e.code === 'Numpad0') {
      e.preventDefault();
      if (!isGiven(game, selected)) update(erase(game, selected), `${cellName(selected)} geleert`);
    }
  });

  document.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') || document.querySelector('dialog[open]')) return;
    if (!game) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      update(undo(game), 'Rückgängig');
    } else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      e.preventDefault();
      update(redo(game), 'Wiederholt');
    } else if (!mod && !e.altKey && e.key.toLowerCase() === 'n') {
      notesMode = !notesMode;
      render();
      announce(notesMode ? 'Notizmodus an' : 'Notizmodus aus');
    } else if (!mod && !e.altKey && e.key.toLowerCase() === 'h') {
      showHint();
    }
  });

  notesBtn.addEventListener('click', () => {
    notesMode = !notesMode;
    render();
  });
  $('erase').addEventListener('click', () => game && !isGiven(game, selected) && update(erase(game, selected), `${cellName(selected)} geleert`));
  undoBtn.addEventListener('click', () => game && update(undo(game), 'Rückgängig'));
  redoBtn.addEventListener('click', () => game && update(redo(game), 'Wiederholt'));
  $('hint').addEventListener('click', showHint);
  $('fill-notes').addEventListener('click', () => game && update(fillAllNotes(game), 'Alle Notizen ausgefüllt'));
  $('check').addEventListener('click', () => {
    if (!game) return;
    showWrong = new Set(wrongCells(game));
    render();
    announce(showWrong.size ? `${showWrong.size} ${showWrong.size === 1 ? 'Feld ist' : 'Felder sind'} falsch und markiert.` : 'Bisher ist alles richtig.');
  });
  hintApply.addEventListener('click', () => {
    if (!game || hint?.kind !== 'step') return;
    const { placements, eliminations } = hint.step;
    update(applyHint(game, placements, eliminations, hint.candidates), placements.length ? `${placements[0]!.digit} in ${cellName(placements[0]!.cell)} eingetragen` : 'Notizen angepasst');
    cells[selected]?.focus();
  });
  $('hint-close').addEventListener('click', () => {
    hint = null;
    showWrong = new Set();
    render();
    cells[selected]?.focus();
  });
  $('new-game').addEventListener('click', () => void newRandomGame());
  $('daily').addEventListener('click', () => void dailyGame());
  winDialog.addEventListener('close', () => {
    if (winDialog.returnValue === 'new') void start(randomSeed(), saved.settings.difficulty, null);
  });

  difficultySel.value = saved.settings.difficulty;
  difficultySel.addEventListener('change', () => {
    const v = difficultySel.value as Difficulty;
    if (DIFFICULTIES.includes(v)) {
      saved.settings.difficulty = v;
      persist();
    }
  });
  showTimerBox.checked = saved.settings.showTimer;
  showTimerBox.addEventListener('change', () => {
    saved.settings.showTimer = showTimerBox.checked;
    persist();
    render();
  });
  insightBox.checked = saved.settings.showInsight;
  insightBox.addEventListener('change', () => {
    saved.settings.showInsight = insightBox.checked;
    insight.open = insightBox.checked;
    persist();
    render();
    announce(insightBox.checked ? 'Informatik-Blick eingeblendet, unter den Werkzeugen.' : 'Informatik-Blick ausgeblendet.');
  });
  highlightBox.checked = saved.settings.highlightSame;
  highlightBox.addEventListener('change', () => {
    saved.settings.highlightSame = highlightBox.checked;
    persist();
    render();
  });

  initThemeToggle();

  // Timer: counts only while the page is visible and a game is running.
  let last = performance.now();
  let sinceSave = 0;
  window.setInterval(() => {
    const now = performance.now();
    const delta = Math.min(now - last, 5000);
    last = now;
    if (!game || game.completed || generating || document.visibilityState !== 'visible') return;
    game = { ...game, elapsedMs: game.elapsedMs + delta };
    timerEl.textContent = formatTime(game.elapsedMs);
    sinceSave += delta;
    if (sinceSave > 10_000) {
      sinceSave = 0;
      persist();
    }
  }, 1000);
  document.addEventListener('visibilitychange', () => {
    last = performance.now();
    if (document.visibilityState === 'hidden') persist();
  });
  window.addEventListener('pagehide', persist);

  if (game) {
    const firstEmpty = game.values.indexOf(0);
    selected = firstEmpty >= 0 ? firstEmpty : 40;
    render();
  } else {
    void start(randomSeed(), saved.settings.difficulty, null);
  }
}
