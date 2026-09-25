/**
 * The other half of the comparison.
 *
 * `canonical.ts` has one job: print LaTeX in exactly the form `readback.ts` produces, so that the
 * two can be compared character for character. These tests pin that form down, because a printer
 * that quietly changed its mind about parentheses would break every round-trip at once and look
 * like a braille bug.
 *
 * The last block is the one that matters most: an unknown command must be *reported*, because an
 * unreported one would make the comparison meaningless while still looking like a pass.
 */

import { describe, expect, it } from 'vitest';
import { canonicalise, comparable } from './canonical';
import { checkRoundTrip } from './roundtrip';
import { unicodeStringToMasks } from './braille';

const print = (latex: string) => canonicalise(latex).text;

describe('printing LaTeX in the canonical form', () => {
  it('leaves ordinary arithmetic alone', () => {
    expect(print('2+3=5')).toBe('2+3=5');
    expect(print('1,00,000')).toBe('1,00,000');
    expect(print('3.14')).toBe('3.14');
  });

  it('parenthesises everything that groups', () => {
    expect(print('\\frac{1}{2}')).toBe('(1)/(2)');
    expect(print('x^2')).toBe('x^(2)');
    expect(print('x^{10}')).toBe('x^(10)');
    expect(print('x_1')).toBe('x_(1)');
    expect(print('\\sqrt{9}')).toBe('√(9)');
    expect(print('\\sqrt[3]{27}')).toBe('√[3](27)');
  });

  it('nests without losing track', () => {
    expect(print('\\frac{\\frac{3}{4}\\times 2}{5}')).toBe('((3)/(4)×2)/(5)');
    expect(print('\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}')).toBe('(-b±√(b^(2)-4ac))/(2a)');
    expect(print('x^{(n+1)}')).toBe('x^((n+1))');
  });

  it('spells the signs out as symbols, and the functions out as letters', () => {
    expect(print('3\\times 4')).toBe('3×4');
    expect(print('a\\ne b')).toBe('a≠b');
    expect(print('2\\le x')).toBe('2≤x');
    expect(print('\\sin\\theta')).toBe('sinθ');
    expect(print('\\log_{10}100')).toBe('log_(10)100');
    expect(print('\\sum_{i=1}^ni')).toBe('Σ_(i=1)^(n)i');
    expect(print('\\int_0^1x^2')).toBe('∫_(0)^(1)x^(2)');
  });

  it('drops what is only about drawing', () => {
    expect(print('\\left|x\\right|=5')).toBe('|x|=5');
    expect(print('\\text{Rs }250')).toBe('Rs250');
    expect(print('\\{1,2,3\\}')).toBe('{1,2,3}');
  });

  it('ignores whitespace on both sides of the comparison', () => {
    expect(comparable(print('3\\times 4 = 12'))).toBe('3×4=12');
  });

  it('prints the symbols a senior class needs', () => {
    expect(print('a\\subset B')).toBe('a⊂B');
    expect(print('A\\subseteq B')).toBe('A⊆B');
    expect(print('x\\notin A')).toBe('x∉A');
    expect(print('x\\approx 1.4')).toBe('x≈1.4');
    expect(print('a\\equiv b')).toBe('a≡b');
    expect(print('y\\propto x')).toBe('y∝x');
    expect(print('\\therefore x=5')).toBe('∴x=5');
    expect(print('AB\\perp CD')).toBe('AB⊥CD');
    // A raised dot and a cross are different symbols, and Nemeth writes them differently, so this
    // printer keeps them apart too rather than calling both of them ×.
    expect(print('a\\cdot b')).toBe('a·b');
    expect(print('a\\times b')).toBe('a×b');
  });

  it('prints a bar after what it covers, because that is where the braille puts it', () => {
    expect(print('\\overline{x}')).toBe('x‾');
    expect(print('\\bar{x}')).toBe('x‾');
    expect(print('\\overline{AB}')).toBe('AB‾');
  });

  it('prints a binomial coefficient as the bracketed pair the braille writes', () => {
    expect(print('\\binom{n}{k}')).toBe('(n_(k))');
  });

  it('reports a command it does not know instead of pretending', () => {
    const result = canonicalise('\\begin{matrix}a&b\\end{matrix}');
    expect(result.unknown).toContain('\\begin');
  });
});

describe('the verdict', () => {
  const cells = (braille: string) => unicodeStringToMasks(braille).cells;

  it('agrees when the braille says what the LaTeX says', () => {
    const result = checkRoundTrip('\\frac{1}{2}', cells('⠹⠂⠌⠆⠼'));
    expect(result.verdict).toBe('agrees');
    expect(result.reading).toBe('(1)/(2)');
  });

  it('differs when a cell is wrong', () => {
    // ⠒ is the digit 3. A one-cell slip in the denominator, and the verdict must catch it.
    expect(checkRoundTrip('\\frac{1}{2}', cells('⠹⠂⠌⠒⠼')).verdict).toBe('differs');
  });

  it('differs when the structure is wrong but every symbol is right', () => {
    // Same five characters, different mathematics: a superscript that never returns to the
    // baseline. This is the class of bug a symbol-by-symbol check cannot see.
    expect(checkRoundTrip('x^2+3', cells('⠭⠘⠆⠬⠒')).verdict).toBe('differs');
    expect(checkRoundTrip('x^2+3', cells('⠭⠘⠆⠐⠬⠒')).verdict).toBe('agrees');
  });

  it('says "unchecked" rather than "agrees" when it met something it does not know', () => {
    const result = checkRoundTrip('\\begin{matrix}a', cells('⠝⠅'));
    expect(result.verdict).toBe('unchecked');
    expect(result.gaps.length).toBeGreaterThan(0);
  });

  it('never claims agreement it cannot support', () => {
    // Empty cells against a real expression is a failure, not a vacuous pass.
    expect(checkRoundTrip('x+1', []).verdict).toBe('differs');
  });
});
