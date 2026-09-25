/**
 * Words and maths on one line.
 *
 * The tests that matter most here are the two "must not change" ones: a pure maths line has to come
 * out byte-identical to what the Nemeth pipeline produced before this file existed, and a pure text
 * line must never acquire a maths indicator. Everything Braillix already did has to keep working
 * exactly as it did, or this feature is a regression wearing a feature's clothes.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { NEMETH_CLOSE, NEMETH_OPEN, hasWords, splitLine, translateMixed } from './mixed';
import { cellsToUnicode, translateLatex } from './translate';
import { initSre } from './sre-service';
import { toLatex } from './mathinput';
import { checkSegment } from './roundtrip';

beforeAll(async () => {
  const status = await initSre();
  expect(status.ok, `speech-rule-engine failed to start: ${status.reason ?? ''}`).toBe(true);
}, 60_000);

describe('splitting a line into words and maths', () => {
  it('calls a pure expression maths, all of it', () => {
    expect(splitLine('x^2 + 3x + 2 = 0')).toEqual([{ kind: 'maths', text: 'x^2 + 3x + 2 = 0' }]);
    expect(hasWords('x^2 + 3x + 2 = 0')).toBe(false);
  });

  it('keeps the maths vocabulary out of the sentence', () => {
    // "theta" and "sin" are maths; without this the identity would be cut into four pieces.
    expect(splitLine('sin^2 theta + cos^2 theta = 1')).toHaveLength(1);
    expect(hasWords('pi r^2')).toBe(false);
  });

  it('finds the maths inside an English question', () => {
    const segments = splitLine('Find the value of 2x + 5 = 15');
    expect(segments).toEqual([
      { kind: 'text', text: 'Find the value of' },
      { kind: 'maths', text: '2x + 5 = 15' },
    ]);
  });

  it('finds the maths inside a Hindi question', () => {
    const segments = splitLine('दो संख्याओं का योग 12 है');
    expect(segments.map((segment) => segment.kind)).toEqual(['text', 'maths', 'text']);
    expect(segments[1].text).toBe('12');
  });

  it('does not let an English word that is also a maths word split a sentence', () => {
    // "sum", "in", "to" and "by" are all in the maths vocabulary and all ordinary English.
    expect(splitLine('The sum of the two numbers')).toHaveLength(1);
    expect(splitLine('Write the answer in the box')).toHaveLength(1);
  });

  it('lets the teacher overrule it, and remembers by what was written', () => {
    const segments = splitLine('Find the value of 2x + 5 = 15', { 'Find the value of': 'maths' });
    // Flipping the words to maths merges the whole line into one maths segment.
    expect(segments).toHaveLength(1);
    expect(segments[0].kind).toBe('maths');
  });

  it('handles the empty line', () => {
    expect(splitLine('')).toEqual([]);
    expect(splitLine('   ')).toEqual([]);
  });
});

describe('translating a mixed line', () => {
  it('leaves a pure maths line exactly as the Nemeth pipeline had it', async () => {
    for (const line of ['x^2 + 3x + 2 = 0', '1/2', 'sqrt(144) = 12', 'sin^2 theta + cos^2 theta = 1']) {
      const mixed = await translateMixed(line);
      const direct = await translateLatex(toLatex(line).latex);
      expect(cellsToUnicode(mixed.cells), line).toBe(cellsToUnicode(direct.cells));
      expect(mixed.mixed, line).toBe(false);
    }
  });

  it('writes Hindi in Bharati and the maths in Nemeth, on one strip of cells', async () => {
    const line = await translateMixed('दो संख्याओं का योग 12 है');
    expect(line.mixed).toBe(true);
    expect(line.segments.map((segment) => segment.code)).toEqual(['bharati', 'nemeth', 'bharati']);

    const text = cellsToUnicode(line.cells);
    expect(text).toContain('⠙⠕'); // दो, in Bharati
    expect(text).toContain('⠼⠂⠆'); // 12, in Nemeth — dropped digits, not literary ones
  });

  it('marks where the code changes, both ways', async () => {
    const line = await translateMixed('Find the value of 2x + 5 = 15');
    const text = cellsToUnicode(line.cells);
    expect(text, 'the Nemeth opening indicator').toContain(cellsToUnicode(NEMETH_OPEN));
    expect(text, 'the Nemeth terminator').toContain(cellsToUnicode(NEMETH_CLOSE));
  });

  it('does not mark anything on a line that never changes code', async () => {
    const pure = await translateMixed('2x + 5 = 15');
    expect(cellsToUnicode(pure.cells)).not.toContain(cellsToUnicode(NEMETH_OPEN));

    const words = await translateMixed('दो सेब');
    expect(cellsToUnicode(words.cells)).not.toContain(cellsToUnicode(NEMETH_OPEN));
    expect(words.mixed).toBe(false);
  });

  it('writes English words in literary braille, not in Nemeth', async () => {
    const line = await translateMixed('Add 2 and 3');
    const first = line.segments[0];
    expect(first.code).toBe('literary');
    // Literary "Add" is capital sign, a, d, d.
    expect(cellsToUnicode(first.cells)).toBe('⠠⠁⠙⠙');
  });

  it('reports a character it cannot write, and still renders the rest', async () => {
    const line = await translateMixed('क ௵ की संख्या');
    const issues = line.segments.flatMap((segment) => segment.issues);
    expect(issues.some((issue) => issue.message.includes('௵'))).toBe(true);
    expect(line.cells.length).toBeGreaterThan(3);
  });

  it('never throws, whatever it is handed', async () => {
    for (const line of ['', '   ', '?????', '\\frac{1}{', 'क ्', '1/0', '।।।']) {
      await expect(translateMixed(line), line).resolves.toBeTruthy();
    }
  });
});

describe('a line that changes script half way through', () => {
  it('does not send Latin words to the Bharati translator', async () => {
    // "Ravi ke paas 5 seb" is how a great many Indian classrooms actually write. Before this was
    // fixed, the Latin word and the Hindi one shared a segment, the whole segment went to Bharati,
    // and every Latin letter was dropped on the floor — half the question, gone, silently.
    const line = await translateMixed('Ravi के पास 5 सेब');
    const codes = line.segments.map((segment) => segment.code);
    expect(codes).toContain('literary');
    expect(codes).toContain('bharati');
    expect(line.segments.flatMap((segment) => segment.issues)).toEqual([]);
  });

  it('reads every part of such a line back correctly', async () => {
    const line = await translateMixed('Ravi के पास 5 सेब');
    for (const segment of line.segments) {
      const result = checkSegment(segment.kind, segment.text, segment.latex, segment.cells);
      expect(result.verdict, `${segment.text}: dots say “${result.reading}”`).toBe('agrees');
    }
  });

  it('keeps a run of one script together', async () => {
    // The rule is "a change of script ends a segment", not "every word is its own segment".
    const line = await translateMixed('दो संख्याओं का योग 12 है');
    expect(line.segments.filter((segment) => segment.code === 'bharati').length).toBe(2);
  });
});

describe('a question is a sentence, and a sentence has punctuation', () => {
  it('does not let a full stop become a decimal point', async () => {
    // This was the worst thing the splitter did, and it did it quietly. "The difference is 7." put
    // the full stop inside the mathematics, where Nemeth writes a dot after a numeral as ⠨ — the
    // DECIMAL POINT. A child read "seven point", the sentence never ended, and every cell was
    // faithful Nemeth for an expression nobody had written.
    const line = await translateMixed('The difference is 7. Find the numbers.');
    const maths = line.segments.filter((segment) => segment.kind === 'maths');
    expect(maths.map((segment) => segment.text)).toEqual(['7']);
    expect(cellsToUnicode(maths[0].cells)).not.toContain('\u2828');
  });

  it('leaves a factorial alone — 5! is mathematics, not a shout', async () => {
    const line = await translateMixed('Find 5! and 6!');
    expect(line.segments.filter((s) => s.kind === 'maths').map((s) => s.text)).toContain('5!');
  });

  it('keeps a comma that is inside the mathematics inside it', async () => {
    const line = await translateMixed('1,00,000');
    expect(line.segments).toHaveLength(1);
    expect(line.segments[0].text).toBe('1,00,000');
  });

  it('sets the punctuation against what it follows, with no space before it', async () => {
    const line = await translateMixed('The area is 12. Find the perimeter.');
    const braille = cellsToUnicode(line.cells);
    // ⠸⠱ is the Nemeth terminator; the full stop must sit straight after it.
    expect(braille).toContain('\u2838\u2831\u2832');
  });
});

describe('English words that are also operators', () => {
  it('does not open a question with "is a member of"', async () => {
    // "In triangle ABC" reached the display as ∈ △ ABC. A binary operator needs something on its
    // left; a line cannot begin with one, however maths-like the rest of it looks.
    const line = await translateMixed('In triangle ABC, angle A = 50 degrees');
    expect(line.segments[0]).toMatchObject({ kind: 'text', text: 'In' });
    // ...and where it genuinely IS membership, it still is.
    const set = await translateMixed('x in A');
    expect(set.segments.every((segment) => segment.kind === 'maths')).toBe(true);
  });

  it('does not open a question with a one-letter island of algebra', async () => {
    const line = await translateMixed('A shopkeeper bought a pen for Rs 40');
    expect(line.segments[0].kind).toBe('text');
    expect(line.segments[0].text).toContain('shopkeeper');
    // ...but A is still a set when it is one.
    const set = await translateMixed('A cup B');
    expect(set.segments.every((segment) => segment.kind === 'maths')).toBe(true);
  });

  it('knows "by" as English and as division, by what is either side of it', async () => {
    const english = await translateMixed('A number is increased by 20%');
    expect(english.segments.find((s) => s.text.includes('by'))?.kind).toBe('text');

    const division = await translateMixed('12 by 4');
    expect(division.segments.every((segment) => segment.kind === 'maths')).toBe(true);
    expect(toLatex('12 by 4').latex).toBe('12\\div 4');
    expect(toLatex('12 divided by 4').latex).toBe('12\\div 4');
  });
});

describe('a comma does not end the mathematics', () => {
  it('keeps parsing after one', () => {
    // Everything past the first comma used to fall through to the stray branch and be appended
    // letter by letter: `triangle ABC, angle A` reached the display as △ABC and then the LETTERS
    // a-n-g-l-e, which a child would have read as a word in the middle of a geometry question.
    expect(toLatex('triangle ABC, angle A').latex).toBe('\\triangle ABC,\\angle A');
    expect(toLatex('a, b, c').latex).toBe('a,b,c');
  });
});

describe('the three that a real sentence found', () => {
  it('does not open a BRACKET with "is a member of" either', () => {
    // "(in cm)" reached the display as (∈ cm). The rule is about what is on the operator's left,
    // and inside a freshly opened bracket there is nothing there any more than at the start of a
    // line. Where there IS something, it is still membership.
    expect(toLatex('x (in cm)').latex).toBe('x(incm)');
    expect(toLatex('x in A').latex).toBe('x\\in A');
    expect(toLatex('A cup B').latex).toBe('A\\cup B');
  });

  it('reads a hyphen between two words as a hyphen, not a minus', async () => {
    // "A right-angled triangle has sides" was being read as algebra, because of the dash in the
    // middle of an ordinary English adjective.
    const line = await translateMixed('A right-angled triangle has sides 3 cm');
    expect(line.segments[0].kind).toBe('text');
    expect(line.segments[0].text).toContain('right-angled');
    // ...and a dash between single letters is still a subtraction.
    expect(toLatex('a-b').latex).toBe('a-b');
  });
});
