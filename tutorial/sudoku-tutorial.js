// Programmier-Tutorial „Dein eigener Sudoku-Löser“.
// Die Abschnitte zwischen "#region" und "#endregion" erscheinen auf programmieren.html.
// Dieser Code wird automatisch getestet (tutorial/sudoku-tutorial.test.ts), damit das Tutorial stimmt.

// #region schritt1
// Ein Sudoku als Text: 81 Ziffern, Zeile für Zeile, 0 = leeres Feld.
const raetsel =
  '007050000460709080910086500090020460004000700051060090009340015080102074000070800';

// Aus dem Text wird eine Liste (ein Array) mit 81 Zahlen.
const feld = raetsel.split('').map(Number);

// Gibt das Feld als 9 Zeilen aus, damit wir es lesen können.
function zeige(feld) {
  for (let zeile = 0; zeile < 9; zeile++) {
    const ziffern = feld.slice(zeile * 9, zeile * 9 + 9);
    console.log(ziffern.map((z) => (z === 0 ? '.' : z)).join(' '));
  }
}

zeige(feld);
// #endregion schritt1

// #region schritt2
// Darf die Ziffer z in Feld i stehen? Nur wenn sie in Zeile, Spalte und Block noch fehlt.
function erlaubt(feld, i, z) {
  const zeile = Math.floor(i / 9);
  const spalte = i % 9;
  const blockZeile = Math.floor(zeile / 3) * 3;
  const blockSpalte = Math.floor(spalte / 3) * 3;
  for (let k = 0; k < 9; k++) {
    if (feld[zeile * 9 + k] === z) return false; // gleiche Zeile
    if (feld[k * 9 + spalte] === z) return false; // gleiche Spalte
    const r = blockZeile + Math.floor(k / 3);
    const s = blockSpalte + (k % 3);
    if (feld[r * 9 + s] === z) return false; // gleicher Block
  }
  return true;
}

console.log(erlaubt(feld, 0, 8)); // true oder false?
// #endregion schritt2

// #region schritt3
// Backtracking: leeres Feld suchen, Ziffer probieren, weitermachen, sonst zurücknehmen.
function loese(feld) {
  const i = feld.indexOf(0); // erstes leeres Feld
  if (i === -1) return true; // kein leeres Feld mehr: gelöst!
  for (let z = 1; z <= 9; z++) {
    if (erlaubt(feld, i, z)) {
      feld[i] = z; // versuchen
      if (loese(feld)) return true; // hat geklappt
      feld[i] = 0; // Sackgasse: zurücknehmen
    }
  }
  return false; // keine Ziffer passt: einen Schritt zurück
}

const kopie = [...feld];
if (loese(kopie)) zeige(kopie);
// #endregion schritt3

// #region schritt4
// Wie viele Lösungen gibt es? Wir zählen, hören aber bei 2 auf.
function zaehleLoesungen(feld, grenze = 2) {
  const i = feld.indexOf(0);
  if (i === -1) return 1;
  let anzahl = 0;
  for (let z = 1; z <= 9 && anzahl < grenze; z++) {
    if (erlaubt(feld, i, z)) {
      feld[i] = z;
      anzahl += zaehleLoesungen(feld, grenze - anzahl);
      feld[i] = 0;
    }
  }
  return anzahl;
}

console.log(zaehleLoesungen([...feld])); // 1 heißt: eindeutig
// #endregion schritt4

// #region schritt5
// Schneller: Immer das Feld mit den wenigsten Möglichkeiten zuerst nehmen.
let versuche = 0;

function kandidaten(feld, i) {
  const liste = [];
  for (let z = 1; z <= 9; z++) if (erlaubt(feld, i, z)) liste.push(z);
  return liste;
}

function loeseSchlau(feld) {
  let bestesFeld = -1;
  let besteListe = [];
  for (let i = 0; i < 81; i++) {
    if (feld[i] !== 0) continue;
    const liste = kandidaten(feld, i);
    if (bestesFeld === -1 || liste.length < besteListe.length) {
      bestesFeld = i;
      besteListe = liste;
    }
  }
  if (bestesFeld === -1) return true;
  for (const z of besteListe) {
    versuche++;
    feld[bestesFeld] = z;
    if (loeseSchlau(feld)) return true;
    feld[bestesFeld] = 0;
  }
  return false;
}

loeseSchlau([...feld]);
console.log('Versuche:', versuche);
// #endregion schritt5

// #region schritt6
// Bonus: ein eigenes Sudoku bauen.
// 1. Ein leeres Feld mit Ziffern in zufälliger Reihenfolge füllen.
function mische(liste) {
  for (let i = liste.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [liste[i], liste[j]] = [liste[j], liste[i]];
  }
  return liste;
}

function fuelleZufaellig(feld) {
  const i = feld.indexOf(0);
  if (i === -1) return true;
  for (const z of mische([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    if (erlaubt(feld, i, z)) {
      feld[i] = z;
      if (fuelleZufaellig(feld)) return true;
      feld[i] = 0;
    }
  }
  return false;
}

// 2. Ziffern entfernen, solange das Rätsel eindeutig bleibt.
function baueSudoku() {
  const neu = new Array(81).fill(0);
  fuelleZufaellig(neu);
  for (const i of mische([...Array(81).keys()])) {
    const merke = neu[i];
    neu[i] = 0;
    if (zaehleLoesungen([...neu]) !== 1) neu[i] = merke; // nicht mehr eindeutig: zurücklegen
  }
  return neu;
}

zeige(baueSudoku());
// #endregion schritt6

export { baueSudoku, erlaubt, feld, fuelleZufaellig, kandidaten, loese, loeseSchlau, zaehleLoesungen };
export const zaehler = () => versuche;
