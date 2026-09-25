/**
 * Tidying must never change the maths.
 *
 * The safety net is not "does it look nicer" — it is that the tidied and untidied forms produce
 * IDENTICAL braille. A cosmetic pass that quietly altered an expression would be the worst kind of
 * bug in this product: invisible on screen, wrong under the fingers.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { tidyLatex } from './tidy';
import { initSre } from '../core/sre-service';
import { translateLatex } from '../core/translate';

describe('tidyLatex', () => {
  it('rejoins digits the model split into separate tokens', () => {
    expect(tidyLatex(String.raw`\frac { 2 2 } { 7 }`)).toBe(String.raw`\frac{22}{7}`);
    expect(tidyLatex('1 4 4')).toBe('144');
  });

  it('does not glue a digit to a letter', () => {
    expect(tidyLatex('2 x')).toBe('2 x');
  });

  it('keeps command names intact', () => {
    expect(tidyLatex(String.raw`\sqrt { x }`)).toBe(String.raw`\sqrt{x}`);
    expect(tidyLatex(String.raw`\sin x`)).toBe(String.raw`\sin x`);
  });

  it('keeps operators readable rather than removing every space', () => {
    expect(tidyLatex('x ^ 2 + 3 x + 2 = 0')).toBe('x^2 + 3 x + 2 = 0');
  });

  it('tightens brackets and scripts', () => {
    expect(tidyLatex('( a + b )')).toBe('(a + b)');
    expect(tidyLatex('x _ 1 ^ 2')).toBe('x_1^2');
  });

  it('drops the model’s spacing hints', () => {
    expect(tidyLatex(String.raw`\int _ 0 ^ 1 x ^ 2 \, d x`)).toBe(String.raw`\int_0^1 x^2 d x`);
  });

  it('handles empty and whitespace-only input', () => {
    expect(tidyLatex('')).toBe('');
    expect(tidyLatex('   \n ')).toBe('');
  });

  it('strips the model’s ~ spacing glyphs, which read as garbage in the correction box', () => {
    // Exactly what the formula model emitted for a stacked fraction, verified in the browser.
    expect(tidyLatex(String.raw`{\frac{~ x^{2} + 1 ~}{~ 2 ~}}~ = ~ 5`)).toBe(
      String.raw`{\frac{x^{2} + 1}{2}} = 5`,
    );
    expect(tidyLatex('a ~ + ~ b')).toBe('a + b');
  });
});

describe('tidying never changes the braille', () => {
  beforeAll(async () => {
    const status = await initSre();
    expect(status.ok).toBe(true);
  }, 60_000);

  const SAMPLES = [
    String.raw`\frac { 2 2 } { 7 }`,
    String.raw`\sqrt { 1 4 4 } = 1 2`,
    'x ^ 2 + 3 x + 2 = 0',
    String.raw`\frac { - b \pm \sqrt { b ^ 2 - 4 a c } } { 2 a }`,
    String.raw`\sum _ { i = 1 } ^ { n } i`,
    '( a + b ) ^ 2',
  ];

  for (const raw of SAMPLES) {
    it(`preserves the meaning of ${raw}`, async () => {
      const before = await translateLatex(raw);
      const after = await translateLatex(tidyLatex(raw));
      expect(after.unicode, `tidied to: ${tidyLatex(raw)}`).toBe(before.unicode);
    });
  }
});
