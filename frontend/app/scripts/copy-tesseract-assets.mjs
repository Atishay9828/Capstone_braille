/**
 * Self-host the word-reading engine.
 *
 * Braillix must work with the Wi-Fi unplugged, so tesseract.js may not fetch its worker or its
 * WASM core from a CDN at runtime — the app serves them itself, like the SRE mathmaps and the
 * fonts. Runs from `postinstall`, so a fresh `npm install` always leaves the app servable.
 */

import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..');
const target = join(appRoot, 'public', 'tesseract');

/** node_modules may be the workspace's own or hoisted to the repo root. */
function locate(pkg) {
  for (const base of [join(appRoot, 'node_modules'), join(appRoot, '..', 'node_modules')]) {
    const candidate = join(base, pkg);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`${pkg} not found in node_modules — run npm install first`);
}

mkdirSync(target, { recursive: true });

cpSync(join(locate('tesseract.js'), 'dist', 'worker.min.js'), join(target, 'worker.min.js'));
cpSync(locate('tesseract.js-core'), join(target, 'core'), {
  recursive: true,
  // Only the engine files: the four core variants (.js / .wasm / .wasm.js) and package.json,
  // which tesseract.js reads to pick the right variant for the browser it finds itself in.
  filter: (src) => {
    const name = src.split(/[\\/]/).pop() ?? '';
    if (name === 'core' || name === 'tesseract.js-core') return true; // the directory itself
    return /\.(js|wasm)$/.test(name) || name === 'package.json';
  },
});

console.log('tesseract worker + core copied to app/public/tesseract');
