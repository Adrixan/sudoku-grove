/** Hints for the player's current position, with German explanations (du-Form). */
import { type Game, basicCandidates, wrongCells, wrongNoteCells } from './game.ts';
import { CELLS, type Grid, PEERS, UNITS, boxOf, colOf, rowOf } from './grid.ts';
import { type State, type Step, type Technique, findStep } from './techniques.ts';

export const TECHNIQUE_NAMES: Record<Technique, string> = {
  hiddenSingle: 'Versteckter Single',
  nakedSingle: 'Nackter Single',
  pointing: 'Zeiger',
  claiming: 'Block-Linien-Regel',
  nakedPair: 'Nacktes Paar',
  hiddenPair: 'Verstecktes Paar',
  nakedTriple: 'Nacktes Tripel',
  hiddenTriple: 'Verstecktes Tripel',
  xWing: 'X-Wing',
  xyWing: 'XY-Wing',
  swordfish: 'Swordfish',
};

export type Hint =
  | { kind: 'mistake'; cells: number[]; title: string; text: string }
  | { kind: 'noteMistake'; cells: number[]; title: string; text: string }
  | { kind: 'step'; step: Step; candidates: number[]; blockers: number[]; title: string; text: string }
  | { kind: 'none'; cells: []; title: string; text: string };

export const cellName = (cell: number): string => `Zeile ${rowOf(cell) + 1}, Spalte ${colOf(cell) + 1}`;
const cellShort = (cell: number): string => `Z${rowOf(cell) + 1}/S${colOf(cell) + 1}`;

export function unitName(unitIndex: number): string {
  const u = UNITS[unitIndex];
  if (!u) return '';
  const n = u.index + 1;
  return u.kind === 'row' ? `Zeile ${n}` : u.kind === 'col' ? `Spalte ${n}` : `Block ${n}`;
}

function list(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} und ${items.at(-1)}`;
}
const cellList = (cells: readonly number[]): string => list(cells.map(cellShort));
const digitList = (digits: readonly number[]): string => list(digits.map(String));

export function explain(step: Step): { title: string; text: string } {
  const title = TECHNIQUE_NAMES[step.technique];
  const d = step.digits[0] ?? 0;
  const [u0 = -1, u1 = -1] = step.units;
  const elimCells = [...new Set(step.eliminations.map((e) => e.cell))];
  const strike = elimCells.length ? ` Streiche sie in ${cellList(elimCells)}.` : '';
  switch (step.technique) {
    case 'hiddenSingle': {
      const c = step.cells[0] ?? 0;
      return { title, text: `In ${unitName(u0)} gibt es nur noch einen Platz für die ${d}: ${cellName(c)}. Alle anderen freien Felder sehen schon eine ${d} in ihrer Zeile, Spalte oder ihrem Block.` };
    }
    case 'nakedSingle': {
      const c = step.cells[0] ?? 0;
      return { title, text: `In ${cellName(c)} passt nur noch die ${d}. Alle anderen Ziffern kommen in seiner Zeile, seiner Spalte oder seinem Block schon vor.` };
    }
    case 'pointing':
      return { title, text: `In ${unitName(u0)} kann die ${d} nur in ${unitName(u1)} stehen (${cellList(step.cells)}). Also darf die ${d} sonst nirgends in ${unitName(u1)} stehen.${strike}` };
    case 'claiming':
      return { title, text: `In ${unitName(u0)} kann die ${d} nur innerhalb von ${unitName(u1)} stehen (${cellList(step.cells)}). Also ist die ${d} im restlichen ${unitName(u1)} ausgeschlossen.${strike}` };
    case 'nakedPair':
    case 'nakedTriple':
      return { title, text: `Die Felder ${cellList(step.cells)} in ${unitName(u0)} haben zusammen nur die Kandidaten ${digitList(step.digits)}. Diese Ziffern müssen genau dort stehen, also fallen sie in den anderen Feldern von ${unitName(u0)} weg.${elimCells.length ? ` Betroffen: ${cellList(elimCells)}.` : ''}` };
    case 'hiddenPair':
    case 'hiddenTriple':
      return { title, text: `Die Ziffern ${digitList(step.digits)} können in ${unitName(u0)} nur in ${cellList(step.cells)} stehen. Dort ist also kein Platz für andere Ziffern: Streiche die übrigen Kandidaten in diesen Feldern.` };
    case 'xWing':
    case 'swordfish': {
      const lines = list(step.units.map(unitName));
      const cross = UNITS[u0]?.kind === 'row' ? 'Spalten' : 'Zeilen';
      const n = step.technique === 'xWing' ? 'zwei' : 'drei';
      return { title, text: `In ${lines} kann die ${d} nur in denselben ${n} ${cross} stehen (${cellList(step.cells)}). Wie auch immer es aufgeht: In jeder dieser ${cross} steht die ${d} in einem der markierten Felder. Außerhalb davon ist die ${d} in diesen ${cross} ausgeschlossen.${strike}` };
    }
    case 'xyWing': {
      const [pivot = 0, a = 0, b = 0] = step.cells;
      const z = step.eliminations[0]?.digit ?? 0;
      const [x = 0, y = 0] = step.digits.filter((v) => v !== z);
      return { title, text: `${cellName(pivot)} kann nur ${x} oder ${y} sein. Ist es die ${x}, muss in einem der beiden anderen markierten Felder (${cellShort(a)} oder ${cellShort(b)}) die ${z} stehen; ist es die ${y}, im anderen. In jedem Fall steht in ${cellShort(a)} oder ${cellShort(b)} eine ${z}. Felder, die beide sehen, können keine ${z} sein.${strike}` };
    }
  }
}

/** Candidate state from entries, narrowed by the player's (correct) pencil marks. */
function playerState(game: Game): State {
  const cands = Array.from({ length: CELLS }, (_, cell) => {
    const basic = basicCandidates(game.values, cell);
    const notes = game.notes[cell] ?? 0;
    return notes ? basic & notes : basic;
  });
  return { values: [...game.values], cands };
}

export function getHint(game: Game): Hint {
  const wrong = wrongCells(game);
  if (wrong.length) {
    return { kind: 'mistake', cells: wrong, title: 'Fehler gefunden', text: wrong.length === 1 ? `In ${cellName(wrong[0] ?? 0)} steht eine falsche Ziffer. Lösche sie zuerst.` : `${wrong.length} Felder enthalten eine falsche Ziffer, sie sind markiert. Lösche sie zuerst.` };
  }
  const wrongNotes = wrongNoteCells(game);
  if (wrongNotes.length) {
    return { kind: 'noteMistake', cells: wrongNotes, title: 'Notiz prüfen', text: `In ${cellList(wrongNotes)} fehlt in deinen Notizen die richtige Ziffer. Prüfe diese Notizen noch einmal.` };
  }
  const state = playerState(game);
  const step = findStep(state);
  if (!step) return { kind: 'none', cells: [], title: 'Kein Tipp', text: 'Hier findet der Tipp-Assistent gerade keinen logischen Schritt.' };
  const blockers = hintBlockers(step, game.values);
  const { title, text } = explain(step);
  const note = blockers.length ? ' Gestrichelt umrandet: die Ziffern, die das zeigen.' : '';
  return { kind: 'step', step, candidates: state.cands, blockers, title, text: text + note };
}

/** Cells to highlight for a step: the units it is about; for a naked single the cell's row, column and box. */
export function hintArea(step: Step): Set<number> {
  const units = [...step.units];
  if (step.technique === 'nakedSingle') {
    const c = step.cells[0] ?? 0;
    units.push(rowOf(c), 9 + colOf(c), 18 + boxOf(c));
  }
  return new Set(units.flatMap((u) => UNITS[u]?.cells ?? []));
}

/**
 * For singles: placed digits that show why the step works. Hidden single: for every other empty
 * cell of the unit, one placed copy of the digit it sees. Naked single: for every other digit,
 * one placed copy in the cell's row, column or box. Few cells, reused where possible.
 */
export function hintBlockers(step: Step, values: Grid): number[] {
  const chosen = new Set<number>();
  const pick = (cell: number, digit: number): void => {
    const peers = PEERS[cell] ?? [];
    if (peers.some((p) => chosen.has(p) && values[p] === digit)) return;
    const found = peers.find((p) => values[p] === digit);
    if (found !== undefined) chosen.add(found);
  };
  if (step.technique === 'hiddenSingle') {
    const target = step.placements[0];
    const unit = UNITS[step.units[0] ?? -1];
    if (!target || !unit) return [];
    for (const c of unit.cells) if (c !== target.cell && values[c] === 0) pick(c, target.digit);
  } else if (step.technique === 'nakedSingle') {
    const target = step.placements[0];
    if (!target) return [];
    for (let d = 1; d <= 9; d++) if (d !== target.digit) pick(target.cell, d);
  }
  return [...chosen].sort((a, b) => a - b);
}
