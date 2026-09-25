/**
 * The verdict: does the braille on the cells still say what was typed?
 *
 * One function, used by the tests, by the accuracy report and by the Board screen, so that the
 * claim on screen and the claim in `docs/ACCURACY.md` are the same claim, computed once
 * (CLAUDE.md Law 5 — one authority per fact).
 *
 * THREE ANSWERS, NOT TWO. "Agrees" and "differs" are the easy ones. The third — "unchecked" — is
 * the honest one: it fires when the reader met a cell it has no rule for, or the printer met a
 * LaTeX command it does not know, and it means *this comparison proves nothing*. Collapsing that
 * into "agrees" would turn a gap in the checker into a clean bill of health for the braille, which
 * is precisely the lie this file exists to prevent.
 */

import type { DotMask } from './braille';
import { canonicalise, comparable } from './canonical';
import { readBack } from './readback';
import { fold, readBharati } from './bharatiback';
import { foldLiteral, readLiteral } from './literalback';
import { hasIndic, toDevanagari } from './indic';

export type Verdict = 'agrees' | 'differs' | 'unchecked';

export interface RoundTrip {
  readonly verdict: Verdict;
  /** What a braille reader would say the cells mean. */
  readonly reading: string;
  /** What the expression that was sent to the display means. */
  readonly expected: string;
  /** Why the comparison could not be made, when it could not. */
  readonly gaps: readonly string[];
}

/**
 * Read the cells back and compare them with the expression they were made from.
 *
 * `latex` must be what went *into* the translator. Passing it something derived from the cells
 * would make this function agree with itself, which is worth nothing.
 */
export function checkRoundTrip(latex: string, cells: readonly DotMask[]): RoundTrip {
  const back = readBack(cells);
  const want = canonicalise(latex);
  const gaps = [
    ...back.unknown.map((cell) => `the reader has no rule for ${cell}`),
    ...want.unknown.map((command) => `the printer has no rule for ${command}`),
  ];

  if (gaps.length > 0) {
    return { verdict: 'unchecked', reading: back.text, expected: want.text, gaps };
  }
  const agrees = comparable(back.text) === comparable(want.text);
  return { verdict: agrees ? 'agrees' : 'differs', reading: back.text, expected: want.text, gaps: [] };
}

/**
 * The same question, asked of the words.
 *
 * `words` must be what the teacher typed, in whatever script they typed it. It is transliterated to
 * Devanagari before comparing, because that is what the cells carry: Bharati Braille is one code
 * for nine scripts, and a Bengali ক leaves no trace of its Bengali-ness in the dots. Comparing the
 * reading against the original Bengali would fail every time and prove nothing.
 *
 * Both sides go through `fold()`, which collapses exactly the distinctions the braille does not
 * carry — and nothing else. See the list in `bharatiback.ts`; it is short, and every line of it is
 * a statement about the code.
 */
export function checkBharatiRoundTrip(words: string, cells: readonly DotMask[]): RoundTrip {
  const back = readBharati(cells);
  const want = toDevanagari(words);
  const gaps = back.unknown.map((cell) => `the reader has no rule for ${cell}`);

  if (gaps.length > 0) {
    return { verdict: 'unchecked', reading: back.text, expected: want, gaps };
  }
  const agrees = fold(back.text) === fold(want);
  return { verdict: agrees ? 'agrees' : 'differs', reading: back.text, expected: want, gaps: [] };
}

/** The same question, asked of English words written in Grade-1 braille. */
export function checkLiteralRoundTrip(words: string, cells: readonly DotMask[]): RoundTrip {
  const back = readLiteral(cells);
  const gaps = back.unknown.map((cell) => `the reader has no rule for ${cell}`);
  if (gaps.length > 0) {
    return { verdict: 'unchecked', reading: back.text, expected: words, gaps };
  }
  const agrees = foldLiteral(back.text) === foldLiteral(words);
  return { verdict: agrees ? 'agrees' : 'differs', reading: back.text, expected: words, gaps: [] };
}

/**
 * The verdict for one segment of a line, whatever code it is written in.
 *
 * The single entry point everything above `core/` should use. Which reader runs is decided the same
 * way `mixed.ts` decided which writer ran — by the kind of segment and the script it is in — so the
 * two decisions cannot drift apart.
 */
export function checkSegment(
  kind: 'maths' | 'text',
  text: string,
  latex: string,
  cells: readonly DotMask[],
): RoundTrip {
  if (kind === 'maths') return checkRoundTrip(latex, cells);
  return hasIndic(text) ? checkBharatiRoundTrip(text, cells) : checkLiteralRoundTrip(text, cells);
}
