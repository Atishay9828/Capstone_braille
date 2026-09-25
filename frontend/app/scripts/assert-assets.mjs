/**
 * The build refuses to ship blind.
 *
 * v1 died exactly here: the recognition model was gitignored, the deploy never fetched it, and
 * the founder met a dead button in front of his team. This script makes that failure a BUILD
 * ERROR instead of a runtime surprise: if the artifact does not carry every on-device asset the
 * app's buttons promise, there is no artifact.
 *
 * Runs as part of `npm run build`, after vite. No flags, no soft mode.
 */

import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

const REQUIRED = [
  // The formula model — the "Photograph it" button's entire substance.
  { path: 'models/formulanet/onnx/encoder_model.onnx', minBytes: 10_000_000 },
  { path: 'models/formulanet/onnx/decoder_model_merged.onnx', minBytes: 5_000_000 },
  { path: 'models/formulanet/tokenizer.json', minBytes: 1_000 },
  // The ONNX runtime the model runs on — useless apart, dead button together-less.
  { path: 'ort/ort-wasm-simd-threaded.wasm', minBytes: 5_000_000 },
  { path: 'ort/ort-wasm-simd-threaded.mjs', minBytes: 10_000 },
  // Word reading for full questions — English and Hindi.
  { path: 'tesseract/worker.min.js', minBytes: 10_000 },
  { path: 'tesseract/core/tesseract-core-simd-lstm.wasm', minBytes: 1_000_000 },
  { path: 'tesseract/lang/eng.traineddata.gz', minBytes: 500_000 },
  { path: 'tesseract/lang/hin.traineddata.gz', minBytes: 300_000 },
  // The maths engine's own tables — no SRE mathmaps, no Nemeth.
  { path: 'sre/mathmaps/en.json', minBytes: 10_000 },
  { path: 'sre/mathmaps/hi.json', minBytes: 10_000 },
];

const missing = [];
for (const item of REQUIRED) {
  const full = join(dist, item.path);
  if (!existsSync(full)) {
    missing.push(`${item.path} — MISSING`);
  } else if (statSync(full).size < item.minBytes) {
    missing.push(`${item.path} — present but only ${statSync(full).size} bytes (truncated?)`);
  }
}

if (missing.length > 0) {
  console.error('\nBUILD REFUSED — the artifact would ship with dead buttons:\n');
  for (const line of missing) console.error('  ✗ ' + line);
  console.error(
    '\nFix: node tools/fetch-model.mjs && node tools/fetch-tesseract-langs.mjs && npm install, then build again.\n',
  );
  process.exit(1);
}

console.log(`assert-assets: all ${REQUIRED.length} on-device assets present in dist ✓`);
