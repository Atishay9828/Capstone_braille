/**
 * Reading Bharati Braille back into words.
 *
 * The maths half of a question could already be checked — `readback.ts` reads the Nemeth cells and
 * says what they mean, and the Board screen shows the verdict. The words half could not, so the
 * panel had to narrow its claim to "the maths matches" and say plainly that nothing had looked at
 * the Hindi. This file closes that, and lets a whole question be verified end to end.
 *
 * WHAT MAKES THIS HARDER THAN NEMETH. Bharati Braille is a six-dot code carrying a script with far
 * more than sixty-four distinctions, so several cells genuinely mean two things, and the reader
 * settles them the way a person does — by where they are:
 *
 *   ⠼  is BOTH the letter ण and the number sign. At the start of a word it opens a number; inside
 *      one it is ण, which is why गणित is ⠛⠼⠊⠞ and not a number with letters glued to it.
 *   ⠊  is the vowel इ standing alone, and the matra ि when it follows a consonant. Bharati has no
 *      diacritics: a matra is written as the whole vowel letter, and the position tells you which.
 *   ⠐  is the nukta, and the prefix of ऋ and ऌ. The cell after it decides.
 *   ⠠  is the visarga, and the prefix of ॠ. Visarga wins — ॠ is not a letter Hindi uses.
 *
 * AND WHAT NO READER CAN SETTLE. A handful of distinctions are not in the braille at all: ॅ and ॆ
 * are one cell, so are ऽ and ँ, so are ऱ and ऋ. Those are properties of the code, not defects in
 * this file, and pretending otherwise would make the verdict cry wolf over ordinary words. They are
 * listed in `fold()` below — that function is the honest, written-down statement of exactly what
 * Bharati Braille does not preserve, and it is applied to BOTH sides of every comparison.
 */

import { dotsToMask, maskToUnicode, type DotMask } from './braille';

export interface BharatiReadback {
  /** The Devanagari the cells say. */
  readonly text: string;
  /** Cells this reader has no rule for. Never guessed at. */
  readonly unknown: readonly string[];
}

/** Dot numbers to the Unicode braille character, through the one module that owns dot masks. */
const cell = (dots: readonly number[]) => maskToUnicode(dotsToMask(dots));

/** The letter tables of `bharati.ts`, turned around. Same dots, read the other way. */
const CONSONANTS: Readonly<Record<string, string>> = Object.fromEntries(
  (
    [
      [[1, 3], 'क'],
      [[4, 6], 'ख'],
      [[1, 2, 4, 5], 'ग'],
      [[1, 2, 6], 'घ'],
      [[3, 4, 6], 'ङ'],
      [[1, 4], 'च'],
      [[1, 6], 'छ'],
      [[2, 4, 5], 'ज'],
      [[3, 5, 6], 'झ'],
      [[2, 5], 'ञ'],
      [[2, 3, 4, 5, 6], 'ट'],
      [[2, 4, 5, 6], 'ठ'],
      [[1, 2, 4, 6], 'ड'],
      [[1, 2, 3, 4, 5, 6], 'ढ'],
      [[3, 4, 5, 6], 'ण'],
      [[2, 3, 4, 5], 'त'],
      [[1, 4, 5, 6], 'थ'],
      [[1, 4, 5], 'द'],
      [[2, 3, 4, 6], 'ध'],
      [[1, 3, 4, 5], 'न'],
      [[1, 2, 3, 4], 'प'],
      [[2, 3, 5], 'फ'],
      [[1, 2], 'ब'],
      [[4, 5], 'भ'],
      [[1, 3, 4], 'म'],
      [[1, 3, 4, 5, 6], 'य'],
      [[1, 2, 3, 5], 'र'],
      [[1, 2, 3], 'ल'],
      [[4, 5, 6], 'ळ'],
      [[1, 2, 3, 6], 'व'],
      [[1, 4, 6], 'श'],
      [[1, 2, 3, 4, 6], 'ष'],
      [[2, 3, 4], 'स'],
      [[1, 2, 5], 'ह'],
    ] as [number[], string][]
  ).map(([dots, letter]) => [cell(dots), letter]),
);

const VOWELS: Readonly<Record<string, string>> = Object.fromEntries(
  (
    [
      [[1], 'अ'],
      [[3, 4, 5], 'आ'],
      [[2, 4], 'इ'],
      [[3, 5], 'ई'],
      [[1, 3, 6], 'उ'],
      [[1, 2, 5, 6], 'ऊ'],
      [[2, 6], 'ऎ'],
      [[1, 5], 'ए'],
      [[3, 4], 'ऐ'],
      [[1, 3, 4, 6], 'ऒ'],
      [[1, 3, 5], 'ओ'],
      [[2, 4, 6], 'औ'],
    ] as [number[], string][]
  ).map(([dots, letter]) => [cell(dots), letter]),
);

/** A vowel written after a consonant is that consonant's matra. अ has none — it is already there. */
const MATRA: Readonly<Record<string, string>> = {
  'आ': 'ा',
  'इ': 'ि',
  'ई': 'ी',
  'उ': 'ु',
  'ऊ': 'ू',
  'ऎ': 'ॆ',
  'ए': 'े',
  'ऐ': 'ै',
  'ऒ': 'ॊ',
  'ओ': 'ो',
  'औ': 'ौ',
};

const SIGNS: Readonly<Record<string, string>> = {
  [cell([5, 6])]: 'ं', // anusvara
  [cell([3])]: 'ँ', // chandrabindu — also where avagraha and the apostrophe land
  [cell([4])]: '्', // halant
};

/** ऋ and ऌ written after a consonant: the vocalic matras, as in वृत्त. */
const VOCALIC_MATRA: Readonly<Record<string, string>> = { 'ऋ': 'ृ', 'ऌ': 'ॢ' };

const VISARGA = cell([6]);
const NUKTA_PREFIX = cell([5]);
const NUMBER_SIGN = cell([3, 4, 5, 6]);
const SPACE = cell([]);

/** The two conjuncts Bharati gives a cell of their own, and the one nukta letter that has one. */
const WHOLE: Readonly<Record<string, string>> = {
  [cell([1, 2, 3, 4, 5])]: 'क्ष',
  [cell([1, 5, 6])]: 'ज्ञ',
  [cell([1, 2, 4, 5, 6])]: 'ड़',
};

/**
 * What ⠐ makes of the letter after it.
 *
 * Most nukta letters are the plain consonant with a dot-5 prefix. Three whole letters — ऩ ऱ ऴ, which
 * are Tamil's ன ற ழ — are written the same way, and ऋ and ऌ borrow the prefix too. ⠐⠗ is therefore
 * ऋ *and* ऱ *and* ऱ; ऋ wins, and `fold()` records that the other two cannot be told from it.
 */
const AFTER_NUKTA: Readonly<Record<string, string>> = {
  'क': 'क़',
  'ख': 'ख़',
  'ग': 'ग़',
  'ज': 'ज़',
  'ढ': 'ढ़',
  'फ': 'फ़',
  'य': 'य़',
  'र': 'ऋ', // and ऱ, and ऱ — one cell pair, three letters
  'ल': 'ऌ',
  'न': 'ऩ',
};

/** ⠐ followed by the cell for ( is ऴ — Tamil's ழ, which no consonant table entry claims. */
const NUKTA_LLLA = cell([1, 2, 3, 5, 6]);

/** Digits are literary: the number sign, then the letters a–j. */
const DIGITS: Readonly<Record<string, string>> = Object.fromEntries(
  (
    [
      [[2, 4, 5], '0'],
      [[1], '1'],
      [[1, 2], '2'],
      [[1, 4], '3'],
      [[1, 4, 5], '4'],
      [[1, 5], '5'],
      [[1, 2, 4], '6'],
      [[1, 2, 4, 5], '7'],
      [[1, 2, 5], '8'],
      [[2, 4], '9'],
    ] as [number[], string][]
  ).map(([dots, digit]) => [cell(dots), digit]),
);

/** Punctuation, for the cells no letter claims. */
const PUNCTUATION: Readonly<Record<string, string>> = {
  [cell([2, 5, 6])]: '.',
  [cell([2])]: ',',
  [cell([2, 3])]: ';',
  [cell([2, 3, 6])]: '?',
  [cell([3, 6])]: '-',
  [cell([1, 2, 3, 5, 6])]: '(',
};

/**
 * Read a run of Bharati cells as Devanagari. Never throws.
 *
 * The result is always Devanagari, whatever script the words were typed in, because that is what
 * the cells encode — Bharati Braille is one code for nine scripts, and a Bengali ক and a Tamil க
 * leave no trace of themselves in the dots. Comparing against the transliterated source is
 * therefore the only comparison that means anything.
 */
export function readBharatiUnicode(braille: string): BharatiReadback {
  const out: string[] = [];
  const unknown: string[] = [];
  let i = 0;
  let wordStart = true;
  let afterConsonant = false;
  let inNumber = false;

  while (i < braille.length) {
    const current = braille[i];
    const next = braille[i + 1] ?? '';

    if (current === SPACE) {
      out.push(' ');
      wordStart = true;
      afterConsonant = false;
      inNumber = false;
      i += 1;
      continue;
    }

    if (inNumber && current in DIGITS) {
      out.push(DIGITS[current]);
      wordStart = false;
      i += 1;
      continue;
    }
    inNumber = false;

    if (current === NUMBER_SIGN) {
      // The one place position decides a letter: ⠼ opens a number at the start of a word and is
      // the consonant ण anywhere inside one.
      if (wordStart) {
        inNumber = true;
      } else {
        out.push('ण');
        afterConsonant = true;
      }
      wordStart = false;
      i += 1;
      continue;
    }

    if (current === NUKTA_PREFIX) {
      if (next === NUKTA_LLLA) {
        out.push('ऴ');
        afterConsonant = true;
        wordStart = false;
        i += 2;
        continue;
      }
      const letter = CONSONANTS[next];
      const mapped = letter ? AFTER_NUKTA[letter] : undefined;
      if (mapped) {
        // ऋ and ऌ are vowels, so after a consonant they are that consonant's matra — the same rule
        // as every other vowel here. Without it वृत्त, a circle's radius, came back as वऋत्त.
        const vowel = mapped === 'ऋ' || mapped === 'ऌ';
        out.push(vowel && afterConsonant ? VOCALIC_MATRA[mapped] : mapped);
        afterConsonant = !vowel;
        wordStart = false;
        i += 2;
        continue;
      }
      out.push('़'); // a nukta standing on its own
      wordStart = false;
      i += 1;
      continue;
    }

    if (current === VISARGA) {
      out.push('ः');
      afterConsonant = false;
      wordStart = false;
      i += 1;
      continue;
    }

    if (current in WHOLE) {
      out.push(WHOLE[current]);
      afterConsonant = true;
      wordStart = false;
      i += 1;
      continue;
    }

    if (current in SIGNS) {
      const sign = SIGNS[current];
      out.push(sign);
      // A halant kills the consonant's vowel, so anything after it starts fresh.
      afterConsonant = false;
      wordStart = false;
      i += 1;
      continue;
    }

    if (current in VOWELS) {
      const vowel = VOWELS[current];
      out.push(afterConsonant ? (MATRA[vowel] ?? vowel) : vowel);
      afterConsonant = false;
      wordStart = false;
      i += 1;
      continue;
    }

    if (current in CONSONANTS) {
      out.push(CONSONANTS[current]);
      afterConsonant = true;
      wordStart = false;
      i += 1;
      continue;
    }

    if (current in PUNCTUATION) {
      out.push(PUNCTUATION[current]);
      afterConsonant = false;
      wordStart = false;
      i += 1;
      continue;
    }

    unknown.push(current);
    i += 1;
  }

  return { text: out.join(''), unknown };
}

/** The same, from the dot masks that are physically on the display. */
export function readBharati(cells: readonly DotMask[]): BharatiReadback {
  return readBharatiUnicode(cells.map(maskToUnicode).join(''));
}

/**
 * Collapse the distinctions Bharati Braille does not carry.
 *
 * Applied to BOTH sides of a comparison, and every line of it is a claim about the code rather than
 * a convenience for the checker:
 *
 *   ॅ ॆ · ॉ ॊ    the candra vowels of loanwords share a cell with the short vowels
 *   ऽ ँ '        avagraha, chandrabindu and the apostrophe are all dots 3
 *   ऱ ऋ ऱ       all three are ⠐⠗
 *   ॠ ॡ          written as the visarga cell plus र / ल, and read back that way
 *   । ॥ .        the danda and the full stop are both dots 2-5-6
 *   : ! / ) "    each shares its cell with a letter — ञ फ ऐ ट ? — and the letter wins
 *   ० … ९        the Devanagari digits and the ASCII ones are the same cells
 *
 * If one of these ever turns out to be wrong, this is the only place to change it, and changing it
 * will immediately show up as a round-trip failure somewhere — which is the point.
 */
export function fold(text: string): string {
  let folded = collapseMatras(text.normalize('NFC'));
  const swaps: [RegExp, string][] = [
    [/ॅ/g, 'ॆ'],
    [/ॉ/g, 'ॊ'],
    [/[ऽ']/g, 'ँ'],
    [/ऱ/g, 'ऋ'],
    [/ऱ/g, 'ऋ'],
    [/ॠ/g, 'ःर'],
    [/ॡ/g, 'ःल'],
    [/[।॥]/g, '.'],
    [/:/g, 'ञ'],
    [/!/g, 'फ'],
    [/\//g, 'ऐ'],
    [/\)/g, 'ट'],
    [/"/g, '?'],
    [/\s+/g, ''],
  ];
  for (const [pattern, replacement] of swaps) folded = folded.replace(pattern, replacement);
  return folded.replace(/[०-९]/g, (digit) => String(digit.codePointAt(0)! - 0x966));
}

/**
 * A consonant followed by a whole vowel is written exactly like that consonant with a matra.
 *
 * This is not a quirk — it is how Bharati works. There are no diacritics in the code: को is written
 * "ka, o", the same two cells as कओ. A reader says को, because that is a word and कओ is not, and
 * there is no cell anywhere that would have told them otherwise.
 *
 * So the two spellings are folded together. Anything else would report a difference the braille
 * does not contain, and a verdict that cries wolf over a real word is a verdict nobody reads.
 */
function collapseMatras(text: string): string {
  const out: string[] = [];
  for (const char of text) {
    const previous = out[out.length - 1] ?? '';
    const matra = MATRA[char];
    out.push(matra && isConsonant(previous) ? matra : char);
  }
  return out.join('');
}

/** Devanagari consonants: क–ह, the precomposed nukta letters, and ऩ ऱ ऴ. */
function isConsonant(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (
    (code >= 0x0915 && code <= 0x0939) ||
    (code >= 0x0958 && code <= 0x095f) ||
    code === 0x0929 ||
    code === 0x0931 ||
    code === 0x0934
  );
}

/**
 * What a single Bharati cell stands for, out of context — for the evidence table.
 *
 * "Out of context" is doing real work here: several cells mean two things depending on where they
 * are, and the table shows both rather than picking one. ⠼ is the letter ण and the number sign; ⠊
 * is the vowel इ and the matra ि. A teacher reading the table deserves to know that, and a table
 * that quietly picked one would be teaching something false half the time.
 */
export function bharatiMeaning(braille: string): string {
  const readings: string[] = [];
  if (braille === SPACE) return 'blank / space';
  if (braille === NUMBER_SIGN) readings.push('ण', 'number sign');
  if (braille === VISARGA) readings.push('ः visarga');
  if (braille === NUKTA_PREFIX) readings.push('़ nukta');
  if (CONSONANTS[braille] && braille !== NUMBER_SIGN) readings.push(CONSONANTS[braille]);
  if (VOWELS[braille]) {
    const vowel = VOWELS[braille];
    readings.push(MATRA[vowel] ? `${vowel} / ${MATRA[vowel]}` : vowel);
  }
  if (SIGNS[braille] && braille !== VISARGA) readings.push(SIGNS[braille]);
  if (WHOLE[braille]) readings.push(WHOLE[braille]);
  if (PUNCTUATION[braille]) readings.push(PUNCTUATION[braille]);
  return [...new Set(readings)].join(' · ');
}
