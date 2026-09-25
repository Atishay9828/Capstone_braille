/**
 * What happens when the maths engine is gone.
 *
 * `ARCHITECTURE.md` promises the display never blanks. This is the test that makes that a
 * behaviour rather than a claim: with `toNemeth` failing, a translation must still come back with
 * cells on it, must say loudly that the braille is no longer Nemeth, and must never pretend
 * otherwise.
 */

import { describe, expect, it, vi } from 'vitest';
import type * as SreService from './sre-service';

vi.mock('./sre-service', async () => {
  const actual = await vi.importActual<typeof SreService>('./sre-service');
  return {
    ...actual,
    toNemeth: vi.fn(async () => {
      throw new Error('mathmaps are missing');
    }),
    toEnrichedMathml: vi.fn(async () => ''),
  };
});

const { translateLatex } = await import('./translate');

describe('when the maths engine cannot start', () => {
  it('still puts braille on the cells rather than blanking the display', async () => {
    const result = await translateLatex('x + 1');
    expect(result.cells.length).toBeGreaterThan(0);
    expect(result.unicode.length).toBeGreaterThan(0);
  });

  it('says the braille is no longer Nemeth — in the data and in the message', async () => {
    const result = await translateLatex('x + 1');
    expect(result.degraded).toBe('literal');

    const message = result.issues.map((i) => i.message).join(' ');
    expect(message).toContain('NOT Nemeth');
    expect(message).toContain('maths engine is unavailable');
  });

  it('gives the user something to do about it', async () => {
    const result = await translateLatex('x + 1');
    expect(result.issues.every((i) => i.fix)).toBe(true);
    expect(result.issues.map((i) => i.fix).join(' ')).toContain('npm install');
  });

  it('produces LITERARY braille, which is a different code from Nemeth', async () => {
    // "1" in literary braille is number-sign + a (⠼⠁). In Nemeth it is the single dropped cell ⠂.
    // Getting the two mixed up silently is the failure this whole path is designed to avoid.
    const result = await translateLatex('1');
    expect(result.unicode).toBe('⠼⠁');
  });

  it('disables structural navigation rather than offering a broken tree', async () => {
    const result = await translateLatex(String.raw`\frac{a}{b}`);
    expect(result.enriched).toBe('');
  });

  it('still refuses input that does not parse at all', async () => {
    const result = await translateLatex(String.raw`\frac{1}{`);
    expect(result.issues.some((i) => i.kind === 'parse')).toBe(true);
    expect(result.cells).toEqual([]);
  });
});
