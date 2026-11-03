/** Tutorial: every solving technique with an idea, how to spot it, and a real example to try. */
import '../ui/styles.css';
import './info.css';
import { UNITS, bit, digitsOf } from '../engine/grid.ts';
import { TECHNIQUE_NAMES, explain, hintArea, unitName } from '../engine/hints.ts';
import { TECHNIQUE_LEVEL } from '../engine/rater.ts';
import type { Step, Technique } from '../engine/techniques.ts';
import { MiniBoard } from '../ui/miniboard.ts';
import { initThemeToggle } from '../ui/theme.ts';
import examples from './technique-examples.json';

const LEVEL: Record<string, string> = { leicht: 'Leicht', mittel: 'Mittel', schwer: 'Schwer', experte: 'Experte' };

const TEXT: Record<Technique, { idea: string; spot: string }> = {
  hiddenSingle: {
    idea: 'Schau dir eine Einheit an (eine Zeile, eine Spalte oder einen Block) und frag: Wo kann eine bestimmte Ziffer hier überhaupt noch hin? Bleibt nur ein Feld übrig, gehört sie dorthin, auch wenn in diesem Feld sonst noch andere Ziffern passen würden.',
    spot: 'Gehe Block für Block die Ziffern 1 bis 9 durch. Streiche in Gedanken alle Zeilen und Spalten, in denen die Ziffer schon steht. Bleibt im Block ein einziges freies Feld, hast du sie gefunden.',
  },
  nakedSingle: {
    idea: 'Kommen in der Zeile, der Spalte und dem Block eines Feldes schon acht verschiedene Ziffern vor, bleibt für dieses Feld nur noch eine übrig.',
    spot: 'Achte auf Felder mit vielen ausgefüllten Nachbarn. Mit Notizen ist es leicht: ein Feld mit genau einer Notiz.',
  },
  pointing: {
    idea: 'Liegen in einem Block alle möglichen Plätze einer Ziffer in derselben Zeile (oder Spalte), dann steht die Ziffer in dieser Zeile sicher innerhalb des Blocks. Im Rest der Zeile kann sie nicht mehr stehen.',
    spot: 'Fülle die Notizen aus. Suche in einem Block eine Ziffer, deren Notizen alle auf einer Linie liegen, und schau, ob dieselbe Ziffer in dieser Linie außerhalb des Blocks noch notiert ist.',
  },
  claiming: {
    idea: 'Das Gegenstück zum Zeiger: Liegen in einer Zeile (oder Spalte) alle möglichen Plätze einer Ziffer im selben Block, dann steht die Ziffer im Block sicher auf dieser Linie. In den anderen Feldern des Blocks fällt sie weg.',
    spot: 'Gehe Zeilen und Spalten durch: Sind die Notizen einer Ziffer auf ein Drittel der Linie zusammengedrängt, prüfe den Block dazu.',
  },
  nakedPair: {
    idea: 'Zwei Felder einer Einheit haben genau dieselben zwei Kandidaten, zum Beispiel 3 und 7. Eines wird die 3, das andere die 7. Welches welches wird, ist noch offen, aber für andere Felder der Einheit sind 3 und 7 vergeben.',
    spot: 'Suche zwei Felder mit genau zwei gleichen Notizen in derselben Zeile, Spalte oder demselben Block.',
  },
  hiddenPair: {
    idea: 'Zwei Ziffern kommen in einer Einheit nur noch in denselben zwei Feldern vor. Diese zwei Felder sind für sie reserviert: Alle anderen Kandidaten in den beiden Feldern fallen weg. Danach ist es ein nacktes Paar.',
    spot: 'Zähle in einer Einheit, wie oft jede Ziffer notiert ist. Zwei Ziffern, die beide genau zweimal vorkommen, und zwar in denselben Feldern, sind ein verstecktes Paar.',
  },
  nakedTriple: {
    idea: 'Drei Felder einer Einheit haben zusammen nur drei verschiedene Kandidaten. Nicht jedes Feld muss alle drei haben: {1, 2}, {2, 5} und {1, 5} sind auch ein Tripel. Die drei Ziffern verteilen sich auf diese drei Felder und fallen sonst in der Einheit weg.',
    spot: 'Suche Felder mit zwei oder drei Notizen, die zusammen nur drei Ziffern ergeben.',
  },
  hiddenTriple: {
    idea: 'Drei Ziffern kommen in einer Einheit nur noch in denselben drei Feldern vor. Diese Felder sind für die drei Ziffern reserviert, alle anderen Kandidaten darin fallen weg.',
    spot: 'Selten und schwer zu sehen: Zähle für jede Ziffer die Felder, in denen sie in einer Einheit noch möglich ist.',
  },
  xWing: {
    idea: 'Eine Ziffer kommt in zwei Zeilen jeweils nur in zwei Feldern vor, und diese Felder liegen in denselben zwei Spalten: Sie bilden die Ecken eines Rechtecks. Entweder sind die Ecken links oben und rechts unten richtig oder rechts oben und links unten. In beiden Fällen ist jede der zwei Spalten schon besetzt, also fällt die Ziffer in diesen Spalten überall sonst weg. Dasselbe geht mit Spalten statt Zeilen.',
    spot: 'Wähle eine Ziffer und suche Zeilen, in denen sie nur zweimal notiert ist. Liegen zwei solche Paare in denselben Spalten, hast du ein X-Wing.',
  },
  xyWing: {
    idea: 'Ein Feld, der Angelpunkt, hat genau zwei Kandidaten x und y. Zwei Felder, die es sieht, die Flügel, haben {x, z} und {y, z}. Wird der Angelpunkt x, muss der eine Flügel z sein; wird er y, ist es der andere. Einer der Flügel ist also sicher z. Felder, die beide Flügel sehen, können kein z sein.',
    spot: 'Schau dir Felder mit genau zwei Notizen an. Findest du ein Dreieck aus solchen Feldern mit den Mustern xy, xz und yz, prüfe die Felder, die beide Flügel sehen.',
  },
  swordfish: {
    idea: 'Ein X-Wing mit drei Zeilen und drei Spalten: Eine Ziffer kommt in drei Zeilen nur in denselben drei Spalten vor (in jeder Zeile zwei- oder dreimal). Dann ist sie in diesen drei Spalten schon verteilt und fällt dort überall sonst weg.',
    spot: 'Sehr selten. Ein Hilfsmittel: Notiere für eine Ziffer, in welchen Spalten sie in jeder Zeile noch möglich ist, und suche drei Zeilen mit denselben drei Spalten.',
  },
};

/** A nudge that points to the right area without giving the answer away. */
function nudge(step: Step): string {
  const d = step.digits[0];
  const unit = step.units[0];
  switch (step.technique) {
    case 'hiddenSingle':
      return `Schau dir ${unitName(unit ?? 0)} an und such die ${d}.`;
    case 'nakedSingle':
      return 'Ein Feld hat nur noch eine einzige Notiz.';
    case 'pointing':
    case 'claiming':
      return `Achte auf die ${d} in ${unitName(unit ?? 0)}.`;
    case 'xWing':
    case 'swordfish':
      return `Achte auf die ${d} in den ${UNITS[unit ?? 0]?.kind === 'row' ? 'Zeilen' : 'Spalten'}.`;
    case 'xyWing':
      return 'Such Felder mit genau zwei Notizen.';
    default:
      return `Schau dir ${unitName(unit ?? 0)} genau an.`;
  }
}

function render(): void {
  const host = document.getElementById('techniques');
  const toc = document.getElementById('technique-toc');
  if (!host || !toc) return;
  for (const ex of examples) {
    const step = ex.step as Step;
    const technique = ex.technique as Technique;
    const name = TECHNIQUE_NAMES[technique];
    const level = LEVEL[TECHNIQUE_LEVEL[technique]] ?? '';

    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#${technique}`;
    a.textContent = `${name} (${level})`;
    li.append(a);
    toc.append(li);

    const section = document.createElement('section');
    section.id = technique;
    section.setAttribute('aria-labelledby', `${technique}-title`);
    const h2 = document.createElement('h2');
    h2.id = `${technique}-title`;
    h2.textContent = name;
    const badge = document.createElement('span');
    badge.className = 'badge badge--inline';
    badge.textContent = level;
    h2.append(' ', badge);

    const idea = document.createElement('p');
    idea.textContent = TEXT[technique].idea;
    const spotTitle = document.createElement('h3');
    spotTitle.textContent = 'Woran erkennst du es?';
    const spot = document.createElement('p');
    spot.textContent = TEXT[technique].spot;

    const demo = document.createElement('div');
    demo.className = 'demo';
    const demoTitle = document.createElement('h3');
    demoTitle.textContent = 'Beispiel: Findest du den Schritt?';
    const intro = document.createElement('p');
    intro.className = 'demo__hint';
    intro.textContent = `Diese Stellung stammt aus einem echten Sudoku des Generators. Die kleinen Zahlen sind die Kandidaten, die nach den vorherigen Schritten noch übrig sind. Tipp: ${nudge(step)}`;
    const body = document.createElement('div');
    body.className = 'demo__body';
    const boardHost = document.createElement('div');
    boardHost.className = 'demo__board';
    const board = new MiniBoard(boardHost, { label: `Beispiel ${name}`, notes: true });
    board.setValues(ex.values);
    board.setNotes(ex.cands);
    const out = document.createElement('div');
    out.className = 'demo__out';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button button--primary';
    button.textContent = 'Auflösen';
    const answer = document.createElement('div');
    answer.id = `${technique}-answer`;
    answer.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', answer.id);
    const { text } = explain(step);
    const answerText = document.createElement('p');
    answerText.textContent = text;
    const result = document.createElement('p');
    result.className = 'demo__hint';
    result.textContent = step.placements.length
      ? `Ergebnis: Du darfst die ${step.placements[0]?.digit} eintragen.`
      : `Ergebnis: ${step.eliminations.length} ${step.eliminations.length === 1 ? 'Kandidat fällt' : 'Kandidaten fallen'} weg (orange durchgestrichen).`;
    answer.append(answerText, result);

    button.addEventListener('click', () => {
      const open = answer.hidden;
      answer.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
      button.textContent = open ? 'Verbergen' : 'Auflösen';
      const strike = new Map<number, number>();
      if (open) for (const e of step.eliminations) strike.set(e.cell, (strike.get(e.cell) ?? 0) | bit(e.digit));
      board.setNotes(ex.cands, strike);
      board.mark('is-hint-area', open ? hintArea(step) : []);
      board.mark('is-hint-key', open ? step.cells : []);
      board.mark('is-hint-target', open ? [...step.placements, ...step.eliminations].map((x) => x.cell) : []);
    });
    // Text version of the position for screen readers (the board itself is drawn only visually).
    const textBoard = document.createElement('details');
    textBoard.className = 'steps';
    const textSummary = document.createElement('summary');
    textSummary.textContent = 'Stellung als Text';
    const rows = document.createElement('ol');
    rows.tabIndex = 0;
    rows.setAttribute('aria-label', `Stellung ${name} als Text`);
    for (let r = 0; r < 9; r++) {
      const li = document.createElement('li');
      const cells = Array.from({ length: 9 }, (_, c) => {
        const i = r * 9 + c;
        const v = ex.values[i] ?? 0;
        return v ? String(v) : `(${digitsOf(ex.cands[i] ?? 0).join(' ')})`;
      });
      li.textContent = `Zeile ${r + 1}: ${cells.join(', ')}`;
      rows.append(li);
    }
    textBoard.append(textSummary, rows);
    out.append(button, answer, textBoard);
    body.append(boardHost, out);
    demo.append(demoTitle, intro, body);

    section.append(h2, idea, spotTitle, spot, demo);
    host.append(section);
  }
}

initThemeToggle();
render();
