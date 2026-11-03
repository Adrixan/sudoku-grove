import { describe, expect, it } from 'vitest';
import { newGame, setDigit } from '../engine/game.ts';
import { generate } from '../engine/generator.ts';
import { DEFAULT_SETTINGS, parseSaved } from './store.ts';

const game = setDigit(newGame(generate('store', 'leicht')), 0, 0);

describe('parseSaved', () => {
  it('falls back to defaults on junk', () => {
    for (const junk of [null, 42, 'x', [], { settings: 'no', game: { version: 99 } }]) {
      expect(parseSaved(junk)).toEqual({ settings: DEFAULT_SETTINGS, game: null, daily: {} });
    }
  });
  it('round-trips a real game through JSON', () => {
    const g = setDigit(game, game.values.indexOf(0), 5);
    const back = parseSaved(JSON.parse(JSON.stringify({ settings: { difficulty: 'schwer', showTimer: false, highlightSame: true }, game: g, daily: { '2026-11-03': { ms: 1000, hints: 1 } } })));
    expect(back.game).toEqual(g);
    expect(back.settings.difficulty).toBe('schwer');
    expect(back.daily['2026-11-03']).toEqual({ ms: 1000, hints: 1 });
  });
  it('rejects tampered puzzles and keeps the rest', () => {
    const solution = [...game.puzzle.solution];
    [solution[0], solution[1]] = [solution[1]!, solution[0]!];
    const tampered = { ...game, puzzle: { ...game.puzzle, solution } };
    expect(parseSaved({ game: tampered, settings: { difficulty: 'nope' } })).toEqual({ settings: DEFAULT_SETTINGS, game: null, daily: {} });
    expect(parseSaved({ game: { ...game, values: game.values.map(() => 0) } }).game).toBeNull();
  });
  it('drops malformed history instead of the game, and never trusts a completed flag', () => {
    const back = parseSaved({ game: { ...game, history: [[{ cell: 999 }]], completed: true } });
    expect(back.game?.history).toEqual([]);
    expect(back.game?.completed).toBe(false);
  });
});
