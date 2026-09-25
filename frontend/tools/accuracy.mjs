/**
 * `npm run accuracy` — walk the whole school syllabus and write down what came out.
 *
 * This exists because "the translation is accurate" is a claim, and a claim without evidence is a
 * slogan. It runs the same code that drives the display over every line in `src/core/syllabus.ts`
 * and writes `docs/ACCURACY.md`, so anyone with a published Nemeth table can check a cell without
 * installing anything or trusting us.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, '..', 'app');
const report = join(here, '..', 'docs', 'ACCURACY.md');

const child = spawn('npx', ['vitest', 'run', 'src/core/syllabus.test.ts', '--reporter=dot'], {
  cwd: appDir,
  env: { ...process.env, BRAILLIX_WRITE_ACCURACY: '1' },
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', (code) => {
  if (code !== 0) {
    console.error('\nSome syllabus lines did not translate. docs/ACCURACY.md was not updated.');
    process.exit(code ?? 1);
  }
  const text = readFileSync(report, 'utf8');
  const summary = text.split('\n').find((line) => line.startsWith('**')) ?? '';
  console.log(`\ndocs/ACCURACY.md written.\n${summary.replace(/\*\*/g, '')}`);
});
