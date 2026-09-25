/**
 * The self-check has to be right about itself.
 *
 * It is the one screen a teacher will believe without question — "it said everything was working"
 * — so the two things tested here are the two that would make it a liar: that the braille checks
 * genuinely compare against the published cells, and that nothing it reports as broken is ever
 * reported without a way to fix it (CLAUDE.md Law 3).
 *
 * Under Node there is no `document`, so the network-shaped checks fail. That is the point: a check
 * that cannot run must report that it could not run, with a fix, rather than shrugging.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { runSelfCheck, reportToText, type CheckId } from './selfcheck';
import { initSre } from './sre-service';
import { translate } from '../ui/i18n';

const INPUT = {
  voice: { available: true, name: 'Test Voice' },
  language: 'English',
  usbSupported: true,
};

beforeAll(async () => {
  const status = await initSre();
  expect(status.ok, `speech-rule-engine failed to start: ${status.reason ?? ''}`).toBe(true);
}, 60_000);

describe('the self-check', () => {
  it('checks the braille against the published cells, and passes', async () => {
    const results = await runSelfCheck(INPUT);
    const byId = Object.fromEntries(results.map((result) => [result.id, result]));

    expect(byId.engine.state, 'one half must translate to ⠹⠂⠌⠆⠼').toBe('pass');
    expect(byId.nemeth.state, 'the quadratic must match cell for cell').toBe('pass');
    expect(byId.bharati.state, 'गणित must translate to ⠛⠼⠊⠞').toBe('pass');
    expect(byId.storage.state, 'the shim in test-setup.ts is a working localStorage').toBe('pass');
  });

  it('reports every check exactly once', async () => {
    const results = await runSelfCheck(INPUT);
    const ids = results.map((result) => result.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('offline');
    expect(ids).toContain('recognition');
  });

  it('never reports a problem without a fix', async () => {
    const results = await runSelfCheck(INPUT);
    for (const result of results) {
      if (result.state === 'pass') continue;
      expect(result.fix, `${result.id} says something is wrong and does not say what to do`).toBeTruthy();
    }
  });

  it('says everything in whichever language it is asked for', async () => {
    const results = await runSelfCheck(INPUT);
    for (const result of results) {
      for (const note of [result.detail, result.fix]) {
        if (!note) continue;
        const english = translate(note.key, note.vars, 'en');
        const hindi = translate(note.key, note.vars, 'hi');
        expect(english, `${result.id}: ${note.key} has no English`).not.toBe(note.key);
        expect(hindi, `${result.id}: ${note.key} is not translated`).not.toBe(english);
      }
    }
  });

  it('writes a report somebody can paste into a message', async () => {
    const results = await runSelfCheck(INPUT);
    const names = Object.fromEntries(results.map((result) => [result.id, `name-${result.id}`])) as Record<
      CheckId,
      string
    >;
    const text = reportToText(results, names, (note) => translate(note.key, note.vars, 'en'), '2026-08-20');

    expect(text.split('\n')[0]).toBe('Braillix self-check');
    expect(text).toContain('2026-08-20');
    expect(text).toContain('name-engine');
    expect(text).toContain('⠹⠂⠌⠆⠼'); // the actual braille, not a summary of it
    // A report with an unresolved key in it would be worse than no report.
    expect(text).not.toMatch(/check\.[a-zA-Z]+/);
  });
});
