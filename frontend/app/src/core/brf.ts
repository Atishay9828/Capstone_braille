/**
 * BRF — Braille Ready Format, the file an embosser eats.
 *
 * A refreshable display is one cell at a time. Paper is thirty lines at once, it costs nothing to
 * read again tomorrow, and it goes home in a bag. A school that owns an embosser (or has a friend
 * who does) should be able to take a worksheet a teacher wrote here and press it onto paper, and
 * that is one small file away.
 *
 * BRF is deliberately dumb: ASCII, one character per braille cell, in the North American Braille
 * ASCII character set that every embosser has understood since the 1970s. Forty cells to a line and
 * twenty-five lines to a page are the defaults every embosser expects; both are arguments here
 * because school embossers are not all the same.
 *
 * The table below is the standard one, indexed by dot mask — dot 1 is bit 0, exactly as everywhere
 * else in Braillix. `brf.test.ts` checks it against the letters a braille reader knows by heart.
 */

import { PATTERN_COUNT, type DotMask } from './braille';

/**
 * Braille ASCII, in dot-mask order. Sixty-four characters, starting with the blank cell.
 *
 * Reading a few: mask 1 (dot 1) is "A"; mask 45 (dots 1-3-4-6, the letter x) is "X"; mask 63 (all
 * six) is "=". Those three are enough to catch a table that has been shifted or reversed.
 */
const BRAILLE_ASCII = ' A1B\'K2L@CIF/MSP"E3H9O6R^DJG>NTQ,*5<-U8V.%[$+X!&;:4\\0Z7(_?W]#Y)=';

/** What an embosser is set to unless somebody says otherwise. */
const BRF_DEFAULT_LINE_LENGTH = 40;
const BRF_DEFAULT_PAGE_LINES = 25;

class BrfError extends Error {}

if (BRAILLE_ASCII.length !== PATTERN_COUNT) {
  // A module-level check rather than a test-only one: a wrong table would emboss silent nonsense,
  // and this is cheap enough to run every time the file is loaded.
  throw new BrfError(`the Braille ASCII table must have ${PATTERN_COUNT} entries, not ${BRAILLE_ASCII.length}`);
}

/** One cell to one character. */
export function maskToBrf(mask: DotMask): string {
  const char = BRAILLE_ASCII[mask];
  if (char === undefined) throw new BrfError(`no Braille ASCII character for mask ${String(mask)}`);
  return char;
}

/** A run of cells to a run of characters, with no wrapping. */
export function cellsToBrf(cells: readonly DotMask[]): string {
  return cells.map(maskToBrf).join('');
}

export interface BrfOptions {
  /** Cells per line. Embossers are usually set to 40. */
  readonly lineLength?: number;
  /** Lines per page. 25 is the common default for A4 braille paper. */
  readonly pageLines?: number;
}

/**
 * Wrap one long line of braille the way paper needs it.
 *
 * Wrapping at a blank cell rather than mid-symbol wherever possible: a Nemeth fraction split across
 * two lines is still readable, but splitting between the numeric indicator and its digit is not.
 * Where there is no blank to break at — a long unbroken expression — it breaks at the line length,
 * because the alternative is running off the edge of the paper.
 */
export function wrapBraille(text: string, lineLength = BRF_DEFAULT_LINE_LENGTH): string[] {
  if (lineLength < 8) throw new BrfError('a braille line shorter than 8 cells is not a line');
  const lines: string[] = [];
  let rest = text;

  while (rest.length > lineLength) {
    const window = rest.slice(0, lineLength + 1);
    const breakAt = window.lastIndexOf(' ');
    const cut = breakAt > lineLength / 3 ? breakAt : lineLength;
    lines.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(breakAt > lineLength / 3 ? cut + 1 : cut);
  }
  if (rest.length > 0 || lines.length === 0) lines.push(rest);
  return lines;
}

export interface BrfItem {
  /** The braille for this item, as dot masks. */
  readonly cells: readonly DotMask[];
}

/**
 * A whole worksheet as a BRF file.
 *
 * Items are numbered in braille — the number sign and the dropped digits — because a page of
 * unnumbered expressions is impossible to talk about across a classroom ("the third one" has to
 * mean something). Pages are separated by a form feed, which is what an embosser expects.
 */
export function worksheetToBrf(items: readonly BrfItem[], options: BrfOptions = {}): string {
  const lineLength = options.lineLength ?? BRF_DEFAULT_LINE_LENGTH;
  const pageLines = options.pageLines ?? BRF_DEFAULT_PAGE_LINES;

  const lines: string[] = [];
  for (const [index, item] of items.entries()) {
    // "#a." — the number sign, the dropped digit, a full stop. Written in Braille ASCII directly
    // because it is a label on paper, not mathematics: it needs no Nemeth context.
    const number = `#${numberToBrfDigits(index + 1)}. `;
    const body = cellsToBrf(item.cells);
    const wrapped = wrapBraille(number + body, lineLength);
    lines.push(...wrapped);
    lines.push(''); // a blank line between questions, as a sighted worksheet would have
  }
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

  const pages: string[] = [];
  for (let i = 0; i < lines.length; i += pageLines) {
    pages.push(lines.slice(i, i + pageLines).join('\r\n'));
  }
  // Embossers expect CRLF and a form feed between pages, and a trailing newline at the end.
  return `${pages.join('\r\n\f')}\r\n`;
}

/** 1 -> "a", 12 -> "ab": Braille ASCII digits are the letters a–j, after a number sign. */
function numberToBrfDigits(value: number): string {
  return String(value)
    .split('')
    .map((digit) => 'JABCDEFGHI'[Number(digit)])
    .join('');
}
