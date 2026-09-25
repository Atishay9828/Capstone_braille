/**
 * The embosser file.
 *
 * A wrong table here would emboss confident nonsense onto paper that a child then reads alone, so
 * the checks are against cells a braille reader knows by heart rather than against our own output.
 */

import { describe, expect, it } from 'vitest';
import { dotsToMask, PATTERN_COUNT } from './braille';
import { cellsToBrf, maskToBrf, wrapBraille, worksheetToBrf } from './brf';

describe('Braille ASCII', () => {
  it('maps the letters everyone knows', () => {
    expect(maskToBrf(dotsToMask([]))).toBe(' '); // blank
    expect(maskToBrf(dotsToMask([1]))).toBe('A');
    expect(maskToBrf(dotsToMask([1, 2]))).toBe('B');
    expect(maskToBrf(dotsToMask([1, 3, 4, 6]))).toBe('X'); // the letter x
    expect(maskToBrf(dotsToMask([1, 2, 3, 4, 5, 6]))).toBe('=');
  });

  it('maps the Nemeth cells a maths worksheet is made of', () => {
    expect(maskToBrf(dotsToMask([3, 4, 5, 6])).toString()).toBe('#'); // numeric indicator
    expect(maskToBrf(dotsToMask([2]))).toBe('1'); // dropped digit 1
    expect(maskToBrf(dotsToMask([1, 4, 5, 6]))).toBe('?'); // open fraction
    expect(maskToBrf(dotsToMask([3, 4]))).toBe('/'); // fraction line
  });

  it('covers every one of the sixty-four patterns, with no duplicates', () => {
    const all = Array.from({ length: PATTERN_COUNT }, (_, mask) => maskToBrf(mask));
    expect(new Set(all).size).toBe(PATTERN_COUNT);
  });

  it('turns a run of cells into a run of characters', () => {
    // ⠹⠂⠌⠆⠼ — one half in Nemeth.
    const half = [dotsToMask([1, 4, 5, 6]), dotsToMask([2]), dotsToMask([3, 4]), dotsToMask([2, 3]), dotsToMask([3, 4, 5, 6])];
    expect(cellsToBrf(half)).toBe('?1/2#');
  });
});

describe('wrapping for paper', () => {
  it('leaves a short line alone', () => {
    expect(wrapBraille('ABC', 40)).toEqual(['ABC']);
  });

  it('breaks at a blank cell rather than mid-symbol', () => {
    expect(wrapBraille('AAAA BBBB CCCC', 10)).toEqual(['AAAA BBBB', 'CCCC']);
  });

  it('breaks at the margin when there is nowhere better', () => {
    const lines = wrapBraille('A'.repeat(25), 10);
    expect(lines).toEqual(['AAAAAAAAAA', 'AAAAAAAAAA', 'AAAAA']);
  });

  it('never returns an empty list, even for nothing', () => {
    expect(wrapBraille('', 40)).toEqual(['']);
  });

  it('refuses a line width that is not a line', () => {
    expect(() => wrapBraille('AB', 4)).toThrow();
  });
});

describe('a worksheet on paper', () => {
  const one = [dotsToMask([1])]; // "A"
  const two = [dotsToMask([1, 2])]; // "B"

  it('numbers the questions, because "the third one" has to mean something', () => {
    const brf = worksheetToBrf([{ cells: one }, { cells: two }]);
    expect(brf).toContain('#A. A');
    expect(brf).toContain('#B. B');
  });

  it('puts a blank line between questions and none at the end', () => {
    const brf = worksheetToBrf([{ cells: one }, { cells: two }]);
    expect(brf).toBe('#A. A\r\n\r\n#B. B\r\n');
  });

  it('breaks into pages with a form feed', () => {
    const many = Array.from({ length: 20 }, () => ({ cells: one }));
    const brf = worksheetToBrf(many, { pageLines: 6 });
    expect(brf).toContain('\f');
    for (const page of brf.split('\f')) {
      expect(page.split('\r\n').filter((line) => line !== '' || true).length).toBeLessThanOrEqual(7);
    }
  });

  it('handles an empty worksheet without producing rubbish', () => {
    expect(worksheetToBrf([])).toBe('\r\n');
  });
});
