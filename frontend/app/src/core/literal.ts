/**
 * Literal braille — the last resort, and a small feature in its own right.
 *
 * `ARCHITECTURE.md` promised that if the maths engine ever fails, the display would fall back to a
 * literal rendering rather than going blank. That promise was written before this file existed,
 * which made it a claim rather than a behaviour — exactly the sort of documented-but-unbuilt gap
 * that turns into a nasty surprise. So here it is.
 *
 * This is **uncontracted (Grade 1) English braille**, not Nemeth. It is deliberately simple: the
 * standard letter, digit and punctuation cells, a capital indicator, and a number sign. It cannot
 * express a fraction or an exponent and does not pretend to — when it is used, the interface says
 * so, because braille that silently means something different from what the reader expects is
 * worse than no braille at all.
 *
 * It is also genuinely useful on its own: a student writing their name, a teacher labelling a
 * worksheet. Maths is what Braillix is for, but text is what surrounds it.
 */

import { BLANK, dotsToMask, type DotMask } from './braille';

/** Uncontracted English braille letters. The same cells Nemeth uses for variables. */
const LETTERS: Readonly<Record<string, readonly number[]>> = {
  a: [1],
  b: [1, 2],
  c: [1, 4],
  d: [1, 4, 5],
  e: [1, 5],
  f: [1, 2, 4],
  g: [1, 2, 4, 5],
  h: [1, 2, 5],
  i: [2, 4],
  j: [2, 4, 5],
  k: [1, 3],
  l: [1, 2, 3],
  m: [1, 3, 4],
  n: [1, 3, 4, 5],
  o: [1, 3, 5],
  p: [1, 2, 3, 4],
  q: [1, 2, 3, 4, 5],
  r: [1, 2, 3, 5],
  s: [2, 3, 4],
  t: [2, 3, 4, 5],
  u: [1, 3, 6],
  v: [1, 2, 3, 6],
  w: [2, 4, 5, 6],
  x: [1, 3, 4, 6],
  y: [1, 3, 4, 5, 6],
  z: [1, 3, 5, 6],
};

/**
 * Digits in LITERARY braille are the letters a–j preceded by the number sign — which is not what
 * Nemeth does. Nemeth drops them into the lower cell instead. Getting these two confused is the
 * single most common mistake in maths braille, and it is why the interface must say which code is
 * in use whenever this fallback is active.
 */
const DIGIT_LETTER: Readonly<Record<string, string>> = {
  '1': 'a',
  '2': 'b',
  '3': 'c',
  '4': 'd',
  '5': 'e',
  '6': 'f',
  '7': 'g',
  '8': 'h',
  '9': 'i',
  '0': 'j',
};

const PUNCTUATION: Readonly<Record<string, readonly number[]>> = {
  ',': [2],
  ';': [2, 3],
  ':': [2, 5],
  '.': [2, 5, 6],
  '?': [2, 3, 6],
  '!': [2, 3, 5],
  "'": [3],
  '-': [3, 6],
  // A blank to be filled in. Written with the same cell as a dash, because that is exactly what the
  // printed line is — and `foldLiteral()` records that the two cannot be told apart.
  '_': [3, 6],
  '(': [1, 2, 3, 5, 6],
  ')': [2, 3, 4, 5, 6],
  '/': [3, 4],
  '+': [3, 4, 6],
  '=': [1, 2, 3, 4, 5, 6],
  '*': [1, 6],
  '"': [2, 3, 6],
};

/** Dots 6 — the next letter is a capital. */
const CAPITAL_SIGN = dotsToMask([6]);
/** Dots 3-4-5-6 — the following letters a–j are digits. */
const NUMBER_SIGN = dotsToMask([3, 4, 5, 6]);
/** Dots 5-6 — cancels number mode when a letter follows a digit directly. */
const LETTER_SIGN = dotsToMask([5, 6]);

export interface LiteralResult {
  readonly cells: readonly DotMask[];
  /** Characters that have no cell in this table. Reported, never silently dropped. */
  readonly unsupported: readonly string[];
}

/**
 * Text -> uncontracted English braille cells.
 *
 * Number mode is the fiddly part: once the number sign is written, a–j mean digits until a space
 * or a non-digit ends it. A letter immediately after a digit needs the letter sign, or "2a" would
 * read as "22".
 */
export function textToLiteralBraille(text: string): LiteralResult {
  const cells: DotMask[] = [];
  const unsupported: string[] = [];
  let inNumber = false;

  for (const char of text) {
    if (char === ' ' || char === '\t' || char === '\n') {
      cells.push(BLANK);
      inNumber = false;
      continue;
    }

    const digitLetter = DIGIT_LETTER[char];
    if (digitLetter) {
      if (!inNumber) {
        cells.push(NUMBER_SIGN);
        inNumber = true;
      }
      cells.push(dotsToMask(LETTERS[digitLetter]));
      continue;
    }

    const lower = char.toLowerCase();
    const letter = LETTERS[lower];
    if (letter) {
      // "2a" without the letter sign would read as the digits "22".
      if (inNumber && lower >= 'a' && lower <= 'j') cells.push(LETTER_SIGN);
      inNumber = false;
      if (char !== lower) cells.push(CAPITAL_SIGN);
      cells.push(dotsToMask(letter));
      continue;
    }

    const punctuation = PUNCTUATION[char];
    if (punctuation) {
      inNumber = false;
      cells.push(dotsToMask(punctuation));
      continue;
    }

    inNumber = false;
    unsupported.push(char);
  }

  return { cells, unsupported };
}

/**
 * Strip LaTeX down to something the literal table can render.
 *
 * Only used when the maths engine is unavailable. It removes the commands and braces, leaving the
 * letters, digits and operators — which is not the maths, but it is honest and it keeps the
 * display alive. The caller must tell the user this is what happened.
 */
export function latexToPlainText(latex: string): string {
  return latex
    .replace(/\\(frac|sqrt|sum|int|lim|sin|cos|tan|log|ln|pm|times|div|cdot|theta|pi|alpha|beta)\b/g, ' $1 ')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[{}]/g, ' ')
    .replace(/\^/g, ' to the power ')
    .replace(/_/g, ' sub ')
    .replace(/\s+/g, ' ')
    .trim();
}
