/**
 * Cross-check the human-readable Nemeth table against the engine that actually drives the motors.
 *
 * A lookup table written by hand is exactly the kind of thing that silently drifts. So rather than
 * trusting it, every letter and every digit in it is verified against speech-rule-engine's own
 * output. If the two ever disagree, this fails — and the atlas, the tooltips and the drill feedback
 * cannot go on telling a student something the hardware contradicts.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { NEMETH_DIGIT_MASKS, NEMETH_LETTER_MASKS, NEMETH_MEANINGS } from './nemeth-meanings';
import { PATTERN_COUNT, describeMask, dotsToMask } from './braille';
import { initSre } from './sre-service';
import { translateLatex } from './translate';

beforeAll(async () => {
  const status = await initSre();
  expect(status.ok).toBe(true);
}, 60_000);

describe('the meanings table', () => {
  it('has an entry for every one of the 64 patterns (even if empty)', () => {
    expect(NEMETH_MEANINGS).toHaveLength(PATTERN_COUNT);
  });

  it('covers the great majority of patterns with a real meaning', () => {
    const named = NEMETH_MEANINGS.filter((m) => m.length > 0).length;
    expect(named).toBeGreaterThanOrEqual(48);
  });

  it('is honest about ambiguity instead of picking one meaning', () => {
    // ⠼ is both the numeric indicator and the fraction close.
    expect(NEMETH_MEANINGS[dotsToMask([3, 4, 5, 6])]).toContain('·');
    // ⠂ is the digit 1 in Nemeth.
    expect(NEMETH_MEANINGS[dotsToMask([2])]).toContain('digit 1');
  });
});

describe('letters match the engine', () => {
  for (const [letter, mask] of NEMETH_LETTER_MASKS) {
    it(`“${letter}” is ${describeMask(mask)}`, async () => {
      const result = await translateLatex(letter);
      expect(result.cells).toEqual([mask]);
    });
  }
});

describe('digits match the engine', () => {
  for (const [digit, mask] of NEMETH_DIGIT_MASKS) {
    it(`“${digit}” is ${describeMask(mask)} after the numeric indicator`, async () => {
      const result = await translateLatex(digit);
      // A standalone number carries the numeric indicator ⠼ first.
      expect(result.cells).toEqual([dotsToMask([3, 4, 5, 6]), mask]);
    });
  }
});

describe('structural indicators match the engine', () => {
  it('fraction open / line / close', async () => {
    const { cells } = await translateLatex('\\frac{a}{b}');
    expect(cells[0]).toBe(dotsToMask([1, 4, 5, 6])); // ⠹
    expect(cells[2]).toBe(dotsToMask([3, 4])); // ⠌
    expect(cells[4]).toBe(dotsToMask([3, 4, 5, 6])); // ⠼
  });

  it('radical open and close', async () => {
    const { cells } = await translateLatex('\\sqrt{a}');
    expect(cells[0]).toBe(dotsToMask([3, 4, 5])); // ⠜
    expect(cells[cells.length - 1]).toBe(dotsToMask([1, 2, 4, 5, 6])); // ⠻
  });

  it('superscript and baseline levels', async () => {
    const { cells } = await translateLatex('x^2+1');
    expect(cells).toContain(dotsToMask([4, 5])); // ⠘ superscript
    expect(cells).toContain(dotsToMask([5])); // ⠐ baseline
  });

  it('parentheses', async () => {
    const { cells } = await translateLatex('(a+b)');
    expect(cells[0]).toBe(dotsToMask([1, 2, 3, 5, 6])); // ⠷
    expect(cells[cells.length - 1]).toBe(dotsToMask([2, 3, 4, 5, 6])); // ⠾
  });

  it('plus and minus', async () => {
    expect((await translateLatex('a+b')).cells).toContain(dotsToMask([3, 4, 6]));
    expect((await translateLatex('a-b')).cells).toContain(dotsToMask([3, 6]));
  });

  it('the first cell of a two-cell comparison sign', async () => {
    expect((await translateLatex('a=b')).cells).toContain(dotsToMask([4, 6])); // ⠨ of ⠨⠅
  });
});
