/**
 * Do the Bharati cells still say the word?
 *
 * The same argument as `readback.test.ts`, applied to the other braille code. Two engines written
 * from opposite ends must agree about every word in the corpus below — and where the braille is
 * broken on purpose, they must disagree.
 *
 * The corpus is deliberately made of words a maths teacher would actually write, in every one of
 * the nine scripts, because Bharati's founding claim is that they all come out the same. If that is
 * true, a Tamil word and its Devanagari equivalent round-trip to the same Devanagari.
 */

import { describe, expect, it } from 'vitest';
import { devanagariToBraille, indicToBraille } from './bharati';
import { fold, readBharati, readBharatiUnicode } from './bharatiback';
import { checkBharatiRoundTrip } from './roundtrip';
import { cellsToUnicode } from './translate';

const trip = (words: string) => checkBharatiRoundTrip(words, indicToBraille(words).cells);
const braille = (words: string) => cellsToUnicode(devanagariToBraille(words).cells);

describe('reading the words back', () => {
  it('reads a word cell by cell', () => {
    // ⠛⠼⠊⠞ — ga, ṇa, i, ta. The ⠼ inside the word is the letter ण, not a number sign.
    expect(readBharatiUnicode('⠛⠼⠊⠞').text).toBe('गणित');
  });

  it('knows a vowel after a consonant is a matra', () => {
    expect(readBharatiUnicode(braille('को')).text).toBe('को');
    expect(readBharatiUnicode(braille('इक')).text).toBe('इक'); // at the start it stays a whole vowel
    expect(readBharatiUnicode(braille('कि')).text).toBe('कि');
  });

  it('tells the letter ण from the number sign by where it is', () => {
    expect(readBharatiUnicode(braille('गणित')).text).toBe('गणित');
    expect(readBharatiUnicode('⠼⠃⠁').text).toBe('21'); // at the start of a word: a number
  });

  it('reads a vocalic matra as a matra, not as the whole vowel', () => {
    // वृत्त — the radius question. ऋ after a consonant is that consonant’s matra, the same rule as
    // every other vowel here, and without it the word came back as वऋत्त.
    expect(readBharatiUnicode(braille('वृत्त')).text).toBe('वृत्त');
    // Standing alone it is still the whole vowel.
    expect(readBharatiUnicode(braille('ऋषि')).text).toBe('ऋषि');
  });

  it('reads the marks', () => {
    for (const word of ['संख्या', 'दुःख', 'हँस', 'क्लिक', 'ज़्यादा', 'क्षेत्रफल', 'ज्ञान']) {
      expect(readBharatiUnicode(braille(word)).text, word).toBe(word.normalize('NFC'));
    }
  });

  it('reads the cells that are physically on the display', () => {
    expect(readBharati(devanagariToBraille('योग').cells).text).toBe('योग');
  });
});

describe('the whole question, in every script', () => {
  const words = [
    'गणित',
    'संख्या',
    'योग',
    'क्षेत्रफल',
    'त्रिभुज',
    'कोण',
    'भिन्न',
    'दो संख्याओं का योग',
    'एक कोण',
    'बड़ा',
    'हिन्दी',
  ];

  it('agrees on every Hindi word in the corpus', () => {
    for (const word of words) {
      const result = trip(word);
      expect(result.verdict, `${word}: dots say “${result.reading}”, expected “${result.expected}”`).toBe('agrees');
    }
  });

  it('agrees on the other eight scripts too', () => {
    const lines = [
      'গণিত', // Bengali
      'দুটি সংখ্যার যোগফল', // Bengali
      'ਗਣਿਤ', // Gurmukhi
      'ਪੰਜਾਬੀ', // Gurmukhi, with the tippi
      'ਇੱਕ ਕੋਣ', // Gurmukhi, with the addak
      'ગણિત', // Gujarati
      'ଗଣିତ', // Oriya
      'கணிதம்', // Tamil
      'ஒரு கோணம்', // Tamil
      'గణితం', // Telugu
      'ಗಣಿತ', // Kannada
      'ഗണിതം', // Malayalam
    ];
    for (const line of lines) {
      const result = trip(line);
      expect(result.verdict, `${line}: dots say “${result.reading}”, expected “${result.expected}”`).toBe('agrees');
    }
  });

  it('gives the same reading for the same word in different scripts', () => {
    const hindi = trip('गणित').reading;
    for (const other of ['গণিত', 'ਗਣਿਤ', 'ગણિત', 'ଗଣିତ', 'గణిత', 'ಗಣಿತ', 'ഗണിത']) {
      expect(trip(other).reading, other).toBe(hindi);
    }
  });
});

describe('the check has teeth', () => {
  it('notices a changed letter', () => {
    const cells = devanagariToBraille('गणित').cells.slice();
    cells[0] = devanagariToBraille('म').cells[0];
    expect(checkBharatiRoundTrip('गणित', cells).verdict).toBe('differs');
  });

  it('notices a dropped matra', () => {
    expect(checkBharatiRoundTrip('कि', devanagariToBraille('क').cells).verdict).toBe('differs');
  });

  it('reads a whole vowel after a consonant as that consonant’s matra', () => {
    // को and कओ are the SAME two cells — Bharati has no diacritics, so a matra is written as
    // the whole vowel. A reader says को because that is a word; there is no cell anywhere that
    // would have told them otherwise, and `fold()` records that the code cannot separate them.
    expect(braille('को')).toBe(braille('कओ'));
    expect(readBharatiUnicode(braille('कओ')).text).toBe('को');
    expect(checkBharatiRoundTrip('कओ', devanagariToBraille('कओ').cells).verdict).toBe('agrees');
  });

  it('notices a missing halant', () => {
    expect(checkBharatiRoundTrip('क्ल', devanagariToBraille('कल').cells).verdict).toBe('differs');
  });

  it('says "unchecked" for a cell it has no rule for', () => {
    // Dots 1-2-4 is the digit six inside a number and nothing at all outside one.
    const result = checkBharatiRoundTrip('गणित', [0b001011, 0b001011]);
    expect(result.verdict).toBe('unchecked');
  });
});

describe('what the code genuinely cannot distinguish', () => {
  it('folds only the pairs Bharati writes with the same cell', () => {
    // Each of these is a real property of the code, not a convenience: ॅ and ॆ are one cell, and so
    // are the danda and the full stop.
    expect(fold('ॅ')).toBe(fold('ॆ'));
    expect(fold('।')).toBe(fold('.'));
    expect(fold('ऽ')).toBe(fold('ँ'));
  });

  it('does NOT fold anything else', () => {
    // The fold list is the one place a real difference could be hidden, so it is pinned down here.
    expect(fold('क')).not.toBe(fold('ख'));
    expect(fold('कि')).not.toBe(fold('की'));
    expect(fold('ं')).not.toBe(fold('ः'));
    expect(fold('क्ष')).not.toBe(fold('क्श'));
  });
});
