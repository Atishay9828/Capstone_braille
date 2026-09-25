/**
 * The other eight scripts.
 *
 * Bharati Braille was created in the 1950s "to unify as far as possible the Braille codes for the
 * various Indian languages and scripts" — and it means it. क in Devanagari, ক in Bengali, ਕ in
 * Gurmukhi, ક in Gujarati, କ in Oriya, க in Tamil, క in Telugu, ಕ in Kannada and ക in Malayalam
 * are **one braille cell**, ⠅. A blind child in Chennai and a blind child in Kolkata read the same
 * dots; only the print differs.
 *
 * Unicode, quite deliberately, laid the nine Indic blocks out in parallel: the same offset inside
 * each block is the same letter. So the whole of Bharati Braille for nine scripts is one table —
 * the Devanagari one in `bharati.ts` — plus this file, which is arithmetic:
 *
 *     ক  U+0995  =  0x0980 + 0x15   →   0x0900 + 0x15  =  क  →  ⠅
 *
 * WHERE THE PARALLEL BREAKS. A few characters exist in one script and not the others, and the
 * arithmetic lands them on a Devanagari code point that is not a letter at all. Each one is either
 * given its true equivalent below — a chillu is a consonant plus a halant, and it says so — or
 * **reported as unsupported** rather than rendered as whatever happened to be there. That is the
 * whole safety argument for doing it this way: a gap is visible, a wrong letter is not.
 *
 * The interface says which script it read, so nobody has to infer it from the dots.
 */

export type IndicScript =
  | 'devanagari'
  | 'bengali'
  | 'gurmukhi'
  | 'gujarati'
  | 'oriya'
  | 'tamil'
  | 'telugu'
  | 'kannada'
  | 'malayalam';

interface Block {
  readonly script: IndicScript;
  readonly base: number;
  /** The script's own name, in its own script — what a teacher would recognise. */
  readonly endonym: string;
}

/** The nine blocks, in Unicode order. Each is 128 code points wide and laid out identically. */
const BLOCKS: readonly Block[] = [
  { script: 'devanagari', base: 0x0900, endonym: 'देवनागरी' },
  { script: 'bengali', base: 0x0980, endonym: 'বাংলা' },
  { script: 'gurmukhi', base: 0x0a00, endonym: 'ਗੁਰਮੁਖੀ' },
  { script: 'gujarati', base: 0x0a80, endonym: 'ગુજરાતી' },
  { script: 'oriya', base: 0x0b00, endonym: 'ଓଡ଼ିଆ' },
  { script: 'tamil', base: 0x0b80, endonym: 'தமிழ்' },
  { script: 'telugu', base: 0x0c00, endonym: 'తెలుగు' },
  { script: 'kannada', base: 0x0c80, endonym: 'ಕನ್ನಡ' },
  { script: 'malayalam', base: 0x0d00, endonym: 'മലയാളം' },
];

const BLOCK_SIZE = 0x80;

/**
 * Where the parallel genuinely breaks, and what the letter actually is.
 *
 * A handful of characters sit at offsets their neighbours do not share, because the script needed
 * something the others did not. The arithmetic lands them on Devanagari code points that are not
 * letters at all, so without this table they would be reported as gaps in perfectly ordinary words.
 *
 * Every entry here is a statement about what the character *means*, not a convenience:
 *
 *   ੰ  Gurmukhi tippi     — nasalisation. The same sound Devanagari writes with anusvara ं.
 *   ৎ  Bengali khanda ta  — a ত with its vowel removed: त plus halant, exactly.
 *   ൺൻർൽൾൿ Malayalam chillus — ണ ന ര ല ള क with their vowels removed. Same construction.
 *
 * Gurmukhi's addak ੱ is not in this table because it is not a letter at all: it doubles the
 * consonant that FOLLOWS it, which Devanagari writes by actually doubling — ਪੱਕਾ is पक्का, with the
 * first क stripped of its vowel by a halant. That needs a look at the next character, so it lives
 * in `transliterate` below rather than in a character-for-character map.
 */
const EXCEPTIONS: Readonly<Record<string, string>> = {
  'ੰ': 'ं', // tippi → anusvara
  'ৎ': 'त्', // khanda ta → त्
  'ൺ': 'ण्', // ൺ → ण्
  'ൻ': 'न्', // ൻ → न्
  'ർ': 'र्', // ർ → र्
  'ൽ': 'ल्', // ൽ → ल्
  'ൾ': 'ळ्', // ൾ → ळ्
  'ൿ': 'क्', // ൿ → क्
};

export function scriptOf(char: string): IndicScript | null {
  const code = char.codePointAt(0);
  if (code === undefined) return null;
  for (const block of BLOCKS) {
    if (code >= block.base && code < block.base + BLOCK_SIZE) return block.script;
  }
  return null;
}

/** The script's own name, for the interface to show. */
export function endonymOf(script: IndicScript): string {
  return BLOCKS.find((block) => block.script === script)?.endonym ?? script;
}

/** Is there any Indian script here at all? Cheap; used to choose a braille code, never a language. */
export function hasIndic(text: string): boolean {
  for (const char of text) {
    if (scriptOf(char) !== null) return true;
  }
  return false;
}

/**
 * Which Indian script this text is mostly written in, or null if there is none.
 *
 * "Mostly", because a Bengali question may well contain a Devanagari digit or a stray Devanagari
 * letter, and the label on screen should say what a person would say.
 */
export function detectScript(text: string): IndicScript | null {
  const counts = new Map<IndicScript, number>();
  for (const char of text) {
    const script = scriptOf(char);
    if (script) counts.set(script, (counts.get(script) ?? 0) + 1);
  }
  let best: IndicScript | null = null;
  let most = 0;
  for (const [script, count] of counts) {
    if (count > most) {
      best = script;
      most = count;
    }
  }
  return best;
}

/**
 * Rewrite any Indian script as its Devanagari equivalent, character for character.
 *
 * Normalises to NFC first, so a Bengali ো written as ে + া becomes one code point and maps to one
 * Devanagari ो — decomposed, it would have become "e" followed by "aa", which is a different vowel
 * and a wrong one.
 *
 * Characters outside the Indic blocks are left exactly as they are: a question is usually Bengali
 * words around Latin digits, and both halves have to survive.
 */
export function toDevanagari(text: string): string {
  return transliterate(text).text;
}

export interface Transliteration {
  readonly text: string;
  /**
   * What each Devanagari character was written as in the original.
   *
   * Needed for one reason: when a character has no braille cell, the message has to name what the
   * *teacher typed* — "no cell for ৎ" — and not the Devanagari code point our arithmetic turned it
   * into, which they have never seen and cannot act on.
   */
  readonly origin: ReadonlyMap<string, string>;
}

const ADDAK = '\u0a71';
const HALANT = '\u094d';

/** Devanagari consonants: क–ह, the precomposed nukta letters, and ऩ ऱ ऴ. */
function isDevanagariConsonant(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (
    (code >= 0x0915 && code <= 0x0939) ||
    (code >= 0x0958 && code <= 0x095f) ||
    code === 0x0929 ||
    code === 0x0931 ||
    code === 0x0934
  );
}

export function transliterate(text: string): Transliteration {
  let out = '';
  const origin = new Map<string, string>();
  const chars = [...text.normalize('NFC')];

  const toDevanagariChar = (char: string): string | null => {
    const code = char.codePointAt(0)!;
    const block = BLOCKS.find((entry) => code >= entry.base && code < entry.base + BLOCK_SIZE);
    if (!block) return null;
    return EXCEPTIONS[char] ?? String.fromCodePoint(0x0900 + (code - block.base));
  };

  const remember = (mapped: string, source: string) => {
    // One source character can become two Devanagari ones — a chillu is a consonant plus a halant.
    // Both remember where they came from, so a gap in either names what the teacher typed.
    for (const part of mapped) {
      if (!origin.has(part)) origin.set(part, source);
    }
  };

  for (const [index, char] of chars.entries()) {
    // The addak doubles the consonant AFTER it: ਪੱਕਾ is पक्का. So it writes that consonant once with
    // a halant, and the ordinary pass writes it again a moment later.
    if (char === ADDAK) {
      const next = chars[index + 1] ? toDevanagariChar(chars[index + 1]) : null;
      if (next && isDevanagariConsonant(next)) {
        out += next + HALANT;
        remember(next + HALANT, char);
        continue;
      }
    }

    const mapped = toDevanagariChar(char);
    if (mapped === null) {
      out += char;
      continue;
    }
    out += mapped;
    remember(mapped, char);
  }

  return { text: out, origin };
}
