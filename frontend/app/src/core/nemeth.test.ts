/**
 * Nemeth correctness.
 *
 * Two kinds of test, deliberately separated:
 *
 *  1. STANDARD — assertions derived from the published Nemeth code (BANA, *The Nemeth Braille Code
 *     for Mathematics and Science Notation 2022*). These are hand-checkable by anyone with the
 *     standard in front of them: dropped digits, the numeric indicator, fraction and radical
 *     indicators, super/subscript and baseline indicators, the equals sign.
 *
 *  2. GOLDEN — frozen full-expression outputs. These exist to catch regressions when a dependency
 *     moves, not to prove the standard.
 *
 * Neither of these touches cam numbers. Cam numbers are configuration and are tested separately in
 * profile.test.ts — that separation is what lets the hardware team change the cam wiring on demo
 * day without invalidating a single braille test (ARCHITECTURE.md, contradiction #3).
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { cellsToUnicode, translateLatex } from './translate';
import { initSre } from './sre-service';

beforeAll(async () => {
  const status = await initSre();
  expect(status.ok, `speech-rule-engine failed to start: ${status.reason ?? ''}`).toBe(true);
}, 60_000);

async function nemeth(latex: string): Promise<string> {
  const result = await translateLatex(latex);
  expect(result.issues.filter((i) => i.kind === 'parse')).toEqual([]);
  // The cell list and the unicode string must always describe the same thing.
  expect(cellsToUnicode(result.cells)).toBe(result.unicode.replace(/[\n\r\t]/g, '').replace(/ /g, '⠀'));
  return result.unicode;
}

describe('Nemeth — the standard', () => {
  it('drops the digits into the lower cell', async () => {
    // Nemeth digits are the literary digits shifted down one row: 1 = dot 2, 2 = dots 2-3, …
    const digits: Record<string, string> = {
      '0': '⠴',
      '1': '⠂',
      '2': '⠆',
      '3': '⠒',
      '4': '⠲',
      '5': '⠢',
      '6': '⠖',
      '7': '⠶',
      '8': '⠦',
      '9': '⠔',
    };
    for (const [digit, cell] of Object.entries(digits)) {
      expect(await nemeth(digit), `digit ${digit}`).toBe(`⠼${cell}`);
    }
  });

  it('prefixes a standalone number with the numeric indicator ⠼', async () => {
    expect(await nemeth('7')).toBe('⠼⠶');
    expect(await nemeth('42')).toBe('⠼⠲⠆');
  });

  it('uses ⠨⠅ for equals and ⠬ / ⠤ for plus and minus', async () => {
    const sum = await nemeth('2+3=5');
    expect(sum).toContain('⠬'); // plus
    expect(sum).toContain('⠨⠅'); // equals
    expect(await nemeth('5-2')).toContain('⠤'); // minus
  });

  it('brackets a fraction with ⠹ … ⠼ and separates it with ⠌', async () => {
    const frac = await nemeth('\\frac{a}{b}');
    expect(frac.startsWith('⠹')).toBe(true);
    expect(frac.endsWith('⠼')).toBe(true);
    expect(frac).toContain('⠌');
    expect(frac).toBe('⠹⠁⠌⠃⠼');
  });

  it('brackets a radical with ⠜ … ⠻', async () => {
    const root = await nemeth('\\sqrt{x+1}');
    expect(root.startsWith('⠜')).toBe(true);
    expect(root.endsWith('⠻')).toBe(true);
  });

  it('marks a superscript with ⠘ and returns to the baseline with ⠐', async () => {
    // x² + 1 : the baseline indicator after the exponent is what stops "+1" being read as part of it.
    const squared = await nemeth('x^2 + 1');
    expect(squared).toContain('⠘⠆'); // superscript, then dropped 2
    expect(squared).toContain('⠐'); // back to the baseline
  });

  it('applies the Numeric Subscript rule', async () => {
    // Nemeth omits the subscript indicator when a first-level NUMERIC subscript sits directly
    // under a letter — so x₁ is just "x" + dropped 1, with no ⠰ and no numeric indicator.
    // https://www.dotlessbraille.org/subsup.htm · Nemeth 2022 Rule 13
    expect(await nemeth('x_1')).toBe('⠭⠂');
    expect(await nemeth('H_2O')).toBe('⠠⠓⠆⠠⠕');

    // …but an ALPHABETIC subscript still needs the indicator, or it would read as multiplication.
    expect(await nemeth('x_a')).toBe('⠭⠰⠁');
    expect(await nemeth('x_n')).toBe('⠭⠰⠝');
  });

  it('keeps subscript and superscript levels apart on the same base', async () => {
    // x₁² — numeric subscript (indicator omitted), then an explicit superscript level.
    expect(await nemeth('x_1^2')).toBe('⠭⠂⠘⠆');
  });

  it('does not emit a numeric indicator for a digit already inside a numeric context', async () => {
    // "x^2" — the 2 is an exponent, not a new number, so no ⠼ before it.
    expect(await nemeth('x^2')).toBe('⠭⠘⠆');
  });
});

describe('Nemeth — golden expressions (regression guard)', () => {
  const GOLDEN: ReadonlyArray<readonly [string, string]> = [
    ['x^2 + 3x + 2 = 0', '⠭⠘⠆⠐⠬⠒⠭⠬⠆⠀⠨⠅⠀⠼⠴'],
    ['2+3=5', '⠼⠆⠬⠒⠀⠨⠅⠀⠼⠢'],
    ['\\frac{a}{b}', '⠹⠁⠌⠃⠼'],
    ['\\sqrt{x+1}', '⠜⠭⠬⠂⠻'],
    ['\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}', '⠹⠤⠃⠬⠤⠜⠃⠘⠆⠐⠤⠲⠁⠉⠻⠌⠆⠁⠼'],
    ['\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}', '⠐⠨⠠⠎⠩⠊⠀⠨⠅⠀⠼⠂⠣⠝⠻⠊⠀⠨⠅⠀⠹⠝⠷⠝⠬⠂⠾⠌⠆⠼'],
    ['\\sin^2\\theta + \\cos^2\\theta = 1', '⠎⠊⠝⠘⠆⠀⠨⠹⠬⠉⠕⠎⠘⠆⠀⠨⠹⠀⠨⠅⠀⠼⠂'],
    ['\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1', '⠐⠇⠊⠍⠩⠭⠀⠫⠕⠀⠼⠴⠻⠀⠹⠎⠊⠝⠀⠭⠌⠭⠼⠀⠨⠅⠀⠼⠂'],
    ['\\int_0^1 x^2 \\, dx', '⠮⠰⠴⠘⠂⠐⠭⠘⠆⠐⠙⠭'],
    ['\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}', '⠠⠷⠼⠂⠀⠼⠆⠠⠾⠀⠠⠷⠼⠒⠀⠼⠲⠠⠾'],
  ];

  for (const [latex, expected] of GOLDEN) {
    it(`translates ${latex}`, async () => {
      expect(await nemeth(latex)).toBe(expected);
    });
  }

  it('covers a spread of maths, not ten variations of one thing', () => {
    expect(GOLDEN.length).toBeGreaterThanOrEqual(10);
  });
});

describe('translation failure behaviour', () => {
  it('reports a parse problem instead of throwing', async () => {
    const result = await translateLatex('\\frac{1}{');
    expect(result.issues.some((i) => i.kind === 'parse')).toBe(true);
    expect(result.cells).toEqual([]);
  });

  it('every reported issue carries a fix the user can act on', async () => {
    const result = await translateLatex('\\notacommand{x}');
    for (const issue of result.issues) {
      expect(issue.fix, `issue "${issue.message}" has no fix`).toBeTruthy();
    }
  });

  it('treats empty input as empty, not as an error', async () => {
    const result = await translateLatex('   ');
    expect(result.issues).toEqual([]);
    expect(result.cells).toEqual([]);
  });
});

describe('structure analysis', () => {
  it('produces enriched MathML with stable semantic ids', async () => {
    const result = await translateLatex('\\frac{a}{b}');
    expect(result.enriched).toContain('data-semantic-id');
    expect(result.enriched).toContain('data-semantic-type="fraction"');
  });
});
