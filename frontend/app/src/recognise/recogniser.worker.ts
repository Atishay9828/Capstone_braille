/// <reference lib="webworker" />
/**
 * The recognition worker.
 *
 * The model is ~76 MB and inference takes around a second on CPU. Doing that on the main thread
 * would freeze the interface — including the braille display and the speech — every time somebody
 * photographs an equation. So it lives here, and the UI stays responsive whatever the model does.
 *
 * Everything is loaded from `public/`: the ONNX Runtime WebAssembly from `/ort/`, and the model
 * from `/models/formulanet/`. Nothing is fetched from a CDN or a model hub at runtime. That is the
 * difference between "works offline" and "works offline until the first cold start".
 */

/*
 * transformers.js warns "Unable to determine content-length from response headers" for every
 * model file a server ships without that header — chunked or compressed responses, which is
 * most static hosts. It is informational (the buffer grows fine), it fires three times per
 * load, and since the model now warms at app start it would land on every single page view.
 * This project's gates treat a console warning as a defect, so exactly that message is
 * filtered; everything else the library says still comes through.
 */
const nativeWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  if (String(args[0] ?? '').startsWith('Unable to determine content-length')) return;
  nativeWarn(...args);
};

import {
  cat,
  env,
  PreTrainedTokenizer,
  Tensor,
  VisionEncoderDecoderModel,
  type PreTrainedModel,
} from '@huggingface/transformers';
import { TARGET_SIZE } from './preprocess';

const MODEL_DIR = 'formulanet';

export type WorkerRequest =
  | { type: 'load'; modelBase: string; wasmBase: string }
  | { type: 'recognise'; id: number; pixels: Float32Array; maxTokens?: number };

export type WorkerResponse =
  | { type: 'progress'; progress: number; message: string }
  | { type: 'ready' }
  | { type: 'error'; message: string; fatal: boolean; id?: number }
  | { type: 'result'; id: number; latex: string; ms: number };

const post = (message: WorkerResponse) => (self as unknown as Worker).postMessage(message);

/** Load one JSON file, and say which file failed if it does. */
async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url.split('/').pop()} is missing (HTTP ${response.status}) — run \`npm run fetch:model\``);
  }
  return (await response.json()) as Record<string, unknown>;
}

let model: PreTrainedModel | null = null;
let tokenizer: PreTrainedTokenizer | null = null;
let loading: Promise<void> | null = null;

async function load(modelBase: string, wasmBase: string): Promise<void> {
  if (model && tokenizer) return;
  if (loading) return loading;

  loading = (async () => {
    // Hard offline: never reach for a hub, always read from our own public directory.
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = modelBase;

    const wasm = env.backends.onnx.wasm;
    if (wasm) {
      wasm.wasmPaths = wasmBase;
      // One thread, deliberately. Multi-threaded ORT was tried in the v3 window with full
      // cross-origin isolation in place, and its session init hung inside this nested worker —
      // a model that silently fails to start is worse than a slower one (NOTES.md has the
      // trail). The real latency win is elsewhere: the model is warmed at app start, so the
      // teacher's press pays only inference, never the load.
      wasm.numThreads = 1;
    }

    const seen = new Map<string, { loaded: number; total: number }>();

    const loaded = await VisionEncoderDecoderModel.from_pretrained(MODEL_DIR, {
      dtype: 'fp32',
      device: 'wasm',
      progress_callback: (info: unknown) => {
        const event = info as { status?: string; file?: string; loaded?: number; total?: number };
        if (event.status === 'progress' && event.file && event.total) {
          seen.set(event.file, { loaded: event.loaded ?? 0, total: event.total });
          let done = 0;
          let all = 0;
          for (const entry of seen.values()) {
            done += entry.loaded;
            all += entry.total;
          }
          post({
            type: 'progress',
            progress: all > 0 ? done / all : 0,
            message: `Loading the recogniser… ${Math.round((done / Math.max(all, 1)) * 100)}%`,
          });
        }
      },
    });

    // The tokenizer is built explicitly from its two JSON files rather than through
    // `from_pretrained`. That loader resolves paths through several layers of its own and, when a
    // file does not come back, hands the constructor `null` — which surfaces as the useless
    // "Tokenizer must be a valid object" and cost real time to diagnose. Fetching the files
    // ourselves means a missing file says exactly which file is missing.
    const tok = new PreTrainedTokenizer(
      await fetchJson(`${modelBase}${MODEL_DIR}/tokenizer.json`),
      await fetchJson(`${modelBase}${MODEL_DIR}/tokenizer_config.json`),
    );

    model = loaded;
    tokenizer = tok;
    post({ type: 'ready' });
  })();

  try {
    await loading;
  } finally {
    loading = null;
  }
}

async function recognise(id: number, pixels: Float32Array, maxTokens: number): Promise<void> {
  if (!model || !tokenizer) {
    post({ type: 'error', id, message: 'the recogniser is not loaded', fatal: false });
    return;
  }

  const started = Date.now();

  // The model wants three channels; the image is grayscale, so the single channel is repeated.
  const grey = new Tensor('float32', pixels, [1, 1, TARGET_SIZE, TARGET_SIZE]);
  const pixelValues = cat([grey, grey, grey], 1);

  const output = await model.generate({ inputs: pixelValues, max_new_tokens: maxTokens });
  const decoded = tokenizer.batch_decode(output as Parameters<typeof tokenizer.batch_decode>[0], {
    skip_special_tokens: true,
  })[0];

  // The model emits LaTeX spacing hints (\!) that Temml has no use for.
  const latex = (decoded ?? '').replace(/\\!/g, '').trim();

  post({ type: 'result', id, latex, ms: Date.now() - started });
}

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  void (async () => {
    try {
      if (request.type === 'load') {
        await load(request.modelBase, request.wasmBase);
        return;
      }
      if (request.type === 'recognise') {
        await recognise(request.id, request.pixels, request.maxTokens ?? 256);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const missing = /404|Could not locate/i.test(message);
      post({
        type: 'error',
        id: request.type === 'recognise' ? request.id : undefined,
        message: missing ? 'the recognition model is not installed' : message,
        fatal: request.type === 'load',
      });
    }
  })();
});
