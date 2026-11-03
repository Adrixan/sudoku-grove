import { describe, expect, it } from 'vitest';
import { applyHint, erase, fillAllNotes, newGame, redo, setDigit, toggleNote, undo, wrongCells, wrongNoteCells } from './game.ts';
import type { Puzzle } from './generator.ts';
import { bit, parseGrid } from './grid.ts';
import { explain, getHint } from './hints.ts';
import { DIFFICULTIES, rate } from './rater.ts';
import { generate } from './generator.ts';

const EXAMPLE = '53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79';
const SOLUTION = '534678912672195348198342567859761423426853791713924856961537284287419635345286179';
const puzzle: Puzzle = { seed: 't', difficulty: 'leicht', givens: parseGrid(EXAMPLE), solution: parseGrid(SOLUTION) };

describe('game reducer', () => {
  it('ignores edits on givens and toggles a digit off when entered twice', () => {
    let g = newGame(puzzle);
    expect(setDigit(g, 0, 1)).toBe(g);
    g = setDigit(g, 2, 4);
    expect(g.values[2]).toBe(4);
    expect(setDigit(g, 2, 4).values[2]).toBe(0);
  });
  it('removes a placed digit from the notes of its peers, and undo restores them', () => {
    let g = newGame(puzzle);
    g = toggleNote(g, 3, 4);
    g = toggleNote(g, 3, 6);
    g = setDigit(g, 2, 4);
    expect(g.notes[3]).toBe(bit(6));
    g = undo(g);
    expect(g.values[2]).toBe(0);
    expect(g.notes[3]).toBe(bit(4) | bit(6));
    g = redo(g);
    expect(g.values[2]).toBe(4);
    expect(g.notes[3]).toBe(bit(6));
  });
  it('a new move clears the redo stack; erase clears value and notes', () => {
    let g = setDigit(newGame(puzzle), 2, 4);
    g = undo(g);
    g = toggleNote(g, 2, 1);
    expect(g.future).toHaveLength(0);
    g = erase(g, 2);
    expect(g.notes[2]).toBe(0);
  });
  it('detects completion and freezes the board', () => {
    let g = newGame(puzzle);
    const sol = parseGrid(SOLUTION);
    for (let c = 0; c < 81; c++) if (!g.values[c]) g = setDigit(g, c, sol[c]!);
    expect(g.completed).toBe(true);
    expect(undo(g)).toBe(g);
  });
  it('flags wrong entries and wrong notes', () => {
    let g = setDigit(newGame(puzzle), 2, 1);
    expect(wrongCells(g)).toEqual([2]);
    g = erase(g, 2);
    g = toggleNote(g, 2, 1);
    expect(wrongNoteCells(g)).toEqual([2]);
  });
  it('fills all notes with the basic candidates', () => {
    const g = fillAllNotes(newGame(puzzle));
    expect(g.notes[2]! & bit(4)).toBeTruthy();
    expect(g.notes[2]! & bit(5)).toBe(0);
    expect(g.notes[0]).toBe(0);
  });
});

describe('hints', () => {
  it('reports mistakes before giving a step', () => {
    const g = setDigit(newGame(puzzle), 2, 1);
    expect(getHint(g).kind).toBe('mistake');
  });
  it('leads to the full solution when hints are applied repeatedly', () => {
    let g = newGame(puzzle);
    for (let i = 0; i < 200 && !g.completed; i++) {
      const h = getHint(g);
      expect(h.kind).toBe('step');
      if (h.kind !== 'step') break;
      expect(h.text.length).toBeGreaterThan(20);
      g = applyHint(g, h.step.placements, h.step.eliminations, h.candidates);
    }
    expect(g.completed).toBe(true);
  });
  it('explains every technique of a rated puzzle without placeholders', () => {
    for (const step of rate(parseGrid(EXAMPLE)).steps) {
      const { title, text } = explain(step);
      expect(title).not.toBe('');
      expect(text).not.toMatch(/undefined|NaN|Zeile 0|Spalte 0|Block 0/);
    }
  });
  for (const difficulty of DIFFICULTIES) {
    it(`hints alone solve a generated ${difficulty} puzzle, with clean texts`, () => {
      let g = newGame(generate(`hint-${difficulty}`, difficulty));
      const seen = new Set<string>();
      for (let i = 0; i < 400 && !g.completed; i++) {
        const h = getHint(g);
        if (h.kind !== 'step') throw new Error(`unexpected hint ${h.kind}`);
        seen.add(h.step.technique);
        expect(h.text).not.toMatch(/undefined|NaN|Zeile 0|Spalte 0|Block 0|Z0|S0\b/);
        g = applyHint(g, h.step.placements, h.step.eliminations, h.candidates);
      }
      expect(g.completed).toBe(true);
      expect(g.values).toEqual(g.puzzle.solution);
    }, 60_000);
  }
});
