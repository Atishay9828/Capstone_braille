// Copies the assets Braillix must have available OFFLINE into public/.
//
// Why this exists: speech-rule-engine loads its locale data ("mathmaps") at runtime. In a browser
// it will happily reach for a CDN if we don't hand it a local path — and this app has to work in a
// room with no Wi-Fi. So we copy the four locale files we actually use into public/sre/mathmaps
// and point SRE at that path (see src/core/sre-service.ts).
//
// Runs automatically on `npm install`. Safe to run repeatedly. Never fails the install.

import { cp, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..');
const repoRoot = join(appRoot, '..');

/** The only locales Braillix uses: base + the Nemeth braille tables + English and Hindi speech. */
const LOCALES = ['base.json', 'nemeth.json', 'en.json', 'hi.json'];

/** node_modules may be hoisted to the workspace root or local to the app. Check both. */
function resolvePackageDir(pkg) {
  for (const root of [appRoot, repoRoot]) {
    const candidate = join(root, 'node_modules', pkg);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

async function copySreMathmaps() {
  const sreDir = resolvePackageDir('speech-rule-engine');
  if (!sreDir) return warn('speech-rule-engine not found — skipping mathmaps copy');

  const src = join(sreDir, 'lib', 'mathmaps');
  if (!existsSync(src)) return warn(`no mathmaps at ${src}`);

  const dest = join(appRoot, 'public', 'sre', 'mathmaps');
  await mkdir(dest, { recursive: true });

  let copied = 0;
  for (const file of LOCALES) {
    const from = join(src, file);
    if (!existsSync(from)) {
      warn(`locale ${file} missing from this speech-rule-engine build`);
      continue;
    }
    await cp(from, join(dest, file));
    copied += 1;
  }
  ok(`sre mathmaps: ${copied}/${LOCALES.length} locales -> public/sre/mathmaps`);
}

/**
 * Say, in a file, whether the handwriting model is installed.
 *
 * The app used to find out by fetching the model's own config and treating a 404 as "no". That
 * works, and it logs a console error on every load of every build that does not have the model —
 * including the public one, where it never will. An error in the console is a thing somebody has to
 * investigate, and this one had no bottom. So the answer is written down instead.
 */
async function writeModelStatus() {
  const dir = join(appRoot, 'public', 'models');
  await mkdir(dir, { recursive: true });
  const installed = existsSync(join(dir, 'formulanet', 'config.json'));
  await writeFile(join(dir, 'status.json'), JSON.stringify({ formulanet: installed }, null, 2), 'utf8');
  ok(`model status: formulanet ${installed ? 'installed' : 'not installed'}`);
}

async function copyOnnxRuntimeWasm() {
  // transformers.js ships the ONNX Runtime .wasm/.mjs files. Serving them from public/ instead of
  // a CDN is what makes on-device recognition work with the network unplugged.
  const tx = resolvePackageDir('@huggingface/transformers');
  if (!tx) return warn('@huggingface/transformers not found — skipping wasm copy');

  const candidates = [
    join(tx, 'dist'),
    join(tx, 'node_modules', 'onnxruntime-web', 'dist'),
  ];
  const ortRoot = resolvePackageDir('onnxruntime-web');
  if (ortRoot) candidates.push(join(ortRoot, 'dist'));

  const dest = join(appRoot, 'public', 'ort');
  await mkdir(dest, { recursive: true });

  /**
   * The `ort-wasm-simd-threaded` family, all of it.
   *
   * ONNX Runtime picks a variant at runtime and Transformers.js reaches for the **asyncify** build
   * in a worker. Copying only the plain one produced "no available backend found … failed to fetch
   * ort-wasm-simd-threaded.asyncify.mjs" — so take the whole family and let the runtime choose.
   * The `ort.*.mjs` bundles and the `transformers.node.*` files are deliberately left behind:
   * they are for Node, and shipping them would only bloat the app.
   */
  const WANTED = /^ort-wasm-simd-threaded[.\w-]*\.(wasm|mjs)$/;

  let copied = 0;
  for (const dir of candidates) {
    if (!existsSync(dir)) continue;
    for (const entry of await readdir(dir)) {
      if (!WANTED.test(entry)) continue;
      const from = join(dir, entry);
      if (!(await stat(from)).isFile()) continue;
      await cp(from, join(dest, entry));
      copied += 1;
    }
  }
  if (copied === 0) warn('no onnxruntime wasm files found — on-device recognition will need the network on first run');
  else ok(`onnxruntime assets: ${copied} files -> public/ort`);
}

const ok = (m) => console.log(`  [braillix] ${m}`);
const warn = (m) => console.log(`  [braillix] ! ${m}`);

try {
  await copySreMathmaps();
  await copyOnnxRuntimeWasm();
  await writeModelStatus();
} catch (err) {
  // Never break `npm install` over this — the app degrades observably instead (Law 3).
  warn(`asset copy incomplete: ${err?.message ?? err}`);
}
