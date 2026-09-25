#!/usr/bin/env node
/**
 * Check the thing that is actually published, not the thing that was built.
 *
 * A local build passing proves the local build passes. Between it and a teacher there is an install
 * step, a build command, a set of headers and a CDN — and every one of those has a way of being
 * subtly wrong that no test on this laptop can see. So this fetches the live site and asserts the
 * few facts that would make it useless if they were false:
 *
 *   · the page is there, and it is Braillix
 *   · the service worker is there, is not cached forever, and precaches the Nemeth tables
 *   · the Nemeth tables themselves are there, and are the real ones
 *   · the manifest and icons are there, so it can be installed
 *   · the handwriting model is honestly reported as absent rather than 404-ing
 *
 *   node tools/check-deployed.mjs [url]
 */

const BASE = (process.argv[2] ?? 'https://braillix.vercel.app').replace(/\/$/, '');

let failures = 0;

function report(ok, what, detail = '') {
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok ' : '  FAIL'}  ${what}${detail ? ` — ${detail}` : ''}`);
}

async function get(path) {
  const response = await fetch(`${BASE}${path}`, { redirect: 'follow' });
  const text = response.ok ? await response.text() : '';
  return { response, text };
}

console.log(`Braillix — checking the deployed site at ${BASE}\n`);

try {
  const index = await get('/');
  report(index.response.ok, 'the page is served', `HTTP ${index.response.status}`);
  report(index.text.includes('Braillix'), 'it is Braillix');
  report(index.text.includes('manifest.webmanifest'), 'it declares a manifest');
  report(/<script[^>]+type="text\/x-sre-config"/.test(index.text), 'the maths engine is pointed at local tables');

  const sw = await get('/sw.js');
  report(sw.response.ok, 'the service worker is served');
  const cache = sw.response.headers.get('cache-control') ?? '';
  report(/no-cache|no-store|max-age=0/.test(cache), 'the service worker is not cached forever', cache || 'no header');
  report(sw.text.includes('sre/mathmaps/nemeth.json'), 'it precaches the Nemeth tables');
  report(sw.text.includes('ignoreVary'), 'it matches the cache ignoring Vary');

  const nemeth = await get('/sre/mathmaps/nemeth.json');
  report(nemeth.response.ok, 'the Nemeth tables are served');
  report(nemeth.text.length > 50_000, 'they are the real ones', `${Math.round(nemeth.text.length / 1024)} KB`);

  const manifest = await get('/manifest.webmanifest');
  report(manifest.response.ok, 'the manifest is served');
  let icons = [];
  try {
    icons = JSON.parse(manifest.text).icons ?? [];
  } catch {
    /* reported below */
  }
  report(icons.length >= 2, 'the manifest lists icons', `${icons.length}`);
  for (const icon of icons.slice(0, 2)) {
    const asset = await fetch(`${BASE}/${String(icon.src).replace(/^\.?\//, '')}`);
    report(asset.ok, `icon ${icon.src} is served`, `HTTP ${asset.status}`);
  }

  // v2 policy — REVERSED from v1, which died of exactly this: the recognition assets SHIP.
  // A deployed Braillix whose scan buttons cannot work is a defective artifact, full stop.
  const status = await get('/models/status.json');
  report(status.response.ok, 'the model status file is served');
  report(status.text.includes('"formulanet": true'), 'and it says the model is installed', status.text.trim());

  const model = await fetch(`${BASE}/models/formulanet/config.json`);
  report(model.ok, 'the formula model ships with the build', `HTTP ${model.status}`);
  const encoder = await fetch(`${BASE}/models/formulanet/onnx/encoder_model.onnx`, { method: 'HEAD' });
  report(encoder.ok, 'the encoder weights are served', `HTTP ${encoder.status}`);

  const tessWorker = await fetch(`${BASE}/tesseract/worker.min.js`, { method: 'HEAD' });
  report(tessWorker.ok, 'the word-reading worker is served', `HTTP ${tessWorker.status}`);
  for (const lang of ['eng', 'hin']) {
    const data = await fetch(`${BASE}/tesseract/lang/${lang}.traineddata.gz`, { method: 'HEAD' });
    report(data.ok, `the ${lang} language file is served`, `HTTP ${data.status}`);
  }
} catch (error) {
  failures += 1;
  console.log(`  FAIL  could not reach the site — ${error instanceof Error ? error.message : String(error)}`);
}

console.log(failures === 0 ? '\nThe deployed site is what it claims to be.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
