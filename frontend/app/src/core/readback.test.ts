/**
 * Can the dots be read back?
 *
 * Two kinds of test here, and the second matters more than the first.
 *
 * The first kind checks the reading against Nemeth by hand: braille written out from the published
 * code, and what it says. Ordinary correctness.
 *
 * The second kind attacks the check itself. A round-trip that always agrees proves nothing — it
 * could be a function that returns whatever it was given. So these tests break the braille on
 * purpose, one cell at a time, in the exact ways Nemeth goes wrong in practice: a missing baseline
 * indicator, a superscript written as a subscript, a numeric indicator dropped after a letter, a
 * fraction left open. Every one of them must produce a *different* reading. A guard has two failure
 * modes — accepting the false and rejecting the true — and both are tested here, on the day it
 * ships (CLAUDE.md Law 7, and the two-sided-honesty rule in ARCHITECTURE.md).
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readBack, readBackUnicode } from './readback';
import { dotsToMask } from './braille';

const read = (braille: string) => readBackUnicode(braille).text;

describe('reading Nemeth back as ordinary maths', () => {
  it('reads numbers, with the dropped digits Nemeth uses', () => {
    expect(read('⠼⠶')).toBe('7');
    expect(read('⠼⠂⠴⠴')).toBe('100');
    expect(read('⠼⠒⠨⠂⠲')).toBe('3.14');
    // A lakh, grouped the Indian way. The comma inside a number is dot 6.
    expect(read('⠼⠂⠠⠴⠴⠠⠴⠴⠴')).toBe('1,00,000');
  });

  it('reads the four operations and a comparison', () => {
    expect(read('⠼⠆⠬⠒⠀⠨⠅⠀⠼⠢')).toBe('2+3=5');
    expect(read('⠼⠔⠤⠲⠀⠨⠅⠀⠼⠢')).toBe('9-4=5');
    expect(read('⠼⠒⠈⠡⠲')).toBe('3×4');
    expect(read('⠼⠂⠆⠨⠌⠲')).toBe('12÷4');
  });

  it('reads a fraction, and a fraction inside a fraction', () => {
    expect(read('⠹⠂⠌⠆⠼')).toBe('(1)/(2)');
    // The outer fraction of a compound one takes the ⠠ prefix on all three of its cells.
    expect(read('⠠⠹⠹⠒⠌⠲⠼⠈⠡⠆⠠⠌⠢⠠⠼')).toBe('((3)/(4)×2)/(5)');
  });

  it('reads fractions nested as deep as they go', () => {
    // One ⠠ per level of nesting. `1/2/3/4/5` reaches three, and the reader used to know only one —
    // it read the expression correctly by luck and reported nine cells it had no rule for.
    const deep = '⠠⠠⠠⠹⠠⠠⠹⠠⠹⠹⠂⠌⠆⠼⠠⠌⠒⠠⠼⠠⠠⠌⠲⠠⠠⠼⠠⠠⠠⠌⠢⠠⠠⠠⠼';
    expect(read(deep)).toBe('((((1)/(2))/(3))/(4))/(5)');
    expect(readBackUnicode(deep).unknown).toEqual([]);
  });

  it('reads a radical, with and without an index', () => {
    expect(read('⠜⠔⠻')).toBe('√(9)');
    expect(read('⠣⠒⠜⠆⠶⠻')).toBe('√[3](27)');
    expect(read('⠜⠭⠘⠆⠐⠬⠽⠘⠆⠐⠻')).toBe('√(x^(2)+y^(2))');
  });

  it('reads levels, and knows a space ends a superscript', () => {
    expect(read('⠭⠘⠆⠐⠬⠒⠭')).toBe('x^(2)+3x');
    // No baseline indicator before the space — Nemeth does not need one, and neither does this.
    expect(read('⠷⠁⠬⠃⠾⠘⠆⠀⠨⠅⠀⠁⠘⠆')).toBe('(a+b)^(2)=a^(2)');
    // Below then above on the same symbol: a single indicator is a level, not a nesting.
    expect(read('⠮⠰⠴⠘⠂⠐⠭⠘⠆⠐')).toBe('∫_(0)^(1)x^(2)');
  });

  it('knows a digit straight after a letter is a subscript', () => {
    expect(read('⠭⠂⠬⠭⠆')).toBe('x_(1)+x_(2)');
    expect(read('⠇⠕⠛⠂⠴⠀⠼⠂⠴⠴')).toBe('log_(10)100');
  });

  it('reads capitals, Greek letters and the shapes', () => {
    expect(read('⠠⠁⠨⠬⠠⠃')).toBe('A∪B');
    expect(read('⠨⠏⠗⠘⠆')).toBe('πr^(2)');
    expect(read('⠫⠪⠀⠠⠁⠠⠃⠠⠉')).toBe('∠ABC');
    expect(read('⠫⠞⠀⠠⠁⠠⠃⠠⠉')).toBe('△ABC');
    expect(read('⠠⠿')).toBe('∞');
  });

  it('tells a decimal point from a greater-than, which are the same two cells', () => {
    expect(read('⠼⠒⠨⠂⠲')).toBe('3.14'); // inside a number
    expect(read('⠁⠀⠨⠂⠀⠃')).toBe('a>b'); // standing alone
    expect(read('⠭⠀⠨⠂⠱⠀⠼⠢')).toBe('x≥5'); // and with a line under it
  });

  it('reads through the switch indicators Braillix writes around maths in a sentence', () => {
    expect(read('⠸⠩⠀⠼⠆⠭⠬⠢⠀⠨⠅⠀⠼⠂⠢⠀⠸⠱')).toBe('2x+5=15');
  });

  it('reads the cells that are physically on the display, not just a string', () => {
    const cells = [dotsToMask([3, 4, 5, 6]), dotsToMask([2]), dotsToMask([3, 4, 6]), dotsToMask([2, 3])];
    expect(readBack(cells).text).toBe('1+2');
  });
});

describe('the symbols a senior class needs', () => {
  /*
   * Every cell here was taken from what speech-rule-engine actually emits, not from a table
   * somebody remembered — a sweep printed the braille for every symbol the printer knows, and each
   * one it could not read back came here as a rule. Two of them are the reason this block exists:
   *
   *   ⠰⠆ is "is proportional to" AND the subscript indicator followed by a 2. A subscript never
   *   follows a space, so the space is what tells them apart — exactly as it does for a reader.
   *
   *   ⠈⠱⠈⠱ is "approximately equal to". It used to read as two bars and say nothing, because a
   *   lone ⠈ was being silently swallowed. Silence was the bug; the wrong reading was the symptom.
   */
  it('reads the set and comparison signs', () => {
    expect(read('⠁⠀⠸⠐⠅⠀⠠⠃')).toBe('a⊂B');
    expect(read('⠸⠐⠅⠱')).toBe('⊆');
    expect(read('⠌⠈⠑')).toBe('∉');
    expect(read('⠭⠀⠈⠱⠈⠱⠀⠼⠂⠨⠲')).toBe('x≈1.4');
    expect(read('⠁⠀⠸⠇⠀⠃')).toBe('a≡b');
  });

  it('reads "proportional to" without mistaking it for a subscript', () => {
    expect(read('⠭⠀⠰⠆⠀⠽')).toBe('x∝y');
    // The same two cells, attached to a letter instead of standing alone: a subscript.
    expect(read('⠭⠰⠆')).toBe('x_(2)');
  });

  it('reads the reasoning signs and the shapes', () => {
    expect(read('⠠⠡')).toBe('∴');
    expect(read('⠈⠌')).toBe('∵');
    expect(read('⠫⠏')).toBe('⊥');
  });

  it('reads a bar over a letter, and over a whole run', () => {
    expect(read('⠭⠱')).toBe('x‾');
    expect(read('⠐⠠⠁⠠⠃⠣⠱⠻')).toBe('AB‾');
  });

  it('reads a factorial, a raised dot, and the punctuation colon', () => {
    expect(read('⠭⠯')).toBe('x!');
    expect(read('⠡')).toBe('·');
    expect(read('⠭⠸⠒⠽')).toBe('x:y');
    // ...which is a different cell from the ratio colon, and must stay different.
    expect(read('⠼⠆⠀⠐⠂⠀⠼⠒')).toBe('2:3');
  });

  it('reads a comma at the baseline, not up in the superscript', () => {
    // `30°, 60°` puts the comma straight after the degree sign with no baseline indicator, because
    // Nemeth does not need one — a comma is never part of a superscript. The reader used to leave it
    // up there, so a list of angles came back as 30^(°,)60^(°).
    expect(read('⠼⠒⠴⠘⠨⠡⠠⠖⠴⠘⠨⠡')).toBe('30^(°),60^(°)');
  });

  it('reads a capital Greek letter from the same cells as the small one', () => {
    expect(read('⠨⠠⠙')).toBe('Δ');
    expect(read('⠨⠙')).toBe('δ');
    expect(read('⠨⠠⠺')).toBe('Ω');
    expect(read('⠨⠠⠏')).toBe('Π');
  });

  it('reads a binomial coefficient, whose lower term has no terminator of its own', () => {
    expect(read('⠷⠝⠩⠅⠾')).toBe('(n_(k))');
  });
});

describe('the check has teeth — every one of these must read differently', () => {
  const good = '⠭⠘⠆⠐⠬⠒⠭⠬⠆⠀⠨⠅⠀⠼⠴'; // x^2 + 3x + 2 = 0

  it('notices a missing baseline indicator', () => {
    // Without the ⠐ the superscript swallows the rest of the equation — which is exactly what a
    // braille reader's finger would do, and exactly the bug that must not pass silently.
    const broken = good.replace('⠐', '');
    expect(read(broken)).not.toBe(read(good));
    expect(read(broken)).toBe('x^(2+3x+2)=0');
  });

  it('notices a superscript written as a subscript', () => {
    expect(read('⠭⠰⠆')).toBe('x_(2)');
    expect(read('⠭⠘⠆')).toBe('x^(2)');
  });

  it('notices a numeric indicator dropped after a letter', () => {
    // ⠭⠼⠆ is "x times 2"; ⠭⠆ is "x sub 2". One cell, two different pieces of mathematics.
    expect(read('⠭⠼⠆')).toBe('x2');
    expect(read('⠭⠆')).toBe('x_(2)');
  });

  it('notices a fraction left open, and says so instead of guessing', () => {
    // The reading is still legible — a half-read expression is more use than a blank — but the gap
    // is reported, and a reported gap makes the verdict "unchecked" rather than "agrees".
    const result = readBackUnicode('⠹⠂⠌⠆');
    expect(result.unknown).toContain('unclosed fraction');
    expect(result.text).toBe('(1)/(2)');
  });

  it('notices a radical left open', () => {
    expect(readBackUnicode('⠜⠔').unknown).toContain('unclosed group');
  });

  it('notices a wrong digit', () => {
    expect(read('⠼⠆⠬⠒')).not.toBe(read('⠼⠆⠬⠲'));
  });

  it('notices a fraction opened at one level and closed at another', () => {
    // Nemeth marks the OUTER fraction of a compound one with ⠠ on all three of its cells. Opening
    // with ⠠⠹ and closing with a plain ⠼ is not a style slip — it leaves the fraction unclosed.
    const mixed = readBackUnicode('⠠⠹⠹⠒⠌⠲⠼⠈⠡⠆⠌⠢⠼');
    expect(mixed.unknown.length).toBeGreaterThan(0);
  });

  it('reports a cell it has no rule for rather than dropping it', () => {
    const result = readBackUnicode('⠭⢿⠆');
    expect(result.unknown.length).toBeGreaterThan(0);
  });
});

describe('every cell in the tables is a six-dot cell', () => {
  /*
   * Unicode has 256 braille patterns, and only the first 64 are six-dot. The other 192 carry dots 7
   * and 8, which belong to computer braille and cannot appear on any display Braillix drives.
   *
   * This is here because the same typo was made twice while adding symbols: \u28c8 and \u2888 were
   * written where ⠸ and ⠈ belonged — a braille character is 0x2800 plus the DOT MASK, and a mask of
   * 56 is 0x2838, not 0x28c8. The rules looked right, matched nothing, and the symbols they were
   * meant to read went on being reported as gaps. A table that cannot be typed wrongly is worth
   * more than one that is merely correct today.
   */
  it('has no eight-dot cell anywhere in the reader', () => {
    const source = readFileSync(new URL('./readback.ts', import.meta.url), 'utf8');
    const wrong = [...source].filter((char) => {
      const code = char.codePointAt(0)!;
      return code > 0x283f && code <= 0x28ff;
    });
    expect(wrong.map((char) => char.codePointAt(0)!.toString(16))).toEqual([]);
  });

  it('and none in the Bharati or Grade-1 readers either', () => {
    for (const file of ['./bharatiback.ts', './literalback.ts']) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8');
      const wrong = [...source].filter((char) => {
        const code = char.codePointAt(0)!;
        return code > 0x283f && code <= 0x28ff;
      });
      expect(wrong.map((char) => char.codePointAt(0)!.toString(16)), file).toEqual([]);
    }
  });
});

describe('it never falls over', () => {
  it('survives nonsense, emptiness and repetition', () => {
    for (const text of ['', '⠀⠀⠀', '⠼⠼⠼⠼', '⠻⠻⠻', '⠐⠐⠐', '⠹'.repeat(200), '⠨', '⠠', '⠣']) {
      expect(() => readBackUnicode(text), text).not.toThrow();
    }
  });

  it('always terminates, whatever it is given', () => {
    // Every branch of the reader must consume at least one cell. A rule that consumed none would
    // hang the interface rather than fail it, which is the worst failure available to us.
    const cells = Array.from({ length: 64 }, (_, mask) => String.fromCodePoint(0x2800 + mask)).join('');
    expect(() => readBackUnicode(cells + cells)).not.toThrow();
  });
});
