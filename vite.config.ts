import { defineConfig } from 'vitest/config';

// Relative base: the game is served under lernspiele.aufner.org/teens/sudoku/ and must work in any subfolder.
export default defineConfig({
  base: './',
  build: {
    target: 'es2023',
    assetsInlineLimit: 0,
  },
  worker: {
    format: 'es',
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
