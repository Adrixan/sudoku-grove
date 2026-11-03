/// <reference lib="webworker" />
/** Generates puzzles (and, for the teaching page, traces) off the main thread so the page stays responsive. */
import { generateWithInfo, traceAttempt } from './engine/generator.ts';
import { DIFFICULTIES, type Difficulty } from './engine/rater.ts';
import { traceSearch } from './engine/solver.ts';

interface Request {
  id: number;
  kind?: 'generate' | 'lab';
  seed: string;
  difficulty: Difficulty;
}

/** Enough for a smooth replay; the counters still cover the whole search. */
const MAX_SEARCH_EVENTS = 40_000;

self.onmessage = (event: MessageEvent<Request>) => {
  const { id, kind = 'generate', seed, difficulty } = event.data;
  if (typeof id !== 'number' || typeof seed !== 'string' || seed.length > 100 || !DIFFICULTIES.includes(difficulty)) return;
  try {
    const result = generateWithInfo(seed, difficulty);
    if (kind === 'lab') {
      self.postMessage({
        id,
        puzzle: result.puzzle,
        attempts: result.attempts,
        attemptSeed: result.attemptSeed,
        generatorEvents: traceAttempt(result.attemptSeed, difficulty),
        search: traceSearch(result.puzzle.givens, 2, MAX_SEARCH_EVENTS),
      });
    } else {
      self.postMessage({ id, puzzle: result.puzzle });
    }
  } catch (error) {
    self.postMessage({ id, error: String(error) });
  }
};
