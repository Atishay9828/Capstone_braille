/**
 * Words and mathematics on one strip of cells.
 *
 * The thing an Indian maths classroom actually reads is not an expression — it is a question:
 *
 *     दो संख्याओं का योग 12 है
 *     Find the value of 2x + 5 = 15
 *
 * Half of that line is language and half is mathematics, and they are written in **different
 * braille codes**. Nemeth cannot spell "संख्याओं"; Bharati cannot express a fraction. So this file
 * cuts the line into segments, sends each to the right translator, and marks the boundary the way
 * a braille reader expects to see it.
 *
 * THREE RULES THAT KEEP IT HONEST:
 *
 *  1. **Nothing is guessed silently.** Every segment is shown on screen with the code it is written
 *     in, and the teacher can flip any segment between "words" and "maths" with one click. The
 *     splitter is a good first guess, not an authority.
 *  2. **The boundary is written into the braille.** Maths inside text opens with the Nemeth Code
 *     indicator ⠸⠩ and closes with the terminator ⠸⠱ (BANA, *Guidance for Transcription Using the
 *     Nemeth Code within UEB Contexts*). A reader must be told the code changed; guessing from
 *     context is exactly what these indicators exist to prevent.
 *  3. **A pure maths line is untouched.** If every segment is mathematics — which is every
 *     expression the rest of Braillix has ever handled — this file returns the same cells the
 *     Nemeth pipeline would have produced on its own, with no indicators and no segmentation.
 */

import { BLANK, dotsToMask, type DotMask } from './braille';
import { indicToBraille } from './bharati';
import { hasIndic, type IndicScript } from './indic';
import { textToLiteralBraille } from './literal';
import { isMathWord, toLatex } from './mathinput';
import { translateLatex, type TranslationIssue } from './translate';

/** Which braille code a run of cells is written in. Always shown; never inferred by the reader. */
export type BrailleCode = 'nemeth' | 'bharati' | 'literary';

export type SegmentKind = 'maths' | 'text';

export interface Segment {
  readonly kind: SegmentKind;
  readonly text: string;
}

export interface RenderedSegment extends Segment {
  readonly code: BrailleCode;
  /** Which Indian script the words are in, when they are in one. Shown, never inferred by the reader. */
  readonly script?: IndicScript;
  readonly cells: readonly DotMask[];
  /** The LaTeX a maths segment became. Empty for text. Shown in the print preview. */
  readonly latex: string;
  readonly issues: readonly TranslationIssue[];
}

export interface MixedLine {
  readonly segments: readonly RenderedSegment[];
  /** Every segment's cells, in order, separated by blanks, with the switch indicators in place. */
  readonly cells: readonly DotMask[];
  /**
   * Which braille code each cell of `cells` is written in, one entry per cell.
   *
   * Built here rather than worked out again by the interface, because the interface used to label
   * every cell "Nemeth" and tell a teacher that a Bharati ⠋ meant "letter g" when it meant ग.
   * One authority for one fact (CLAUDE.md Law 5).
   */
  readonly codes: readonly BrailleCode[];
  /** True when the line contains words as well as maths — the only case that needs indicators. */
  readonly mixed: boolean;
}

/** BANA's opening Nemeth Code indicator: dots 4-5-6, then dots 1-4-6. */
export const NEMETH_OPEN: readonly DotMask[] = [dotsToMask([4, 5, 6]), dotsToMask([1, 4, 6])];
/** BANA's Nemeth Code terminator: dots 4-5-6, then dots 1-5-6. */
export const NEMETH_CLOSE: readonly DotMask[] = [dotsToMask([4, 5, 6]), dotsToMask([1, 5, 6])];

/**
 * Characters that make a token mathematics whatever else it contains.
 *
 * The underscore is on this list because of `S_n = n/2 (2a + (n-1)d)`, the sum of an arithmetic
 * progression. Without it, `S_n` looked like an ordinary word, went to the text half, and left the
 * equals sign stranded at the front of the mathematics — which then read as a fraction with `=n` on
 * top. Every cell was correct Nemeth for the expression it was given; the expression was wrong two
 * steps earlier. A subscript is not a word.
 */
const MATHS_CHARS = /[0-9+\-*/^_=<>()[\]{}|%°₹\\÷×±≤≥≠≈∞√]/;

/** A token made only of operators — `+`, `=`, `<=`. What binds two things into one expression. */
const OPERATOR_ONLY = /^[+\-*/^_=<>:|×÷±≤≥≠≈]+$/;

/**
 * Unit abbreviations, which belong to the mathematics and not to the sentence.
 *
 * `12.5 cm` was being cut in two — the number in Nemeth, the unit in literary braille, with switch
 * indicators between them. That is not how a measurement is written: Nemeth keeps the unit inside
 * the expression, as the plain letters c and m. Two characters, no ceremony.
 */
const UNITS = new Set([
  'cm',
  'mm',
  'km',
  'kg',
  'mg',
  'ml',
  'kl',
  'cc',
  'sq',
  'ft',
  'hr',
  'hrs',
  'min',
  'sec',
  'am',
  'pm',
  'ha',
  'kw',
]);

/**
 * Short English words that are never mathematics, however they are surrounded.
 *
 * This list exists because of one line: `25% of 80 = 20`. "of" is two letters with mathematics on
 * both sides, so the rule below promoted it — and it reached the display as the variables o times
 * f. A teacher would never have known; the dots looked perfectly plausible.
 *
 * Kept deliberately short, and every word on it checked against the ones that ARE mathematics in an
 * Indian classroom: "in" is set membership, "by" is division, "into" is multiplication, "to" is an
 * arrow. None of those appear here. A word earns its place only by being unambiguous.
 */
/**
 * Words that are a symbol in one place and English in another.
 *
 * "in" is set membership and also the commonest preposition in the language; "by" is division in
 * Indian English ("twelve by four") and also "increased by 20%"; "to" is the arrow of a limit and
 * also half of "to find". None of them can be decided by looking at the word — only by looking at
 * what is either side, which is what `weak` is for.
 */
const AMBIGUOUS = new Set(['in', 'by', 'to']);

/**
 * Words that stand for a BINARY operator: they need something on their left.
 *
 * A line cannot open with one, however maths-like the rest of it looks. "In triangle ABC" was
 * reaching the display as ∈ △ ABC — the sentence began with "is a member of", which is not a thing
 * anybody wrote, and a braille reader would have had no way to guess what was meant.
 */
const NEEDS_A_LEFT_OPERAND = new Set([
  'in',
  'by',
  'to',
  'cup',
  'cap',
  'union',
  'intersect',
  'intersection',
  'mid',
  'subset',
  'subseteq',
  'supset',
  'notin',
  'perp',
  'parallel',
  'equiv',
  'propto',
  'approx',
  'times',
  'into',
  'div',
  'divided',
]);

const NEVER_MATHS = new Set([
  'of',
  'is',
  'are',
  'was',
  'were',
  'the',
  'and',
  'an',
  'as',
  'at',
  'on',
  'be',
  'do',
  'if',
  'it',
  'we',
  'so',
  'my',
  'us',
  'no',
]);

/**
 * How confidently a token belongs to the mathematics.
 *
 * Three states rather than two, because two is not enough. "ab" in `ab + bc` is algebra; "of" in
 * "the value of 2x" is English; both are two letters and neither can be judged alone. So they are
 * `weak`, and the pass below decides them by what is next to them.
 */
type Strength = 'maths' | 'text' | 'weak';

function strengthOf(token: string): Strength {
  const bare = token.replace(/[.,;:!?।]+$/, '');
  if (!bare) return 'weak'; // a lone punctuation mark: the colon in "2 : 3", a stray dash
  if (hasIndic(bare)) return 'text'; // Nemeth has no cells for any Indian script, so never maths
  if (NEVER_MATHS.has(bare.toLowerCase())) return 'text'; // decided outright, before any neighbour can vote
  // A run of underscores is a blank to be filled in, which is half the questions in a primary
  // worksheet. Read as mathematics it was three subscript operators with nothing to subscript, and
  // `2x + ___ = 10` produced no braille at all plus an internal error message on screen.
  if (/^[_—-]{2,}$/.test(bare)) return 'text';
  // A hyphen between two whole words is a hyphen, not a minus sign: "a right-angled triangle" was
  // being read as algebra because of the dash in the middle of an ordinary English adjective.
  // `a-b` keeps its minus, because single letters either side of a dash are a subtraction.
  if (/^[A-Za-z]{2,}(-[A-Za-z]{2,})+$/.test(bare)) return 'text';
  if (MATHS_CHARS.test(bare)) return 'maths';
  if (/^[A-Za-z]$/.test(bare)) return 'maths'; // a single letter is a variable
  if (/^[A-Z]{2,}$/.test(bare)) return 'maths'; // ABC — a geometry label, not a word
  if (AMBIGUOUS.has(bare.toLowerCase())) return 'weak'; // decided by the neighbours, never by the word
  if (isMathWord(bare)) return 'maths'; // sin, theta, Rs
  if (UNITS.has(bare.toLowerCase())) return 'maths'; // cm, kg, min
  if (/^[A-Za-z]{2}$/.test(bare)) return 'weak'; // ab, or of
  return 'text';
}

/**
 * Cut a line into segments of words and mathematics.
 *
 * `overrides` maps a segment's exact text to the kind the teacher chose for it, so a correction
 * survives further typing elsewhere in the line. Keying by text rather than by position is the
 * difference between a fix that sticks and one that jumps to another word when you add a comma.
 */
export function splitLine(line: string, overrides: Readonly<Record<string, SegmentKind>> = {}): Segment[] {
  const tokens = line.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const strength = tokens.map(strengthOf);
  const isOperator = tokens.map((token) => OPERATOR_ONLY.test(token));

  // PASS 1 — decide the undecided by their neighbours. An operator on either side makes a token
  // part of an expression ("ab + bc"); otherwise it is a word ("the value of 2x"). A lone
  // punctuation mark between two pieces of maths belongs to the maths ("2 : 3").
  const kinds: SegmentKind[] = strength.map((value, i) => {
    // A binary operator with nothing on its left is a word, whatever else it might have been.
    if (i === 0 && NEEDS_A_LEFT_OPERAND.has(tokens[0].replace(/[.,;:!?।]+$/, '').toLowerCase())) return 'text';
    if (value !== 'weak') return value;
    if (isOperator[i - 1] || isOperator[i + 1]) return 'maths';
    if (strength[i - 1] === 'maths' && strength[i + 1] === 'maths') return 'maths';
    return 'text';
  });

  // PASS 2 — a run of maths that contains no digit and no operator, with words on BOTH sides, is
  // a phrase: "The sum of the two numbers" is English, even though "sum" is an operator's name.
  // Words on only one side is not enough — "Find the value of x" ends in maths, and should.
  for (let start = 0; start < kinds.length; start += 1) {
    if (kinds[start] !== 'maths') continue;
    let end = start;
    while (end + 1 < kinds.length && kinds[end + 1] === 'maths') end += 1;
    const symbolic = tokens.slice(start, end + 1).some((token) => MATHS_CHARS.test(token));
    const between = start > 0 && end < kinds.length - 1 && kinds[start - 1] === 'text' && kinds[end + 1] === 'text';
    // ...and the same at the START of a line, where there is no left-hand side to be between. "A
    // shopkeeper bought a pen" was opening with a one-letter island of mathematics called A.
    // Only at the start: "Find angle C" ends in mathematics, and should.
    const opening = start === 0 && end < kinds.length - 1 && kinds[end + 1] === 'text';
    if (!symbolic && (between || opening)) {
      for (let i = start; i <= end; i += 1) kinds[i] = 'text';
    }
    start = end;
  }

  const segments: Segment[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const previous = segments[segments.length - 1];
    if (previous && joinable(previous, { kind: kinds[i], text: tokens[i] })) {
      segments[segments.length - 1] = { kind: previous.kind, text: `${previous.text} ${tokens[i]}` };
    } else {
      segments.push({ kind: kinds[i], text: tokens[i] });
    }
  }

  // Apply the teacher's corrections, then merge again — flipping a segment may join it to a
  // neighbour, and two adjacent segments of the same kind would otherwise render a stray boundary.
  const corrected = punctuationBelongsToTheSentence(
    segments.map((segment) => ({ ...segment, kind: overrides[segment.text] ?? segment.kind })),
  );
  const merged: Segment[] = [];
  for (const segment of corrected) {
    const previous = merged[merged.length - 1];
    if (previous && joinable(previous, segment)) {
      merged[merged.length - 1] = { kind: segment.kind, text: `${previous.text} ${segment.text}` };
    } else {
      merged.push(segment);
    }
  }
  return merged;
}

/**
 * The full stop at the end of a sentence is not part of the mathematics.
 *
 * This is the worst thing the splitter did, and it did it quietly. "The difference is 7." put the
 * full stop inside the maths, where Nemeth writes a dot after a numeral as ⠨ — the DECIMAL POINT.
 * A child read "seven point", the sentence never ended, and every cell was faithful Nemeth for an
 * expression nobody had written.
 *
 * So trailing sentence punctuation is moved out of a maths run and into the words beside it, which
 * is also what BANA asks for: the punctuation after a Nemeth passage belongs to the surrounding
 * text and is written in the literary code, after the terminator.
 *
 * The exclamation mark is left alone: `5!` is a factorial, and it is real mathematics.
 */
const SENTENCE_END = /[.,;:।॥?]+$/;

/**
 * Which marks end a SENTENCE rather than separate two pieces of mathematics.
 *
 * At the end of a maths run every mark is sentence punctuation, because what follows is words. In
 * the middle of one only these are: a comma between the terms of a progression — `a, a+d, a+2d` —
 * belongs to the mathematics, and cutting the line there put two full stops into a series.
 */
const ENDS_A_SENTENCE = /[.।॥?]+$/;

function punctuationBelongsToTheSentence(segments: readonly Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const segment of segments) {
    if (segment.kind !== 'maths') {
      out.push(segment);
      continue;
    }
    // Every token, not only the last one. "Find the value of x. (2 marks)" has the full stop in the
    // MIDDLE of the maths run, where it was still becoming a decimal point.
    let run: string[] = [];
    const flush = () => {
      if (run.length > 0) out.push({ kind: 'maths', text: run.join(' ') });
      run = [];
    };
    const tokens = segment.text.split(' ');
    for (const [index, token] of tokens.entries()) {
      const last = index === tokens.length - 1;
      const match = (last ? SENTENCE_END : ENDS_A_SENTENCE).exec(token);
      const body = match ? token.slice(0, -match[0].length) : token;
      // A lone punctuation mark IS the token (the colon of `2 : 3`); there is nothing to move.
      if (!match || !body.trim()) {
        run.push(token);
        continue;
      }
      run.push(body);
      flush();
      out.push({ kind: 'text', text: match[0] });
    }
    flush();
  }
  return out;
}

/**
 * Can these two runs share a segment?
 *
 * Same kind is not enough. A segment is written in ONE braille code, and “Ravi के पास” is two:
 * the Latin word is Grade-1 literary braille and the Hindi is Bharati. Merging them sent the whole
 * thing to the Bharati translator, which has no cell for a Latin r and dropped it — a Hinglish
 * question quietly losing half its words. So a change of script ends a segment, exactly as a change
 * between words and mathematics does.
 */
function joinable(previous: Segment, next: Segment): boolean {
  if (previous.kind !== next.kind) return false;
  if (previous.kind === 'maths') return true;
  return hasIndic(previous.text) === hasIndic(next.text);
}

async function renderSegment(segment: Segment, standalone: boolean): Promise<RenderedSegment> {
  if (segment.kind === 'maths') {
    const parsed = toLatex(segment.text);
    const translation = await translateLatex(parsed.latex);
    const issues = [
      ...parsed.issues.map((issue) => ({ kind: 'parse' as const, message: issue.message, fix: issue.fix })),
      ...translation.issues,
    ];
    const body = translation.cells;
    return {
      ...segment,
      code: 'nemeth',
      latex: parsed.latex,
      // A maths line on its own needs no indicators; maths inside a sentence does.
      cells: standalone ? body : [...NEMETH_OPEN, BLANK, ...body, BLANK, ...NEMETH_CLOSE],
      issues,
    };
  }

  if (hasIndic(segment.text)) {
    const result = indicToBraille(segment.text);
    return {
      ...segment,
      code: 'bharati',
      script: result.script ?? undefined,
      latex: '',
      cells: result.cells,
      issues: result.unsupported.length
        ? [
            {
              kind: 'unknown-character' as const,
              message: `No Bharati cell for: ${[...new Set(result.unsupported)].join(' ')}`,
              fix: 'They were skipped. Tell us the character and it can be added to the table.',
            },
          ]
        : [],
    };
  }

  const result = textToLiteralBraille(segment.text);
  return {
    ...segment,
    code: 'literary',
    latex: '',
    cells: result.cells,
    issues: result.unsupported.length
      ? [
          {
            kind: 'unknown-character' as const,
            message: `No braille cell for: ${[...new Set(result.unsupported)].join(' ')}`,
            fix: 'They were skipped.',
          },
        ]
      : [],
  };
}

/**
 * Translate a whole line of words and maths.
 *
 * Never throws: a segment that fails contributes its issue and no cells, and the rest of the line
 * still reaches the display (CLAUDE.md Law 4).
 */
export async function translateMixed(
  line: string,
  overrides: Readonly<Record<string, SegmentKind>> = {},
): Promise<MixedLine> {
  const segments = splitLine(line, overrides);
  const mixed = segments.some((segment) => segment.kind === 'text') && segments.some((s) => s.kind === 'maths');
  const standalone = !mixed;

  const rendered = await Promise.all(segments.map((segment) => renderSegment(segment, standalone)));

  const cells: DotMask[] = [];
  const codes: BrailleCode[] = [];
  for (const [index, segment] of rendered.entries()) {
    // Punctuation hugs what it follows. Every other join gets a blank between the two runs, but a
    // full stop set off by a space is not a full stop — in braille as on paper, the mark belongs to
    // the word or the expression in front of it.
    if (index > 0 && !hugsWhatCameBefore(segment.text)) {
      cells.push(BLANK);
      codes.push(segment.code); // the blank between two runs belongs to the run it introduces
    }
    for (const cell of segment.cells) {
      cells.push(cell);
      codes.push(segment.code);
    }
  }

  return { segments: rendered, cells, codes, mixed };
}

/**
 * A segment that BEGINS with sentence punctuation sits against the run before it, not apart.
 *
 * Begins with, not consists of: the full stop is split off the mathematics as its own segment and
 * then merges with the words that follow it, so by the time the cells are joined the segment reads
 * ".  Find its area." — and it is the leading mark that has to hug what came before.
 */
function hugsWhatCameBefore(text: string): boolean {
  return /^[.,;:।॥?!]/.test(text.trim());
}

/** Does this line contain anything that is not mathematics? Cheap check, no translation. */
export function hasWords(line: string): boolean {
  return splitLine(line).some((segment) => segment.kind === 'text');
}
