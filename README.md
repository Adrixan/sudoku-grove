# Sudoku (sudoku-grove)
Sudoku für [lernspiele.aufner.org](https://lernspiele.aufner.org/) (Route `teens/sudoku`): eigener Generator mit eindeutiger Lösung, vier Stufen nach benötigter Lösungstechnik (Leicht, Mittel, Schwer, Experte), Notizen, Rückgängig, Tipps, die die Technik erklären, Tagesrätsel und Offline-Modus. Ohne Anmeldung, ohne Tracking; der Spielstand bleibt im Browser.

## Entwicklung
- `npm ci`, dann `npm run dev` (Vite), `npm test` (Vitest), `npm run typecheck`, `npm run build` (statische Ausgabe in `dist/`).
- `src/engine/`: Spiellogik ohne DOM (Generator, Löser, Techniken, Bewertung, Tipps); `src/ui/`: Oberfläche; `src/storage/`: lokaler Spielstand.
- Veröffentlicht wird über die Release-Pipeline von `lernspiele.aufner.org`, nicht aus diesem Repository.

## Lizenz
Code: AGPL-3.0 (`LICENSE`). Schriften: SIL OFL 1.1 (`public/fonts/`).
