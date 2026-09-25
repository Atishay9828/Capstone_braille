/**
 * Bharati Braille — Devanagari.
 *
 * WHY THIS EXISTS. A maths textbook in a Hindi-medium school for the blind is not maths; it is
 * Hindi with maths inside it. "दो संख्याओं का योग 12 है" is one line, and a tool that can only
 * render the `12` cannot carry a single question from an actual classroom. Nemeth handles the
 * mathematics (`core/translate.ts`); this handles the words around it, and `core/mixed.ts` puts
 * them on one strip of cells with each segment labelled with the code it is written in.
 *
 * SOURCES, because a braille table that is nearly right teaches children something false:
 *
 *   · liblouis `tables/devanagari.cti` — the machine-readable table maintained for the National
 *     Institute for the Visually Handicapped, Dehradun (now NIEPVD). Authority for the nukta
 *     letters, the halant, the anusvara/visarga/chandrabindu and the digits.
 *   · *Bharati Braille* letter tables (Wikipedia, agreeing with the DEPwD/NIEPVD *Standard Bharati
 *     Braille Codes*, 4 Jan 2025) — authority for the consonants and vowels.
 *
 * ONE DISAGREEMENT, RESOLVED IN WRITING. The published prose describes the halant as a *prefix*
 * written before a consonant cluster (क्लिक → ⠈⠅⠇⠊⠅). liblouis's table maps it in place, so the
 * same word comes out ⠅⠈⠇⠊⠅. We follow **liblouis**, because it is the table that actually drives
 * Indian braille production today and because in-place is what round-trips. This is recorded in
 * DECISIONS.md D7.9 and is a one-line change if a school tells us otherwise.
 *
 * Nothing here is silently dropped: a character with no cell is returned in `unsupported` so the
 * interface can say so (CLAUDE.md Law 3).
 */

import { BLANK, dotsToMask, type DotMask } from './braille';
import { detectScript, transliterate, type IndicScript } from './indic';

/* ------------------------------------------------------------------ the tables */

/** Consonants. The inherent 'a' is not written — a bare consonant already means "ka", not "k". */
const CONSONANTS: Readonly<Record<string, readonly number[]>> = {
  क: [1, 3],
  ख: [4, 6],
  ग: [1, 2, 4, 5],
  घ: [1, 2, 6],
  ङ: [3, 4, 6],
  च: [1, 4],
  छ: [1, 6],
  ज: [2, 4, 5],
  झ: [3, 5, 6],
  ञ: [2, 5],
  ट: [2, 3, 4, 5, 6],
  ठ: [2, 4, 5, 6],
  ड: [1, 2, 4, 6],
  ढ: [1, 2, 3, 4, 5, 6],
  ण: [3, 4, 5, 6],
  त: [2, 3, 4, 5],
  थ: [1, 4, 5, 6],
  द: [1, 4, 5],
  ध: [2, 3, 4, 6],
  न: [1, 3, 4, 5],
  प: [1, 2, 3, 4],
  फ: [2, 3, 5],
  ब: [1, 2],
  भ: [4, 5],
  म: [1, 3, 4],
  य: [1, 3, 4, 5, 6],
  र: [1, 2, 3, 5],
  ल: [1, 2, 3],
  ळ: [4, 5, 6],
  व: [1, 2, 3, 6],
  श: [1, 4, 6],
  ष: [1, 2, 3, 4, 6],
  स: [2, 3, 4],
  ह: [1, 2, 5],
};

/** Independent vowels. */
const VOWELS: Readonly<Record<string, readonly number[]>> = {
  अ: [1],
  आ: [3, 4, 5],
  इ: [2, 4],
  ई: [3, 5],
  उ: [1, 3, 6],
  ऊ: [1, 2, 5, 6],
  ऎ: [2, 6],
  ए: [1, 5],
  ऐ: [3, 4],
  ऒ: [1, 3, 4, 6],
  ओ: [1, 3, 5],
  औ: [2, 4, 6],
};

/**
 * Vowel signs.
 *
 * Bharati has no diacritics: a matra is written as the whole vowel letter, after the consonant.
 * Unicode already stores them in that order — including ि, which *prints* to the left of its
 * consonant but is stored after it — so no reordering is needed here. That quiet agreement between
 * the encoding and the braille is the reason this table is a plain map.
 */
const MATRAS: Readonly<Record<string, string>> = {
  'ा': 'आ',
  'ि': 'इ',
  'ी': 'ई',
  'ु': 'उ',
  'ू': 'ऊ',
  'ॆ': 'ऎ',
  'े': 'ए',
  'ॅ': 'ऎ', // candra e — the vowel of English loanwords, written as the short e
  'ै': 'ऐ',
  'ॊ': 'ऒ',
  'ो': 'ओ',
  'ॉ': 'ऒ', // candra o, as in डॉक्टर
  'ौ': 'औ',
};

/** Marks that stand on their own. */
const SIGNS: Readonly<Record<string, readonly number[]>> = {
  'ं': [5, 6], // anusvara
  'ः': [6], // visarga
  'ँ': [3], // chandrabindu
  '्': [4], // halant / virama
  '़': [5], // nukta, standing alone
  'ऽ': [3], // avagraha, written as the chandrabindu cell
};

/** Vocalic consonants: a prefix cell, then an ordinary letter. */
const PREFIXED: Readonly<Record<string, readonly [prefix: number[], letter: string]>> = {
  ऋ: [[5], 'र'],
  ॠ: [[6], 'र'],
  ऌ: [[5], 'ल'],
  ॡ: [[6], 'ल'],
};

/**
 * Three letters Unicode keeps whole rather than as a consonant plus a nukta.
 *
 * ऩ, ऱ and ऴ are single code points that NFC does not take apart, so the nukta rule below never
 * sees them — and they are not obscure: they are Tamil's ன, ற and ழ, which is most of what makes
 * Tamil Tamil. Cells from liblouis `devanagari.cti`: 5-1345, 5-1235 and 5-12356.
 */
const WHOLE_NUKTA: Readonly<Record<string, readonly (readonly number[])[]>> = {
  'ऩ': [[5], [1, 3, 4, 5]],
  'ऱ': [[5], [1, 2, 3, 5]],
  'ऴ': [[5], [1, 2, 3, 5, 6]],
};

/** ऋ as a matra behaves like the independent vowel. */
const MATRA_PREFIXED: Readonly<Record<string, string>> = { 'ृ': 'ऋ', 'ॄ': 'ॠ' };

const NUKTA = '़';

/**
 * The nukta letters — ज़, ड़, फ़ and the rest.
 *
 * These are handled as a consonant followed by U+093C rather than as single characters, because
 * Unicode normalisation *decomposes* them: they sit on the composition-exclusion list, so
 * `'ज़'.normalize('NFC')` is two code points, not one. Keying the table on the precomposed
 * character would therefore match nothing at all — a bug that would have shipped silently and
 * turned every ज़ in a Hindi worksheet into a plain ज.
 *
 * Most take the dot-5 prefix. Two do not, and liblouis is the authority for both: ड़ has a cell of
 * its own (1-2-4-5-6) and फ़ uses the "f" cell (1-2-4) rather than फ.
 */
const NUKTA_FORMS: Readonly<Record<string, readonly (readonly number[])[]>> = {
  क: [[5], [1, 3]],
  ख: [[5], [4, 6]],
  ग: [[5], [1, 2, 4, 5]],
  ज: [[5], [2, 4, 5]],
  ड: [[1, 2, 4, 5, 6]],
  ढ: [[5], [1, 2, 4, 5, 6]],
  फ: [[5], [1, 2, 4]],
  य: [[5], [1, 3, 4, 5, 6]],
  र: [[5], [1, 2, 3, 5]],
};

/** Conjuncts with a cell of their own. Checked before the letters, because they are sequences. */
const CONJUNCTS: readonly (readonly [text: string, dots: number[]])[] = [
  ['क्ष', [1, 2, 3, 4, 5]],
  ['ज्ञ', [1, 5, 6]],
];

/** Digits are literary: the number sign, then a–j. Devanagari and ASCII digits both. */
const DIGIT_DOTS: readonly (readonly number[])[] = [
  [2, 4, 5], // 0 = j
  [1], // 1 = a
  [1, 2],
  [1, 4],
  [1, 4, 5],
  [1, 5],
  [1, 2, 4],
  [1, 2, 4, 5],
  [1, 2, 5],
  [2, 4], // 9 = i
];

const NUMBER_SIGN = dotsToMask([3, 4, 5, 6]);

const PUNCTUATION: Readonly<Record<string, readonly number[]>> = {
  '।': [2, 5, 6], // danda — the Hindi full stop
  '॥': [2, 5, 6],
  '.': [2, 5, 6],
  ',': [2],
  ';': [2, 3],
  ':': [2, 5],
  '?': [2, 3, 6],
  '!': [2, 3, 5],
  '-': [3, 6],
  '(': [1, 2, 3, 5, 6],
  ')': [2, 3, 4, 5, 6],
  '"': [2, 3, 6],
  "'": [3],
  '/': [3, 4],
};

/* ------------------------------------------------------------------ translating */

export interface BharatiResult {
  readonly cells: readonly DotMask[];
  /** Characters with no cell in this table. Reported, never silently dropped. */
  readonly unsupported: readonly string[];
}

function digitIndex(char: string): number {
  const code = char.codePointAt(0) ?? 0;
  if (code >= 0x30 && code <= 0x39) return code - 0x30; // ASCII 0-9
  if (code >= 0x966 && code <= 0x96f) return code - 0x966; // Devanagari ०-९
  return -1;
}

/**
 * Devanagari (and the digits and punctuation around it) into Bharati Braille cells.
 *
 * The input is normalised to NFC first. That does NOT merge a nukta into its consonant — those
 * characters are composition exclusions, so NFC leaves (and puts) them decomposed — which is
 * exactly why it is useful here: after normalising, every nukta letter is a consonant followed by
 * U+093C whichever way the teacher's keyboard produced it, and there is one path to test.
 */
export function devanagariToBraille(text: string): BharatiResult {
  const source = text.normalize('NFC');
  const cells: DotMask[] = [];
  const unsupported: string[] = [];
  let inNumber = false;

  const push = (dots: readonly number[]) => cells.push(dotsToMask([...dots]));

  for (let i = 0; i < source.length; ) {
    // Conjuncts first: they are two- and three-character sequences with a single cell.
    const conjunct = CONJUNCTS.find((entry) => source.startsWith(entry[0], i));
    if (conjunct) {
      inNumber = false;
      push(conjunct[1]);
      i += conjunct[0].length;
      continue;
    }

    const char = source[i];
    i += 1;

    if (char === ' ' || char === '\t' || char === '\n') {
      cells.push(BLANK);
      inNumber = false;
      continue;
    }

    const digit = digitIndex(char);
    if (digit >= 0) {
      if (!inNumber) {
        cells.push(NUMBER_SIGN);
        inNumber = true;
      }
      push(DIGIT_DOTS[digit]);
      continue;
    }
    inNumber = false;

    // A consonant carrying a nukta is one letter, whatever the code points say.
    if (source[i] === NUKTA) {
      const form = NUKTA_FORMS[char];
      if (form) {
        i += 1;
        for (const dots of form) push(dots);
        continue;
      }
      const base = CONSONANTS[char];
      if (base) {
        i += 1;
        push([5]); // the general nukta prefix
        push(base);
        continue;
      }
    }

    const whole = WHOLE_NUKTA[char];
    if (whole) {
      for (const dots of whole) push(dots);
      continue;
    }

    const prefixed = PREFIXED[char];
    if (prefixed) {
      push(prefixed[0]);
      push(CONSONANTS[prefixed[1]] ?? []);
      continue;
    }

    const matraPrefixed = MATRA_PREFIXED[char];
    if (matraPrefixed) {
      const entry = PREFIXED[matraPrefixed];
      push(entry[0]);
      push(CONSONANTS[entry[1]] ?? []);
      continue;
    }

    const consonant = CONSONANTS[char];
    if (consonant) {
      push(consonant);
      continue;
    }

    const vowel = VOWELS[char];
    if (vowel) {
      push(vowel);
      continue;
    }

    const matra = MATRAS[char];
    if (matra) {
      push(VOWELS[matra]);
      continue;
    }

    const sign = SIGNS[char];
    if (sign) {
      push(sign);
      continue;
    }

    const punctuation = PUNCTUATION[char];
    if (punctuation) {
      push(punctuation);
      continue;
    }

    // Zero-width joiners decide how a conjunct is *drawn*; braille does not draw.
    if (char === '‌' || char === '‍') continue;

    unsupported.push(char);
  }

  return { cells, unsupported };
}

/** Does this text contain Devanagari at all? Used to choose a code, never to guess a language. */
export function hasDevanagari(text: string): boolean {
  return /[ऀ-ॿ]/.test(text);
}

/**
 * Any Indian script to Bharati Braille.
 *
 * Bengali, Gurmukhi, Gujarati, Oriya, Tamil, Telugu, Kannada and Malayalam are rewritten as their
 * Devanagari equivalents first (`core/indic.ts`) and then go through exactly the table above —
 * which is not a shortcut but the point of Bharati Braille: the same cell for the corresponding
 * letter in every Indian script.
 */
export function indicToBraille(text: string): BharatiResult & { script: IndicScript | null } {
  const script = detectScript(text);
  const { text: devanagari, origin } = transliterate(text);
  const result = devanagariToBraille(devanagari);
  return {
    cells: result.cells,
    // Reported as the teacher wrote it, not as our arithmetic rewrote it.
    unsupported: result.unsupported.map((char) => origin.get(char) ?? char),
    script,
  };
}
