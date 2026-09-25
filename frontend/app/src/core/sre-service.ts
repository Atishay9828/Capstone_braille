/**
 * The single owner of speech-rule-engine's engine state.
 *
 * Two things make this file necessary:
 *
 * 1. SRE keeps its configuration in a GLOBAL. `setupEngine({modality:'braille'})` changes what the
 *    next `toSpeech()` call returns. Two concurrent callers — one wanting Nemeth, one wanting
 *    spoken English — will silently swap results. So every call goes through one promise chain
 *    here, and nothing else in the app may call `setupEngine`. (CLAUDE.md Law 5.)
 *
 * 2. In a browser SRE defaults to fetching its locale data from a jsDelivr CDN. Braillix has to
 *    work with the Wi-Fi unplugged, so we point it at `/sre/mathmaps/`, which `postinstall`
 *    copies out of node_modules. (CLAUDE.md — the design law.)
 */

import sre from 'speech-rule-engine';

/**
 * Where to load locale data from.
 *
 * In a browser: `/sre/mathmaps/`, which postinstall copied out of node_modules — never the CDN.
 * Under Node (unit tests): `undefined`, so SRE uses its own filesystem lookup inside node_modules.
 */
function mathmapsPath(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return new URL('sre/mathmaps/', document.baseURI).href;
}

export type SpeechLocale = 'en' | 'hi';

/** Which engine configuration is currently loaded. SRE can only be in one at a time. */
type EngineMode =
  | { kind: 'braille' }
  | { kind: 'speech'; locale: SpeechLocale };

function modeKey(mode: EngineMode): string {
  return mode.kind === 'braille' ? 'braille' : `speech:${mode.locale}`;
}

/**
 * SRE's typings do not describe the subset we use, and they differ between the CJS and ESM builds.
 * This is the contract we actually depend on, asserted in one place.
 */
interface SreApi {
  setupEngine(features: Record<string, unknown>): Promise<void>;
  engineReady(): Promise<unknown>;
  toSpeech(mathml: string): string;
  toEnriched(mathml: string): unknown;
  toJson(mathml: string): unknown;
  version?: string;
}

const api = sre as unknown as SreApi;

let queue: Promise<unknown> = Promise.resolve();
let currentMode: string | null = null;
let failure: string | null = null;

/** Serialise every SRE interaction. Returns the task's value; never lets the chain break. */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  // Keep the chain alive even if this task rejects, so one bad expression can't wedge the engine.
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function applyMode(mode: EngineMode): Promise<void> {
  const key = modeKey(mode);
  if (currentMode === key) return;

  const features: Record<string, unknown> =
    mode.kind === 'braille'
      ? { locale: 'nemeth', modality: 'braille', domain: 'default', style: 'default' }
      : { locale: mode.locale, modality: 'speech', domain: 'mathspeak', style: 'default' };

  const json = mathmapsPath();
  await api.setupEngine(json ? { json, ...features } : features);
  await api.engineReady();
  currentMode = key;
}

/**
 * Warm the engine up. Called once at startup so the first user keystroke isn't the thing that pays
 * for loading ~1.2 MB of locale data. Resolves to whether the engine is usable.
 */
export function initSre(): Promise<{ ok: boolean; reason?: string; version?: string }> {
  return enqueue(async () => {
    try {
      await applyMode({ kind: 'braille' });
      failure = null;
      return { ok: true, version: api.version };
    } catch (err) {
      failure = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: failure };
    }
  });
}

/** MathML -> a Unicode-braille string in Nemeth. */
export function toNemeth(mathml: string): Promise<string> {
  return enqueue(async () => {
    await applyMode({ kind: 'braille' });
    return api.toSpeech(mathml);
  });
}

/** MathML -> a spoken description, in English or Hindi. */
export function toSpeechText(mathml: string, locale: SpeechLocale): Promise<string> {
  return enqueue(async () => {
    await applyMode({ kind: 'speech', locale });
    return api.toSpeech(mathml);
  });
}

/**
 * MathML -> MathML annotated with `data-semantic-*` attributes.
 *
 * This is the raw material for the Reader: it carries stable node ids and the parent/child
 * structure of the expression, which is what lets a reader walk a fraction instead of scrolling
 * through its characters.
 */
export function toEnrichedMathml(mathml: string): Promise<string> {
  return enqueue(async () => {
    // Enrichment is modality-independent, but SRE still needs *a* loaded configuration.
    await applyMode({ kind: 'braille' });
    return stringifyEnriched(api.toEnriched(mathml));
  });
}

/**
 * SRE returns different things from `toEnriched` depending on where it is running: a string under
 * Node, but a live DOM element in a browser. A naive `String(value)` turns the browser case into
 * the literal text "[object Element]", which silently disables structural navigation — exactly
 * the kind of failure that passes every unit test and then breaks in front of an audience.
 */
export function stringifyEnriched(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';

  const element = value as { outerHTML?: string; nodeType?: number };
  if (typeof element.outerHTML === 'string') return element.outerHTML;

  if (typeof element.nodeType === 'number' && typeof XMLSerializer !== 'undefined') {
    try {
      return new XMLSerializer().serializeToString(value as Node);
    } catch {
      /* fall through to the string coercion below */
    }
  }

  const text = String(value);
  return text.startsWith('<') ? text : '';
}
