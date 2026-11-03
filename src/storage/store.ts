/** Versioned local save. Everything stays in this browser; reads are validated, failures fall back to defaults. */
import { GAME_VERSION, type Game } from '../engine/game.ts';
import { CELLS, isComplete, isGrid } from '../engine/grid.ts';
import { DIFFICULTIES, type Difficulty } from '../engine/rater.ts';

const KEY = 'sudoku-grove:v1';
const MAX_HISTORY = 500;

export interface Settings {
  difficulty: Difficulty;
  showTimer: boolean;
  highlightSame: boolean;
}

export interface DailyResult {
  ms: number;
  hints: number;
}

export interface Saved {
  settings: Settings;
  game: Game | null;
  daily: Record<string, DailyResult>;
}

export const DEFAULT_SETTINGS: Settings = { difficulty: 'leicht', showTimer: true, highlightSame: true };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isMaskArray = (v: unknown): v is number[] =>
  Array.isArray(v) && v.length === CELLS && v.every((n) => Number.isInteger(n) && n >= 0 && n <= 0x1ff);
const isDifficulty = (v: unknown): v is Difficulty => DIFFICULTIES.includes(v as Difficulty);

function isMove(v: unknown): boolean {
  return (
    Array.isArray(v) &&
    v.every(
      (c) =>
        isObj(c) &&
        Number.isInteger(c.cell) &&
        (c.cell as number) >= 0 &&
        (c.cell as number) < CELLS &&
        isObj(c.before) &&
        isObj(c.after) &&
        [c.before.value, c.after.value].every((x) => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 9) &&
        [c.before.notes, c.after.notes].every((x) => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 0x1ff),
    )
  );
}

function parseGame(v: unknown): Game | null {
  if (!isObj(v) || v.version !== GAME_VERSION || !isObj(v.puzzle)) return null;
  const p = v.puzzle;
  if (typeof p.seed !== 'string' || !isDifficulty(p.difficulty) || !isGrid(p.givens) || !isGrid(p.solution)) return null;
  const givens = p.givens;
  const solution = p.solution;
  if (!isComplete(solution) || !givens.every((g, i) => g === 0 || g === solution[i])) return null;
  if (!isGrid(v.values) || !isMaskArray(v.notes)) return null;
  const values = v.values;
  if (!givens.every((g, i) => g === 0 || g === values[i])) return null;
  const history = Array.isArray(v.history) && v.history.every(isMove) ? (v.history as Game['history']) : [];
  const future = Array.isArray(v.future) && v.future.every(isMove) ? (v.future as Game['future']) : [];
  const num = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0);
  return {
    version: GAME_VERSION,
    puzzle: { seed: p.seed.slice(0, 100), difficulty: p.difficulty, givens, solution },
    daily: typeof v.daily === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.daily) ? v.daily : null,
    values,
    notes: v.notes,
    history,
    future,
    elapsedMs: num(v.elapsedMs),
    hintsUsed: Math.floor(num(v.hintsUsed)),
    completed: v.completed === true && values.every((x, i) => x === solution[i]),
  };
}

export function parseSaved(raw: unknown): Saved {
  const out: Saved = { settings: { ...DEFAULT_SETTINGS }, game: null, daily: {} };
  if (!isObj(raw)) return out;
  if (isObj(raw.settings)) {
    const s = raw.settings;
    if (isDifficulty(s.difficulty)) out.settings.difficulty = s.difficulty;
    if (typeof s.showTimer === 'boolean') out.settings.showTimer = s.showTimer;
    if (typeof s.highlightSame === 'boolean') out.settings.highlightSame = s.highlightSame;
  }
  out.game = parseGame(raw.game);
  if (isObj(raw.daily)) {
    for (const [date, r] of Object.entries(raw.daily).slice(-400)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && isObj(r) && typeof r.ms === 'number' && typeof r.hints === 'number') {
        out.daily[date] = { ms: Math.max(0, r.ms), hints: Math.max(0, Math.floor(r.hints)) };
      }
    }
  }
  return out;
}

export function load(): Saved {
  try {
    const text = globalThis.localStorage?.getItem(KEY);
    return parseSaved(text ? JSON.parse(text) : null);
  } catch {
    return parseSaved(null);
  }
}

export function save(data: Saved): boolean {
  try {
    const game = data.game ? { ...data.game, history: data.game.history.slice(-MAX_HISTORY), future: data.game.future.slice(-MAX_HISTORY) } : null;
    globalThis.localStorage?.setItem(KEY, JSON.stringify({ ...data, game }));
    return true;
  } catch {
    return false;
  }
}
