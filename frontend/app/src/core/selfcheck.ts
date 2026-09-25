/**
 * "Is everything working on this laptop?"
 *
 * A teacher cannot be expected to read a status strip and infer whether the thing will hold up in
 * front of a class. So this is one button that goes and *finds out* — by doing the work, not by
 * reading a flag. The maths engine check translates a real expression and compares it with a known
 * answer; the offline check actually fetches the locale file; the storage check actually writes.
 *
 * Every check reports the same three things: what it is, what happened, and what to do about it if
 * it is not right. That is CLAUDE.md Law 3 as a screen rather than as a badge.
 *
 * Like `learn/feedback.ts`, it returns **keys and values, not sentences** — a teacher reading this
 * screen in Hindi is exactly the teacher who most needs to understand it, and a module that builds
 * English prose could not give them that.
 */

import { translateLatex, cellsToUnicode } from './translate';
import { toLatex } from './mathinput';
import { devanagariToBraille } from './bharati';
import { checkRoundTrip } from './roundtrip';
import { unicodeStringToMasks } from './braille';
import { modelStatus } from '../recognise/status';
import type { StringKey } from '../ui/i18n';

export type CheckState = 'pass' | 'warn' | 'fail';

export type CheckId =
  | 'engine'
  | 'nemeth'
  | 'readback'
  | 'bharati'
  | 'offline'
  | 'storage'
  | 'recognition'
  | 'speech'
  | 'usb';

/** One thing to say, as a key and its values. The interface turns it into a sentence. */
export interface CheckNote {
  readonly key: StringKey;
  readonly vars?: Record<string, string | number>;
}

export interface CheckResult {
  readonly id: CheckId;
  readonly state: CheckState;
  /** What actually happened. */
  readonly detail: CheckNote;
  /** Only when the state is not 'pass'. */
  readonly fix?: CheckNote;
}

/**
 * A known answer, so the engine check is a *check* and not a shrug.
 *
 * `1/2` in Nemeth is: open fraction ⠹, dropped 1 ⠂, fraction line ⠌, dropped 2 ⠆, close ⠼. It is in
 * docs/ACCURACY.md, it is in the published table, and it is five cells that a braille reader can
 * verify with their fingers.
 */
const KNOWN_FRACTION = '⠹⠂⠌⠆⠼';
/** A quadratic: a superscript, the return to the baseline, and the two-cell equals with its spaces. */
const KNOWN_QUADRATIC = '⠭⠘⠆⠐⠬⠒⠭⠬⠆⠀⠨⠅⠀⠼⠴';
/** ⠛⠼⠊⠞ — "gaṇit", the word mathematics, in Bharati Braille. */
const KNOWN_HINDI = '⠛⠼⠊⠞';

async function checkEngine(): Promise<CheckResult> {
  try {
    const result = await translateLatex(toLatex('1/2').latex);
    const braille = cellsToUnicode(result.cells);
    if (result.degraded === 'literal') {
      return {
        id: 'engine',
        state: 'fail',
        detail: { key: 'check.engineDead' },
        fix: { key: 'check.engineDeadFix' },
      };
    }
    if (braille !== KNOWN_FRACTION) {
      return {
        id: 'engine',
        state: 'fail',
        detail: { key: 'check.engineWrong', vars: { got: braille || '—', want: KNOWN_FRACTION } },
        fix: { key: 'check.dontUse' },
      };
    }
    return { id: 'engine', state: 'pass', detail: { key: 'check.engineOk', vars: { braille } } };
  } catch {
    return { id: 'engine', state: 'fail', detail: { key: 'check.engineDead' }, fix: { key: 'check.engineDeadFix' } };
  }
}

async function checkNemeth(): Promise<CheckResult> {
  const result = await translateLatex(toLatex('x^2 + 3x + 2 = 0').latex);
  const braille = cellsToUnicode(result.cells);
  return braille === KNOWN_QUADRATIC
    ? { id: 'nemeth', state: 'pass', detail: { key: 'check.nemethOk', vars: { count: braille.length } } }
    : {
        id: 'nemeth',
        state: 'fail',
        detail: { key: 'check.nemethWrong', vars: { got: braille || '—', want: KNOWN_QUADRATIC } },
        fix: { key: 'check.dontUse' },
      };
}

/**
 * Does the round-trip check work on THIS machine, and does it still have teeth?
 *
 * Two halves, and the second is the one that matters. Confirming that correct braille reads back
 * correctly is easy; a checker that had quietly degraded into a function returning "agrees" would
 * pass that half every time. So this also hands it braille it KNOWS is broken — the same quadratic
 * with its baseline indicator taken out, which makes the superscript swallow the rest of the
 * equation — and requires the answer "differs". A check that cannot fail is not a check.
 */
async function checkReadback(): Promise<CheckResult> {
  const latex = toLatex('x^2 + 3x + 2 = 0').latex;
  const result = await translateLatex(latex);
  const good = checkRoundTrip(latex, result.cells);
  if (good.verdict !== 'agrees') {
    return {
      id: 'readback',
      state: 'fail',
      detail: { key: 'check.readbackWrong', vars: { got: good.reading || '—', want: good.expected } },
      fix: { key: 'check.dontUse' },
    };
  }

  const broken = checkRoundTrip(latex, unicodeStringToMasks(KNOWN_QUADRATIC.replace('⠐', '')).cells);
  if (broken.verdict === 'agrees') {
    return {
      id: 'readback',
      state: 'fail',
      detail: { key: 'check.readbackBlunt' },
      fix: { key: 'check.dontUse' },
    };
  }

  return { id: 'readback', state: 'pass', detail: { key: 'check.readbackOk', vars: { reading: good.reading } } };
}

function checkBharati(): CheckResult {
  const braille = devanagariToBraille('गणित').cells.map((mask) => String.fromCodePoint(0x2800 + mask)).join('');
  return braille === KNOWN_HINDI
    ? { id: 'bharati', state: 'pass', detail: { key: 'check.bharatiOk', vars: { braille } } }
    : {
        id: 'bharati',
        state: 'fail',
        detail: { key: 'check.bharatiWrong', vars: { got: braille || '—', want: KNOWN_HINDI } },
        fix: { key: 'check.dontUse' },
      };
}

/**
 * Is the maths engine's locale data being served from this machine?
 *
 * This is the check that matters most in a school hall: if these files are missing, the engine
 * quietly reaches for a CDN, and the first time anybody notices is when the Wi-Fi is down.
 */
async function checkOffline(): Promise<CheckResult> {
  try {
    const url = new URL('sre/mathmaps/nemeth.json', document.baseURI).href;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const size = (await response.text()).length;
    return { id: 'offline', state: 'pass', detail: { key: 'check.offlineOk', vars: { size: Math.round(size / 1024) } } };
  } catch (error) {
    return {
      id: 'offline',
      state: 'fail',
      detail: {
        key: 'check.offlineBad',
        vars: { reason: error instanceof Error ? error.message : String(error) },
      },
      fix: { key: 'check.offlineFix' },
    };
  }
}

function checkStorage(): CheckResult {
  try {
    const key = 'braillix.selfcheck';
    localStorage.setItem(key, '1');
    const read = localStorage.getItem(key);
    localStorage.removeItem(key);
    if (read !== '1') throw new Error('the value did not come back');
    return { id: 'storage', state: 'pass', detail: { key: 'check.storageOk' } };
  } catch {
    return { id: 'storage', state: 'warn', detail: { key: 'check.storageBad' }, fix: { key: 'check.storageFix' } };
  }
}

async function checkRecognition(): Promise<CheckResult> {
  const model = await modelStatus();
  return model.installed
    ? { id: 'recognition', state: 'pass', detail: { key: 'check.recognitionOk' } }
    : {
        id: 'recognition',
        state: 'warn',
        detail: { key: 'check.recognitionMissing' },
        fix: { key: 'check.recognitionFix' },
      };
}

function checkSpeech(voice: { available: boolean; name?: string }, language: string): CheckResult {
  return voice.available
    ? {
        id: 'speech',
        state: 'pass',
        detail: { key: 'check.speechOk', vars: { language, voice: voice.name ?? '' } },
      }
    : {
        id: 'speech',
        state: 'warn',
        detail: { key: 'check.speechMissing', vars: { language } },
        fix: { key: 'check.speechFix' },
      };
}

function checkUsb(supported: boolean): CheckResult {
  return supported
    ? { id: 'usb', state: 'pass', detail: { key: 'check.usbOk' } }
    : { id: 'usb', state: 'warn', detail: { key: 'check.usbMissing' }, fix: { key: 'check.usbFix' } };
}

export interface SelfCheckInput {
  readonly voice: { available: boolean; name?: string };
  /** Already in the interface's own language — the caller knows it, this module does not. */
  readonly language: string;
  readonly usbSupported: boolean;
}

/** Run everything. Never throws: a check that cannot run reports that it could not run. */
export async function runSelfCheck(input: SelfCheckInput): Promise<CheckResult[]> {
  const [engine, nemeth, readback, offline, recognition] = await Promise.all([
    checkEngine(),
    checkNemeth(),
    checkReadback(),
    checkOffline(),
    checkRecognition(),
  ]);
  return [
    engine,
    nemeth,
    readback,
    checkBharati(),
    offline,
    checkStorage(),
    recognition,
    checkSpeech(input.voice, input.language),
    checkUsb(input.usbSupported),
  ];
}

/**
 * The whole report as plain text, for pasting into a message to whoever helps this school.
 *
 * The caller supplies the words, because it is the only one that knows which language the teacher
 * is reading in — and a report they cannot read is a report they cannot send.
 */
export function reportToText(
  results: readonly CheckResult[],
  names: Record<CheckId, string>,
  say: (note: CheckNote) => string,
  now: string,
): string {
  const lines = ['Braillix self-check', now, ''];
  for (const result of results) {
    lines.push(`[${result.state.toUpperCase()}] ${names[result.id]}: ${say(result.detail)}`);
    if (result.fix) lines.push(`        fix: ${say(result.fix)}`);
  }
  return lines.join('\n');
}
