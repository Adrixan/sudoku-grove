# Plan: sudoku-grove v1
Stories in order; each one is test-first where the logic is pure. Decisions live in `AGENTS.md`.
- [x] S1 Engine: grid model, seeded PRNG, uniqueness solver, human techniques (singles, pointing, claiming, pairs, triples, X-Wing, XY-Wing, Swordfish), rater with four levels, deterministic generator. Timing in Node: leicht/mittel < 0.1 s, experte p95 0.2 s, schwer p95 1.1 s (max 1.7 s).
- [ ] S2 Game state: moves, pencil marks, undo/redo, conflict detection, completion, timer; pure reducer with tests.
- [ ] S3 Hints: German explanations per technique built from `Step` (cells as "Zeile r, Spalte c", boxes as "Block n"); wrong entries are flagged first.
- [ ] S4 UI: accessible grid (roving tabindex, arrow keys, digits, Backspace, N for notes, aria-live), number pad for touch, difficulty picker, daily puzzle (Europe/Vienna date seed), generation in a Web Worker.
- [ ] S5 Storage: versioned save of the running game and settings in localStorage (try/catch, schema check).
- [ ] S6 PWA: manifest, service worker scoped to the route, offline after first visit; CSP `default-src 'self'`.
- [ ] S7 Integration: lernspiele `release-manifest.json` source and `teens/sudoku` path, landing-page card; local release build; accessibility check on the local build; release only with Peter's go.
