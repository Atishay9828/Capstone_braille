/**
 * Bharati Braille, checked against the published tables.
 *
 * Every expected string here was written by hand from the letter table in `bharati.ts` — which is
 * itself taken from liblouis's NIEPVD-maintained `devanagari.cti` and the Bharati Braille letter
 * charts. If a cell in this file disagrees with the table, one of them is wrong, and finding out
 * which is exactly the point.
 */

import { describe, expect, it } from 'vitest';
import { devanagariToBraille, hasDevanagari } from './bharati';
import { cellsToUnicode } from './translate';

function braille(text: string): string {
  return cellsToUnicode(devanagariToBraille(text).cells);
}

describe('Bharati Braille — Devanagari', () => {
  it('writes the vowels', () => {
    expect(braille('अ')).toBe('⠁');
    expect(braille('आ')).toBe('⠜');
    expect(braille('इ')).toBe('⠊');
    expect(braille('ई')).toBe('⠔');
    expect(braille('उ')).toBe('⠥');
    expect(braille('ऊ')).toBe('⠳');
    expect(braille('ए')).toBe('⠑');
    expect(braille('ऐ')).toBe('⠌');
    expect(braille('ओ')).toBe('⠕');
    expect(braille('औ')).toBe('⠪');
  });

  it('writes the consonants', () => {
    expect(braille('क')).toBe('⠅');
    expect(braille('ग')).toBe('⠛');
    expect(braille('त')).toBe('⠞');
    expect(braille('न')).toBe('⠝');
    expect(braille('म')).toBe('⠍');
    expect(braille('स')).toBe('⠎');
    expect(braille('ह')).toBe('⠓');
    expect(braille('ण')).toBe('⠼');
  });

  it('writes a matra as the whole vowel, after its consonant', () => {
    // There are no diacritics in Bharati: को is "ka" then the letter "o", not one modified cell.
    expect(braille('को')).toBe('⠅⠕');
    expect(braille('दो')).toBe('⠙⠕');
    expect(braille('की')).toBe('⠅⠔');
    expect(braille('सेब')).toBe('⠎⠑⠃');
  });

  it('leaves the inherent vowel unwritten', () => {
    // क alone is already "ka" — writing an ⠁ after it would say "kaa".
    expect(braille('कम')).toBe('⠅⠍');
  });

  it('writes real words', () => {
    expect(braille('गणित')).toBe('⠛⠼⠊⠞'); // ga · na · i · ta
    expect(braille('नमस्ते')).toBe('⠝⠍⠎⠈⠞⠑');
    expect(braille('संख्या')).toBe('⠎⠰⠨⠈⠽⠜');
    expect(braille('बड़ा')).toBe('⠃⠻⠜');
    expect(braille('क्षेत्र')).toBe('⠟⠑⠞⠈⠗');
  });

  it('writes the nukta letters with their dot-5 prefix', () => {
    expect(braille('ज़')).toBe('⠐⠚');
    expect(braille('ग़')).toBe('⠐⠛');
    expect(braille('ड़')).toBe('⠻'); // a cell of its own, not a prefix
    expect(braille('ढ़')).toBe('⠐⠻');
    expect(braille('फ़')).toBe('⠐⠋');
  });

  it('gives the same answer whether the nukta was typed as one key or two', () => {
    // ड + ़ and the precomposed ड़ are the same word to a reader, so they must be the same braille.
    expect(braille('ड़')).toBe(braille('ड' + '़'));
    expect(braille('बड़ा')).toBe(braille('बड' + '़' + 'ा'));
  });

  it('writes the marks', () => {
    expect(braille('ं')).toBe('⠰');
    expect(braille('ः')).toBe('⠠');
    expect(braille('ँ')).toBe('⠄');
    expect(braille('्')).toBe('⠈');
  });

  it('writes digits with a number sign, in either script', () => {
    expect(braille('12')).toBe('⠼⠁⠃');
    expect(braille('१२')).toBe('⠼⠁⠃');
    expect(braille('2026')).toBe('⠼⠃⠚⠃⠋');
  });

  it('writes the danda as a full stop', () => {
    expect(braille('।')).toBe('⠲');
  });

  it('separates words with a blank cell', () => {
    expect(braille('दो सेब')).toBe('⠙⠕⠀⠎⠑⠃');
  });

  it('reports what it cannot write instead of dropping it', () => {
    const result = devanagariToBraille('क ௵ ख');
    expect(result.unsupported).toEqual(['௵']);
    expect(result.cells.length).toBeGreaterThan(0); // the rest still reaches the display
  });

  it('knows Devanagari when it sees it', () => {
    expect(hasDevanagari('गणित')).toBe(true);
    expect(hasDevanagari('x + 1')).toBe(false);
    expect(hasDevanagari('')).toBe(false);
  });

  it('never throws, whatever it is handed', () => {
    for (const input of ['', '  ', '्', 'ा', '़', 'क्ष्', '१', 'abc']) {
      expect(() => devanagariToBraille(input), input).not.toThrow();
    }
  });
});
