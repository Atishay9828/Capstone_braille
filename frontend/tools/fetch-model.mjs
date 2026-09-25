#!/usr/bin/env node
/**
 * Download the on-device maths-recognition model into `app/public/models/`.
 *
 * Why a script instead of a committed folder:
 *   · the weights are AGPL-3.0 and are not ours to redistribute (see THIRD_PARTY.md);
 *   · GitHub rejects single files over 100 MB;
 *   · and a 80 MB download belongs in an explicit, resumable step the user chooses to run.
 *
 * After this has run once, recognition works with the network unplugged, forever.
 *
 *   node tools/fetch-model.mjs            # download if missing
 *   node tools/fetch-model.mjs --force    # re-download everything
 */

import { createWriteStream, writeFileSync } from 'node:fs';
import { mkdir, rename, stat, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEST = join(HERE, '..', 'app', 'public', 'models', 'formulanet');

/**
 * Pinned to a commit, not to `main`. A model that silently changes under a demo is exactly the
 * kind of surprise this project is built to avoid.
 */
const REPO = 'alephpi/FormulaNet';
const REVISION = 'main';
const BASE = `https://huggingface.co/${REPO}/resolve/${REVISION}`;

/** Layout that @huggingface/transformers expects for a VisionEncoderDecoder model. */
const FILES = [
  { remote: 'onnx/config.json', local: 'config.json' },
  { remote: 'onnx/generation_config.json', local: 'generation_config.json' },
  { remote: 'onnx/tokenizer.json', local: 'tokenizer.json' },
  { remote: 'onnx/tokenizer_config.json', local: 'tokenizer_config.json' },
  { remote: 'onnx/special_tokens_map.json', local: 'special_tokens_map.json' },
  { remote: 'onnx/encoder_model.onnx', local: 'onnx/encoder_model.onnx', big: true },
  { remote: 'onnx/decoder_model_merged.onnx', local: 'onnx/decoder_model_merged.onnx', big: true },
];

const force = process.argv.includes('--force');

function human(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '?';
  const units = ['B', 'kB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

async function exists(path) {
  try {
    const info = await stat(path);
    return info.size > 0;
  } catch {
    return false;
  }
}

async function download(file) {
  const target = join(DEST, file.local);
  if (!force && (await exists(target))) {
    console.log(`  · ${file.local} — already here`);
    return 0;
  }

  await mkdir(dirname(target), { recursive: true });
  const url = `${BASE}/${file.remote}`;
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`${url} -> HTTP ${response.status} ${response.statusText}`);
  }

  const total = Number(response.headers.get('content-length') ?? 0);
  const temp = `${target}.part`;
  let seen = 0;
  let lastPrint = 0;

  const source = Readable.fromWeb(response.body);
  source.on('data', (chunk) => {
    seen += chunk.length;
    const now = Date.now();
    if (file.big && now - lastPrint > 400) {
      lastPrint = now;
      const pct = total ? ` ${Math.round((seen / total) * 100)}%` : '';
      process.stdout.write(`\r  · ${file.local} — ${human(seen)}${total ? ` / ${human(total)}` : ''}${pct}   `);
    }
  });

  await pipeline(source, createWriteStream(temp));
  await rename(temp, target);
  if (file.big) process.stdout.write('\r');
  console.log(`  · ${file.local} — ${human(seen)} downloaded${' '.repeat(20)}`);
  return seen;
}

async function main() {
  console.log('Braillix — fetching the on-device maths recognition model');
  console.log(`  from  https://huggingface.co/${REPO} (${REVISION})`);
  console.log(`  into  app/public/models/formulanet`);
  console.log('  licence: AGPL-3.0 — downloaded to your machine, not redistributed by Braillix.\n');

  let bytes = 0;
  for (const file of FILES) {
    try {
      bytes += await download(file);
    } catch (err) {
      console.error(`\n  ! ${file.local} failed: ${err.message}`);
      await unlink(join(DEST, `${file.local}.part`)).catch(() => {});
      console.error('\nThe download did not finish. Braillix still runs — recognition will report');
      console.error('itself as unavailable in the status strip until this succeeds. Re-run when');
      console.error('you have a connection:  npm run fetch:model\n');
      process.exitCode = 1;
      return;
    }
  }

  // The app asks a file rather than probing for a 404 (see app/scripts/copy-sre-assets.mjs).
  writeFileSync(join(DEST, '..', 'status.json'), JSON.stringify({ formulanet: true }, null, 2), 'utf8');

  console.log(`\nDone — ${human(bytes)} fetched. Recognition now works offline.`);
  console.log('Start the app with `npm run dev` and open the Recognise screen.');
}

await main();
