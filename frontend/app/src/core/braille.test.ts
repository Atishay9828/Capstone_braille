import { describe, expect, it } from 'vitest';
import {
  BLANK,
  BrailleError,
  FULL_CELL,
  PATTERN_COUNT,
  describeMask,
  dotDistance,
  dotsToMask,
  hasDot,
  isDotMask,
  maskToDots,
  maskToUnicode,
  unicodeStringToMasks,
  unicodeToMask,
} from './braille';

describe('dot masks', () => {
  it('maps dots to bits in the standard order (dot1 -> bit0 … dot6 -> bit5)', () => {
    expect(dotsToMask([1])).toBe(0b000001);
    expect(dotsToMask([2])).toBe(0b000010);
    expect(dotsToMask([3])).toBe(0b000100);
    expect(dotsToMask([4])).toBe(0b001000);
    expect(dotsToMask([5])).toBe(0b010000);
    expect(dotsToMask([6])).toBe(0b100000);
  });

  it('matches the worked example in the hardware handoff (§3 step 2)', () => {
    // "(1,2,5) -> 19" straight out of SOFTWARE_TEAM_README.
    expect(dotsToMask([1, 2, 5])).toBe(19);
    expect(dotsToMask([])).toBe(0);
  });

  it('is order- and duplicate-insensitive', () => {
    expect(dotsToMask([5, 1, 2, 2])).toBe(dotsToMask([1, 2, 5]));
  });

  it('round-trips every one of the 64 patterns', () => {
    for (let mask = 0; mask < PATTERN_COUNT; mask += 1) {
      expect(dotsToMask(maskToDots(mask))).toBe(mask);
    }
  });

  it('rejects dot numbers outside 1..6', () => {
    expect(() => dotsToMask([0])).toThrow(BrailleError);
    expect(() => dotsToMask([7])).toThrow(BrailleError);
    expect(() => dotsToMask([1.5])).toThrow(BrailleError);
  });

  it('knows what is and is not a dot mask', () => {
    expect(isDotMask(0)).toBe(true);
    expect(isDotMask(63)).toBe(true);
    expect(isDotMask(64)).toBe(false);
    expect(isDotMask(-1)).toBe(false);
    expect(isDotMask(1.5)).toBe(false);
    expect(isDotMask('3')).toBe(false);
  });

  it('reports individual dots', () => {
    const mask = dotsToMask([1, 4, 6]);
    expect(hasDot(mask, 1)).toBe(true);
    expect(hasDot(mask, 2)).toBe(false);
    expect(hasDot(mask, 4)).toBe(true);
    expect(hasDot(mask, 6)).toBe(true);
  });
});

describe('unicode braille', () => {
  it('agrees with the Unicode Braille Patterns block for all 64 cells', () => {
    for (let mask = 0; mask < PATTERN_COUNT; mask += 1) {
      const char = maskToUnicode(mask);
      expect(char.codePointAt(0)).toBe(0x2800 + mask);
      expect(unicodeToMask(char)).toBe(mask);
    }
  });

  it('names the landmark cells correctly', () => {
    expect(maskToUnicode(BLANK)).toBe('⠀');
    expect(maskToUnicode(FULL_CELL)).toBe('⠿'); // ⠿ — Braillix's "folded" marker
    expect(maskToUnicode(dotsToMask([1]))).toBe('⠁'); // ⠁
    expect(maskToUnicode(19)).toBe('⠓');
  });

  it('returns null for characters outside the 6-dot block', () => {
    expect(unicodeToMask('a')).toBeNull();
    expect(unicodeToMask(' ')).toBeNull();
    expect(unicodeToMask('⣿')).toBeNull(); // an 8-dot pattern
  });
});

describe('unicodeStringToMasks', () => {
  it('keeps spaces as blank cells rather than dropping them', () => {
    // Dropping a separator would shift every following cell — a silent, invisible corruption.
    const { cells, unknown } = unicodeStringToMasks('⠁ ⠃');
    expect(cells).toEqual([1, 0, 3]);
    expect(unknown).toEqual([]);
  });

  it('treats the braille blank and an ASCII space identically', () => {
    expect(unicodeStringToMasks('⠁⠀⠃').cells).toEqual([1, 0, 3]);
  });

  it('reports unknown characters instead of hiding them', () => {
    const { cells, unknown } = unicodeStringToMasks('⠁?⠃');
    expect(cells).toEqual([1, 3]);
    expect(unknown).toEqual(['?']);
  });

  it('skips layout whitespace from the translator', () => {
    expect(unicodeStringToMasks('⠁\n\t⠃').cells).toEqual([1, 3]);
  });
});

describe('dotDistance', () => {
  it('counts differing dots', () => {
    expect(dotDistance(0, 0)).toBe(0);
    expect(dotDistance(0, 63)).toBe(6);
    expect(dotDistance(dotsToMask([1, 2]), dotsToMask([1, 3]))).toBe(2);
  });
});

describe('describeMask', () => {
  it('produces something a human can check against a cam', () => {
    expect(describeMask(19)).toBe('⠓ (1-2-5)');
    expect(describeMask(0)).toBe('⠀ (blank)');
  });
});
