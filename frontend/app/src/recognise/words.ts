/**
 * Reading the WORDS of a question — the other half of a textbook page.
 *
 * The formula model reads mathematics; this reads the sentence around it, in English and
 * Hindi, with Tesseract compiled to WASM. Everything is served from this origin — worker,
 * core, language files — because a classroom's Wi-Fi is a rumour (Design Law 1), and nothing
 * it reads is trusted: every reading goes to the teacher's eyes and ears before the board
 * (Design Law 2).
 */

import { createWorker, type Worker as TesseractWorker } from 'tesseract.js';

export interface WordsReading {
  readonly text: string;
  /** Tesseract's own 0–100 word confidence, averaged. Below ~80 means "check this". */
  readonly confidence: number;
  readonly ms: number;
}

export interface WordsStatus {
  readonly state: 'ready' | 'loadable' | 'unavailable';
  readonly reason?: string;
  readonly fix?: string;
}

function base(path: string): string {
  return new URL(path, document.baseURI).href;
}

let worker: TesseractWorker | null = null;
let starting: Promise<TesseractWorker> | null = null;

/** The language files are fetched from OUR origin; their absence is a build defect, not a 404. */
export async function wordsStatus(): Promise<WordsStatus> {
  if (worker) return { state: 'ready' };
  try {
    const probe = await fetch(base('tesseract/lang/eng.traineddata.gz'), { method: 'HEAD' });
    const probeHi = await fetch(base('tesseract/lang/hin.traineddata.gz'), { method: 'HEAD' });
    if (!probe.ok || !probeHi.ok) {
      return {
        state: 'unavailable',
        reason: 'the word-reading language files are not installed',
        fix: 'Run `node tools/fetch-tesseract-langs.mjs` once (3 MB). Maths scanning still works.',
      };
    }
    return { state: 'loadable' };
  } catch {
    return { state: 'unavailable', reason: 'the word-reading files could not be checked' };
  }
}

/** The last engine grumbles, kept for anyone debugging — never printed as console errors. */
export const engineNotes: string[] = [];

/**
 * A quiet wrapper worker, built at runtime so the absolute URL of the real worker can be baked
 * in (the wrapper runs from a blob:, where relative URLs mean nothing). The tessdata_fast
 * models trip two known-cosmetic core warnings that the stock worker prints with console.error;
 * this project's gates treat a console error as a defect, so exactly those lines are filtered
 * INSIDE the worker. Everything else still comes through.
 */
function quietWorkerUrl(): string {
  const source = `
const nativeError = console.error.bind(console);
console.error = (...args) => {
  const first = String(args[0] ?? '');
  if (first.startsWith('Warning: Parameter not found:')) return;
  nativeError(...args);
};
importScripts(${JSON.stringify(base('tesseract/worker.min.js'))});
`;
  return URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
}

async function start(): Promise<TesseractWorker> {
  if (worker) return worker;
  starting ??= createWorker(['eng', 'hin'], 1, {
    workerPath: quietWorkerUrl(),
    corePath: base('tesseract/core'),
    langPath: base('tesseract/lang'),
    gzip: true,
    // The tessdata_fast models trip two known-cosmetic core warnings ("Parameter not found:
    // classify_misfit_junk_penalty" / "merge_fragments_in_matrix") that tesseract.js would
    // print with console.error. They are not errors and the console must stay clean (Law 7);
    // real failures still reach the caller as thrown errors from recognize().
    errorHandler: (err: unknown) => {
      engineNotes.push(String(err instanceof Error ? err.message : err));
      if (engineNotes.length > 20) engineNotes.shift();
    },
  }).then((created) => {
    worker = created;
    return created;
  });
  return starting;
}

/**
 * Read the words in an image (a canvas crop of the sentence part of a question).
 * Throws with a plain message on failure — the caller shows it, never swallows it.
 */
export async function readWords(image: HTMLCanvasElement): Promise<WordsReading> {
  const engine = await start();
  const began = performance.now();
  const { data } = await engine.recognize(image);
  const text = data.text
    .replace(/\s+/g, ' ')
    .trim();
  return {
    text,
    confidence: Math.round(data.confidence),
    ms: Math.round(performance.now() - began),
  };
}

/**
 * Warm the engine before it is needed. A teacher mid-lesson must never watch a worker boot;
 * this runs in the background after app start so the first scan pays nothing.
 */
export async function warmWords(): Promise<void> {
  try {
    if ((await wordsStatus()).state === 'unavailable') return;
    await start();
  } catch {
    // Warming is a courtesy; a failure here reports itself on first real use instead.
  }
}

/** Free the worker (tests and teardown). */
export async function disposeWords(): Promise<void> {
  const current = worker;
  worker = null;
  starting = null;
  await current?.terminate();
}
