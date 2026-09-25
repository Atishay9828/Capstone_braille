// Find exports nothing else references — dead weight in a repo a panel might browse.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const files = walk(process.argv[2] ?? 'app/src');
const all = files.map((f) => ({ f, t: readFileSync(f, 'utf8') }));
const sources = files.filter((f) => !/\.test\./.test(f));

const dead = [];
for (const f of sources) {
  const text = readFileSync(f, 'utf8');
  const names = [...text.matchAll(/^export (?:async )?(?:function|const|class) (\w+)/gm)].map((m) => m[1]);
  for (const name of names) {
    const used = all.some((o) => o.f !== f && new RegExp(`\\b${name}\\b`).test(o.t));
    if (!used) dead.push(`${relative('src', f).split('\\').join('/')} :: ${name}`);
  }
}

console.log(dead.length ? dead.join('\n') : 'no unused exports');
