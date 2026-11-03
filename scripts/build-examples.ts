/**
 * Finds one teaching example per technique in puzzles from our own generator and writes
 * src/info/technique-examples.json. Deterministic: rerun after engine changes (`npm run examples`).
 */
import { writeFileSync } from 'node:fs';
import { generate } from '../src/engine/generator.ts';
import { type Difficulty, TECHNIQUE_LEVEL } from '../src/engine/rater.ts';
import { type Step, type Technique, TECHNIQUES, applyStep, createState, findStep } from '../src/engine/techniques.ts';

interface Example {
  technique: Technique;
  seed: string;
  values: number[];
  cands: number[];
  step: Step;
}

const wanted = new Map<Technique, Example>();
const order: Difficulty[] = ['leicht', 'mittel', 'schwer', 'experte'];
// Prefer compact examples: few eliminations are easier to see.
const score = (s: Step): number => s.eliminations.length + s.cells.length;

for (let n = 0; n < 400 && wanted.size < TECHNIQUES.length; n++) {
  for (const level of order) {
    const seed = `beispiel-${level}-${n}`;
    const puzzle = generate(seed, level);
    const state = createState(puzzle.givens);
    for (let step = findStep(state); step; step = findStep(state)) {
      const t = step.technique;
      const known = wanted.get(t);
      // Singles: take an early, busy board position; others: the most compact step found.
      const better = !known || (TECHNIQUE_LEVEL[t] !== 'leicht' && score(step) < score(known.step));
      if (better && state.values.filter(Boolean).length >= 30) {
        wanted.set(t, { technique: t, seed, values: [...state.values], cands: [...state.cands], step });
      }
      applyStep(state, step);
    }
  }
}

const missing = TECHNIQUES.map((t) => t.id).filter((id) => !wanted.has(id));
if (missing.length) throw new Error(`No example for ${missing.join(', ')}`);
const out = TECHNIQUES.map((t) => wanted.get(t.id));
writeFileSync('src/info/technique-examples.json', `${JSON.stringify(out)}\n`);
console.log(out.map((e) => `${e?.technique}: ${e?.seed}, ${e?.step.eliminations.length} eliminations`).join('\n'));
