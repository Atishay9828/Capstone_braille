/**
 * Nine scripts, one braille.
 *
 * The claim this file defends is the founding claim of Bharati Braille: the corresponding letter in
 * every Indian script is the *same cell*. If that is true, supporting nine scripts is one table and
 * some arithmetic. If it is false anywhere, a child reads the wrong letter — so the tests below
 * check the arithmetic against letters whose correspondence is not in doubt, and check that
 * anything outside the correspondence is *reported* rather than quietly turned into a neighbour.
 */

import { describe, expect, it } from 'vitest';
import { detectScript, endonymOf, hasIndic, scriptOf, toDevanagari } from './indic';
import { devanagariToBraille, indicToBraille } from './bharati';
import { cellsToUnicode } from './translate';

const braille = (text: string) => cellsToUnicode(indicToBraille(text).cells);

describe('the nine blocks are parallel', () => {
  it('maps the same letter in every script to the same Devanagari letter', () => {
    // ka, ma, ra, sa, ha — five consonants every one of these scripts has.
    const rows: [string, string[]][] = [
      ['क', ['ক', 'ਕ', 'ક', 'କ', 'க', 'క', 'ಕ', 'ക']],
      ['म', ['ম', 'ਮ', 'મ', 'ମ', 'ம', 'మ', 'ಮ', 'മ']],
      ['र', ['র', 'ਰ', 'ર', 'ର', 'ர', 'ర', 'ರ', 'ര']],
      ['स', ['স', 'ਸ', 'સ', 'ସ', 'ஸ', 'స', 'ಸ', 'സ']],
      ['ह', ['হ', 'ਹ', 'હ', 'ହ', 'ஹ', 'హ', 'ಹ', 'ഹ']],
    ];
    for (const [devanagari, others] of rows) {
      for (const other of others) {
        expect(toDevanagari(other), `${other} should be ${devanagari}`).toBe(devanagari);
      }
    }
  });

  it('gives the same braille cell for the same letter in every script', () => {
    const ka = braille('क');
    expect(ka).toBe('⠅');
    for (const other of ['ক', 'ਕ', 'ક', 'କ', 'க', 'క', 'ಕ', 'ക']) {
      expect(braille(other), other).toBe(ka);
    }
  });

  it('leaves everything that is not an Indian script alone', () => {
    expect(toDevanagari('12 + x = y')).toBe('12 + x = y');
    expect(toDevanagari('')).toBe('');
  });

  it('composes a vowel sign before mapping it', () => {
    // Bengali ো written as ে + া is one vowel, not two. Decomposed it would read "e" then "aa".
    const composed = 'কো';
    const decomposed = 'ক' + 'ে' + 'া';
    expect(braille(decomposed)).toBe(braille(composed));
    expect(braille(composed)).toBe(braille('को')); // ka, then the letter o
  });
});

describe('reading real words', () => {
  it('reads Bengali', () => {
    // গণিত — "ganit", mathematics. Same cells as the Devanagari गणित.
    expect(braille('গণিত')).toBe(braille('गणित'));
    expect(braille('গণিত')).toBe('⠛⠼⠊⠞');
  });

  it('reads Gurmukhi, Gujarati, Oriya, Telugu, Kannada and Malayalam', () => {
    const expected = braille('गणित');
    expect(braille('ਗਣਿਤ')).toBe(expected);
    expect(braille('ગણિત')).toBe(expected);
    expect(braille('ଗଣିତ')).toBe(expected);
    expect(braille('గణిత')).toBe(expected);
    expect(braille('ಗಣಿತ')).toBe(expected);
    expect(braille('ഗണിത')).toBe(expected);
  });

  it('reads the Tamil letters no other script has', () => {
    // ன ற ழ are single Devanagari code points that NFC does not take apart, so they need their own
    // entries. Without them, most of Tamil would be reported as unsupported.
    for (const letter of ['ன', 'ற', 'ழ', 'ள']) {
      const result = indicToBraille(letter);
      expect(result.unsupported, `${letter} should have a cell`).toEqual([]);
      expect(result.cells.length).toBeGreaterThan(0);
    }
    expect(braille('தமிழ்')).toBe('⠞⠍⠊⠐⠷⠈'); // ta, ma, i, (nukta) lla, halant
  });

  it('reads the digits of each script as digits', () => {
    const twelve = braille('१२');
    for (const digits of ['১২', '੧੨', '૧૨', '୧୨', '௧௨', '౧౨', '೧೨', '൧൨']) {
      expect(braille(digits), digits).toBe(twelve);
    }
    expect(twelve).toBe('⠼⠁⠃');
  });
});

describe('what it will not guess at', () => {
  it('reports a letter that has no equivalent instead of rendering a neighbour', () => {
    // Oriya's wa sits at an offset no other script here uses, and the arithmetic lands it on a
    // Devanagari code point that is not a letter. That must be a gap, not a guess: inventing a
    // plausible cell would be the worst outcome available, a child reading a word never written.
    for (const orphan of ['ୱ', 'ੲ']) {
      const result = indicToBraille(orphan);
      expect(result.unsupported.length, `${orphan} should be reported`).toBeGreaterThan(0);
    }
  });

  it('doubles the consonant after a Gurmukhi addak, because that is what an addak is', () => {
    // ਪੱਕਾ is पक्का — the addak is not a letter, it is an instruction to write the next
    // consonant twice, and Devanagari writes that by stripping the first one's vowel with a halant.
    expect(toDevanagari('ਪੱਕਾ')).toBe('पक्का');
    expect(braille('ਪੱਕਾ')).toBe(braille('पक्का'));
    expect(indicToBraille('ਇੱਕ').unsupported).toEqual([]);
  });

  it('knows the letters where the parallel breaks but the meaning does not', () => {
    // Bengali khanda ta is a ত with its vowel taken away. Malayalam's chillu letters are the same
    // construction. Both are written in Bharati as the consonant plus a halant, which is what they
    // are — so they translate, rather than being reported as gaps in an ordinary word.
    expect(indicToBraille('ৎ').unsupported).toEqual([]);
    expect(braille('ৎ')).toBe(braille('त्'));
    expect(indicToBraille('ൺ').unsupported).toEqual([]);
    expect(braille('ൻ')).toBe(braille('न्'));
    // Gurmukhi's tippi is the nasal Devanagari writes with anusvara.
    expect(braille('ਪੰਜਾਬੀ')).toBe(braille('पंजाबी'));
  });

  it('still renders the rest of the line when one character is unknown', () => {
    const result = indicToBraille('গণিত ୱ গণিত');
    expect(result.unsupported).toContain('ୱ');
    expect(result.cells.length).toBeGreaterThan(8);
  });

  it('never throws, on anything', () => {
    for (const text of ['', '   ', 'ৎৎৎ', '𑂍', 'ಠ_ಠ', 'क'.repeat(500)]) {
      expect(() => indicToBraille(text), text).not.toThrow();
    }
  });
});

describe('naming the script', () => {
  it('knows which script a character belongs to', () => {
    expect(scriptOf('ক')).toBe('bengali');
    expect(scriptOf('க')).toBe('tamil');
    expect(scriptOf('x')).toBeNull();
  });

  it('names the script of a whole line by what most of it is', () => {
    expect(detectScript('গণিত 12')).toBe('bengali');
    expect(detectScript('दो संख्याओं का योग 12 है')).toBe('devanagari');
    expect(detectScript('x + 1 = 2')).toBeNull();
  });

  it('has a name for each script in its own script', () => {
    expect(endonymOf('bengali')).toBe('বাংলা');
    expect(endonymOf('tamil')).toBe('தமிழ்');
    expect(hasIndic('বাংলা')).toBe(true);
    expect(hasIndic('nothing here')).toBe(false);
  });
});

describe('the Devanagari table is untouched by any of this', () => {
  it('still gives the same answers as before', () => {
    expect(cellsToUnicode(devanagariToBraille('गणित').cells)).toBe('⠛⠼⠊⠞');
    expect(cellsToUnicode(devanagariToBraille('दो सेब').cells)).toBe('⠙⠕⠀⠎⠑⠃');
  });
});
