/// <reference lib="webworker" />
/** Generates puzzles off the main thread so the page stays responsive. */
import { generate } from './engine/generator.ts';
import { DIFFICULTIES, type Difficulty } from './engine/rater.ts';

interface Request {
  id: number;
  seed: string;
  difficulty: Difficulty;
}

self.onmessage = (event: MessageEvent<Request>) => {
  const { id, seed, difficulty } = event.data;
  if (typeof id !== 'number' || typeof seed !== 'string' || !DIFFICULTIES.includes(difficulty)) return;
  try {
    self.postMessage({ id, puzzle: generate(seed, difficulty) });
  } catch (error) {
    self.postMessage({ id, error: String(error) });
  }
};
