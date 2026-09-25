/**
 * What each of the 64 cell patterns means in Nemeth.
 *
 * Used by the Cell Atlas, by drill feedback ("you raised dot 3 — that's a minus, not a plus"), and
 * by tooltips. Several patterns are genuinely ambiguous out of context — ⠂ is the digit 1 in a
 * numeric context and a comma otherwise — and this table says so rather than picking one and
 * pretending.
 *
 * Every entry here is cross-checked against speech-rule-engine's own output by
 * `nemeth-meanings.test.ts`, so the table cannot quietly drift away from the engine that drives
 * the hardware.
 */

import { dotsToMask, PATTERN_COUNT, type DotMask } from './braille';

interface Entry {
  dots: number[];
  meaning: string;
}

/** Letters. In Nemeth these are the ordinary uncontracted braille letters. */
const LETTERS: ReadonlyArray<readonly [string, number[]]> = [
  ['a', [1]],
  ['b', [1, 2]],
  ['c', [1, 4]],
  ['d', [1, 4, 5]],
  ['e', [1, 5]],
  ['f', [1, 2, 4]],
  ['g', [1, 2, 4, 5]],
  ['h', [1, 2, 5]],
  ['i', [2, 4]],
  ['j', [2, 4, 5]],
  ['k', [1, 3]],
  ['l', [1, 2, 3]],
  ['m', [1, 3, 4]],
  ['n', [1, 3, 4, 5]],
  ['o', [1, 3, 5]],
  ['p', [1, 2, 3, 4]],
  ['q', [1, 2, 3, 4, 5]],
  ['r', [1, 2, 3, 5]],
  ['s', [2, 3, 4]],
  ['t', [2, 3, 4, 5]],
  ['u', [1, 3, 6]],
  ['v', [1, 2, 3, 6]],
  ['w', [2, 4, 5, 6]],
  ['x', [1, 3, 4, 6]],
  ['y', [1, 3, 4, 5, 6]],
  ['z', [1, 3, 5, 6]],
];

/**
 * Nemeth digits, "dropped" into the lower part of the cell — the single most distinctive feature
 * of the code, and the thing that surprises everyone who has only seen literary braille.
 */
const DIGITS: ReadonlyArray<readonly [string, number[]]> = [
  ['0', [3, 5, 6]],
  ['1', [2]],
  ['2', [2, 3]],
  ['3', [2, 5]],
  ['4', [2, 5, 6]],
  ['5', [2, 6]],
  ['6', [2, 3, 5]],
  ['7', [2, 3, 5, 6]],
  ['8', [2, 3, 6]],
  ['9', [3, 5]],
];

/** Indicators and single-cell operators. Two-cell symbols (⠨⠅ for "=") are described on their first cell. */
const SYMBOLS: ReadonlyArray<Entry> = [
  { dots: [], meaning: 'blank / space' },
  { dots: [3, 4, 6], meaning: 'plus' },
  { dots: [3, 6], meaning: 'minus' },
  { dots: [3, 4, 5, 6], meaning: 'numeric indicator · fraction close' },
  { dots: [1, 4, 5, 6], meaning: 'fraction open' },
  { dots: [3, 4], meaning: 'fraction line' },
  { dots: [3, 4, 5], meaning: 'radical open' },
  { dots: [1, 2, 4, 5, 6], meaning: 'radical close' },
  { dots: [4, 5], meaning: 'superscript level' },
  { dots: [5, 6], meaning: 'subscript level' },
  { dots: [5], meaning: 'baseline level' },
  { dots: [1, 2, 3, 5, 6], meaning: 'open parenthesis' },
  { dots: [2, 3, 4, 5, 6], meaning: 'close parenthesis' },
  { dots: [4, 6], meaning: 'first cell of “=”, “≠” and other two-cell comparisons' },
  { dots: [1, 2, 3, 4, 5, 6], meaning: 'full cell — Braillix uses it for a folded sub-expression' },
];

function build(): string[] {
  const table = new Array<string>(PATTERN_COUNT).fill('');
  const add = (mask: DotMask, meaning: string) => {
    table[mask] = table[mask] ? `${table[mask]} · ${meaning}` : meaning;
  };

  for (const entry of SYMBOLS) add(dotsToMask(entry.dots), entry.meaning);
  for (const [digit, dots] of DIGITS) add(dotsToMask(dots), `digit ${digit}`);
  for (const [letter, dots] of LETTERS) add(dotsToMask(dots), `letter ${letter}`);

  return table;
}

/** Indexed by dot mask (0..63). Empty string where the pattern has no common Nemeth meaning. */
export const NEMETH_MEANINGS: readonly string[] = build();

/** The digit table on its own — the drills quiz it directly. */
export const NEMETH_DIGIT_MASKS: ReadonlyMap<string, DotMask> = new Map(
  DIGITS.map(([digit, dots]) => [digit, dotsToMask(dots)]),
);

/** The letter table on its own. */
export const NEMETH_LETTER_MASKS: ReadonlyMap<string, DotMask> = new Map(
  LETTERS.map(([letter, dots]) => [letter, dotsToMask(dots)]),
);
