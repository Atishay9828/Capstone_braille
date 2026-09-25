/**
 * What a teacher types must become what they meant.
 *
 * Two kinds of test here, and the second is the one that matters:
 *
 *  1. SHAPE — the LaTeX that comes out, asserted exactly. Cheap, fast, catches parser regressions.
 *  2. EQUIVALENCE — the *braille* produced from what a teacher types is identical to the braille
 *     produced from the LaTeX an expert would have written. That is the real claim: `1/2` and
 *     `\frac{1}{2}` reach the child's fingers as the same dots. A shape test can be right while
 *     the meaning is wrong; this one cannot.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { looksLikeLatex, toLatex } from './mathinput';
import { initSre } from './sre-service';
import { translateLatex } from './translate';

describe('natural maths — the shape of what comes out', () => {
  const cases: [input: string, latex: string][] = [
    // Fractions: the single most common thing a teacher writes, and the thing LaTeX makes hardest.
    ['1/2', String.raw`\frac{1}{2}`],
    ['22/7', String.raw`\frac{22}{7}`],
    ['(x+1)/(x-1)', String.raw`\frac{x+1}{x-1}`],
    ['2x/3', String.raw`\frac{2x}{3}`],
    ['x^2/2', String.raw`\frac{x^2}{2}`],
    ['a/b/c', String.raw`\frac{\frac{a}{b}}{c}`],
    // A name straight onto a bracket is one thing, on BOTH sides of a slash. Found by looking
    // at the printed Bayes line: (B) was standing outside the fraction, and the round-trip
    // could not object because both engines were faithful to the same mis-grouped LaTeX.
    ['P(A)/P(B)', String.raw`\frac{P(A)}{P(B)}`],
    ['1/x(x+1)', String.raw`\frac{1}{x(x+1)}`],

    // Powers and indices.
    ['x^2', 'x^2'],
    ['x^10', 'x^{10}'],
    ['x^(n+1)', 'x^{(n+1)}'],
    ['2^3 = 8', '2^3=8'],
    ['x_1 + x_2', 'x_1+x_2'],

    // Roots.
    ['sqrt(9)', String.raw`\sqrt{9}`],
    ['sqrt 9', String.raw`\sqrt{9}`],
    ['sqrt(x^2+y^2)', String.raw`\sqrt{x^2+y^2}`],
    ['cbrt(27)', String.raw`\sqrt[3]{27}`],

    // Relations, written the way a keyboard makes easy.
    ['2 <= x', String.raw`2\le x`],
    ['x >= 5', String.raw`x\ge 5`],
    ['a != b', String.raw`a\ne b`],
    ['x + 1 = 4', 'x+1=4'],
    ['1 < x < 5', '1<x<5'],

    // Multiplication, all the ways it is written by hand.
    ['3 x 4', String.raw`3\times 4`],
    ['3*4', String.raw`3\times 4`],
    ['3 times 4', String.raw`3\times 4`],
    ['2(x+1)', '2(x+1)'],
    ['ab + bc', 'ab+bc'],
    ['6 div 2', String.raw`6\div 2`],

    // The vocabulary of an Indian school maths line.
    ['45 degrees', String.raw`45^{\circ}`],
    ['90°', String.raw`90^{\circ}`],
    ['50%', String.raw`50\%`],
    ['Rs 250', String.raw`\text{Rs }250`],
    ['pi r^2', String.raw`\pi r^2`],
    ['theta', String.raw`\theta`],
    ['1,00,000', '1,00,000'],
    ['1,000 + 500', '1,000+500'],

    // Functions.
    ['sin x', String.raw`\sin x`],
    ['sin^2 A + cos^2 A = 1', String.raw`\sin^2A+\cos^2A=1`],
    ['log_10 100 = 2', String.raw`\log_{10}100=2`],

    // Sets, brackets, bars.
    ['{1,2,3}', String.raw`\{1,2,3\}`],
    ['|x|', String.raw`\left|x\right|`],
    ['[0,1]', '[0,1]'],

    // LaTeX still works, untouched, and mixes freely with the rest.
    [String.raw`\frac{-b \pm \sqrt{b^2-4ac}}{2a}`, String.raw`\frac{-b \pm \sqrt{b^2-4ac}}{2a}`],
    [String.raw`\sqrt{144} = 12`, String.raw`\sqrt{144}=12`],
    [String.raw`\sum_{i=1}^{n} i`, String.raw`\sum_{i=1}^ni`],
    [String.raw`\frac{22}{7}`, String.raw`\frac{22}{7}`],
  ];

  for (const [input, latex] of cases) {
    it(`${input} -> ${latex}`, () => {
      expect(toLatex(input).latex).toBe(latex);
    });
  }

  it('is empty for empty input, without complaining', () => {
    expect(toLatex('').latex).toBe('');
    expect(toLatex('   ').issues).toEqual([]);
  });

  it('recognises LaTeX so the interface can say which notation is in use', () => {
    expect(looksLikeLatex(String.raw`\frac{1}{2}`)).toBe(true);
    expect(looksLikeLatex('1/2')).toBe(false);
  });
});

describe('natural maths — saying what is wrong instead of failing silently', () => {
  it('names an unclosed bracket and still produces something readable', () => {
    const result = toLatex('(x + 1');
    expect(result.issues[0].message).toContain('never closed');
    expect(result.latex).toContain('x+1'); // the display keeps working — Law 4
  });

  it('names a closing bracket that opens nothing', () => {
    const result = toLatex('x + 1)');
    expect(result.issues.some((issue) => issue.message.includes('nothing to close'))).toBe(true);
  });

  it('names a character it cannot use', () => {
    const result = toLatex('x @ 2');
    expect(result.issues[0].message).toContain('@');
    expect(result.issues[0].fix).toBeTruthy();
  });

  it('never throws, whatever it is handed', () => {
    const nasty = ['((((', '////', '^^^', '\\', '}{', '1/', 'sqrt', '|||', '_', '+++', 'x^'];
    for (const input of nasty) {
      expect(() => toLatex(input), input).not.toThrow();
    }
  });
});

describe('natural maths — the braille is identical to the expert LaTeX', () => {
  beforeAll(async () => {
    const status = await initSre();
    expect(status.ok, `speech-rule-engine failed to start: ${status.reason ?? ''}`).toBe(true);
  }, 60_000);

  const pairs: [teacher: string, expert: string][] = [
    ['1/2', String.raw`\frac{1}{2}`],
    ['22/7', String.raw`\frac{22}{7}`],
    ['x^2 + 3x + 2 = 0', String.raw`x^{2} + 3x + 2 = 0`],
    ['sqrt(144) = 12', String.raw`\sqrt{144} = 12`],
    ['(a+b)/(a-b)', String.raw`\frac{a+b}{a-b}`],
    ['2 <= x', String.raw`2 \le x`],
    ['45 degrees', String.raw`45^{\circ}`],
    ['sin^2 A + cos^2 A = 1', String.raw`\sin^2 A + \cos^2 A = 1`],
    ['pi r^2', String.raw`\pi r^2`],
    ['3 x 4 = 12', String.raw`3 \times 4 = 12`],
    ['50%', String.raw`50\%`],
    ['{1,2,3}', String.raw`\{1,2,3\}`],
    ['cbrt(27) = 3', String.raw`\sqrt[3]{27} = 3`],
    ['log_10 100 = 2', String.raw`\log_{10} 100 = 2`],
  ];

  for (const [teacher, expert] of pairs) {
    it(`“${teacher}” reads as “${expert}”`, async () => {
      const fromTeacher = await translateLatex(toLatex(teacher).latex);
      const fromExpert = await translateLatex(expert);
      expect(fromExpert.unicode.length, 'the expert form must itself translate').toBeGreaterThan(0);
      expect(fromTeacher.unicode).toBe(fromExpert.unicode);
    });
  }
});
