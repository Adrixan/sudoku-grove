# sudoku-grove
A JavaScript Sudoku game for students (ages 10 to 18) under the Prof. Aufner educator brand, published on lernspiele.aufner.org. Requested by Peter and relayed by the Greeter on 2026-11-03; the name is provisional and Peter can rename it. The global rules apply, and this file adds the project rules. State: `.agents/session-handoff.md`.

## Decisions (Peter, 2026-11-03)
- Audience: students of the Prof. Aufner brand. The minor-protection rules apply: no accounts, no personal data, no free-text input that leaves the device.
- Hosting: one game inside the sister site `~/code/lernspiele.aufner.org`. This repo builds a static output (`dist`); the site's release pipeline (`release-manifest.json` source entry plus a `games` path, `npm run release` there) fetches, checks, builds and deploys it. Never deploy from this repo directly.
- Repository: public GitHub `Adrixan/sudoku-grove`.
- Branding: Prof. Aufner, which means the lernspiele shell look (Bioluminescent Night, dark default, Cyber-Mint for educational highlights, self-hosted Space Grotesk, Inter and JetBrains Mono).
- Features in v1: own generator with difficulty levels; pencil marks, conflict highlighting, undo/redo and hints that explain the technique; optional timer and a seeded daily puzzle; offline PWA with progress and settings saved only in the browser.
- Route `teens/sudoku`, classic 9x9 only.
- Stack: Vite, strict TypeScript, vanilla DOM (no UI framework), Vitest; zero runtime dependencies.
- Informatik-Einblicke (Peter, 2026-11-03): the game stands on its own; the deeper layer is optional. The "Informatik-Blick" panel is a setting, off by default (`settings.showInsight`). Learning area, linked quietly from the footer, the hint panel and the panel: `info.html` (Informatik dahinter: data structure, bitmasks, PRNG, generator, backtracking, rating, live demos), `techniken.html` (tutorial per technique with real examples from `src/info/technique-examples.json`, rebuilt by `npm run examples` after engine changes) and `programmieren.html` (JavaScript tutorial whose code is inserted at build time from `tutorial/sudoku-tutorial.js`, tested by Vitest). Keep texts in sync with the engine; sources there are verified, add no fact without a checked source.
- Name `sudoku-grove`; fonts SIL OFL 1.1 with their licence texts.
- Code licence PolyForm Noncommercial 1.0.0 since 2026-11-07 (Peter): only Peter may use it commercially; versions published before that date stay available under AGPL-3.0 to those who received them. Content (learning-area texts, hint and technique explanations) CC BY-NC-SA 4.0; commercial rights reserved to Peter.

## Release
- Standing order (Peter, 2026-11-03): publish after every verified change. Push `main` here, then run `npm run release` in `~/code/lernspiele.aufner.org` (it builds this repo from GitHub `main`). One SSH attempt; on failure `DEPLOY_VIA=m11x npm run release`.

- GitHub Actions: `ci.yml` runs the release gates (audit, typecheck, tests, build) on `main` and `feat/**`; `notify-site-release.yml` dispatches a lernspiele release after green CI on `main` (skips while `LERNSPIELE_DISPATCH_TOKEN` is unset, then release by hand). Actions are pinned by SHA with the version as comment; Dependabot proposes updates with a 1-day cooldown.

## Engineering
- Layout: `src/engine/` is pure and DOM-free (grid model, solver, technique-based rater, generator, seeded PRNG), fully covered by Vitest; `src/ui/` renders and handles input; `src/storage/` wraps browser storage with try/catch and schema versions.
- Scripts the lernspiele manifest calls: `npm ci`, `npm audit --audit-level=low`, `npm run typecheck`, `npm test`, `npm run build` (output `dist`). No linter for now: strict `tsc` is the gate, which keeps the dev dependencies to Vite, TypeScript, Vitest and `@types/node`.
- Engine performance budget: generation runs in a Web Worker; keep `schwer` (the slowest level) at a p95 under 1.5 s in Node (`node .scratch/timing.ts`-style check after engine changes).
- TDD: engine behaviour gets a failing test first. The daily puzzle is derived from the date (Europe/Vienna) through the seeded PRNG, so every device shows the same puzzle without a server.

## Fixed defaults
- Puzzles come from our own generator code (no copied puzzle collections). Every puzzle has exactly one solution, checked by a solver before it is served. Difficulty is rated by the solving techniques a human needs, not by the number of clues.
- Static output only: HTML, CSS and JavaScript at runtime, no server code. Relative base path so the game works under its lernspiele route; the service worker scope stays inside that route.
- Accessible: full keyboard play, screen-reader labels and live announcements, WCAG AA contrast in both themes, no colour-only cues, respects `prefers-reduced-motion`.
- No tracking, analytics, cookies or external runtime requests (CSP `default-src 'self'`, no CDNs, no Google Fonts). Progress lives in localStorage/IndexedDB and is never sent anywhere.
- German UI (Austrian usage), "du" form. No em dashes in any text.
- Few or no runtime dependencies. All dependencies follow the global rules: latest release past the 24 h cooldown, `npm audit` before committing, no exact pins.
- Never fetch aufner.org sites with agent tools (the host bans AI user agents on all ports). Check the live site only with curl and a desktop-browser User-Agent; run lighthouse and accessibility tools only against local builds.
