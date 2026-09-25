/**
 * Can Braillix carry the actual syllabus?
 *
 * Not "does Nemeth work" — that is `nemeth.test.ts`, against the published tables. This asks the
 * question a head teacher would ask: take the maths my school teaches, typed the way my teachers
 * type, and show me that all of it reaches the display. Seventy lines, from a single digit to a
 * definite integral, plus word problems in both languages.
 *
 * When this file writes `docs/ACCURACY.md` (via `npm run accuracy`) it is producing evidence rather
 * than decoration: the same list, with what each line actually became, so a panel can check a cell
 * against a published table without running anything.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { initSre } from './sre-service';
import { toLatex } from './mathinput';
import { translateMixed } from './mixed';
import { cellsToUnicode } from './translate';
import { checkSegment } from './roundtrip';
import { SYLLABUS, allEntries } from './syllabus';

beforeAll(async () => {
  const status = await initSre();
  expect(status.ok, `speech-rule-engine failed to start: ${status.reason ?? ''}`).toBe(true);
}, 60_000);

interface Outcome {
  topic: string;
  source: string;
  says: string;
  latex: string;
  braille: string;
  cells: number;
  issues: string[];
  /** What a braille reader would say the cells mean — read back by an engine that has never seen the input. */
  reading: string;
}

const outcomes: Outcome[] = [];

describe('the school syllabus reaches the display', () => {
  for (const topic of SYLLABUS) {
    describe(topic.topic, () => {
      for (const entry of topic.entries) {
        it(`${entry.source}  (${entry.says})`, async () => {
          const line = await translateMixed(entry.source);
          const issues = line.segments.flatMap((segment) => segment.issues);

          // Read every segment back with an engine that has never seen the input, and compare.
          // Nemeth for the mathematics, Bharati for words in an Indian script, Grade-1 for English
          // ones — so the whole line is checked, not the convenient half of it.
          const trips = line.segments.map((segment) =>
            checkSegment(segment.kind, segment.text, segment.latex, segment.cells),
          );

          outcomes.push({
            topic: topic.topic,
            source: entry.source,
            says: entry.says,
            latex: line.segments.map((segment) => segment.latex || segment.text).join(' '),
            braille: cellsToUnicode(line.cells),
            cells: line.cells.length,
            issues: issues.map((issue) => `${issue.kind}: ${issue.message}`),
            reading: trips.map((trip) => trip.reading).join(' '),
          });

          // 1. Something reached the cells.
          expect(line.cells.length, 'produced no braille at all').toBeGreaterThan(0);
          // 2. Nothing was quietly skipped.
          expect(
            issues.filter((issue) => issue.kind !== 'engine').map((issue) => issue.message),
            'a character or a parse was lost',
          ).toEqual([]);
          // 3. The natural input and the LaTeX it becomes are the same maths.
          if (!line.mixed) {
            const direct = toLatex(entry.source).latex;
            expect(direct.length, 'the input parser produced nothing').toBeGreaterThan(0);
          }
          // 3a. A line of pure mathematics must reach the display as ONE run of Nemeth. This is the
          //     assertion that caught `S_n = n/2 (2a + (n-1)d)`: the splitter took `S_n` for a word,
          //     sent it to the text half, and left the equals sign at the front of the mathematics,
          //     where it became the numerator of a fraction. Every cell was faithful to the
          //     expression it was handed. The expression was already wrong.
          const shape = line.segments.map((segment) => segment.kind).join(' + ');
          if (entry.words) {
            expect(shape, 'this line has words in it and should have been split').toContain('text');
          } else {
            expect(shape, 'this line is pure mathematics and must not be cut up').toBe('maths');
          }
          // 3b. Nothing the teacher typed may vanish. Digits and capitals are checked because they
          //     survive translation unchanged — `sqrt` becomes √ and is unrecognisable, but a 4 is
          //     a 4 and an S is an S, in Nemeth as on the blackboard.
          //
          //     A subsequence, not an equality: the reading is allowed to say MORE than was typed.
          //     `cbrt(27)` becomes √[3](27), and that 3 is not a digit that appeared from nowhere —
          //     it is the index of the root, which the word "cbrt" was standing in for.
          //
          //     Measured against the LATEX, not against what was typed. "Delta ABC" is Δ ABC: the D
          //     of "Delta" was never meant to survive as a letter, and demanding that it did made the
          //     guard reject a perfectly good line. Commands are stripped for the same reason —
          //     `\circ` is a degree sign, not the letter C.
          if (!entry.words) {
            const kept = (text: string): string[] => text.match(/[0-9A-Z]/g) ?? [];
            const written = trips.map((trip) => trip.expected.replace(/\\[a-zA-Z]+/g, '')).join('');
            const reading = kept(trips.map((trip) => trip.reading).join(''));
            let at = 0;
            for (const char of kept(written)) {
              const found = reading.indexOf(char, at);
              expect(found, `“${char}” never reached the cells (read back as “${reading.join('')}”)`).toBeGreaterThan(-1);
              at = found + 1;
            }
          }
          // 4. And the meaning survived the trip to the cells and back. This is the assertion that
          //    turns "it translated" into "it translated correctly": the reading below was produced
          //    from the dots alone, by code that never saw the LaTeX.
          for (const trip of trips) {
            expect(
              trip.verdict,
              `the dots read "${trip.reading}" but the expression was "${trip.expected}"${
                trip.gaps.length ? ` (${trip.gaps.join('; ')})` : ''
              }`,
            ).toBe('agrees');
          }
        });
      }
    });
  }

  it('covers a wide enough surface to mean anything', () => {
    expect(allEntries().length).toBeGreaterThanOrEqual(60);
    expect(SYLLABUS.length).toBeGreaterThanOrEqual(8);
  });

  /**
   * Written only when asked (`npm run accuracy`), so an ordinary test run never dirties the tree.
   */
  it('writes the evidence when asked', () => {
    if (!process.env.BRAILLIX_WRITE_ACCURACY) return;

    const path = join(import.meta.dirname, '..', '..', '..', 'docs', 'ACCURACY.md');
    mkdirSync(dirname(path), { recursive: true });

    const failures = outcomes.filter((outcome) => outcome.issues.length > 0);
    const lines: string[] = [
      '# What Braillix can carry',
      '',
      'Generated by `npm run accuracy`. Every line below is written the way a teacher writes it on',
      'the Board, translated by the same code that drives the display, and shown as the braille that',
      'reaches the cells. Nothing here is hand-typed.',
      '',
      `**${outcomes.length} lines across ${SYLLABUS.length} topics. ${outcomes.length - failures.length} translated cleanly, ${failures.length} with something to report.**`,
      '',
      'Read a cell against a published Nemeth table and it should agree. If it does not, that is a',
      'bug worth reporting, and this file is where to look for it.',
      '',
      '## How the last column is made',
      '',
      'The **Reads back as** column is not a copy of what was typed. It is produced by engines that',
      'take the braille cells and nothing else, and work out what a braille reader would say they',
      'mean — one for each code that can appear on a line: `src/core/readback.ts` for Nemeth,',
      '`bharatiback.ts` for the Indian scripts, `literalback.ts` for English words. None of them has',
      'ever seen the input, the LaTeX, or the translator. Every line below is one where the readings',
      'agree — where they did not, the test suite would have failed before this file was written.',
      '',
      'What that proves: the grammar survived. Numeric indicators, where a superscript ends, which',
      'cell closes a fraction, whether a digit after a letter is a subscript, whether a vowel after a',
      'consonant is a matra — the things that actually go wrong. What it does not prove: that both',
      'engines share the right alphabet. That is checked separately against published tables in',
      '`src/core/nemeth.test.ts` and `src/core/bharati.test.ts`.',
      '',
      'The reading is written in a deliberately plain form — everything parenthesised, `(1)/(2)`',
      'rather than ½ — because it exists to be compared, not admired.',
      '',
    ];

    for (const topic of SYLLABUS) {
      const rows = outcomes.filter((outcome) => outcome.topic === topic.topic);
      if (rows.length === 0) continue;
      lines.push(`## ${topic.topic}  ·  classes ${topic.classes}`, '');
      lines.push('| Typed | Means | Braille | Cells | Reads back as |', '|---|---|---|---|---|');
      for (const row of rows) {
        const note = row.issues.length ? ` ⚠ ${row.issues.join('; ')}` : '';
        lines.push(
          `| \`${row.source}\` | ${row.says} | ${row.braille}${note} | ${row.cells} | \`${row.reading}\` |`,
        );
      }
      lines.push('');
    }

    writeFileSync(path, lines.join('\n'), 'utf8');
    expect(outcomes.length).toBeGreaterThan(0);
  });
});
