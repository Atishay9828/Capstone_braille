/**
 * Reading uncontracted English braille back.
 *
 * The third and last reader. `readback.ts` handles the Nemeth, `bharatiback.ts` the Indian scripts,
 * and this one the English words in a question like "Find the value of 2x + 5 = 15" — which is the
 * commonest thing a teacher will type after the maths itself.
 *
 * With this in place every cell Braillix puts on a display has a second engine that can say what it
 * means, so the verdict on the Board screen covers the whole line instead of half of it.
 *
 * Grade 1, so there are no contractions to undo. The only state is the number sign: once it is
 * written, a–j are digits until a space, a letter sign, or anything that is not a digit.
 */

import { dotsToMask, maskToUnicode, type DotMask } from './braille';

export interface LiteralReadback {
  readonly text: string;
  readonly unknown: readonly string[];
}

/** Dot numbers to the Unicode braille character, through the one module that owns dot masks. */
const cell = (dots: readonly number[]) => maskToUnicode(dotsToMask(dots));

const LETTERS: Readonly<Record<string, string>> = Object.fromEntries(
  (
    [
      [[1], 'a'],
      [[1, 2], 'b'],
      [[1, 4], 'c'],
      [[1, 4, 5], 'd'],
      [[1, 5], 'e'],
      [[1, 2, 4], 'f'],
      [[1, 2, 4, 5], 'g'],
      [[1, 2, 5], 'h'],
      [[2, 4], 'i'],
      [[2, 4, 5], 'j'],
      [[1, 3], 'k'],
      [[1, 2, 3], 'l'],
      [[1, 3, 4], 'm'],
      [[1, 3, 4, 5], 'n'],
      [[1, 3, 5], 'o'],
      [[1, 2, 3, 4], 'p'],
      [[1, 2, 3, 4, 5], 'q'],
      [[1, 2, 3, 5], 'r'],
      [[2, 3, 4], 's'],
      [[2, 3, 4, 5], 't'],
      [[1, 3, 6], 'u'],
      [[1, 2, 3, 6], 'v'],
      [[2, 4, 5, 6], 'w'],
      [[1, 3, 4, 6], 'x'],
      [[1, 3, 4, 5, 6], 'y'],
      [[1, 3, 5, 6], 'z'],
    ] as [number[], string][]
  ).map(([dots, letter]) => [cell(dots), letter]),
);

/** In number mode the letters a–j are the digits 1–9 and 0. */
const DIGIT_OF: Readonly<Record<string, string>> = {
  a: '1',
  b: '2',
  c: '3',
  d: '4',
  e: '5',
  f: '6',
  g: '7',
  h: '8',
  i: '9',
  j: '0',
};

/**
 * Punctuation and the signs that are not letters.
 *
 * `?` and `"` are the same cell (dots 2-3-6) in this table, and `w` and `⠺` are not — so the only
 * genuine loss here is the quotation mark, which `foldLiteral()` records.
 */
const PUNCTUATION: Readonly<Record<string, string>> = {
  [cell([2])]: ',',
  [cell([2, 3])]: ';',
  [cell([2, 5])]: ':',
  [cell([2, 5, 6])]: '.',
  [cell([2, 3, 6])]: '?',
  [cell([2, 3, 5])]: '!',
  [cell([3])]: "'",
  [cell([3, 6])]: '-',
  [cell([1, 2, 3, 5, 6])]: '(',
  [cell([2, 3, 4, 5, 6])]: ')',
  [cell([3, 4])]: '/',
  [cell([3, 4, 6])]: '+',
  [cell([1, 2, 3, 4, 5, 6])]: '=',
  [cell([1, 6])]: '*',
};

const SPACE = cell([]);
const CAPITAL_SIGN = cell([6]);
const NUMBER_SIGN = cell([3, 4, 5, 6]);
const LETTER_SIGN = cell([5, 6]);

/** Read a run of Grade-1 English braille cells back as text. Never throws. */
export function readLiteralUnicode(braille: string): LiteralReadback {
  const out: string[] = [];
  const unknown: string[] = [];
  let inNumber = false;
  let capital = false;

  for (const current of braille) {
    if (current === SPACE) {
      out.push(' ');
      inNumber = false;
      capital = false;
      continue;
    }
    if (current === CAPITAL_SIGN) {
      capital = true;
      continue;
    }
    if (current === NUMBER_SIGN) {
      inNumber = true;
      continue;
    }
    if (current === LETTER_SIGN) {
      inNumber = false;
      continue;
    }

    const letter = LETTERS[current];
    if (letter) {
      const digit = inNumber ? DIGIT_OF[letter] : undefined;
      if (digit) {
        out.push(digit);
      } else {
        inNumber = false;
        out.push(capital ? letter.toUpperCase() : letter);
      }
      capital = false;
      continue;
    }

    const mark = PUNCTUATION[current];
    if (mark) {
      out.push(mark);
      inNumber = false;
      capital = false;
      continue;
    }

    unknown.push(current);
  }

  return { text: out.join(''), unknown };
}

/** The same, from the dot masks that are physically on the display. */
export function readLiteral(cells: readonly DotMask[]): LiteralReadback {
  return readLiteralUnicode(cells.map(maskToUnicode).join(''));
}

/**
 * Collapse what Grade-1 braille does not carry, and nothing more.
 *
 * Two lines only, because this code is nearly lossless: the question mark and the quotation mark
 * share dots 2-3-6, and so do the dash and the underscore of a fill-in-the-blank. Spaces go, as
 * everywhere else in these comparisons.
 */
export function foldLiteral(text: string): string {
  return text
    .replace(/"/g, '?')
    .replace(/_/g, '-') // a blank and a dash share dots 3-6
    .replace(/\s+/g, '');
}

/** What a single Grade-1 cell stands for, for the evidence table. */
export function literalMeaning(braille: string): string {
  if (braille === SPACE) return 'blank / space';
  if (braille === CAPITAL_SIGN) return 'capital sign';
  if (braille === NUMBER_SIGN) return 'number sign';
  if (braille === LETTER_SIGN) return 'letter sign';
  const readings: string[] = [];
  const letter = LETTERS[braille];
  if (letter) {
    readings.push(`letter ${letter}`);
    if (DIGIT_OF[letter]) readings.push(`digit ${DIGIT_OF[letter]}`);
  }
  if (PUNCTUATION[braille]) readings.push(PUNCTUATION[braille]);
  return readings.join(' · ');
}
