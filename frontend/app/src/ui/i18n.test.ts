/**
 * The rule from `i18n.ts`, enforced: **no half-translated screen**.
 *
 * A teacher who does not read English will not experience a missing string as "a small gap" — they
 * will experience it as the moment the software stopped talking to them. These tests read the whole
 * source tree, so the failure arrives at build time rather than in a classroom.
 *
 * They also catch the opposite waste: a key nobody uses is a string somebody has to keep
 * translating forever.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LANGS, allKeys, translate, type StringKey } from './i18n';

const SRC = join(import.meta.dirname, '..');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const FILES = sourceFiles(SRC).map((file) => ({
  path: relative(SRC, file).split(sep).join('/'),
  text: readFileSync(file, 'utf8'),
}));

/**
 * Two different questions need two different scans.
 *
 * MENTIONED: any `'a.b'`-shaped literal anywhere — keys reach the interface as props and as table
 * values (`hint={'prac.hintRead'}`, `sre: 'cap.sre'`), not only through a call. Good enough to
 * answer "is this key used at all?".
 *
 * CALLED: only what is passed directly to `t(…)` or `translate(…)`. Every one of those MUST exist,
 * and this is the scan that has to be precise — an earlier version keyed off the namespace, which
 * meant that when a whole namespace was missing (`rec.*`), every key in it was excused. That
 * shipped a screen showing `rec.image` on the page, and the suite stayed green.
 */
const MENTIONED = new Set<string>();
const CALLED = new Set<string>();
for (const file of FILES) {
  if (file.path === 'ui/i18n.ts') continue;
  for (const match of file.text.matchAll(/['"]([a-z]+\.[A-Za-z0-9.]+)['"]/g)) MENTIONED.add(match[1]);
  for (const match of file.text.matchAll(/\b(?:t|translate)\(\s*'([a-z]+\.[A-Za-z0-9.]+)'/g)) CALLED.add(match[1]);
}

const KEYS = allKeys();

/** Words that are genuinely the same in both languages — mostly symbols and borrowed names. */
const SAME_IN_BOTH = new Set<StringKey>(['evidence.col.index']);

describe('every string exists in every language', () => {
  it('has keys at all (guards against this suite passing on an empty table)', () => {
    expect(KEYS.length).toBeGreaterThan(50);
  });

  for (const language of LANGS) {
    it(`has a non-empty ${language.english} string for every key`, () => {
      const missing = KEYS.filter((key) => !translate(key, undefined, language.id).trim());
      expect(missing, `missing ${language.english}`).toEqual([]);
    });
  }

  it('actually translates — no key left as its English self', () => {
    const untranslated = KEYS.filter(
      (key) => !SAME_IN_BOTH.has(key) && translate(key, undefined, 'hi') === translate(key, undefined, 'en'),
    );
    expect(untranslated, 'these are still in English under Hindi').toEqual([]);
  });

  it('has no Latin letters left inside a Hindi string, except in names and code', () => {
    // Braillix, Nemeth, LaTeX, npm commands, maths examples and single-letter variables (a, b, x)
    // stay as they are — everything else in a Hindi string written in the Latin alphabet is an
    // untranslated fragment.
    // Key caps — Enter, PageUp, PageDown — are printed on the keyboard in Latin whatever the
    // interface language; a Hindi string telling a teacher which key to press must name the key.
    const names = /Braillix|Nemeth|LaTeX|SRE|npm (install|run [a-z:]+)|npm|USB|Wi-Fi|BRF|CSV|JSON|API|Chrome|Edge|Windows|KB|MB|sqrt|degrees|Prev|Select|Next|Enter|PageUp|PageDown|\bms\b/g;
    // A token carrying a dot, slash or colon is a path, a command or an address — docs/PROTOCOL.md,
    // 127.0.0.1:8080 — and translating those would break them.
    const code = /[A-Za-z][\w.\-/]*[./:][\w.\-/:]*/g;
    const offenders = KEYS.filter((key) =>
      /[A-Za-z]/.test(
        translate(key, undefined, 'hi')
          .replace(/\{\w+\}/g, '') // `{count}` and friends are placeholders, not words
          // Names first: `code` would otherwise eat "fetch:model" out of "npm run fetch:model"
          // and leave a bare "run" behind, which is not a word anybody has to translate.
          .replace(names, '')
          .replace(code, '')
          .replace(/\b[a-zA-Z]\b/g, ''), // single letters are maths variables
      ),
    );
    expect(offenders).toEqual([]);
  });

  it('keeps the same placeholders in both languages', () => {
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    for (const key of KEYS) {
      expect(placeholders(translate(key, undefined, 'hi')), `placeholders differ in ${key}`).toEqual(
        placeholders(translate(key, undefined, 'en')),
      );
    }
  });

  it('substitutes placeholders in both languages', () => {
    expect(translate('say.cells', { count: 7 }, 'en')).toContain('7');
    expect(translate('say.cells', { count: 7 }, 'hi')).toContain('7');
    expect(translate('say.cells', { count: 7 }, 'hi')).not.toContain('{count}');
  });
});

describe('the table and the interface agree', () => {
  it('finds the calls at all (guards against this check passing on an empty scan)', () => {
    expect(CALLED.size).toBeGreaterThan(50);
  });

  it('has no key asked for by the interface that is missing from the table', () => {
    const known = new Set<string>(KEYS);
    const missing = [...CALLED].filter((key) => !known.has(key));
    expect(missing, 'the screen would show the key itself instead of a sentence').toEqual([]);
  });

  it('has no key in the table that nothing uses', () => {
    const unused = KEYS.filter((key) => !MENTIONED.has(key));
    expect(unused, 'translated but never shown — delete them').toEqual([]);
  });
});
