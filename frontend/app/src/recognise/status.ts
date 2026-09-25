/**
 * Is the handwriting model installed on this machine?
 *
 * It asks a file that is always there — `public/models/status.json`, written by `npm install` and
 * rewritten by `npm run fetch:model` — rather than asking for the model's own config and reading a
 * 404 as "no". Both answer the question; only one of them logs a console error on every load of
 * every build that will never have the model, which is what the public one is.
 *
 * A missing status file means an install older than this check, and the honest answer to "is it
 * there" when we cannot tell is no.
 */

import { LOCAL_MODEL_PATH } from '../config';

export interface ModelStatus {
  readonly installed: boolean;
  /** Present when we could not tell, for the badge to show. */
  readonly reason?: string;
}

function absolute(path: string): string {
  return new URL(path, document.baseURI).href;
}

export async function modelStatus(): Promise<ModelStatus> {
  try {
    const response = await fetch(absolute(`${LOCAL_MODEL_PATH}status.json`));
    if (!response.ok) return { installed: false, reason: 'no model status file' };
    const text = await response.text();
    // A dev server happily returns index.html for a missing file; check it is really JSON.
    if (!text.trimStart().startsWith('{')) return { installed: false, reason: 'no model status file' };
    const parsed = JSON.parse(text) as { formulanet?: unknown };
    return { installed: parsed.formulanet === true };
  } catch (error) {
    return { installed: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
