# To-do: sudoku-grove
Proposals waiting for Peter's decision.

## Proposal: color scheme via `<meta name="color-scheme">` (web-modernize 2026-11-15)
- Finding: Modern Web Guidance `dark-mode-toggle` on `public/theme-init.js:9` (and the toggle in `src/ui/theme.ts`): the theme override is stored in localStorage (`lernspiele-theme`) and applied as `data-theme` on `<html>`, without a `<meta name="color-scheme">`; CSS sets `color-scheme` per `data-theme` in `src/ui/styles.css`.
- Guide pattern: `<meta name="color-scheme" content="light dark">` updated by a tiny inline script, `:root { color-scheme: light dark }` mapped from the meta with `:has()`, colours through `light-dark()`, default = system preference, two-state toggle that removes the stored value when the user returns to the system scheme, `storage` event for other tabs.
- Why not applied: behaviour change. The brand rule and AGENTS.md fix dark as the default; the guide defaults to the system preference and changes the toggle semantics. The storage key is shared with the lernspiele shell (`~/code/lernspiele.aufner.org/js/site.js`), so a change must land in both repos together. The inline script also conflicts with CSP `default-src 'self'` (needs a hash) unless it stays the external `theme-init.js`.
- Options: (a) keep as is (current behaviour is correct and accessible); (b) behaviour-neutral half step: add `<meta name="color-scheme" content="dark">` to the four pages and keep it in sync in `theme-init.js` and `theme.ts` (small gain: the pre-CSS canvas matches the theme); (c) full guide pattern with system default, coordinated with the lernspiele shell.
- Recommendation: (a) unless Peter wants the site to follow the system scheme, then (c) across both repos in one change.
