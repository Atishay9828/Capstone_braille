/**
 * The contrast curve — the one piece of preprocessing that can be tested without a canvas.
 *
 * It exists to rescue faint pencil from a classroom photograph, so what matters is that it pushes
 * greys apart without inventing detail and without wrapping around at the ends: a stroke that
 * became white, or a highlight that became black, would be worse than the original.
 */

import { describe, expect, it } from 'vitest';
import { applyContrast } from './preprocess';

describe('the contrast curve', () => {
  it('leaves the image alone at 1', () => {
    for (const value of [0, 60, 128, 200, 255]) {
      expect(applyContrast(value, 1)).toBe(value);
    }
  });

  it('pushes greys away from the middle', () => {
    expect(applyContrast(100, 2)).toBeLessThan(100); // a faint stroke gets darker
    expect(applyContrast(200, 2)).toBeGreaterThan(200); // the paper gets whiter
    expect(applyContrast(128, 2)).toBe(128); // mid-grey is the hinge
  });

  it('never wraps around at either end', () => {
    for (const contrast of [1.5, 1.8, 3, 10]) {
      for (const value of [0, 1, 127, 128, 254, 255]) {
        const out = applyContrast(value, contrast);
        expect(out, `${value} at ${contrast}`).toBeGreaterThanOrEqual(0);
        expect(out, `${value} at ${contrast}`).toBeLessThanOrEqual(255);
      }
    }
  });

  it('keeps the order of the greys', () => {
    // Monotonic: a darker pixel must never come out lighter than a lighter one.
    let previous = -1;
    for (let value = 0; value <= 255; value += 1) {
      const out = applyContrast(value, 1.8);
      expect(out).toBeGreaterThanOrEqual(previous);
      previous = out;
    }
  });
});
