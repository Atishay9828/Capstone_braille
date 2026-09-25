/**
 * Fetch the word-reading language files — once.
 *
 * English and Hindi traineddata for Tesseract, from the official tessdata_fast repository
 * (the models tesseract.js itself defaults to), stored gzipped in app/public/tesseract/lang/
 * so the app serves them from its own origin, offline forever after.
 *
 * Sibling of tools/fetch-model.mjs, and run by the same build pipeline: a deployed Braillix
 * with the scan button but not the models is the exact defect that killed v1 — so the build
 * asserts these files exist (app/scripts/assert-assets.mjs) rather than hoping.
 */

import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, '..', 'app', 'public', 'tesseract', 'lang');
mkdirSync(target, { recursive: true });

const BASE = 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main';
const LANGS = ['eng', 'hin'];

for (const lang of LANGS) {
  const file = join(target, `${lang}.traineddata.gz`);
  if (existsSync(file) && statSync(file).size > 100_000) {
    console.log(`${lang}: already here (${(statSync(file).size / 1e6).toFixed(1)} MB)`);
    continue;
  }
  const url = `${BASE}/${lang}.traineddata`;
  console.log(`fetching ${url} …`);
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`${lang}: HTTP ${response.status}`);
  // tesseract.js unpacks .gz itself; gzip on the way down to keep the repo/deploy small.
  const { createGzip } = await import('node:zlib');
  await pipeline(Readable.fromWeb(response.body), createGzip({ level: 9 }), createWriteStream(file));
  console.log(`${lang}: ${(statSync(file).size / 1e6).toFixed(1)} MB gzipped`);
}

console.log('word-reading languages ready:', target);
