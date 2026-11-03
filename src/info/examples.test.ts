import { describe, expect, it } from 'vitest';
import { generate } from '../engine/generator.ts';
import type { Difficulty } from '../engine/rater.ts';
import { type Step, TECHNIQUES } from '../engine/techniques.ts';
import examples from './technique-examples.json';

describe('technique examples', () => {
  it('cover every technique once, in engine order', () => {
    expect(examples.map((e) => e.technique)).toEqual(TECHNIQUES.map((t) => t.id));
  });
  for (const ex of examples) {
    it(`${ex.technique}: the stored step is what the engine finds and agrees with the solution`, () => {
      const finder = TECHNIQUES.find((t) => t.id === ex.technique)!.find;
      const found = finder({ values: [...ex.values], cands: [...ex.cands] });
      expect(found).toEqual(ex.step as Step);
      const level = ex.seed.split('-')[1] as Difficulty;
      const { solution } = generate(ex.seed, level);
      for (const p of ex.step.placements) expect(p.digit).toBe(solution[p.cell]);
      for (const e of ex.step.eliminations) expect(e.digit).not.toBe(solution[e.cell]);
      ex.values.forEach((v, i) => v && expect(v).toBe(solution[i]));
    }, 30_000);
  }
});
