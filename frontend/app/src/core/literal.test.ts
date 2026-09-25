import { describe, expect, it } from 'vitest';
import { latexToPlainText, textToLiteralBraille } from './literal';
import { cellsToUnicode } from './translate';
import { dotsToMask } from './braille';

/**
 * Literary braille is NOT Nemeth, and the difference is the point: literary digits are the letters
 * a–j after a number sign, while Nemeth drops them into the lower cell. These tests pin that
 * distinction down, because a fallback that quietly produced the wrong code would be worse than a
 * fallback that produced nothing.
 */
describe('literal (Grade 1) braille', () => {
  it('writes letters as the standard cells', () => {
    expect(cellsToUnicode(textToLiteralBraille('abc').cells)).toBe('⠁⠃⠉');
    expect(cellsToUnicode(textToLiteralBraille('braille').cells)).toBe('⠃⠗⠁⠊⠇⠇⠑');
  });

  it('marks a capital with dots 6', () => {
    const result = textToLiteralBraille('Hi');
    expect(result.cells[0]).toBe(dotsToMask([6]));
    expect(cellsToUnicode(result.cells)).toBe('⠠⠓⠊');
  });

  it('writes digits the LITERARY way — number sign then a–j, not the Nemeth drop', () => {
    // "1" here is number-sign + the letter a. In Nemeth it would be the single dropped cell ⠂.
    expect(cellsToUnicode(textToLiteralBraille('1').cells)).toBe('⠼⠁');
    expect(cellsToUnicode(textToLiteralBraille('2026').cells)).toBe('⠼⠃⠚⠃⠋');
  });

  it('uses one number sign for a whole number, not one per digit', () => {
    expect(textToLiteralBraille('123').cells).toHaveLength(4);
  });

  it('ends number mode at a space', () => {
    expect(cellsToUnicode(textToLiteralBraille('12 34').cells)).toBe('⠼⠁⠃⠀⠼⠉⠙');
  });

  it('needs the letter sign when a letter follows a digit directly', () => {
    // Without it, "2a" would read as the digits "22".
    const result = textToLiteralBraille('2a');
    expect(result.cells).toEqual([dotsToMask([3, 4, 5, 6]), dotsToMask([1, 2]), dotsToMask([5, 6]), dotsToMask([1])]);
  });

  it('does not need the letter sign for a letter outside a–j', () => {
    expect(cellsToUnicode(textToLiteralBraille('2x').cells)).toBe('⠼⠃⠭');
  });

  it('writes spaces as blank cells', () => {
    expect(cellsToUnicode(textToLiteralBraille('a b').cells)).toBe('⠁⠀⠃');
  });

  it('handles common punctuation', () => {
    expect(cellsToUnicode(textToLiteralBraille('a, b.').cells)).toBe('⠁⠂⠀⠃⠲');
  });

  it('reports characters it cannot write rather than dropping them silently', () => {
    const result = textToLiteralBraille('a€b');
    expect(result.unsupported).toEqual(['€']);
    expect(cellsToUnicode(result.cells)).toBe('⠁⠃');
  });

  it('produces nothing for empty input', () => {
    expect(textToLiteralBraille('').cells).toEqual([]);
  });
});

describe('reducing LaTeX to something literal braille can carry', () => {
  it('keeps the letters and numbers, drops the syntax', () => {
    expect(latexToPlainText(String.raw`\frac{a}{b}`)).toBe('frac a b');
    expect(latexToPlainText('x^2 + 1')).toBe('x to the power 2 + 1');
  });

  it('names the commands a reader would recognise', () => {
    expect(latexToPlainText(String.raw`\sqrt{x}`)).toContain('sqrt');
    expect(latexToPlainText(String.raw`\theta`)).toContain('theta');
  });

  it('does not leave stray braces or backslashes', () => {
    const out = latexToPlainText(String.raw`\sum_{i=1}^{n} \frac{1}{i}`);
    expect(out).not.toMatch(/[{}\\]/);
  });

  it('survives empty and plain input', () => {
    expect(latexToPlainText('')).toBe('');
    expect(latexToPlainText('hello')).toBe('hello');
  });
});
