# Sudoku (sudoku-grove)
Sudoku für [lernspiele.aufner.org](https://lernspiele.aufner.org/) (Route `teens/sudoku`): eigener Generator mit eindeutiger Lösung, vier Stufen nach benötigter Lösungstechnik (Leicht, Mittel, Schwer, Experte), Notizen, Rückgängig, Tipps, die die Technik erklären, Tagesrätsel und Offline-Modus. Ohne Anmeldung, ohne Tracking; der Spielstand bleibt im Browser.

## Entwicklung
- `npm ci`, dann `npm run dev` (Vite), `npm test` (Vitest), `npm run typecheck`, `npm run build` (statische Ausgabe in `dist/`).
- `src/engine/`: Spiellogik ohne DOM (Generator, Löser, Techniken, Bewertung, Tipps); `src/ui/`: Oberfläche; `src/storage/`: lokaler Spielstand.
- Veröffentlicht wird über die Release-Pipeline von `lernspiele.aufner.org`, nicht aus diesem Repository.

## Lizenz
- Code: PolyForm Noncommercial License 1.0.0 (`LICENSE`, SPDX `PolyForm-Noncommercial-1.0.0`): Nutzung, Änderung und Weitergabe für nichtkommerzielle Zwecke erlaubt, auch an Schulen und Bildungseinrichtungen.
- Inhalte (Texte des Lernbereichs, Tipp- und Technikerklärungen): [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.de).
- Kommerzielle Nutzung von Code und Inhalten bleibt Peter Aufner vorbehalten (Anfragen: https://prof.aufner.org).
- Contributions are accepted only with a written agreement that lets Peter Aufner license them commercially.
- Schriften: SIL OFL 1.1 (`public/fonts/`), mit eigenen Lizenztexten.
- Code licence PolyForm Noncommercial 1.0.0 since 2026-11-07 (Peter): only Peter may use it commercially; versions published before that date stay available under AGPL-3.0 to those who received them.
