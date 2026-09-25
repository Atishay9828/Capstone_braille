/**
 * The on-device recognition provider.
 *
 * Runs entirely in the browser, on this machine, with the network unplugged. Nothing about a
 * student's work leaves the laptop — which is how the brief's unanswered "data sensitivity"
 * question gets resolved in the only way that cannot go wrong: there is nowhere for it to go.
 */

import { LOCAL_MODEL_PATH, ORT_WASM_PATH } from '../config';
import { modelStatus } from './status';
import { latexToMathml } from '../core/translate';
import { tidyLatex } from './tidy';
import { judge, type ProviderStatus, type RecognitionProvider, type RecognitionResult } from './types';
import type { WorkerRequest, WorkerResponse } from './recogniser.worker';

/** How long one image may take before we assume something is wrong. */
const RECOGNISE_TIMEOUT_MS = 45_000;
const LOAD_TIMEOUT_MS = 120_000;

function absolute(path: string): string {
  return new URL(path, document.baseURI).href;
}



export class OnDeviceRecogniser implements RecognitionProvider {
  readonly id = 'on-device' as const;
  readonly label = 'On this device';

  #worker: Worker | null = null;
  #nextId = 1;
  #pending = new Map<number, { resolve: (latex: string, ms: number) => void; reject: (err: Error) => void }>();
  #loaded = false;
  #inkCoverage = 0;

  async probe(): Promise<ProviderStatus> {
    if (typeof Worker === 'undefined') {
      return { state: 'unavailable', reason: 'this browser has no Web Workers' };
    }
    if (!((await modelStatus()).installed)) {
      return {
        state: 'unavailable',
        reason: 'the recognition model is not installed',
        fix: 'Run `npm run fetch:model` once (about 76 MB). After that it works offline forever.',
      };
    }
    return this.#loaded ? { state: 'ready' } : { state: 'loadable' };
  }

  #ensureWorker(): Worker {
    if (this.#worker) return this.#worker;

    const worker = new Worker(new URL('./recogniser.worker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => this.#onMessage(event.data));
    worker.addEventListener('error', (event) => {
      for (const pending of this.#pending.values()) pending.reject(new Error(event.message));
      this.#pending.clear();
    });
    this.#worker = worker;
    return worker;
  }

  #onProgress: ((progress: number, message: string) => void) | null = null;
  #onReady: (() => void) | null = null;
  #onFatal: ((error: Error) => void) | null = null;

  #onMessage(message: WorkerResponse): void {
    switch (message.type) {
      case 'progress':
        this.#onProgress?.(message.progress, message.message);
        break;
      case 'ready':
        this.#loaded = true;
        this.#onReady?.();
        break;
      case 'result': {
        const pending = this.#pending.get(message.id);
        this.#pending.delete(message.id);
        pending?.resolve(message.latex, message.ms);
        break;
      }
      case 'error': {
        if (message.fatal) {
          this.#onFatal?.(new Error(message.message));
          return;
        }
        if (message.id !== undefined) {
          const pending = this.#pending.get(message.id);
          this.#pending.delete(message.id);
          pending?.reject(new Error(message.message));
        }
        break;
      }
    }
  }

  /**
   * One load in flight, ever. The background warm-up (store.bootstrap) and the panel's own
   * load raced here once: each call overwrote the single ready/progress callback slots, so
   * whichever caller lost the race waited for a 'ready' that had already been delivered to
   * the other — and timed out after two minutes with the model sitting there loaded.
   */
  #loading: Promise<void> | null = null;

  async load(onProgress?: (progress: number, message: string) => void): Promise<void> {
    if (this.#loaded) return;
    if (this.#loading) {
      // Join the load already under way; the newest progress reporter wins the badge.
      if (onProgress) this.#onProgress = onProgress;
      return this.#loading;
    }
    this.#loading = this.#doLoad(onProgress).finally(() => {
      this.#loading = null;
    });
    return this.#loading;
  }

  async #doLoad(onProgress?: (progress: number, message: string) => void): Promise<void> {
    const worker = this.#ensureWorker();

    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.#onReady = null;
        this.#onFatal = null;
        reject(new Error('the recogniser took too long to start'));
      }, LOAD_TIMEOUT_MS);

      this.#onProgress = onProgress ?? null;
      this.#onReady = () => {
        window.clearTimeout(timer);
        this.#onProgress = null;
        resolve();
      };
      this.#onFatal = (error) => {
        window.clearTimeout(timer);
        this.#onProgress = null;
        reject(error);
      };

      const request: WorkerRequest = {
        type: 'load',
        modelBase: absolute(LOCAL_MODEL_PATH),
        wasmBase: absolute(ORT_WASM_PATH),
      };
      worker.postMessage(request);
    });
  }

  /** Carried from preprocessing so the quality judgement can mention a distant photo. */
  setInkCoverage(coverage: number): void {
    this.#inkCoverage = coverage;
  }

  async recognise(pixels: Float32Array): Promise<RecognitionResult> {
    if (!this.#loaded) await this.load();
    const worker = this.#ensureWorker();
    const id = this.#nextId++;

    const { latex: raw, ms } = await new Promise<{ latex: string; ms: number }>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error('recognition took too long and was stopped'));
      }, RECOGNISE_TIMEOUT_MS);

      this.#pending.set(id, {
        resolve: (value, took) => {
          window.clearTimeout(timer);
          resolve({ latex: value, ms: took });
        },
        reject: (err) => {
          window.clearTimeout(timer);
          reject(err);
        },
      });

      // The pixel buffer is transferred, not copied — it is 576 kB and we have no further use
      // for it once the worker has it.
      const request: WorkerRequest = { type: 'recognise', id, pixels };
      worker.postMessage(request, [pixels.buffer]);
    });

    // The model emits one token at a time, so its raw output is spaced token by token.
    // Tidying is cosmetic only, and tidy.test.ts proves it never changes the resulting braille.
    const latex = tidyLatex(raw);

    // The strongest available check on the result: can the app's own maths engine read it back?
    const { issue } = latexToMathml(latex);
    const { quality, notes } = judge(latex, { parses: issue === null, inkCoverage: this.#inkCoverage });

    return { latex, quality, notes, ms, provider: this.id };
  }

  dispose(): void {
    this.#worker?.terminate();
    this.#worker = null;
    this.#loaded = false;
    this.#pending.clear();
  }
}
