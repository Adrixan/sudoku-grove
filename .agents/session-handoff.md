# Session handoff: sudoku-grove
Last updated: 2026-11-03

## Trajectory
- Project created by the Greeter; Peter decided audience, hosting, features, brand, stack, licence and route (all recorded in `AGENTS.md`).
- Built v1 on `main` (merge `8f82503`), public repo https://github.com/Adrixan/sudoku-grove:
  - Engine (`src/engine/`): bitmask solver proves uniqueness; techniques hidden/naked single, pointing, claiming, naked/hidden pair and triple, X-Wing, XY-Wing, Swordfish; rater (leicht/mittel/schwer/experte = hardest technique needed); deterministic generator (symmetric removal, asymmetric second pass when too easy). Node timing: schwer p95 about 1.1 s, the others under 0.2 s.
  - Game reducer (notes, undo/redo, peer-note cleanup, completion) and hints with German explanations that use the player's notes; wrong entries and wrong notes are flagged first.
  - UI: ARIA grid with roving tabindex, hidden-text accessible names, live region, keyboard (arrows, 1-9, Shift+digit or N for notes, Del, Ctrl+Z/Y, H), touch pad with remaining counts, timer (pauses while hidden), daily puzzle (Europe/Vienna date; Mo/Di leicht, Mi/Do mittel, Fr/Sa schwer, So experte), generation in a Web Worker with main-thread fallback, validated localStorage save, theme key shared with lernspiele (`lernspiele-theme`).
  - Build: CSP meta injected at build time; `dist/sw.js` generated with a precache list and content-hash version, deletes only `sudoku-grove-*` caches.
- Verified: 40 Vitest tests, strict `tsc`, `npm audit` clean, Playwright e2e on the build served under `/teens/sudoku/` (play, hints, win, daily, offline reload, mobile without overflow, no console errors, no external requests), axe-core WCAG 2.2 AA with 0 violations in dark and light at 1280 and 390 px.
- Test tooling (local, `.scratch/` is git-ignored): `.scratch/e2e.cjs`, `.scratch/axe.cjs`, `.scratch/timing.ts`. Run browser scripts with `NODE_PATH=$(npm root -g)/@playwright/mcp/node_modules`, Chromium `/usr/bin/chromium`, build served by `python3 -m http.server 8765` from `.scratch/site` (symlink `teens/sudoku` to `dist`). The accessibility MCP cannot inject axe because of the CSP; use `.scratch/axe.cjs` (bypassCSP, axe from `~/code/in-memoriam-pascal/node_modules`).

## 2026-11-03 later: Informatik-Einblicke, Lernbereich, live
- Live at https://lernspiele.aufner.org/teens/sudoku/ (lernspiele releases `20261103204544-117624`, then `20261103205921-190890` with sudoku-grove `1cdaa43`; 817 files SHA-256 verified, all 31 routes HTTP 200; the four sudoku pages checked with curl and a desktop UA).
- Solver and generator emit trace events (`traceSearch`, `traceAttempt`, `generateWithInfo`); worker kind `lab` returns them for the demos.
- Game: "Informatik-Blick" is a setting (off by default, remembered); hint panel links to `techniken.html#<technique>`; footer links the learning area.
- Learning area: `info.html` (background and demos, sources verified with pho-research), `techniken.html` (examples from `src/info/technique-examples.json`, `npm run examples`), `programmieren.html` (snippets injected at build from `tutorial/sudoku-tutorial.js`, tested).
- Verified: 61 Vitest tests, tsc, npm audit clean, Playwright checks (`.scratch/learn.cjs`, `.scratch/info.cjs`, `.scratch/e2e.cjs`), axe WCAG 2.2 AA 0 violations on all four pages in dark 1280 px and light 390 px, offline load of all pages.
- Standing order: publish after every verified change (`AGENTS.md` Release; now also a global rule in `~/.config/ai/AGENTS.md`).

## Next steps / ideas
- Hint highlight could also mark the cells that block a hidden single.
- Optional: kids variant (4x4/6x6) was declined for v1.
