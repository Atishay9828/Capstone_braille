/**
 * Reading the dots back.
 *
 * Everything else in `core/` runs one way: maths goes in, braille comes out. Which means that when
 * the braille is wrong, nothing in the system notices — the tests can only check that a translation
 * *happened*, and a teacher who cannot read braille has no way to tell a correct cell from a
 * plausible one. That is an uncomfortable position for a tool whose whole job is to be trusted.
 *
 * So this file reads in the other direction: braille cells in, ordinary maths out. It is a small
 * Nemeth parser that knows nothing about temml, nothing about speech-rule-engine, and nothing about
 * how the forward path decided anything. Feed it the cells that are physically on the display and
 * it says what a braille reader would say they mean.
 *
 * WHAT AGREEMENT PROVES, AND WHAT IT DOES NOT.
 *
 * The two directions share the alphabet — a Nemeth "5" is dots 2-6 in both, and no amount of
 * round-tripping can discover that both are wrong about that. (`nemeth.test.ts` checks the alphabet
 * against published tables; that is its job, not this one's.) What the two directions do *not*
 * share is the grammar: numeric indicators, where a superscript ends, which cell closes a fraction,
 * whether a lone digit after a letter is a subscript. That is where braille goes wrong in practice,
 * and every one of those is checked here by two pieces of code that were written from opposite
 * ends and have to arrive at the same sentence.
 *
 * THE READING IS A CANONICAL FORM, NOT PRETTY MATHS. Everything is parenthesised — `(1)/(2)`,
 * `x^(2)` — because the point is comparison, not beauty, and an unparenthesised reading would let
 * a genuine grouping bug slip through as a formatting difference. `canonical.ts` prints LaTeX into
 * the same form so the two can be compared character for character.
 *
 * Nemeth rules this file implements, with the case in the corpus that forced each one:
 *
 *   · dropped digits ⠂⠆⠒⠲⠢⠖⠶⠦⠔⠴, distinct from the letters a–j        `2 + 3 = 5`
 *   · the numeric indicator ⠼, and the fact that ⠼ is ALSO the fraction
 *     closing cell — told apart by whether a digit follows it              `1/2` vs `2/3 + 1/6`
 *   · a digit straight after a letter is a subscript, no indicator needed   `x_1`, `log_10 100`
 *   · levels: ⠘ up, ⠰ down, ⠐ back to the baseline, and a space also
 *     returns to the baseline                                              `(a+b)^2 = a^2 + ...`
 *   · fractions ⠹ … ⠌ … ⠼, and the "complex fraction" ⠠⠹ … ⠠⠌ … ⠠⠼
 *     one level out when a fraction contains a fraction                    `3/4 x 2/5`
 *   · radicals ⠜ … ⠻, with the index written ⠣ n ⠜ before the sign         `cbrt(27)`
 *   · limits written below ⠩ and above ⠣, closed by ⠻                      `sum_{i=1}^{n}`
 *   · ⠨ before a digit inside a number is a decimal point, but ⠨⠂ standing
 *     alone is "greater than" — the same two cells, told apart by context   `3.14` vs `a > b`
 */

import { maskToUnicode, type DotMask } from './braille';

export interface Readback {
  /** The canonical reading. Empty if there was nothing to read. */
  readonly text: string;
  /** Cells this parser has no rule for, as Unicode braille. Never guessed at. */
  readonly unknown: readonly string[];
}

/** Nemeth digits are "dropped" — the same shapes as a–j, moved down the cell. */
const DIGITS: Readonly<Record<string, string>> = {
  '⠂': '1',
  '⠆': '2',
  '⠒': '3',
  '⠲': '4',
  '⠢': '5',
  '⠖': '6',
  '⠶': '7',
  '⠦': '8',
  '⠔': '9',
  '⠴': '0',
};

const LETTERS: Readonly<Record<string, string>> = {
  '⠁': 'a',
  '⠃': 'b',
  '⠉': 'c',
  '⠙': 'd',
  '⠑': 'e',
  '⠋': 'f',
  '⠛': 'g',
  '⠓': 'h',
  '⠊': 'i',
  '⠚': 'j',
  '⠅': 'k',
  '⠇': 'l',
  '⠍': 'm',
  '⠝': 'n',
  '⠕': 'o',
  '⠏': 'p',
  '⠟': 'q',
  '⠗': 'r',
  '⠎': 's',
  '⠞': 't',
  '⠥': 'u',
  '⠧': 'v',
  '⠺': 'w',
  '⠭': 'x',
  '⠽': 'y',
  '⠵': 'z',
};

/**
 * Multi-cell symbols, longest first.
 *
 * Order matters more than it looks: ⠌⠨⠅ ("not equal") begins with the fraction line, and ⠨⠂⠱
 * ("greater than or equal") begins with "greater than". Matching short first would read every ≠ as
 * a fraction and every ≥ as a > followed by a stray cell.
 */
const SYMBOLS: ReadonlyArray<readonly [string, string]> = ([
  ['⠸⠐⠅⠱', '⊆'],
  ['⠈⠱⠈⠱', '≈'],
  ['⠸⠐⠅', '⊂'],
  ['⠸⠨⠂', '⊃'],
  ['⠌⠈⠑', '∉'],
  ['⠸⠇', '≡'],
  ['⠸⠒', ':'],
  ['⠸⠲', '.'], // the punctuation indicator, for a mark that is punctuation and not mathematics
  ['⠸⠂', ','],
  ['⠸⠆', ';'],
  ['⠸⠦', '?'],
  ['⠸⠖', '!'],
  ['⠠⠡', '∴'],
  ['⠈⠌', '∵'],
  ['⠫⠏', '⊥'],
  ['⠣⠱⠻', '‾'],
  ['⠌⠨⠅', '≠'],
  ['⠐⠅⠱', '≤'],
  ['⠨⠂⠱', '≥'],
  ['⠨⠠⠎', 'Σ'],
  ['⠨⠅', '='],
  ['⠐⠅', '<'],
  ['⠨⠂', '>'],
  ['⠈⠡', '×'],
  ['⠨⠌', '÷'],
  ['⠬⠤', '±'],
  ['⠈⠴', '%'],
  ['⠨⠡', '°'],
  ['⠨⠬', '∪'],
  ['⠨⠩', '∩'],
  ['⠈⠑', '∈'],
  ['⠨⠷', '{'],
  ['⠈⠷', '['], // Nemeth square brackets — the round ones with a dot-4 prefix
  ['⠈⠾', ']'],
  ['⠨⠾', '}'],
  ['⠐⠂', ':'],
  ['⠫⠪', '∠'],
  ['⠫⠞', '△'],
  ['⠫⠇', '∥'],
  ['⠫⠕', '→'],
  ['⠠⠿', '∞'],
  ['⠨⠁', 'α'],
  ['⠨⠃', 'β'],
  ['⠨⠛', 'γ'],
  ['⠨⠙', 'δ'],
  ['⠨⠑', 'ε'],
  ['⠨⠇', 'λ'],
  ['⠨⠍', 'μ'],
  ['⠨⠏', 'π'],
  ['⠨⠹', 'θ'],
  ['⠨⠗', 'ρ'],
  ['⠨⠎', 'σ'],
  ['⠨⠞', 'τ'],
  ['⠨⠋', 'φ'],
  ['⠨⠺', 'ω'],
] as ReadonlyArray<readonly [string, string]>)
  .slice()
  .sort((a, b) => b[0].length - a[0].length);

/** Single cells that stand for themselves. */
const SINGLES: Readonly<Record<string, string>> = {
  '⠡': '·', // a raised dot: multiplication written the other way
  '⠄': "'", // the prime: f'(x), a minute of arc, a first derivative (v5 audit gap G5)
  '⠯': '!', // factorial
  '⠱': '‾', // a bar over the letter before it
  '⠬': '+',
  '⠤': '-',
  '⠷': '(',
  '⠾': ')',
  '⠳': '|',
  '⠮': '∫',
};

/**
 * The switch indicators Braillix writes around maths inside a sentence. They say "the code changes
 * here", which is information for a reader and noise for a comparison, so they are read and dropped.
 */
const IGNORED = new Set(['⠸⠩', '⠸⠱']);

type Group = 'radical' | 'limit';

class Reader {
  private out: string[] = [];
  private unknown: string[] = [];
  /** Open superscript/subscript groups, innermost last. */
  private levels: string[] = [];
  /**
   * Open fractions, innermost last, each holding how many ⠠ prefixes its cells carry.
   *
   * Nemeth marks a fraction that CONTAINS a fraction with ⠠ on all three of its cells, one for
   * each level of nesting: ⠹ is a plain fraction, ⠠⠹ contains one, ⠠⠠⠹ contains that. It was
   * written here as a two-valued kind, which was enough for `3/4 x 2/5` and gave up at `1/2/3/4/5`.
   */
  private fractions: number[] = [];
  /** Open radicals and limit groups — everything ⠻ can close. */
  private groups: Group[] = [];
  /** True between the ⠣ of a radical index and the ⠜ that follows it. */
  private inRadicalIndex = false;
  /** What the previous cell produced. Decides whether a digit is a digit or a subscript. */
  private last: 'digit' | 'letter' | 'other' = 'other';

  constructor(private readonly cells: string) {}

  read(): Readback {
    let i = 0;
    while (i < this.cells.length) {
      i += this.step(i);
    }
    this.closeLevels();
    // A fraction or radical left open means the braille itself is unbalanced. Close it so the
    // reading is still legible, and say so — silence here would hide a real defect.
    while (this.groups.length > 0) {
      this.groups.pop();
      this.out.push(')');
      this.unknown.push('unclosed group');
    }
    while (this.fractions.length > 0) {
      this.fractions.pop();
      this.out.push(')');
      this.unknown.push('unclosed fraction');
    }
    return { text: this.out.join(''), unknown: this.unknown };
  }

  /** Handle the cell at `i`; return how many cells were consumed (never zero). */
  private step(i: number): number {
    const cell = this.cells[i];
    const next = this.cells[i + 1] ?? '';

    if (cell === '⠀') {
      // A space ends a superscript in Nemeth, which is why `(a+b)^2 = ...` needs no ⠐ before the
      // comparison. It is also just a space, and the canonical form has none.
      this.closeLevels();
      this.last = 'other';
      return 1;
    }

    for (const pair of IGNORED) {
      if (this.cells.startsWith(pair, i)) return pair.length;
    }

    // ⠨ before a digit, in the middle of a number, is a decimal point — and ⠨⠂ on its own is
    // "greater than". Identical cells; only the neighbours tell them apart.
    if (cell === '⠨' && this.last === 'digit' && next in DIGITS && !this.cells.startsWith('⠨⠂⠱', i)) {
      this.out.push('.');
      this.last = 'other';
      return 1;
    }

    // ⠰⠆ is "is proportional to", and it is also the subscript indicator followed by the digit 2.
    // A subscript never follows a space — it attaches to the thing before it — so a space (or the
    // start of the line) is what tells them apart, exactly as it does for a reader.
    if (this.cells.startsWith('⠰⠆', i) && (i === 0 || this.cells[i - 1] === '⠀')) {
      this.out.push('∝');
      this.last = 'other';
      return 2;
    }

    // The ratio colon ⠐⠂ is spaced — `2 : 3`. Unspaced, the same two cells are the baseline
    // indicator followed by the digit 1, which is how `Q1` is written, and `Q1. Find the area` was
    // reading back as `Q:`.
    if (this.cells.startsWith('⠐⠂', i) && !(i === 0 || this.cells[i - 1] === '⠀')) {
      this.closeLevels();
      this.last = 'other';
      return 1; // consume only the ⠐; the digit is read on the next pass
    }

    if (this.cells.startsWith('⠨⠠', i)) return this.greekCapital(i);

    for (const [sequence, meaning] of SYMBOLS) {
      if (this.cells.startsWith(sequence, i)) {
        this.out.push(meaning);
        this.last = 'other';
        return sequence.length;
      }
    }

    switch (cell) {
      case '⠼':
        // The numeric indicator and the fraction's closing cell are the same six dots. A digit
        // after it means "a number starts here"; anything else means "that fraction is finished".
        if (next in DIGITS) {
          this.last = 'other';
          return 1;
        }
        return this.closeFraction(0);

      case '⠹':
        return this.openFraction(0);

      case '⠌':
        return this.fractionLine(0);

      case '⠠':
        return this.dotSix(i);

      case '⠘':
      case '⠰':
        return this.openLevel(i, cell === '⠘' ? '^' : '_');

      case '⠐':
        this.closeLevels();
        this.last = 'other';
        return 1;

      case '⠜':
        if (this.inRadicalIndex) {
          this.inRadicalIndex = false;
          this.out.push('](');
        } else {
          this.out.push('√(');
        }
        this.groups.push('radical');
        this.last = 'other';
        return 1;

      case '⠻':
        if (this.groups.length === 0) {
          this.unknown.push(cell);
          return 1;
        }
        this.groups.pop();
        this.out.push(')');
        this.last = 'other';
        return 1;

      case '⠣':
        return this.above(i);

      case '⠩':
        this.closeLimit();
        this.out.push('_(');
        this.groups.push('limit');
        this.last = 'other';
        return 1;

      default:
        break;
    }

    if (cell in DIGITS) return this.digits(i);

    if (cell in LETTERS) {
      this.out.push(LETTERS[cell]);
      this.last = 'letter';
      return 1;
    }

    if (cell in SINGLES) {
      // A binomial coefficient is written ( n ⠩ k ) — the "directly below" group has no terminator
      // of its own, and the bracket that closes the whole thing closes it too.
      if (cell === '⠾') this.closeLimit();
      this.out.push(SINGLES[cell]);
      this.last = 'other';
      return 1;
    }

    this.unknown.push(cell);
    return 1;
  }

  /**
   * ⠨⠠ then a letter is a capital Greek letter — the same two cells as the lowercase one with the
   * capital sign wedged in the middle. Only Σ was tabled, because only Σ had turned up; the rest are
   * the same rule and were waiting to be met as gaps.
   */
  private greekCapital(i: number): number {
    const letter = this.cells[i + 2] ?? '';
    const lower = SYMBOLS.find(([sequence]) => sequence === `\u2828${letter}`)?.[1];
    if (!lower) {
      this.unknown.push('\u2828\u2820');
      return 2;
    }
    this.out.push(lower.toUpperCase());
    this.last = 'other';
    return 3;
  }

  /**
   * ⠠ is several things, and how many of them are in a row decides which.
   *
   *   a run of ⠠ before ⠹ ⠌ or ⠼   the marks of a fraction nested that many levels deep
   *   one ⠠ before a letter            a capital
   *   one ⠠ otherwise                  the comma — in a lakh, in a set, between the terms of a series
   */
  private dotSix(i: number): number {
    let run = 0;
    while (this.cells[i + run] === '\u2820') run += 1;
    const after = this.cells[i + run] ?? '';

    if (after === '\u2839') return run + this.openFraction(run);
    if (after === '\u280c') return run + this.fractionLine(run);
    if (after === '\u283c') return run + this.closeFraction(run);

    if (run === 1 && after in LETTERS) {
      this.out.push(LETTERS[after].toUpperCase());
      this.last = 'letter';
      return 2;
    }
    // Everything else is the comma: dot 6, whether it is grouping a lakh (⠂⠠⠴⠴⠠⠴⠴⠴), separating
    // the members of a set (⠂⠠⠆⠠⠒), or separating the terms of a progression, where it is followed
    // by a space rather than by a digit — which is how this rule came to be written.
    if (run === 1 && (after in DIGITS || after === '\u2800' || after === '')) {
      // Punctuation is read at the baseline. `30^\u00b0, 60^\u00b0` puts the comma straight after the degree
      // sign with no baseline indicator, and Nemeth does not need one — a comma is never part of a
      // superscript. Without this the comma was read as though it were up there with the degree.
      this.closeLevels();
      this.out.push(',');
      this.last = 'other';
      return 1;
    }
    this.unknown.push('\u2820'.repeat(run));
    return run;
  }

  private openFraction(level: number): number {
    this.fractions.push(level);
    this.out.push('(');
    this.last = 'other';
    return 1;
  }

  private fractionLine(level: number): number {
    if (this.fractions[this.fractions.length - 1] === level) {
      this.out.push(')/(');
      this.last = 'other';
      return 1;
    }
    this.unknown.push('\u280c');
    return 1;
  }

  private closeFraction(level: number): number {
    if (this.fractions[this.fractions.length - 1] === level) {
      this.fractions.pop();
      this.out.push(')');
      this.last = 'other';
      return 1;
    }
    // A closing cell with nothing open at this level. Say so rather than dropping it.
    this.unknown.push('\u283c');
    return 1;
  }

  /**
   * ⠘ and ⠰ move one level away from the baseline; doubling them moves two. A single indicator
   * therefore *replaces* whatever level we were on, which is how `∫_0^1` puts the 0 below and the
   * 1 above rather than nesting one inside the other.
   */
  private openLevel(i: number, mark: '^' | '_'): number {
    const cell = this.cells[i];
    let depth = 0;
    while (this.cells[i + depth] === cell) depth += 1;
    while (this.levels.length >= depth) this.closeLevel();
    this.levels.push(mark);
    this.out.push(`${mark}(`);
    this.last = 'other';
    return depth;
  }

  private closeLevel(): void {
    if (this.levels.length === 0) return;
    this.levels.pop();
    this.out.push(')');
  }

  private closeLevels(): void {
    while (this.levels.length > 0) this.closeLevel();
  }

  private closeLimit(): void {
    if (this.groups[this.groups.length - 1] === 'limit') {
      this.groups.pop();
      this.out.push(')');
    }
  }

  /**
   * ⠣ is the index of a root when a radical sign follows it, and "the limit written above" when one
   * does not — `cbrt(27)` and `sum_{i=1}^{n}` respectively. Looking ahead for the radical sign is
   * the only way to tell, and it is exactly what a braille reader does.
   */
  private above(i: number): number {
    const rest = this.cells.slice(i + 1);
    const radical = rest.indexOf('⠜');
    const terminator = rest.indexOf('⠻');
    if (radical !== -1 && (terminator === -1 || radical < terminator)) {
      this.inRadicalIndex = true;
      this.out.push('√[');
      this.last = 'other';
      return 1;
    }
    this.closeLimit();
    this.out.push('^(');
    this.groups.push('limit');
    this.last = 'other';
    return 1;
  }

  /**
   * A run of digits — or, when it comes straight after a letter with no numeric indicator, a
   * subscript. `x⠂` is x-sub-one; `x⠼⠂` would be x times one. Nemeth leaves the indicator out
   * because after a letter there is nothing else it could be.
   */
  private digits(i: number): number {
    const subscript = this.last === 'letter';
    if (subscript) this.out.push('_(');
    let taken = 0;
    while (this.cells[i + taken] in DIGITS) {
      this.out.push(DIGITS[this.cells[i + taken]]);
      taken += 1;
      if (!subscript) break; // ordinary digits are emitted one at a time so ⠠ and ⠨ can interrupt
    }
    if (subscript) {
      this.out.push(')');
      this.last = 'other';
    } else {
      this.last = 'digit';
    }
    return taken;
  }
}

/** Read a run of Nemeth cells as ordinary maths. Never throws. */
export function readBackUnicode(braille: string): Readback {
  return new Reader(braille).read();
}

/** The same, from the dot masks that are physically on the display. */
export function readBack(cells: readonly DotMask[]): Readback {
  return readBackUnicode(cells.map(maskToUnicode).join(''));
}
