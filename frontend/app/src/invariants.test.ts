/**
 * Invariants that are enforced structurally rather than by discipline.
 *
 * These read the source tree. They exist because the two rules they police are exactly the kind
 * that quietly rot: someone in a hurry writes `cellCount: 4` in a component, and six months later
 * the display silently truncates on a 20-cell rig. A test that greps is not elegant, but it is the
 * only thing that actually holds this line.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '.');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const FILES = sourceFiles(SRC).map((f) => ({
  path: relative(SRC, f).split(sep).join('/'),
  text: readFileSync(f, 'utf8'),
}));

describe('Law 1 — the cell count is discovered, never known', () => {
  it('finds source files to check (guards against the check silently passing on nothing)', () => {
    expect(FILES.length).toBeGreaterThan(5);
  });

  it('has no file outside the authority that writes a cell count as a literal', () => {
    // `config.ts` holds the one named simulator default; `core/profile.ts` IS the authority and is
    // allowed to talk about cell counts freely. Everywhere else, a numeric literal here means
    // somebody assumed a display size.
    const authority = new Set(['config.ts', 'core/profile.ts']);
    // Matches `cellCount: 4`, `cellCount = 4` and `simulatedProfile(4)` — but not a ternary's `: 0`,
    // which is why the property form requires a preceding word boundary and no `?` on the line.
    const pattern = /(?:^|[^?\w.])cellCount\s*[:=]\s*\d+|simulatedProfile\s*\(\s*\d+/m;
    // Two-sided honesty: prove the guard actually catches an offender before trusting it to
    // report none. A guard that can only ever pass is not a guard.
    expect(pattern.test('const p = { cellCount: 4 };'), 'guard fails to catch an obvious offender').toBe(true);
    expect(pattern.test('simulatedProfile(8)'), 'guard fails to catch a literal profile').toBe(true);
    expect(pattern.test('return profile.cellCount ? a : 0;'), 'guard misfires on a ternary').toBe(false);

    const offenders = FILES.filter((f) => !authority.has(f.path) && pattern.test(f.text)).map((f) => f.path);
    expect(offenders, `cell counts must come from config.ts or a transport, not from: ${offenders.join(', ')}`).toEqual(
      [],
    );
  });

  it('keeps the simulator default in config.ts, named', () => {
    const config = FILES.find((f) => f.path === 'config.ts');
    expect(config).toBeDefined();
    expect(config!.text).toMatch(/export const DEFAULT_SIMULATED_CELLS\s*=\s*\d+/);
  });

  it('never assumes a width by slicing to a constant', () => {
    // e.g. `.slice(0, 4)` on a cell run — the classic way a hardcoded width sneaks back in.
    const offenders = FILES.filter((f) => /cells[\s\S]{0,40}\.slice\(\s*0\s*,\s*\d+\s*\)/.test(f.text)).map(
      (f) => f.path,
    );
    expect(offenders).toEqual([]);
  });
});

describe('Law 2 — hardware bit arithmetic lives in exactly one place', () => {
  it('keeps dot<->cam bit shifting out of the UI and transports', () => {
    const allowed = new Set(['core/profile.ts', 'core/braille.ts', 'core/scheduler.ts']);
    const offenders = FILES.filter((f) => !allowed.has(f.path) && /<<\s*\(?\s*(?:dot|bit|i)\b/.test(f.text)).map(
      (f) => f.path,
    );
    expect(offenders, 'use profile.toCam()/fromCam() instead of shifting bits inline').toEqual([]);
  });
});

describe('bundle hygiene — Node-only backends must never reach the browser', () => {
  it('never imports the Node ONNX runtime or sharp', () => {
    const offenders = FILES.filter((f) => /from\s+'(onnxruntime-node|sharp)'/.test(f.text)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });
});

describe('Law 3 — nothing degrades silently', () => {
  it('every capability id has a name the interface can show, in both languages', () => {
    const store = FILES.find((f) => f.path === 'store.ts');
    expect(store, 'store.ts should exist').toBeDefined();
    const union = /export type CapabilityId =([^;]+);/.exec(store!.text);
    expect(union, 'CapabilityId union should exist').toBeTruthy();
    const ids = [...union![1].matchAll(/'([a-z]+)'/g)].map((match) => match[1]);
    expect(ids.length).toBeGreaterThan(0);

    const strip = FILES.find((f) => f.path === 'ui/StatusStrip.tsx');
    const i18n = FILES.find((f) => f.path === 'ui/i18n.ts');
    for (const id of ids) {
      expect(strip!.text, `capability "${id}" is not named in the status strip`).toContain(`${id}: 'cap.`);
      expect(i18n!.text, `capability "${id}" has no translated name`).toContain(`'cap.${id}'`);
    }
  });
});
